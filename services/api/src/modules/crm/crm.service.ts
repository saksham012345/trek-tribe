/**
 * CRM Service
 *
 * All business logic extracted from routes/crm.ts.
 * No req/res objects — pure data in, data out.
 */



import { prisma } from '../../lib/prisma';
import { withMongoId, withMongoIds } from '../../lib/apiShape';
import { leadScoringService } from '../../services/leadScoringService';
import { toNumber } from '../../lib/money';
import { UserPrisma as User } from '../../models/userPrismaAdapter';
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
    // Was: fetch every trip id, then filter bookings by that list.
    // `trip: { organizerId }` is the same restriction as a join condition.
    bookingQuery.trip = { organizerId: userId };
  }

  const leads = await prisma.lead.findMany({ where: leadQuery });
  const trips = await prisma.trip.findMany({
    where: tripQuery,
    select: { id: true, price: true, status: true, _count: { select: { participants: true } } },
  });

  bookingQuery.paymentStatus = { in: ['completed', 'partial'] };
  bookingQuery.bookingStatus = { in: ['confirmed', 'completed'] };
  const bookings = await prisma.groupBooking.findMany({
    where: bookingQuery,
    select: {
      finalAmount: true, paymentStatus: true, bookingStatus: true,
      createdAt: true, advanceAmount: true,
    },
  });

  // finalAmount and advanceAmount are Decimal columns; `s + b.finalAmount` in
  // the reduce below would concatenate strings rather than add.
  const calcRevenue = (b: any) =>
    b.paymentStatus === 'completed'
      ? toNumber(b.finalAmount)
      : b.paymentStatus === 'partial'
      ? toNumber(b.advanceAmount)
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

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const bookings = await prisma.groupBooking.findMany({
    where: {
      ...(Object.keys(tripQuery).length ? { trip: tripQuery } : {}),
      createdAt: { gte: startDate, lte: endDate },
    },
    select: { createdAt: true, finalAmount: true, paymentStatus: true },
  });

  const byDate: Record<string, { count: number; revenue: number }> = {};
  bookings.forEach(b => {
    const date = new Date(b.createdAt).toISOString().split('T')[0];
    if (!byDate[date]) byDate[date] = { count: 0, revenue: 0 };
    byDate[date].count++;
    if (b.paymentStatus === 'completed' || b.paymentStatus === 'partial') {
      byDate[date].revenue += toNumber(b.finalAmount);
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

  // Was: load every booking's paymentStatus and tally them in JavaScript.
  const groups = await prisma.groupBooking.groupBy({
    by: ['paymentStatus'],
    where: Object.keys(tripQuery).length ? { trip: tripQuery } : {},
    _count: { paymentStatus: true },
  });

  return groups.map(g => ({ status: g.paymentStatus, count: g._count.paymentStatus }));
}

export async function getRevenuePerTrip(userId: string, isAdmin: boolean) {
  const tripQuery: any = {};
  if (!isAdmin && userId) tripQuery.organizerId = userId;

  const trips = await prisma.trip.findMany({
    where: tripQuery,
    select: { id: true, title: true },
  });
  const titleById = new Map(trips.map(t => [t.id, t.title]));

  const grouped = await prisma.groupBooking.groupBy({
    by: ['tripId'],
    where: {
      tripId: { in: trips.map(t => t.id) },
      paymentStatus: { in: ['completed', 'partial'] },
    },
    _sum: { finalAmount: true },
    _count: { _all: true },
  });

  return grouped
    .map(g => ({
      tripId: g.tripId,
      tripName: titleById.get(g.tripId) || 'Unknown Trip',
      revenue: toNumber(g._sum.finalAmount),
      bookings: g._count._all,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

export async function getLeadSources(userId: string, isAdmin: boolean): Promise<LeadSourceResult[]> {
  const leadQuery: any = {};
  if (!isAdmin && userId) leadQuery.assignedTo = userId;

  // One $group counted totals and conversions together with a $cond. groupBy
  // cannot express a conditional sum, so it is two grouped counts joined here.
  const [totals, convertedTotals] = await Promise.all([
    prisma.lead.groupBy({ by: ['source'], where: leadQuery, _count: { source: true } }),
    prisma.lead.groupBy({
      by: ['source'],
      where: { ...leadQuery, status: 'converted' },
      _count: { source: true }
    })
  ]);

  const convertedBySource = new Map(convertedTotals.map(c => [c.source, c._count.source]));

  return totals
    .map(t => {
      const count = t._count.source;
      const converted = convertedBySource.get(t.source) ?? 0;
      return {
        source: t.source || 'other',
        count,
        converted,
        conversionRate: count > 0 ? ((converted / count) * 100).toFixed(2) : '0.00',
      };
    })
    .sort((a, b) => b.count - a.count);
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
  data = await prisma.lead.findMany({ where: query });

  // populate('tripId') is gone - trips are still Mongo documents - so the titles
  // are fetched in one query and looked up, rather than one round trip per row.
  const tripIds = Array.from(new Set(data.map((l: any) => l.tripId).filter(Boolean)));
  const trips = tripIds.length
    ? await prisma.trip.findMany({ where: { id: { in: tripIds } }, select: { id: true, title: true } })
    : [];
  const tripTitleById = new Map(trips.map((t: any) => [t._id.toString(), t.title]));

  const rows = data
    .map(
      (l: any) =>
        `"${l.name || ''}","${l.email || ''}","${l.phone || ''}","${(l.tripId && tripTitleById.get(l.tripId)) || 'N/A'}","${l.status}","${l.source}","${l.createdAt}"`
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
  const existing = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!existing) throw Object.assign(new Error('Lead not found'), { status: 404 });

  const updated = await prisma.lead.update({
    where: { id: leadId },
    data: { pipelineStage: pipelineStage as any }
  });
  return withMongoId(updated);
}

// ─── Activities ───────────────────────────────────────────────────────────────

export async function recordActivity(leadId: string, eventType: string, metadata: Record<string, any> = {}) {
  if (!leadId || !eventType) {
    throw Object.assign(new Error('leadId and eventType are required'), { status: 400 });
  }

  // leadId is a real foreign key now, so an activity for a lead that does not
  // exist is refused here rather than stored and orphaned.
  const activity = await prisma.leadActivity.create({
    data: { leadId, eventType: eventType as any, metadata, timestamp: new Date() }
  });

  if (eventType === 'booking_abandoned') {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: { interactions: { select: { type: true } } }
    });
    if (lead) {
      const abandonedCount = await prisma.leadActivity.count({
        where: { leadId, eventType: 'booking_abandoned' }
      });
      await prisma.lead.update({
        where: { id: leadId },
        data: { leadScore: leadScoringService.computeScore(lead, abandonedCount) }
      });
    }
  }

  return withMongoId(activity);
}

export async function getActivitiesForLead(leadId: string) {
  const activities = await prisma.leadActivity.findMany({
    where: { leadId },
    orderBy: { timestamp: 'desc' },
    take: 50
  });
  return withMongoIds(activities);
}

// ─── Rescore ──────────────────────────────────────────────────────────────────

export async function rescoreLeads(organizerId: string): Promise<{ total: number; updated: number }> {
  // interactions are a relation now, and the score reads them, so they are
  // loaded with the lead instead of being one more query per row.
  const leads = await prisma.lead.findMany({
    where: { assignedTo: organizerId },
    include: { interactions: { select: { type: true } } }
  });
  let updated = 0;

  for (const lead of leads) {
    const abandonedCount = await prisma.leadActivity.count({
      where: { leadId: lead.id, eventType: 'booking_abandoned' }
    });
    const newScore = leadScoringService.computeScore(lead, abandonedCount);
    if (newScore !== lead.leadScore) {
      await prisma.lead.update({ where: { id: lead.id }, data: { leadScore: newScore } });
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
