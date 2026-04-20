import { Follow } from '../models/Follow';
import { User } from '../models/User';
import { emailService } from './emailService';
import { smsService } from './smsService';
import { getSiteSettings } from './siteSettingsService';
import { logger } from '../utils/logger';

export async function notifyFollowersOnNewTrip(params: {
  tripId: string;
  organizerId: string;
  tripTitle: string;
  destination: string;
  startDate: Date;
}) {
  try {
    const settings = await getSiteSettings();
    if (!settings.notifications?.sendFollowerTripAlerts) {
      return;
    }

    const [organizer, follows] = await Promise.all([
      User.findById(params.organizerId).select('name').lean(),
      Follow.find({ followingId: params.organizerId }).select('followerId').lean()
    ]);

    if (!organizer || follows.length === 0) {
      return;
    }

    const followerIds = follows.map((f: any) => f.followerId);
    const followers = await User.find({ _id: { $in: followerIds } })
      .select('name email phone preferences')
      .lean();

    const frontend = process.env.FRONTEND_URL || 'https://tripe.sbpgm.com';
    const tripUrl = `${frontend}/trip/${params.tripId}`;

    await Promise.allSettled(followers.map(async (follower: any) => {
      const wantsEmail = follower?.preferences?.notifications?.email !== false;
      const wantsSms = !!follower?.preferences?.notifications?.sms;

      const subject = `New trip by ${organizer.name}: ${params.tripTitle}`;
      const html = `
        <p>Hello ${follower.name || 'Traveler'},</p>
        <p><strong>${organizer.name}</strong> just published a new trip:</p>
        <p><strong>${params.tripTitle}</strong> — ${params.destination}</p>
        <p>Start Date: ${new Date(params.startDate).toLocaleDateString('en-IN')}</p>
        <p>If you do not want to miss it, book now.</p>
        <p><a href="${tripUrl}">View Trip</a></p>
      `;

      if (settings.notifications?.emailEnabled && wantsEmail && follower.email) {
        await emailService.sendEmail({ to: follower.email, subject, html });
      }

      if (settings.notifications?.smsEnabled && wantsSms && follower.phone) {
        await smsService.sendMessage(
          follower.phone,
          `${organizer.name} added a new trip: ${params.tripTitle}. ${params.destination}. Book now: ${tripUrl}`
        );
      }
    }));

    logger.info('Follower notifications processed for new trip', {
      tripId: params.tripId,
      organizerId: params.organizerId,
      followerCount: followers.length
    });
  } catch (error: any) {
    logger.error('Failed to notify followers for new trip', {
      error: error.message,
      tripId: params.tripId,
      organizerId: params.organizerId
    });
  }
}

