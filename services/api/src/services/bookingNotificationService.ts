import { prisma } from '../lib/prisma';
import { User } from '../models/User';
import { emailService } from './emailService';
import { smsService } from './smsService';
import { getSiteSettings } from './siteSettingsService';
import { logger } from '../utils/logger';

function getFrontendBase() {
  return process.env.FRONTEND_URL || 'https://tripe.sbpgm.com';
}

export async function sendBookingConfirmationNotifications(params: {
  bookingId: string;
  userName: string;
  userEmail?: string;
  userPhone?: string;
  tripTitle: string;
  tripDestination: string;
  tripStartDate: Date;
  totalAmount: number;
}) {
  const settings = await getSiteSettings();
  const dashboardUrl = `${getFrontendBase()}/my-bookings`;

  if (settings.notifications?.emailEnabled && params.userEmail) {
    await emailService.sendEmail({
      to: params.userEmail,
      subject: `Booking confirmed: ${params.tripTitle}`,
      html: `
        <p>Hello ${params.userName},</p>
        <p>Your trip booking is confirmed.</p>
        <p><strong>${params.tripTitle}</strong> — ${params.tripDestination}</p>
        <p>Start: ${new Date(params.tripStartDate).toLocaleDateString('en-IN')}</p>
        <p>Amount: INR ${params.totalAmount.toLocaleString('en-IN')}</p>
        <p>You can download invoice/receipt from your bookings page.</p>
        <p><a href="${dashboardUrl}">Open My Bookings</a></p>
      `
    });
  }

  if (settings.notifications?.smsEnabled && params.userPhone) {
    await smsService.sendMessage(
      params.userPhone,
      `Booking confirmed for ${params.tripTitle}. Amount INR ${params.totalAmount}. Track details in My Bookings: ${dashboardUrl}`
    );
  }
}

export async function send24HourTripReminders(): Promise<{ processed: number; notified: number }> {
  const settings = await getSiteSettings();
  const reminderHours = settings.notifications?.tripReminderHours || 24;
  const now = new Date();

  // Send reminders for trips starting roughly in the next hour around the configured reminder hour.
  const windowStart = new Date(now.getTime() + Math.max(reminderHours - 1, 0) * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + reminderHours * 60 * 60 * 1000 + 15 * 60 * 1000);

  const trips = await prisma.trip.findMany({
    where: { startDate: { gte: windowStart, lte: windowEnd } },
    select: { id: true, title: true, destination: true, startDate: true }
  });

  if (trips.length === 0) {
    return { processed: 0, notified: 0 };
  }

  const tripById = new Map(trips.map(t => [t.id, t]));
  const tripIds = trips.map(t => t.id);

  // reminders was a nested object, and "not sent yet" was two conditions
  // because a nested object might be absent entirely. It is one nullable
  // column, so it is one condition.
  const bookings = await prisma.groupBooking.findMany({
    where: {
      tripId: { in: tripIds },
      bookingStatus: 'confirmed',
      paymentStatus: { in: ['completed', 'partial'] },
      tripStart24hSentAt: null
    }
  });

  // populate('mainBookerId') is gone - User is still a Mongo document - so the
  // bookers are fetched once for the batch rather than once per booking.
  const bookerIds = Array.from(new Set(bookings.map(b => b.mainBookerId)));
  const bookers = bookerIds.length
    ? await User.find({ _id: { $in: bookerIds } }, 'name email phone preferences').lean()
    : [];
  const bookerById = new Map(bookers.map((u: any) => [u._id.toString(), u]));

  let notified = 0;
  for (const booking of bookings as any[]) {
    try {
      const user = bookerById.get(booking.mainBookerId);
      const trip = tripById.get(booking.tripId);
      if (!user || !trip) continue;

      const wantsEmail = user?.preferences?.notifications?.email !== false;
      const wantsSms = !!user?.preferences?.notifications?.sms;

      const subject = `Reminder: ${trip.title} starts in about ${reminderHours} hours`;
      const html = `
        <p>Hello ${user.name || 'Traveler'},</p>
        <p>Your trip <strong>${trip.title}</strong> starts soon.</p>
        <p>Destination: ${trip.destination}</p>
        <p>Start: ${new Date(trip.startDate).toLocaleString('en-IN')}</p>
        <p>Please keep your essentials and documents ready.</p>
      `;

      if (settings.notifications?.emailEnabled && wantsEmail && user.email) {
        await emailService.sendEmail({ to: user.email, subject, html });
      }

      if (settings.notifications?.smsEnabled && wantsSms && user.phone) {
        await smsService.sendMessage(
          user.phone,
          `Reminder: ${trip.title} starts soon (${new Date(trip.startDate).toLocaleString('en-IN')}). Keep your essentials ready.`
        );
      }

      // Only mark it sent if no other run got there first. The set-and-save
      // this replaces would happily send a second reminder to anyone whose
      // booking two workers picked up together.
      const marked = await prisma.groupBooking.updateMany({
        where: { id: booking.id, tripStart24hSentAt: null },
        data: { tripStart24hSentAt: new Date() }
      });
      if (marked.count > 0) notified += 1;
    } catch (error: any) {
      logger.error('Failed to send trip reminder', { bookingId: booking.id, error: error.message });
    }
  }

  logger.info('Trip reminder job completed', {
    reminderHours,
    scannedTrips: trips.length,
    processedBookings: bookings.length,
    notified
  });

  return { processed: bookings.length, notified };
}

