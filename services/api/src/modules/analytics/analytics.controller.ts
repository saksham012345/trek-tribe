/**
 * Analytics Controller
 *
 * Handles req/res, delegates all logic to analytics.service.ts.
 * No business logic lives here.
 */

import { Request, Response } from 'express';
import * as analyticsService from './analytics.service';

// ─── Dashboard ────────────────────────────────────────────────────────────────

export async function getDashboard(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.userId;
    const userRole = (req as any).user?.role;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (userRole === 'admin') {
      const data = await analyticsService.getAdminDashboard();
      return res.json(data);
    } else if (userRole === 'organizer') {
      const data = await analyticsService.getOrganizerDashboard(userId);
      return res.json(data);
    } else {
      const data = await analyticsService.getTravelerDashboard(userId);
      return res.json(data);
    }
  } catch (error: any) {
    console.error('❌ Error fetching analytics:', error);
    return res.status(500).json({ error: 'Failed to fetch analytics', message: error.message });
  }
}

// ─── Revenue ──────────────────────────────────────────────────────────────────

export async function getRevenue(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.userId;
    const userRole = (req as any).user?.role;
    const data = await analyticsService.getRevenueAnalytics(userId, userRole);
    return res.json(data);
  } catch (error: any) {
    console.error('❌ Error fetching revenue analytics:', error);
    return res.status(500).json({ error: 'Failed to fetch revenue analytics' });
  }
}

// ─── Trips ────────────────────────────────────────────────────────────────────

export async function getTrips(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.userId;
    const userRole = (req as any).user?.role;
    const data = await analyticsService.getTripAnalytics(userId, userRole);
    return res.json(data);
  } catch (error: any) {
    console.error('❌ Error fetching trip analytics:', error);
    return res.status(500).json({ error: 'Failed to fetch trip analytics' });
  }
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function getUsers(req: Request, res: Response) {
  try {
    const data = await analyticsService.getUserGrowthAnalytics();
    return res.json(data);
  } catch (error: any) {
    console.error('❌ Error fetching user analytics:', error);
    return res.status(500).json({ error: 'Failed to fetch user analytics' });
  }
}

// ─── Leads ────────────────────────────────────────────────────────────────────

export async function getLeads(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.userId;
    const userRole = (req as any).user?.role;
    const data = await analyticsService.getLeadAnalytics(userId, userRole);
    return res.json(data);
  } catch (error: any) {
    console.error('❌ Error fetching lead analytics:', error);
    return res.status(500).json({ error: 'Failed to fetch lead analytics' });
  }
}

// ─── Performance ──────────────────────────────────────────────────────────────

export async function getPerformance(req: Request, res: Response) {
  try {
    const data = await analyticsService.getPlatformPerformance();
    return res.json(data);
  } catch (error: any) {
    console.error('❌ Error fetching performance metrics:', error);
    return res.status(500).json({ error: 'Failed to fetch performance metrics' });
  }
}

// ─── Retention ────────────────────────────────────────────────────────────────

export async function getRetention(req: Request, res: Response) {
  try {
    const data = await analyticsService.getRetentionCohorts();
    return res.json(data);
  } catch (error: any) {
    console.error('❌ Error fetching retention analytics:', error);
    return res.status(500).json({ error: 'Failed to fetch retention analytics' });
  }
}

// ─── Activity ─────────────────────────────────────────────────────────────────

export async function getActivity(req: Request, res: Response) {
  try {
    const data = await analyticsService.getActivityHeatmap();
    return res.json(data);
  } catch (error: any) {
    console.error('❌ Error fetching activity analytics:', error);
    return res.status(500).json({ error: 'Failed to fetch activity analytics' });
  }
}

// ─── Top organizers ───────────────────────────────────────────────────────────

export async function getTopOrganizers(req: Request, res: Response) {
  try {
    const data = await analyticsService.getTopOrganizers();
    return res.json(data);
  } catch (error: any) {
    console.error('❌ Error fetching top organizers:', error);
    return res.status(500).json({ error: 'Failed to fetch top organizers' });
  }
}

// ─── Sprint 3: read-only analytics ───────────────────────────────────────────
//
// Organizer-scoped. An admin may pass ?organizerId= to read someone else's;
// an organizer always reads their own, and the query param is ignored for them
// so it cannot be used to read across accounts.

function resolveOrganizerId(req: Request): string | null {
  const userId = (req as any).user?.userId;
  const role = (req as any).user?.role;
  if (!userId) return null;
  if (role === 'admin' && typeof req.query.organizerId === 'string') {
    return req.query.organizerId;
  }
  return userId;
}

export async function getOccupancy(req: Request, res: Response) {
  try {
    const organizerId = resolveOrganizerId(req);
    if (!organizerId) return res.status(401).json({ error: 'Unauthorized' });
    return res.json(await analyticsService.getOccupancyByTrip(organizerId));
  } catch (error: any) {
    console.error('❌ Error fetching occupancy:', error);
    return res.status(500).json({ error: 'Failed to fetch occupancy', message: error.message });
  }
}

export async function getProfitability(req: Request, res: Response) {
  try {
    const organizerId = resolveOrganizerId(req);
    if (!organizerId) return res.status(401).json({ error: 'Unauthorized' });
    return res.json(await analyticsService.getTripProfitability(organizerId));
  } catch (error: any) {
    console.error('❌ Error fetching profitability:', error);
    return res.status(500).json({ error: 'Failed to fetch profitability', message: error.message });
  }
}

export async function getCustomers(req: Request, res: Response) {
  try {
    const organizerId = resolveOrganizerId(req);
    if (!organizerId) return res.status(401).json({ error: 'Unauthorized' });
    return res.json(await analyticsService.getCustomerGeography(organizerId));
  } catch (error: any) {
    console.error('❌ Error fetching customer geography:', error);
    return res.status(500).json({ error: 'Failed to fetch customer geography', message: error.message });
  }
}

export async function getMarketing(req: Request, res: Response) {
  try {
    const organizerId = resolveOrganizerId(req);
    if (!organizerId) return res.status(401).json({ error: 'Unauthorized' });
    return res.json(await analyticsService.getMarketingPerformance(organizerId));
  } catch (error: any) {
    console.error('❌ Error fetching marketing performance:', error);
    return res.status(500).json({ error: 'Failed to fetch marketing performance', message: error.message });
  }
}
