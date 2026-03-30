/**
 * Admin Service
 *
 * All business logic extracted from routes/admin.ts.
 * No req/res objects — pure data in, data out.
 */

import { User } from '../../models/User';
import { Trip } from '../../models/Trip';
import { Review } from '../../models/Review';
import { Wishlist } from '../../models/Wishlist';
import CRMSubscription from '../../models/CRMSubscription';
import { OrganizerSubscription } from '../../models/OrganizerSubscription';
import { SupportTicket } from '../../models/SupportTicket';
import { VerificationRequest } from '../../models/VerificationRequest';
import { logger } from '../../utils/logger';
import { emailService } from '../../services/emailService';
import RetryJob from '../../models/RetryJob';
import TrustScoreService from '../../services/trustScoreService';
import { emailQueue } from '../../services/emailQueueService';

// ─── Dashboard stats ──────────────────────────────────────────────────────────

export async function getDashboardStats() {
  const [totalUsers, totalTrips, totalReviews, totalWishlists, totalTickets, activeSubscriptions] =
    await Promise.all([
      User.countDocuments(),
      Trip.countDocuments(),
      Review.countDocuments(),
      Wishlist.countDocuments(),
      SupportTicket.countDocuments(),
      CRMSubscription.countDocuments({ status: 'active' }),
    ]);

  const usersByRole = await User.aggregate([
    { $group: { _id: '$role', count: { $sum: 1 } } },
    { $project: { role: '$_id', count: 1, _id: 0 } },
  ]);

  const tripsByStatus = await Trip.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } },
    { $project: { status: '$_id', count: 1, _id: 0 } },
  ]);

  const tripsWithParticipants = await Trip.find({}, 'participants price');
  let totalBookings = 0;
  let totalTripRevenue = 0;
  tripsWithParticipants.forEach((trip) => {
    totalBookings += trip.participants.length;
    totalTripRevenue += trip.participants.length * trip.price;
  });

  const subscriptions = await CRMSubscription.find({});
  let totalSubscriptionRevenue = 0;
  let thisMonthSubscriptionRevenue = 0;
  const currentDate = new Date();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  subscriptions.forEach((sub) => {
    const revenue = sub.totalPaid || 0;
    totalSubscriptionRevenue += revenue;
    if (sub.createdAt >= firstDayOfMonth) thisMonthSubscriptionRevenue += revenue;
  });

  const subscriptionsByPlan = await CRMSubscription.aggregate([
    { $group: { _id: '$planType', count: { $sum: 1 }, revenue: { $sum: '$totalPaid' } } },
    { $project: { plan: '$_id', count: 1, revenue: 1, _id: 0 } },
  ]);

  const ticketsByStatus = await SupportTicket.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } },
    { $project: { status: '$_id', count: 1, _id: 0 } },
  ]);

  const recentUsers = await User.find({}, 'name email role createdAt')
    .sort({ createdAt: -1 })
    .limit(5)
    .select('-passwordHash');

  const recentTrips = await Trip.find({}, 'title destination price status createdAt')
    .populate('organizerId', 'name')
    .sort({ createdAt: -1 })
    .limit(5);

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
      total: subscriptions.length,
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
  const usersByRole = await User.aggregate([
    { $group: { _id: '$role', count: { $sum: 1 } } },
    { $project: { role: '$_id', count: 1, _id: 0 } },
  ]);
  const recentUsers = await User.find({}, 'name email role createdAt')
    .sort({ createdAt: -1 })
    .limit(10)
    .select('-passwordHash');
  return { total: totalUsers, byRole: usersByRole, recentUsers };
}

// ─── Trip stats ───────────────────────────────────────────────────────────────

export async function getTripStats() {
  const totalTrips = await Trip.countDocuments();
  const tripsByStatus = await Trip.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } },
    { $project: { status: '$_id', count: 1, _id: 0 } },
  ]);
  const recentTrips = await Trip.find({}, 'title destination price status participants createdAt')
    .populate('organizerId', 'name email')
    .sort({ createdAt: -1 })
    .limit(10);

  const tripsWithParticipants = await Trip.find({}, 'participants price');
  let totalBookings = 0;
  let totalRevenue = 0;
  tripsWithParticipants.forEach((trip) => {
    totalBookings += trip.participants.length;
    totalRevenue += trip.participants.length * trip.price;
  });

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
    Review.deleteMany({ reviewerId: userId }),
    Wishlist.deleteMany({ userId }),
    Trip.updateMany({ participants: userId }, { $pull: { participants: userId } }),
  ]);
  await User.findByIdAndDelete(userId);

  logger.info('User deleted', { adminId, deletedUserId: userId, deletedUserEmail: user.email });
  return { message: 'User deleted successfully' };
}

