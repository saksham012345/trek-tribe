/**
 * Admin Service
 *
 * All business logic extracted from routes/admin.ts.
 * No req/res objects — pure data in, data out.
 */

import { UserPrisma as User } from '../../models/userPrismaAdapter';
import { shapeTrip, shapeTrips } from '../../services/tripShapeService';
import { prisma } from '../../lib/prisma';
import { upsertRacingSafely } from '../../lib/upsert';
import { toNumber } from '../../lib/money';


import { ensureTrialSubscription, decorate, tripsRemaining } from '../../services/organizerSubscriptionService';

import { logger } from '../../utils/logger';
import { emailService } from '../../services/emailService';

import TrustScoreService from '../../services/trustScoreService';
import { emailQueue } from '../../services/emailQueueService';

/**
 * Attach the organizer that .populate('organizerId') supplied.
 *
 * Trips are Postgres rows; users are still Mongo documents, so this is a second
 * query for the page rather than a join.
 */
async function tripsWithOrganizers(rows: any[], select: string): Promise<any[]> {
  const present = rows.filter(Boolean);
  if (present.length === 0) return [];
  const ids = Array.from(new Set(present.map(r => r.organizerId)));
  const users = await User.find({ _id: { $in: ids } }, select).lean();
  const byId = new Map<string, any>(users.map((u: any) => [u._id.toString(), u]));
  return present.map(row => {
    const trip = shapeTrip(row);
    trip.organizerId = byId.get(row.organizerId) ?? row.organizerId;
    return trip;
  });
}

// ─── Dashboard stats ──────────────────────────────────────────────────────────

export async function getDashboardStats() {
  const [totalUsers, totalTrips, totalReviews, totalWishlists, totalTickets, activeSubscriptions] =
    await Promise.all([
      User.countDocuments(),
      prisma.trip.count(),
      prisma.review.count(),
      prisma.wishlist.count(),
      prisma.supportTicket.count(),
      prisma.cRMSubscription.count({ where: { status: 'active' } }),
    ]);

  // Was a Mongo pipeline; the same query now has one name and one definition.
  const usersByRole = await User.groupByRole();

  const tripStatusGroups = await prisma.trip.groupBy({
    by: ['status'],
    _count: { status: true },
  });
  const tripsByStatus = tripStatusGroups.map(g => ({ status: g.status, count: g._count.status }));

  // Was every trip loaded with its participants array so two totals could be
  // summed in JavaScript. It is one statement.
  //
  // "Revenue" here is participants times list price, which is not what anyone
  // was actually charged - group discounts and packages both change it. That is
  // what it has always computed, and it is left alone: correcting it is a
  // reporting decision, not a migration one.
  const [tripTotals] = await prisma.$queryRawUnsafe<Array<{ bookings: bigint; revenue: number }>>(
    'SELECT count(p.id) AS bookings, COALESCE(sum(t.price), 0)::float8 AS revenue FROM trips t LEFT JOIN trip_participants p ON p.trip_id = t.id'
  );
  const totalBookings = Number(tripTotals?.bookings ?? 0);
  const totalTripRevenue = Number(tripTotals?.revenue ?? 0);

  // This loaded every subscription and summed a virtual in JavaScript. The sum
  // is a sum of the completed payment rows, which the database can do.
  //
  // "This month" meant subscriptions created this month, and counted all of
  // their payments toward it - so a renewal on a year-old subscription
  // contributed nothing to any month. It is the month the payment was made now,
  // which is what a monthly revenue figure means.
  const currentDate = new Date();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);

  const [totalSubscriptionCount, totalRevenueAgg, monthRevenueAgg] = await Promise.all([
    prisma.cRMSubscription.count(),
    prisma.cRMSubscriptionPayment.aggregate({
      where: { status: 'completed' },
      _sum: { amount: true },
    }),
    prisma.cRMSubscriptionPayment.aggregate({
      where: { status: 'completed', paidAt: { gte: firstDayOfMonth } },
      _sum: { amount: true },
    }),
  ]);

  const totalSubscriptionRevenue = toNumber(totalRevenueAgg._sum.amount);
  const thisMonthSubscriptionRevenue = toNumber(monthRevenueAgg._sum.amount);

  // `{ $sum: '$totalPaid' }` summed a field that does not exist: totalPaid is a
  // Mongoose virtual, and an aggregation pipeline never sees virtuals. Revenue
  // per plan has therefore always been zero on the admin dashboard. The join
  // below is what the query was reaching for.
  const subscriptionsByPlan = await prisma.$queryRaw<Array<{
    plan: string; count: number; revenue: number;
  }>>`
    SELECT s.plan_type::text AS plan,
           COUNT(DISTINCT s.id)::int AS count,
           COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'completed'), 0)::float8 AS revenue
      FROM crm_subscriptions s
      LEFT JOIN crm_subscription_payments p ON p.subscription_id = s.id
     GROUP BY s.plan_type
  `;

  const ticketGroups = await prisma.supportTicket.groupBy({
    by: ['status'],
    _count: { status: true }
  });
  const ticketsByStatus = ticketGroups.map(g => ({ status: g.status, count: g._count.status }));

  const recentUsers = await User.find({}, 'name email role createdAt')
    .sort({ createdAt: -1 })
    .limit(5)
    .select('-passwordHash');

  const recentTrips = await tripsWithOrganizers(
    await prisma.trip.findMany({ orderBy: { createdAt: 'desc' }, take: 5 }),
    'name'
  );

  const totalRevenue = totalTripRevenue + totalSubscriptionRevenue;

  return {
    overview: { totalUsers, totalTrips, totalBookings, totalRevenue, totalReviews, totalWishlists, totalTickets, activeSubscriptions },
    users: {
      total: totalUsers,
      byRole: usersByRole,
      organizers: usersByRole.find((r: any) => r.role === 'organizer')?.count || 0,
      agents: usersByRole.find((r: any) => r.role === 'agent')?.count || 0,
      recentUsers,
    },
    trips: { total: totalTrips, byStatus: tripsByStatus, recentTrips, totalBookings, totalRevenue: totalTripRevenue },
    subscriptions: {
      total: totalSubscriptionCount,
      active: activeSubscriptions,
      byPlan: subscriptionsByPlan,
      revenue: { total: totalSubscriptionRevenue, thisMonth: thisMonthSubscriptionRevenue },
    },
    tickets: {
      total: totalTickets,
      byStatus: ticketsByStatus,
      open: ticketsByStatus.find((t: any) => t.status === 'open')?.count || 0,
      inProgress: ticketsByStatus.find((t: any) => t.status === 'in-progress')?.count || 0,
      resolved: ticketsByStatus.find((t: any) => t.status === 'resolved')?.count || 0,
    },
  };
}

