import { GroupBooking } from '../models/GroupBooking';
import { Trip } from '../models/Trip';
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

  const trips = await Trip.find({
    startDate: { $gte: windowStart, $lte: windowEnd }
  }).select('_id title destination startDate').lean();

  if (trips.length === 0) {
    return { processed: 0, notified: 0 };
  }

  const tripById = new Map(trips.map((t: any) => [String(t._id), t]));
  const tripIds = trips.map((t: any) => t._id);

  const bookings = await GroupBooking.find({
    tripId: { $in: tripIds },
    bookingStatus: 'confirmed',
    paymentStatus: { $in: ['completed', 'partial'] },
    $or: [
      { 'reminders.tripStart24hSentAt': { $exists: false } },
      { 'reminders.tripStart24hSentAt': null }
    ]
  }).populate('mainBookerId', 'name email phone preferences');

  let notified = 0;
  for (const booking of bookings as any[]) {
    try {
      const user = booking.mainBookerId;
      const trip = tripById.get(String(booking.tripId));
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

      booking.set('reminders.tripStart24hSentAt', new Date());
      await booking.save();
      notified += 1;
    } catch (error: any) {
      logger.error('Failed to send trip reminder', { bookingId: booking._id, error: error.message });
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

