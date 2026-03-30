/**
 * CRM Service
 *
 * All business logic extracted from routes/crm.ts.
 * No req/res objects — pure data in, data out.
 */

import Lead from '../../models/Lead';
import { LeadActivity } from '../../models/LeadActivity';
import { leadScoringService } from '../../services/leadScoringService';
import { Trip } from '../../models/Trip';
import { GroupBooking } from '../../models/GroupBooking';
import { User } from '../../models/User';
import { databaseImportService } from '../../services/databaseImportService';
import analyticsService from '../../services/analyticsService';
import notificationService from '../../services/notificationService';
import { PipelineStage } from '../../models/Lead';
import mongoose from 'mongoose';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CrmStatsResult {
  totalLeads: number;
  newLeads: number;
  contactedLeads: number;
  interestedLeads: number;
  qualifiedLeads: number;
  lostLeads: number;
  conversionRate: number;
  revenue: {
    total: number;
    thisMonth: number;
    lastMonth: number;
    growth: number;
    averageBookingValue: number;
  };
  bookings: { total: number; confirmed: number; pending: number };
  trips: { total: number; active: number };
}

export interface BookingsOverTimeResult {
  date: string;
  bookings: number;
  revenue: number;
}

export interface LeadSourceResult {
  source: string;
  count: number;
  converted: number;
  conversionRate: string;
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export async function getCrmStats(userId: string, isAdmin: boolean): Promise<CrmStatsResult> {
  const leadQuery: any = {};
  const tripQuery: any = {};
  const bookingQuery: any = {};

  if (!isAdmin && userId) {
    leadQuery.assignedTo = userId;
    tripQuery.organizerId = userId;
    const organizerTripIds = await Trip.find({ organizerId: userId }).distinct('_id');
    bookingQuery.tripId = { $in: organizerTripIds };
  }

  const leads = await Lead.find(leadQuery).lean();
  const trips = await Trip.find(tripQuery).select('_id price participants status').lean();

  bookingQuery.paymentStatus = { $in: ['completed', 'partial'] };
  bookingQuery.bookingStatus = { $in: ['confirmed', 'completed'] };
  const bookings = await GroupBooking.find(bookingQuery)
    .select('finalAmount paymentStatus bookingStatus createdAt advanceAmount')
    .lean();

  const calcRevenue = (b: any) =>
    b.paymentStatus === 'completed'
      ? b.finalAmount || 0
      : b.paymentStatus === 'partial'
      ? b.advanceAmount || 0
      : 0;

  const totalRevenue = bookings.reduce((s, b) => s + calcRevenue(b), 0);

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

  const thisMonthRevenue = bookings
    .filter(b => new Date(b.createdAt) >= startOfMonth)
    .reduce((s, b) => s + calcRevenue(b), 0);

  const lastMonthRevenue = bookings
    .filter(b => {
      const d = new Date(b.createdAt);
      return d >= startOfLastMonth && d <= endOfLastMonth;
    })
    .reduce((s, b) => s + calcRevenue(b), 0);

  const revenueGrowth =
    lastMonthRevenue > 0
      ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
      : thisMonthRevenue > 0
      ? 100
      : 0;

  const totalBookings = bookings.length;
  const confirmedBookings = bookings.filter(
    b => b.bookingStatus === 'confirmed' || b.bookingStatus === 'completed'
  ).length;

  return {
    totalLeads: leads.length,
    newLeads: leads.filter((l: any) => l.status === 'new').length,
    contactedLeads: leads.filter((l: any) => l.status === 'contacted').length,
    interestedLeads: leads.filter((l: any) => l.status === 'interested').length,
    qualifiedLeads: leads.filter((l: any) => l.status === 'qualified').length,
    lostLeads: leads.filter((l: any) => l.status === 'lost').length,
    conversionRate:
      leads.length > 0
        ? (leads.filter((l: any) => l.status === 'qualified').length / leads.length) * 100
        : 0,
    revenue: {
      total: totalRevenue,
      thisMonth: thisMonthRevenue,
      lastMonth: lastMonthRevenue,
      growth: revenueGrowth,
      averageBookingValue: totalBookings > 0 ? totalRevenue / totalBookings : 0,
    },
    bookings: {
      total: totalBookings,
      confirmed: confirmedBookings,
      pending: totalBookings - confirmedBookings,
    },
    trips: {
      total: trips.length,
      active: trips.filter((t: any) => t.status === 'active').length,
    },
  };
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export async function getBookingsOverTime(
  userId: string,
  isAdmin: boolean,
  days: number
): Promise<BookingsOverTimeResult[]> {
  const tripQuery: any = {};
  if (!isAdmin && userId) tripQuery.organizerId = userId;

  const tripIds = await Trip.find(tripQuery).distinct('_id');
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const bookings = await GroupBooking.find({
    tripId: { $in: tripIds },
    createdAt: { $gte: startDate, $lte: endDate },
  })
    .select('createdAt finalAmount paymentStatus')
    .lean();

  const byDate: Record<string, { count: number; revenue: number }> = {};
  bookings.forEach(b => {
    const date = new Date(b.createdAt).toISOString().split('T')[0];
    if (!byDate[date]) byDate[date] = { count: 0, revenue: 0 };
    byDate[date].count++;
    if (b.paymentStatus === 'completed' || b.paymentStatus === 'partial') {
      byDate[date].revenue += b.finalAmount || 0;
    }
  });

  const result: BookingsOverTimeResult[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    result.push({
      date: dateStr,
      bookings: byDate[dateStr]?.count || 0,
      revenue: byDate[dateStr]?.revenue || 0,
    });
  }
  return result;
}

export async function getPaymentStatusBreakdown(userId: string, isAdmin: boolean) {
  const tripQuery: any = {};
  if (!isAdmin && userId) tripQuery.organizerId = userId;

  const tripIds = await Trip.find(tripQuery).distinct('_id');
  const bookings = await GroupBooking.find({ tripId: { $in: tripIds } })
    .select('paymentStatus')
    .lean();

  const counts: Record<string, number> = {};
  bookings.forEach(b => {
    counts[b.paymentStatus] = (counts[b.paymentStatus] || 0) + 1;
  });

  return Object.entries(counts).map(([status, count]) => ({ status, count }));
}

export async function getRevenuePerTrip(userId: string, isAdmin: boolean) {
  const tripQuery: any = {};
  if (!isAdmin && userId) tripQuery.organizerId = userId;

  const trips = await Trip.find(tripQuery).select('_id title').lean();
  const tripIds = trips.map(t => t._id);

  const bookings = await GroupBooking.aggregate([
    { $match: { tripId: { $in: tripIds }, paymentStatus: { $in: ['completed', 'partial'] } } },
    { $group: { _id: '$tripId', revenue: { $sum: '$finalAmount' }, bookings: { $sum: 1 } } },
  ]);

  return bookings
    .map(b => {
      const trip = trips.find(t => t._id.toString() === b._id.toString());
      return { tripId: b._id, tripName: trip?.title || 'Unknown Trip', revenue: b.revenue, bookings: b.bookings };
    })
    .sort((a, b) => b.revenue - a.revenue);
}

export async function getLeadSources(userId: string, isAdmin: boolean): Promise<LeadSourceResult[]> {
  const leadQuery: any = {};
  if (!isAdmin && userId) leadQuery.assignedTo = userId;

  const leads = await Lead.aggregate([
    { $match: leadQuery },
    {
      $group: {
        _id: '$source',
        count: { $sum: 1 },
        converted: { $sum: { $cond: [{ $eq: ['$status', 'converted'] }, 1, 0] } },
      },
    },
    { $sort: { count: -1 } },
  ]);

  return leads.map(l => ({
    source: l._id || 'other',
    count: l.count,
    converted: l.converted,
    conversionRate: l.count > 0 ? ((l.converted / l.count) * 100).toFixed(2) : '0.00',
  }));
}

// ─── Lead import / export ─────────────────────────────────────────────────────

export async function importLeadsFromFile(
  file: Express.Multer.File,
  organizerId: string
) {
  return databaseImportService.importDatabase(file as any, organizerId, undefined, {
    autoAssignToOrganizer: true,
    defaultLeadSource: 'form',
    defaultLeadStatus: 'new',
  });
}

export async function exportLeadsToCsv(
  userId: string,
  isAdmin: boolean,
  exportAllUsers: boolean
): Promise<{ csv: string; filename: string }> {
  let data: any[] = [];
  const date = new Date().toISOString().split('T')[0];

  if (exportAllUsers) {
    data = await User.find({ role: 'traveler' }).select('name email phone createdAt').lean();
    const rows = data
      .map(u => `"${u.name}","${u.email}","${u.phone || ''}","${u.createdAt}"`)
      .join('\n');
    return { csv: 'Name,Email,Phone,Joined At\n' + rows, filename: `all-users-export-${date}.csv` };
  }

  const query: any = {};
  if (!isAdmin) query.assignedTo = userId;
  data = await Lead.find(query).populate('tripId', 'title').lean();
  const rows = data
    .map(
      (l: any) =>
        `"${l.name || ''}","${l.email || ''}","${l.phone || ''}","${l.tripId?.title || 'N/A'}","${l.status}","${l.source}","${l.createdAt}"`
    )
    .join('\n');
  return { csv: 'Name,Email,Phone,Trip,Status,Source,Created At\n' + rows, filename: `leads-export-${date}.csv` };
}

// ─── Pipeline stage ───────────────────────────────────────────────────────────

const VALID_STAGES: PipelineStage[] = ['new', 'contacted', 'interested', 'negotiating', 'booked', 'lost'];

export async function updatePipelineStage(leadId: string, pipelineStage: string) {
  if (!VALID_STAGES.includes(pipelineStage as PipelineStage)) {
    throw Object.assign(new Error(`Invalid pipelineStage. Must be one of: ${VALID_STAGES.join(', ')}`), { status: 400 });
  }
  const lead = await Lead.findByIdAndUpdate(leadId, { $set: { pipelineStage } }, { new: true });
  if (!lead) throw Object.assign(new Error('Lead not found'), { status: 404 });
  return lead;
}

// ─── Activities ───────────────────────────────────────────────────────────────

export async function recordActivity(leadId: string, eventType: string, metadata: Record<string, any> = {}) {
  if (!leadId || !eventType) {
    throw Object.assign(new Error('leadId and eventType are required'), { status: 400 });
  }

  const activity = await LeadActivity.create({ leadId, eventType, metadata, timestamp: new Date() });

  if (eventType === 'booking_abandoned') {
    const lead = await Lead.findById(leadId);
    if (lead) {
      const abandonedCount = await LeadActivity.countDocuments({ leadId, eventType: 'booking_abandoned' });
      lead.leadScore = leadScoringService.computeScore(lead, abandonedCount);
      await lead.save();
    }
  }

  return activity;
}

export async function getActivitiesForLead(leadId: string) {
  return LeadActivity.find({ leadId }).sort({ timestamp: -1 }).limit(50).lean();
}

// ─── Rescore ──────────────────────────────────────────────────────────────────

export async function rescoreLeads(organizerId: string): Promise<{ total: number; updated: number }> {
  const leads = await Lead.find({ assignedTo: organizerId });
  let updated = 0;

  for (const lead of leads) {
    const abandonedCount = await LeadActivity.countDocuments({ leadId: lead._id, eventType: 'booking_abandoned' });
    const newScore = leadScoringService.computeScore(lead, abandonedCount);
    if (newScore !== lead.leadScore) {
      lead.leadScore = newScore;
      await lead.save();
      updated++;
    }
  }

  return { total: leads.length, updated };
}

// ─── Organizer analytics (delegated to analyticsService) ─────────────────────

export async function getOrganizerAnalytics(organizerId: string, startDate?: string, endDate?: string) {
  const dateRange =
    startDate && endDate
      ? { start: new Date(startDate), end: new Date(endDate) }
      : undefined;
  return analyticsService.getOrganizerAnalytics(organizerId, dateRange);
}

export async function getUserAnalytics(userId: string) {
  return analyticsService.getUserAnalytics(userId);
}

export async function getAdminAnalytics(startDate?: string, endDate?: string) {
  const dateRange =
    startDate && endDate
      ? { start: new Date(startDate), end: new Date(endDate) }
      : undefined;
  return analyticsService.getAdminAnalytics(dateRange);
}

export async function getLeadSourcesBreakdown() {
  return analyticsService.getLeadSourcesBreakdown();
}

export async function getTicketCategoryBreakdown() {
  return analyticsService.getTicketCategoryBreakdown();
}

// ─── Notifications ────────────────────────────────────────────────────────────

export async function getUserNotifications(
  userId: string,
  opts: { limit?: number; skip?: number; unreadOnly?: boolean }
) {
  return notificationService.getUserNotifications(userId, opts);
}

export async function markNotificationRead(notificationId: string) {
  return notificationService.markAsRead(notificationId);
}

export async function markAllNotificationsRead(userId: string) {
  return notificationService.markAllAsRead(userId);
}