// ─── User stats ───────────────────────────────────────────────────────────────

export async function getUserStats() {
  const totalUsers = await User.countDocuments();
  // Was a Mongo pipeline; the same query now has one name and one definition.
  const usersByRole = await User.groupByRole();
  const recentUsers = await User.find({}, 'name email role createdAt')
    .sort({ createdAt: -1 })
    .limit(10)
    .select('-passwordHash');
  return { total: totalUsers, byRole: usersByRole, recentUsers };
}

// ─── Trip stats ───────────────────────────────────────────────────────────────

export async function getTripStats() {
  const [totalTrips, statusGroups, recentTripRows, [totals]] = await Promise.all([
    prisma.trip.count(),
    prisma.trip.groupBy({ by: ['status'], _count: { status: true } }),
    prisma.trip.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { participants: { select: { userId: true } } },
    }),
    // Same participants-times-list-price total as the dashboard, and the same
    // note applies: it is not what anyone paid, and that is pre-existing.
    prisma.$queryRawUnsafe<Array<{ bookings: bigint; revenue: number }>>(
      'SELECT count(p.id) AS bookings, COALESCE(sum(t.price), 0)::float8 AS revenue FROM trips t LEFT JOIN trip_participants p ON p.trip_id = t.id'
    ),
  ]);

  const tripsByStatus = statusGroups.map(g => ({ status: g.status, count: g._count.status }));
  const recentTrips = await tripsWithOrganizers(recentTripRows, 'name email');
  const totalBookings = Number(totals?.bookings ?? 0);
  const totalRevenue = Number(totals?.revenue ?? 0);

  return { total: totalTrips, byStatus: tripsByStatus, recentTrips, totalBookings, totalRevenue };
}

// ─── Users list ───────────────────────────────────────────────────────────────

export async function listUsers(page: number, limit: number, search: string, role?: string) {
  const query: any = {};
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
  }
  if (role && role !== 'all') query.role = role;

  const total = await User.countDocuments(query);
  const users = await User.find(query)
    .select('-passwordHash')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  return { users, pagination: { current: page, pages: Math.ceil(total / limit), total } };
}

// ─── User contacts ────────────────────────────────────────────────────────────

export async function listUserContacts(adminId: string, page: number, limit: number, search: string, role?: string) {
  const query: any = {};
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
    ];
  }
  if (role && role !== 'all') query.role = role;

  const total = await User.countDocuments(query);
  const users = await User.find(query, {
    name: 1, email: 1, phone: 1, role: 1, isVerified: 1,
    location: 1, dateOfBirth: 1, emergencyContact: 1, createdAt: 1, lastActive: 1,
  })
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  logger.info('Admin accessed user contact information', { adminId, userCount: users.length, searchQuery: search, timestamp: new Date() });

  return {
    users,
    pagination: { current: page, pages: Math.ceil(total / limit), total },
    warning: 'This endpoint contains sensitive user data. Access is logged and monitored.',
  };
}

export async function getUserContact(adminId: string, userId: string) {
  const user = await User.findById(userId, {
    name: 1, email: 1, phone: 1, role: 1, location: 1,
    dateOfBirth: 1, emergencyContact: 1, privacySettings: 1, createdAt: 1, lastActive: 1, isVerified: 1,
  });
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });

  logger.info('Admin accessed individual user contact information', { adminId, targetUserId: userId, targetUserEmail: user.email, timestamp: new Date() });

  return { user, warning: 'This data contains sensitive user information. Access is logged and monitored.' };
}

export async function exportUserContacts(adminId: string, role?: string) {
  const query: any = {};
  if (role && role !== 'all') query.role = role;

  const users = await User.find(query, {
    name: 1, email: 1, phone: 1, role: 1, location: 1, createdAt: 1, lastActive: 1, isVerified: 1,
  }).sort({ createdAt: -1 });

  const csvHeader = 'Name,Email,Phone,Role,Location,Verified,Created At,Last Active\n';
  const csvRows = users.map((user) =>
    [
      `"${user.name || ''}",`,
      `"${user.email || ''}",`,
      `"${user.phone || ''}",`,
      `"${user.role || ''}",`,
      `"${user.location || ''}",`,
      `"${user.isVerified ? 'Yes' : 'No'}",`,
      `"${user.createdAt ? new Date(user.createdAt).toISOString() : ''}",`,
      `"${user.lastActive ? new Date(user.lastActive).toISOString() : ''}"`,
    ].join('')
  ).join('\n');

  logger.warn('Admin exported user contact data', { adminId, userCount: users.length, roleFilter: role, timestamp: new Date() });

  return { csv: csvHeader + csvRows, filename: `trek-tribe-users-${new Date().toISOString().split('T')[0]}.csv` };
}