// ─── Trips list ───────────────────────────────────────────────────────────────

export async function listTrips(page: number, limit: number, search: string, status?: string) {
  const query: any = {};
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { destination: { $regex: search, $options: 'i' } },
    ];
  }
  if (status && status !== 'all') query.status = status;

  const total = await Trip.countDocuments(query);
  const trips = await Trip.find(query)
    .populate('organizerId', 'name email')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  return { trips, pagination: { current: page, pages: Math.ceil(total / limit), total } };
}

export async function listPendingVerificationTrips(page: number, limit: number) {
  const query: any = { verificationStatus: 'pending' };
  const skip = (page - 1) * limit;
  const total = await Trip.countDocuments(query);
  const trips = await Trip.find(query)
    .populate('organizerId', 'name email')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
  return { trips, pagination: { current: page, pages: Math.ceil(total / limit), total } };
}

// ─── Trip verify / reject ─────────────────────────────────────────────────────

export async function verifyTrip(adminId: string, tripId: string, adminNotes?: string) {
  const trip = await Trip.findById(tripId).populate('organizerId', 'name email');
  if (!trip) throw Object.assign(new Error('Trip not found'), { status: 404 });
  if (trip.verificationStatus === 'approved') throw Object.assign(new Error('Trip already approved'), { status: 400 });

  trip.verificationStatus = 'approved';
  trip.verifiedBy = adminId;
  trip.verifiedAt = new Date();
  if (adminNotes) trip.adminNotes = adminNotes;
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
  const trip = await Trip.findById(tripId).populate('organizerId', 'name email');
  if (!trip) throw Object.assign(new Error('Trip not found'), { status: 404 });
  if (trip.verificationStatus === 'rejected') throw Object.assign(new Error('Trip already rejected'), { status: 400 });

  trip.verificationStatus = 'rejected';
  trip.rejectionReason = rejectionReason || 'No reason provided';
  trip.adminNotes = adminNotes || trip.adminNotes;
  trip.verifiedBy = adminId;
  trip.verifiedAt = new Date();
  trip.status = 'cancelled';
  await trip.save();

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
  const trip = await Trip.findByIdAndUpdate(tripId, { status }, { new: true }).populate('organizerId', 'name email');
  if (!trip) throw Object.assign(new Error('Trip not found'), { status: 404 });
  logger.info('Trip status updated', { adminId, tripId, newStatus: status });
  return { message: 'Trip status updated successfully', trip };
}