// ─── Update user role ─────────────────────────────────────────────────────────

export async function updateUserRole(adminId: string, userId: string, role: string) {
  if (!['traveler', 'organizer', 'admin', 'agent'].includes(role)) {
    throw Object.assign(new Error('Invalid role'), { status: 400 });
  }
  const user = await User.findByIdAndUpdate(userId, { role }, { new: true }).select('-passwordHash');
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
  logger.info('User role updated', { adminId, userId, newRole: role });
  return { message: 'User role updated successfully', user };
}

// ─── Delete user ──────────────────────────────────────────────────────────────

export async function deleteUser(adminId: string, userId: string) {
  if (userId === adminId) throw Object.assign(new Error('Cannot delete your own account'), { status: 400 });

  const user = await User.findById(userId);
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });

  await Promise.all([
    prisma.review.deleteMany({ where: { reviewerId: String(userId) } }),
    prisma.wishlist.deleteMany({ where: { userId: String(userId) } }),
    // Was $pull from an ObjectId array; the participant is a row.
    prisma.tripParticipant.deleteMany({ where: { userId: String(userId) } }),
  ]);
  await User.findByIdAndDelete(userId);

  logger.info('User deleted', { adminId, deletedUserId: userId, deletedUserEmail: user.email });
  return { message: 'User deleted successfully' };
}

// ─── Trips list ───────────────────────────────────────────────────────────────