export async function deleteTrip(adminId: string, tripId: string) {
  const trip = await Trip.findById(tripId);
  if (!trip) throw Object.assign(new Error('Trip not found'), { status: 404 });

  await Promise.all([
    Review.deleteMany({ targetId: tripId, reviewType: 'trip' }),
    Wishlist.deleteMany({ tripId }),
  ]);
  await Trip.findByIdAndDelete(tripId);

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
  const orphanedReviewsResult = await Review.deleteMany({
    $or: [{ reviewerId: { $exists: false } }, { targetId: { $exists: false } }],
  });
  const orphanedWishlistsResult = await Wishlist.deleteMany({
    $or: [{ userId: { $exists: false } }, { tripId: { $exists: false } }],
  });
  const expiredTripsResult = await Trip.updateMany(
    { endDate: { $lt: new Date() }, status: 'active' },
    { status: 'completed' }
  );

  logger.info('System cleanup performed', {
    adminId,
    orphanedReviews: orphanedReviewsResult.deletedCount,
    orphanedWishlists: orphanedWishlistsResult.deletedCount,
    expiredTrips: expiredTripsResult.modifiedCount,
  });

  return {
    message: 'System cleanup completed successfully',
    results: {
      orphanedReviews: orphanedReviewsResult.deletedCount,
      orphanedWishlists: orphanedWishlistsResult.deletedCount,
      expiredTrips: expiredTripsResult.modifiedCount,
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
  user.organizerVerificationReviewedBy = adminId;
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

  const existingSubscription = await OrganizerSubscription.findOne({ organizerId: user._id, status: { $in: ['active', 'trial'] } });
  if (!existingSubscription) {
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 30);
    await OrganizerSubscription.create({
      organizerId: user._id, plan: 'free-trial', status: 'trial', isTrialActive: true,
      trialStartDate: new Date(), trialEndDate, tripsPerCycle: 5, tripsUsed: 0, tripsRemaining: 5, pricePerCycle: 0, totalPaid: 0,
    });
  }

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
  user.organizerVerificationReviewedBy = adminId;
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

export async function listVerificationRequests(filters: any, page: number, limit: number, sortBy: string, sortOrder: string) {
  const query: any = {};
  if (filters.status) query.status = filters.status;
  if (filters.requestType) query.requestType = filters.requestType;
  if (filters.priority) query.priority = filters.priority;

  const skip = (page - 1) * limit;
  const sort: any = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

  const [requests, total] = await Promise.all([
    VerificationRequest.find(query)
      .populate('organizerId', 'name email phone createdAt')
      .populate('reviewedBy', 'name email')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    VerificationRequest.countDocuments(query),
  ]);

  const statusCounts = await VerificationRequest.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
  const summary = {
    pending: statusCounts.find((s: any) => s._id === 'pending')?.count || 0,
    under_review: statusCounts.find((s: any) => s._id === 'under_review')?.count || 0,
    approved: statusCounts.find((s: any) => s._id === 'approved')?.count || 0,
    rejected: statusCounts.find((s: any) => s._id === 'rejected')?.count || 0,
    total,
  };

  return { success: true, data: requests, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }, summary };
}

export async function getVerificationRequestById(requestId: string) {
  const request = await VerificationRequest.findById(requestId)
    .populate('organizerId', 'name email phone createdAt organizerProfile')
    .populate('reviewedBy', 'name email')
    .lean();

  if (!request) throw Object.assign(new Error('Verification request not found'), { status: 404 });

  const organizer = request.organizerId as any;
  let tripHistory: any[] = [];
  if (organizer?._id) {
    tripHistory = await Trip.find({ organizerId: organizer._id })
      .select('title destination price status startDate participants createdAt')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();
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

  const request = await VerificationRequest.findById(requestId);
  if (!request) throw Object.assign(new Error('Verification request not found'), { status: 404 });
  if (request.status === 'approved') throw Object.assign(new Error('Verification request already approved'), { status: 400 });

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
  organizer.organizerVerificationApprovedBy = adminId;

  if (!organizer.organizerProfile.autoPay) organizer.organizerProfile.autoPay = {} as any;
  organizer.organizerProfile.autoPay.autoPayEnabled = true;
  organizer.organizerProfile.autoPay.isSetupCompleted = true;
  organizer.markModified('organizerProfile');
  await organizer.save();

  const existingSubscription = await OrganizerSubscription.findOne({ organizerId: organizer._id, status: { $in: ['active', 'trial'] } });
  if (!existingSubscription) {
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 30);
    await OrganizerSubscription.create({
      organizerId: organizer._id, plan: 'free-trial', status: 'trial', isTrialActive: true,
      trialStartDate: new Date(), trialEndDate, tripsPerCycle: 5, tripsUsed: 0, tripsRemaining: 5, pricePerCycle: 0, totalPaid: 0,
    });
  }

  request.status = 'approved';
  request.reviewedBy = adminId;
  request.reviewedAt = new Date();
  request.adminNotes = adminNotes || '';
  request.initialTrustScore = trustScore;
  await request.save();

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

  const request = await VerificationRequest.findById(requestId);
  if (!request) throw Object.assign(new Error('Verification request not found'), { status: 404 });
  if (request.status === 'rejected') throw Object.assign(new Error('Verification request already rejected'), { status: 400 });

  const organizer = await User.findById(request.organizerId);
  if (!organizer) throw Object.assign(new Error('Organizer not found'), { status: 404 });

  organizer.organizerVerificationStatus = 'rejected';
  organizer.organizerVerificationRejectedAt = new Date();
  organizer.organizerVerificationRejectionReason = rejectionReason;
  await organizer.save();

  request.status = 'rejected';
  request.reviewedBy = adminId;
  request.reviewedAt = new Date();
  request.adminNotes = adminNotes || rejectionReason;
  await request.save();

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

  const request = await VerificationRequest.findById(requestId);
  if (!request) throw Object.assign(new Error('Verification request not found'), { status: 404 });

  request.status = status;
  if (priority) request.priority = priority;
  if (adminNotes) request.adminNotes = adminNotes;
  if (['approved', 'rejected'].includes(status)) {
    request.reviewedBy = adminId;
    request.reviewedAt = new Date();
  }
  await request.save();

  logger.info('Admin updated verification request status', { adminId, requestId, newStatus: status });
  return { success: true, message: 'Verification request status updated', data: request };
}

export async function recalculateTrustScore(adminId: string, requestId: string) {
  const request = await VerificationRequest.findById(requestId);
  if (!request) throw Object.assign(new Error('Verification request not found'), { status: 404 });

  const organizer = await User.findById(request.organizerId);
  if (!organizer) throw Object.assign(new Error('Organizer not found'), { status: 404 });

  const trustScore = await TrustScoreService.calculateTrustScore(request.organizerId.toString());

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
  const subscription = await OrganizerSubscription.findOne({ organizerId: userId });
  if (!subscription) return { hasSubscription: false };
  return { hasSubscription: true, subscription: { ...subscription.toObject(), crmAccess: subscription.crmAccess || false } };
}

export async function overrideUserSubscription(adminId: string, userId: string, crmAccess?: boolean, addTrips?: number, setPlan?: string) {
  let subscription = await OrganizerSubscription.findOne({ organizerId: userId });

  if (!subscription) {
    const user = await User.findById(userId);
    if (user && (user.role === 'organizer' || user.role === 'admin')) {
      subscription = await OrganizerSubscription.create({ organizerId: userId, plan: 'free-trial', status: 'trial', isTrialActive: true });
    } else {
      throw Object.assign(new Error('No subscription found and user is not an organizer'), { status: 404 });
    }
  }

  const updates: any = {};
  if (crmAccess !== undefined) { subscription.crmAccess = crmAccess; updates.crmAccess = crmAccess; }
  if (addTrips && typeof addTrips === 'number') {
    subscription.tripsRemaining = (subscription.tripsRemaining || 0) + addTrips;
    subscription.tripsPerCycle = Math.max(subscription.tripsPerCycle, subscription.tripsRemaining);
    updates.tripsAdded = addTrips;
  }
  if (setPlan) { subscription.plan = setPlan; updates.plan = setPlan; }

  await subscription.save();
  logger.info('Admin updated user subscription manually', { adminId, targetUserId: userId, updates });
  return { success: true, subscription };
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
    user.organizerVerificationApprovedBy = adminId;
    if (!user.organizerProfile) user.organizerProfile = {} as any;
    if (!user.organizerProfile.autoPay) user.organizerProfile.autoPay = {} as any;
    user.organizerProfile.autoPay.autoPayEnabled = true;
    user.organizerProfile.autoPay.isSetupCompleted = true;
    user.markModified('organizerProfile');
  }

  await user.save();

  if (status === 'approved') {
    const existingSubscription = await OrganizerSubscription.findOne({ organizerId: user._id, status: { $in: ['active', 'trial'] } });
    if (!existingSubscription) {
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 30);
      await OrganizerSubscription.create({
        organizerId: user._id, plan: 'free-trial', status: 'trial', isTrialActive: true,
        trialStartDate: new Date(), trialEndDate, tripsPerCycle: 5, tripsUsed: 0, tripsRemaining: 5, pricePerCycle: 0, totalPaid: 0,
      });
    }
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
  const jobs = await RetryJob.find({}).sort({ createdAt: -1 }).limit(limit).skip(skip).lean();
  const total = await RetryJob.countDocuments({});
  return { data: jobs, pagination: { page, limit, total } };
}

export async function retryJob(jobId: string) {
  const job = await RetryJob.findById(jobId);
  if (!job) throw Object.assign(new Error('Retry job not found'), { status: 404 });
  job.status = 'pending';
  job.nextRetryAt = new Date();
  job.retryCount = 0;
  await job.save();
  return { success: true, job };
}

export async function cancelJob(jobId: string) {
  const job = await RetryJob.findById(jobId);
  if (!job) throw Object.assign(new Error('Retry job not found'), { status: 404 });
  job.status = 'cancelled';
  await job.save();
  return { success: true, job };
}