export async function listTrips(page: number, limit: number, search: string, status?: string) {
  const query: any = {};
  if (search) {
    // $regex with the 'i' option is an unanchored case-insensitive substring
    // match, which is what `contains` with insensitive mode does.
    query.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { destination: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (status && status !== 'all') query.status = status;

  const [total, rows] = await Promise.all([
    prisma.trip.count({ where: query }),
    prisma.trip.findMany({
      where: query,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  const trips = await tripsWithOrganizers(rows, 'name email');
  return { trips, pagination: { current: page, pages: Math.ceil(total / limit), total } };
}

export async function listPendingVerificationTrips(page: number, limit: number) {
  const query: any = { verificationStatus: 'pending' as const };
  const skip = (page - 1) * limit;
  const [total, rows] = await Promise.all([
    prisma.trip.count({ where: query }),
    prisma.trip.findMany({
      where: query,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
  ]);
  const trips = await tripsWithOrganizers(rows, 'name email');
  return { trips, pagination: { current: page, pages: Math.ceil(total / limit), total } };
}

// ─── Trip verify / reject ─────────────────────────────────────────────────────

export async function verifyTrip(adminId: string, tripId: string, adminNotes?: string) {
  // Read the status, check it, write it - two admins approving the same trip
  // both passed. The claim and the check are one statement.
  const claimed = await prisma.trip.updateMany({
    where: { id: tripId, verificationStatus: { not: 'approved' } },
    data: {
      verificationStatus: 'approved',
      verifiedBy: adminId,
      verifiedAt: new Date(),
      ...(adminNotes ? { adminNotes } : {}),
    },
  });

  const tripRow = await prisma.trip.findUnique({ where: { id: tripId } });
  if (!tripRow) throw Object.assign(new Error('Trip not found'), { status: 404 });
  if (claimed.count === 0) throw Object.assign(new Error('Trip already approved'), { status: 400 });

  const [trip] = await tripsWithOrganizers([tripRow], 'name email');
  trip.status = 'active';
  await trip.save();

  try {
    const organizer: any = trip.organizerId;
    if (organizer?.email) {
      await emailService.sendEmail({
        to: organizer.email,
        subject: `Your trip "${trip.title}" has been approved`,
        html: `<p>Hi ${organizer.name || ''},</p><p>Your trip <strong>${trip.title}</strong> has been approved by the Trek Tribe team and is now live.</p><p>Notes from admin: ${adminNotes || 'No notes provided.'}</p>`,
      });
    }
  } catch (err) {
    logger.warn('Failed to send trip approval email', { error: (err as any)?.message });
  }

  logger.info('Trip verified by admin', { adminId, tripId });
  return { message: 'Trip approved successfully', trip };
}

export async function rejectTrip(adminId: string, tripId: string, rejectionReason?: string, adminNotes?: string) {
  const existing = await prisma.trip.findUnique({ where: { id: tripId } });
  if (!existing) throw Object.assign(new Error('Trip not found'), { status: 404 });

  const claimed = await prisma.trip.updateMany({
    where: { id: tripId, verificationStatus: { not: 'rejected' } },
    data: {
      verificationStatus: 'rejected',
      rejectionReason: rejectionReason || 'No reason provided',
      adminNotes: adminNotes || existing.adminNotes,
      verifiedBy: adminId,
      verifiedAt: new Date(),
      status: 'cancelled',
    },
  });

  if (claimed.count === 0) throw Object.assign(new Error('Trip already rejected'), { status: 400 });

  const [trip] = await tripsWithOrganizers(
    [await prisma.trip.findUnique({ where: { id: tripId } })],
    'name email'
  );

  try {
    const organizer: any = trip.organizerId;
    if (organizer?.email) {
      await emailService.sendEmail({
        to: organizer.email,
        subject: `Your trip "${trip.title}" has been rejected`,
        html: `<p>Hi ${organizer.name || ''},</p><p>Your trip <strong>${trip.title}</strong> was not approved.</p><p>Reason: ${trip.rejectionReason}</p><p>Admin notes: ${trip.adminNotes || 'No notes provided.'}</p>`,
      });
    }
  } catch (err) {
    logger.warn('Failed to send trip rejection email', { error: (err as any)?.message });
  }

  logger.info('Trip rejected by admin', { adminId, tripId });
  return { message: 'Trip rejected', trip };
}

export async function updateTripStatus(adminId: string, tripId: string, status: string) {
  if (!['active', 'cancelled', 'completed'].includes(status)) {
    throw Object.assign(new Error('Invalid status'), { status: 400 });
  }
  const updated = await prisma.trip.update({
    where: { id: tripId },
    data: { status: status as any },
  }).catch((error: any) => {
    if (error?.code === 'P2025') return null;
    throw error;
  });
  if (!updated) throw Object.assign(new Error('Trip not found'), { status: 404 });
  const [trip] = await tripsWithOrganizers([updated], 'name email');
  logger.info('Trip status updated', { adminId, tripId, newStatus: status });
  return { message: 'Trip status updated successfully', trip };
}

export async function deleteTrip(adminId: string, tripId: string) {
  const trip = await prisma.trip.findUnique({ where: { id: tripId } });
  if (!trip) throw Object.assign(new Error('Trip not found'), { status: 404 });

  await Promise.all([
    prisma.review.deleteMany({ where: { targetId: String(tripId), reviewType: 'trip' } }),
    prisma.wishlist.deleteMany({ where: { tripId: String(tripId) } }),
  ]);
  // The schedule, packages, stops, photos, participants and bookings go with it
  // by cascade; deleting the document used to leave all of them behind.
  await prisma.trip.delete({ where: { id: tripId } });

  logger.info('Trip deleted', { adminId, deletedTripId: tripId, deletedTripTitle: trip.title });
  return { message: 'Trip deleted successfully' };
}

// ─── Email / cleanup ──────────────────────────────────────────────────────────

export async function getEmailStatus() {
  return emailService.getServiceStatus();
}

export async function getEmailHealth() {
  const emailStatus = await emailService.getServiceStatus();
  const queueStats = await emailQueue.getQueueStats();
  return { email: emailStatus, queue: { ...queueStats, healthy: queueStats.failed < 10 }, timestamp: new Date() };
}

export async function performCleanup(adminId: string) {
  // Reviews moved to Postgres (D10/D11 wave 2), where reviewer_id and target_id
  // are NOT NULL, so the orphan this swept up can no longer be created.
  const orphanedReviewsResult = { deletedCount: 0 };
  // Wishlists moved to Postgres (D10/D11 wave 2), where user_id and trip_id are
  // NOT NULL - so the orphan this used to sweep up can no longer be created.
  // Rows pointing at a *deleted* Mongo user or trip are a different problem and
  // are deliberately not swept here: that would be new behaviour, not a port.
  const orphanedWishlistsResult = { deletedCount: 0 };
  const expiredTripsResult = await prisma.trip.updateMany({
    where: { endDate: { lt: new Date() }, status: 'active' },
    data: { status: 'completed' },
  });

  logger.info('System cleanup performed', {
    adminId,
    orphanedReviews: orphanedReviewsResult.deletedCount,
    orphanedWishlists: orphanedWishlistsResult.deletedCount,
    expiredTrips: expiredTripsResult.count,
  });

  return {
    message: 'System cleanup completed successfully',
    results: {
      orphanedReviews: orphanedReviewsResult.deletedCount,
      orphanedWishlists: orphanedWishlistsResult.deletedCount,
      expiredTrips: expiredTripsResult.count,
    },
  };
}

// ─── Organizer verifications ──────────────────────────────────────────────────

export async function getPendingOrganizerVerifications() {
  const pendingVerifications = await User.find({
    role: 'organizer',
    organizerVerificationStatus: 'pending',
  })
    .select('name email phone organizerProfile.bio organizerProfile.experience organizerProfile.specialties organizerVerificationSubmittedAt')
    .sort({ organizerVerificationSubmittedAt: -1 });

  return { success: true, count: pendingVerifications.length, verifications: pendingVerifications };
}

export async function approveOrganizerVerification(adminId: string, userId: string) {
  const user = await User.findById(userId);
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
  if (user.role !== 'organizer') throw Object.assign(new Error('User is not an organizer'), { status: 400 });
  if (user.organizerVerificationStatus !== 'pending') throw Object.assign(new Error('Verification is not pending'), { status: 400 });

  user.organizerVerificationStatus = 'approved';
  user.organizerVerificationApprovedAt = new Date();
  user.organizerVerificationReviewedBy = adminId as any;
  user.isVerified = true;

  if (!user.organizerProfile) user.organizerProfile = {} as any;
  if (!user.organizerProfile.autoPay) user.organizerProfile.autoPay = {} as any;
  user.organizerProfile.autoPay.autoPayEnabled = true;
  user.organizerProfile.autoPay.isSetupCompleted = true;
  user.markModified('organizerProfile');

  if (!user.reputation) {
    user.reputation = { points: 0, level: 1, levelName: 'Explorer', badges: [], achievements: [] };
  }
  user.reputation.points += 500;
  user.reputation.badges.push('verified_organizer');
  user.reputation.achievements.push({ type: 'verification_approved', earnedAt: new Date(), description: 'Successfully verified as an organizer' });

  await user.save();

  // Was: findOne(status active|trial) then create. organizerId is unique, so an
  // organizer with an expired subscription matched nothing and the create hit a
  // duplicate key error - verifying them failed with E11000. See
  // ensureTrialSubscription for the whole story.
  await ensureTrialSubscription(user._id.toString());

  try {
    await emailService.sendEmail({
      to: user.email,
      subject: 'Congratulations! Your Organizer Account is Verified',
      html: `<h1>Welcome to Trek Tribe Verified Organizers!</h1><p>Dear ${user.name},</p><p>Your organizer account has been approved and verified.</p><p>You've earned <strong>500 reputation points</strong>!</p>`,
    });
  } catch (emailError) {
    logger.error('Failed to send verification approval email', { error: emailError });
  }

  logger.info('Organizer verification approved', { userId, adminId });
  return { success: true, message: 'Organizer verified successfully', user: { id: user._id, name: user.name, email: user.email, verificationStatus: user.organizerVerificationStatus } };
}

export async function rejectOrganizerVerification(adminId: string, userId: string, reason: string) {
  if (!reason) throw Object.assign(new Error('Rejection reason is required'), { status: 400 });

  const user = await User.findById(userId);
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
  if (user.role !== 'organizer') throw Object.assign(new Error('User is not an organizer'), { status: 400 });
  if (user.organizerVerificationStatus !== 'pending') throw Object.assign(new Error('Verification is not pending'), { status: 400 });

  user.organizerVerificationStatus = 'rejected';
  user.organizerVerificationRejectedAt = new Date();
  user.organizerVerificationRejectionReason = reason;
  user.organizerVerificationReviewedBy = adminId as any;
  await user.save();

  try {
    await emailService.sendEmail({
      to: user.email,
      subject: 'Trek Tribe Organizer Verification Update',
      html: `<h1>Organizer Verification Status Update</h1><p>Dear ${user.name},</p><p>We are unable to approve your verification request at this time.</p><p><strong>Reason:</strong> ${reason}</p>`,
    });
  } catch (emailError) {
    logger.error('Failed to send verification rejection email', { error: emailError });
  }

  logger.info('Organizer verification rejected', { userId, adminId, reason });
  return { success: true, message: 'Organizer verification rejected', user: { id: user._id, name: user.name, email: user.email, verificationStatus: user.organizerVerificationStatus, rejectionReason: reason } };
}

export async function getAllOrganizerVerifications(status?: string) {
  const filter: any = { role: 'organizer' };
  if (status && ['pending', 'approved', 'rejected'].includes(status)) filter.organizerVerificationStatus = status;

  const verifications = await User.find(filter)
    .select('name email phone organizerProfile organizerVerificationStatus organizerVerificationSubmittedAt organizerVerificationApprovedAt organizerVerificationRejectedAt organizerVerificationRejectionReason')
    .sort({ organizerVerificationSubmittedAt: -1 });

  return { success: true, count: verifications.length, verifications };
}

// ─── Verification requests ────────────────────────────────────────────────────

/**
 * Reattach the organizer and reviewer that .populate() used to supply.
 *
 * VerificationRequest is a Postgres row and User is still a Mongo document, so
 * there is no join to make. Both are fetched in one query each and attached
 * under the keys the admin UI already reads - organizerId and reviewedBy as
 * objects, not ids - so the response shape does not change.
 */
async function attachVerificationUsers(rows: any[]): Promise<any[]> {
  if (rows.length === 0) return [];

  const ids = Array.from(new Set([
    ...rows.map(r => r.organizerId),
    ...rows.map(r => r.reviewedBy).filter(Boolean),
  ]));

  const users = await User.find(
    { _id: { $in: ids } },
    'name email phone createdAt organizerProfile'
  ).lean();

  const byId = new Map<string, any>(users.map((u: any) => [u._id.toString(), u]));

  return rows.map(row => ({
    ...row,
    _id: row.id,
    organizerId: byId.get(row.organizerId) ?? row.organizerId,
    reviewedBy: row.reviewedBy ? (byId.get(row.reviewedBy) ?? row.reviewedBy) : null,
  }));
}

export async function listVerificationRequests(filters: any, page: number, limit: number, sortBy: string, sortOrder: string) {
  const query: any = {};
  if (filters.status) query.status = filters.status;
  if (filters.requestType) query.requestType = filters.requestType;
  if (filters.priority) query.priority = filters.priority;

  const skip = (page - 1) * limit;
  const sort: any = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

  const orderBy = { [sortBy]: sortOrder === 'desc' ? 'desc' : 'asc' } as any;

  const [rows, total, statusCounts] = await Promise.all([
    prisma.verificationRequest.findMany({
      where: query,
      orderBy,
      skip,
      take: limit,
      include: { documents: true },
    }),
    prisma.verificationRequest.count({ where: query }),
    // Was an aggregate over the whole collection with the four statuses picked
    // out of the result by hand. groupBy says the same thing.
    prisma.verificationRequest.groupBy({ by: ['status'], _count: { status: true } }),
  ]);

  const requests = await attachVerificationUsers(rows);

  const counted = (status: string) =>
    statusCounts.find(c => c.status === status)?._count.status || 0;

  const summary = {
    pending: counted('pending'),
    under_review: counted('under_review'),
    approved: counted('approved'),
    rejected: counted('rejected'),
    total,
  };

  return { success: true, data: requests, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }, summary };
}

export async function getVerificationRequestById(requestId: string) {
  const row = await prisma.verificationRequest.findUnique({
    where: { id: requestId },
    include: { documents: true },
  });

  if (!row) throw Object.assign(new Error('Verification request not found'), { status: 404 });

  // populate() is gone - User is still a Mongo document until wave 9 - so the
  // organizer and reviewer are fetched and attached under the same keys the
  // admin UI reads.
  const [request] = await attachVerificationUsers([row]);
  const organizer = request.organizerId as any;
  let tripHistory: any[] = [];
  if (organizer?._id) {
    tripHistory = shapeTrips(
      await prisma.trip.findMany({
        where: { organizerId: organizer._id.toString() },
        include: { participants: { select: { userId: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }) as any
    );
  }

  return { success: true, data: { ...request, tripHistory } };
}

export async function approveVerificationRequest(adminId: string, requestId: string, trustScore: number, verificationBadge?: string, enableRouting = false, adminNotes?: string) {
  if (typeof trustScore !== 'number' || trustScore < 0 || trustScore > 100) {
    throw Object.assign(new Error('Trust score must be a number between 0 and 100'), { status: 400 });
  }
  const validBadges = ['none', 'bronze', 'silver', 'gold', 'platinum'];
  if (verificationBadge && !validBadges.includes(verificationBadge)) {
    throw Object.assign(new Error('Invalid verification badge'), { status: 400 });
  }

  // Claiming the request and checking it is one statement. Two admins pressing
  // approve at the same moment both passed the "already approved" check before,
  // and both ran the whole approval - two emails, two trust scores written, two
  // audit entries.
  const claimed = await prisma.verificationRequest.updateMany({
    where: { id: requestId, status: { not: 'approved' } },
    data: { status: 'approved', reviewedBy: adminId, reviewedAt: new Date() },
  });

  const request = await prisma.verificationRequest.findUnique({ where: { id: requestId } });
  if (!request) throw Object.assign(new Error('Verification request not found'), { status: 404 });
  if (claimed.count === 0) throw Object.assign(new Error('Verification request already approved'), { status: 400 });

  const organizer = await User.findById(request.organizerId);
  if (!organizer) throw Object.assign(new Error('Organizer not found'), { status: 404 });

  let badge = verificationBadge;
  if (!badge) {
    if (trustScore >= 95) badge = 'platinum';
    else if (trustScore >= 85) badge = 'gold';
    else if (trustScore >= 70) badge = 'silver';
    else if (trustScore >= 50) badge = 'bronze';
    else badge = 'none';
  }

  if (!organizer.organizerProfile) organizer.organizerProfile = {} as any;
  organizer.organizerProfile.trustScore = {
    overall: trustScore,
    breakdown: {
      documentVerified: Math.min(trustScore * 0.2, 20),
      bankVerified: Math.min(trustScore * 0.2, 20),
      experienceYears: Math.min(trustScore * 0.15, 15),
      completedTrips: 0, userReviews: 0,
      responseTime: Math.min(trustScore * 0.1, 10),
      refundRate: Math.min(trustScore * 0.05, 5),
    },
    lastCalculated: new Date(),
  };
  organizer.organizerProfile.verificationBadge = badge as any;
  organizer.organizerProfile.routingEnabled = enableRouting;
  organizer.organizerVerificationStatus = 'approved';
  organizer.organizerVerificationApprovedAt = new Date();
  organizer.organizerVerificationApprovedBy = adminId as any;

  if (!organizer.organizerProfile.autoPay) organizer.organizerProfile.autoPay = {} as any;
  organizer.organizerProfile.autoPay.autoPayEnabled = true;
  organizer.organizerProfile.autoPay.isSetupCompleted = true;
  organizer.markModified('organizerProfile');
  await organizer.save();

  await ensureTrialSubscription(organizer._id.toString());

  // The status, reviewer and timestamp were written by the claim above.
  await prisma.verificationRequest.update({
    where: { id: requestId },
    data: { adminNotes: adminNotes || '', initialTrustScore: trustScore },
  });

  try {
    await emailService.sendEmail({
      to: organizer.email,
      subject: '🎉 Your TrekTribe Organizer Account is Approved!',
      html: `<h2>Congratulations! Your Account is Approved</h2><p>Dear ${organizer.name},</p><p>Trust Score: ${trustScore}/100, Badge: ${badge}</p>${adminNotes ? `<p>Admin Notes: ${adminNotes}</p>` : ''}`,
    });
  } catch (emailError: any) {
    logger.error('Failed to send approval email', { organizerId: organizer._id, error: emailError.message });
  }

  logger.info('Admin approved organizer verification', { adminId, organizerId: organizer._id, requestId, trustScore, badge, routingEnabled: enableRouting });
  return { success: true, message: 'Organizer approved successfully', data: { organizerId: organizer._id, trustScore, verificationBadge: badge, routingEnabled: enableRouting, approvedAt: new Date() } };
}

export async function rejectVerificationRequest(adminId: string, requestId: string, rejectionReason: string, adminNotes?: string) {
  if (!rejectionReason?.trim()) throw Object.assign(new Error('Rejection reason is required'), { status: 400 });

  const claimed = await prisma.verificationRequest.updateMany({
    where: { id: requestId, status: { not: 'rejected' } },
    data: { status: 'rejected', reviewedBy: adminId, reviewedAt: new Date() },
  });

  const request = await prisma.verificationRequest.findUnique({ where: { id: requestId } });
  if (!request) throw Object.assign(new Error('Verification request not found'), { status: 404 });
  if (claimed.count === 0) throw Object.assign(new Error('Verification request already rejected'), { status: 400 });

  const organizer = await User.findById(request.organizerId);
  if (!organizer) throw Object.assign(new Error('Organizer not found'), { status: 404 });

  organizer.organizerVerificationStatus = 'rejected';
  organizer.organizerVerificationRejectedAt = new Date();
  organizer.organizerVerificationRejectionReason = rejectionReason;
  await organizer.save();

  await prisma.verificationRequest.update({
    where: { id: requestId },
    data: { adminNotes: adminNotes || rejectionReason },
  });

  try {
    await emailService.sendEmail({
      to: organizer.email,
      subject: 'TrekTribe Organizer Account - Verification Update',
      html: `<h2>Organizer Verification Update</h2><p>Dear ${organizer.name},</p><p>We are unable to approve your organizer account at this time.</p><p><strong>Reason:</strong> ${rejectionReason}</p>`,
    });
  } catch (emailError: any) {
    logger.error('Failed to send rejection email', { organizerId: organizer._id, error: emailError.message });
  }

  logger.info('Admin rejected organizer verification', { adminId, organizerId: organizer._id, requestId, reason: rejectionReason });
  return { success: true, message: 'Organizer verification rejected', data: { organizerId: organizer._id, rejectionReason, rejectedAt: new Date() } };
}

export async function updateVerificationRequestStatus(adminId: string, requestId: string, status: string, priority?: string, adminNotes?: string) {
  const validStatuses = ['pending', 'under_review', 'approved', 'rejected'];
  if (!validStatuses.includes(status)) throw Object.assign(new Error('Invalid status. Must be: pending, under_review, approved, or rejected'), { status: 400 });

  const existing = await prisma.verificationRequest.findUnique({ where: { id: requestId } });
  if (!existing) throw Object.assign(new Error('Verification request not found'), { status: 404 });

  const data: any = { status };
  if (priority) data.priority = priority;
  if (adminNotes) data.adminNotes = adminNotes;
  if (['approved', 'rejected'].includes(status)) {
    data.reviewedBy = adminId;
    data.reviewedAt = new Date();
  }

  // status and priority are enums, so a value outside the four - the validation
  // above lists them - is refused by the database as well as by the check.
  const request = await prisma.verificationRequest.update({
    where: { id: requestId },
    data,
  });

  logger.info('Admin updated verification request status', { adminId, requestId, newStatus: status });
  return { success: true, message: 'Verification request status updated', data: { ...request, _id: request.id } };
}

export async function recalculateTrustScore(adminId: string, requestId: string) {
  const request = await prisma.verificationRequest.findUnique({ where: { id: requestId } });
  if (!request) throw Object.assign(new Error('Verification request not found'), { status: 404 });

  const organizer = await User.findById(request.organizerId);
  if (!organizer) throw Object.assign(new Error('Organizer not found'), { status: 404 });

  // organizerId is already a string column; .toString() was there because it
  // was an ObjectId.
  const trustScore = await TrustScoreService.calculateTrustScore(request.organizerId);

  if (!organizer.organizerProfile) organizer.organizerProfile = {} as any;
  organizer.organizerProfile.trustScore = trustScore;
  organizer.organizerProfile.verificationBadge = TrustScoreService.getBadgeForScore(trustScore.overall);
  await organizer.save();

  const recommendations = TrustScoreService.getImprovementRecommendations(trustScore.breakdown);

  logger.info('Admin recalculated organizer trust score', { adminId, organizerId: organizer._id });
  return {
    success: true,
    message: 'Trust score recalculated successfully',
    data: { trustScore, verificationBadge: organizer.organizerProfile.verificationBadge, isEligibleForRouting: TrustScoreService.isEligibleForRouting(trustScore.overall), recommendations },
  };
}

// ─── Subscription management ──────────────────────────────────────────────────

export async function getUserSubscription(userId: string) {
  const subscription = await prisma.organizerSubscription.findUnique({ where: { organizerId: userId } });
  if (!subscription) return { hasSubscription: false };
  // decorate() supplies _id, tripsRemaining, isValid and daysRemaining, which
  // were a Mongoose virtual or a stored column and are neither now.
  return { hasSubscription: true, subscription: { ...decorate(subscription), crmAccess: subscription.crmAccess || false } };
}

export async function overrideUserSubscription(adminId: string, userId: string, crmAccess?: boolean, addTrips?: number, setPlan?: string) {
  let subscription = await prisma.organizerSubscription.findUnique({ where: { organizerId: userId } });

  if (!subscription) {
    const user = await User.findById(userId);
    if (user && (user.role === 'organizer' || user.role === 'admin')) {
      subscription = await upsertRacingSafely(() => prisma.organizerSubscription.upsert({
        where: { organizerId: userId },
        create: { organizerId: userId, plan: 'free_trial', status: 'trial', isTrialActive: true },
        update: {}
      }));
    } else {
      throw Object.assign(new Error('No subscription found and user is not an organizer'), { status: 404 });
    }
  }

  const updates: any = {};
  const data: any = {};

  if (crmAccess !== undefined) { data.crmAccess = crmAccess; updates.crmAccess = crmAccess; }

  if (addTrips && typeof addTrips === 'number') {
    // "Add trips" used to mean: raise tripsRemaining, then raise tripsPerCycle
    // to match if it had fallen behind. tripsRemaining is tripsPerCycle minus
    // tripsUsed now, so granting N more trips is raising the cycle allowance by
    // N - which is the same result, said once instead of twice.
    data.tripsPerCycle = subscription.tripsPerCycle + addTrips;
    updates.tripsAdded = addTrips;
  }

  if (setPlan) { data.plan = setPlan; updates.plan = setPlan; }

  let updated;
  try {
    updated = await prisma.organizerSubscription.update({
      where: { id: subscription.id },
      data
    });
  } catch (error: any) {
    // setPlan comes straight from an admin request body. The eight plan names
    // are an enum, so a typo is refused here rather than stored and puzzled
    // over later.
    if (/invalid input value for enum/i.test(error?.message || '')) {
      throw Object.assign(new Error(`Unknown plan: ${setPlan}`), { status: 400 });
    }
    throw error;
  }

  logger.info('Admin updated user subscription manually', {
    adminId, targetUserId: userId, updates, tripsRemaining: tripsRemaining(updated)
  });
  return { success: true, subscription: decorate(updated) };
}

// ─── Trust score ──────────────────────────────────────────────────────────────

export async function manageTrustScore(adminId: string, userId: string, manualScore?: number) {
  const user = await User.findById(userId);
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
  if (user.role !== 'organizer') throw Object.assign(new Error('Trust score is only applicable for organizers'), { status: 400 });

  let trustScore: any;

  if (typeof manualScore === 'number') {
    if (manualScore < 0 || manualScore > 100) throw Object.assign(new Error('Trust score must be between 0 and 100'), { status: 400 });
    trustScore = {
      overall: manualScore,
      breakdown: {
        documentVerified: Math.min(manualScore * 0.2, 20),
        bankVerified: Math.min(manualScore * 0.2, 20),
        experienceYears: Math.min(manualScore * 0.15, 15),
        completedTrips: 0, userReviews: 0,
        responseTime: Math.min(manualScore * 0.1, 10),
        refundRate: Math.min(manualScore * 0.05, 5),
      },
      lastCalculated: new Date(),
    };
    if (!user.organizerProfile) user.organizerProfile = {} as any;
    user.organizerProfile.trustScore = trustScore;
    user.organizerProfile.verificationBadge = TrustScoreService.getBadgeForScore(manualScore) as any;
    await user.save();
    logger.info('Admin manually assigned trust score', { adminId, organizerId: userId, score: manualScore });
  } else {
    trustScore = await TrustScoreService.updateOrganizerTrustScore(userId);
    logger.info('Trust score recalculated by admin', { adminId, organizerId: userId, newScore: trustScore.overall });
  }

  return {
    success: true,
    message: manualScore !== undefined ? 'Trust score assigned successfully' : 'Trust score recalculated successfully',
    trustScore,
    badge: TrustScoreService.getBadgeForScore(trustScore.overall),
  };
}

export async function verifyOrganizer(adminId: string, userId: string, status: 'approved' | 'rejected', notes?: string) {
  if (!['approved', 'rejected'].includes(status)) throw Object.assign(new Error('Invalid verification status'), { status: 400 });

  const user = await User.findById(userId);
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });

  user.organizerVerificationStatus = status;
  user.isVerified = status === 'approved';

  if (status === 'approved') {
    user.organizerVerificationApprovedAt = new Date();
    user.organizerVerificationApprovedBy = adminId as any;
    if (!user.organizerProfile) user.organizerProfile = {} as any;
    if (!user.organizerProfile.autoPay) user.organizerProfile.autoPay = {} as any;
    user.organizerProfile.autoPay.autoPayEnabled = true;
    user.organizerProfile.autoPay.isSetupCompleted = true;
    user.markModified('organizerProfile');
  }

  await user.save();

  if (status === 'approved') {
    await ensureTrialSubscription(user._id.toString());
  }

  try {
    if (user.email) {
      const subject = status === 'approved' ? 'Your Organizer Account is Verified! 🎉' : 'Update on your Organizer Account Application';
      const html = status === 'approved'
        ? `<p>Hi ${user.name},</p><p>Congratulations! Your account has been verified.</p>`
        : `<p>Hi ${user.name},</p><p>Thank you for your application. Unfortunately, we could not verify your account at this time.</p><p>Reason: ${notes || 'Does not meet criteria'}</p>`;
      await emailService.sendEmail({ to: user.email, subject, html });
    }
  } catch (e) {
    logger.warn('Failed to send verification email', { error: (e as any).message });
  }

  logger.info('Organizer verification updated', { adminId, organizerId: userId, status });
  return { message: `Organizer ${status} successfully`, user };
}

// ─── Retry jobs ───────────────────────────────────────────────────────────────

export async function listRetryJobs(page: number, limit: number) {
  const skip = (page - 1) * limit;
  const [jobs, total] = await Promise.all([
    prisma.retryJob.findMany({ orderBy: { createdAt: 'desc' }, take: limit, skip }),
    prisma.retryJob.count()
  ]);
  return { data: jobs, pagination: { page, limit, total } };
}

export async function retryJob(jobId: string) {
  const job = await prisma.retryJob.findUnique({ where: { id: jobId } });
  if (!job) throw Object.assign(new Error('Retry job not found'), { status: 404 });
  const updated = await prisma.retryJob.update({
    where: { id: jobId },
    data: { status: 'pending', nextRetryAt: new Date(), retryCount: 0 }
  });
  return { success: true, job: updated };
}

export async function cancelJob(jobId: string) {
  const job = await prisma.retryJob.findUnique({ where: { id: jobId } });
  if (!job) throw Object.assign(new Error('Retry job not found'), { status: 404 });
  const updated = await prisma.retryJob.update({
    where: { id: jobId },
    data: { status: 'cancelled' }
  });
  return { success: true, job: updated };
}
