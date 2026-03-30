/**
 * CRM Controller
 *
 * Handles req/res, delegates all logic to crm.service.ts.
 * No business logic lives here.
 */

import { Response } from 'express';
import { AuthRequest } from '../../types/app-types';
import * as crmService from './crm.service';

// ─── Stats ────────────────────────────────────────────────────────────────────

export async function getStats(req: AuthRequest, res: Response) {
  try {
    const stats = await crmService.getCrmStats(req.user!.id, req.user!.role === 'admin');
    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch CRM stats', error: err.message });
  }
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export async function getBookingsOverTime(req: AuthRequest, res: Response) {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const data = await crmService.getBookingsOverTime(req.user!.id, req.user!.role === 'admin', days);
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch bookings over time', error: err.message });
  }
}

export async function getPaymentStatus(req: AuthRequest, res: Response) {
  try {
    const data = await crmService.getPaymentStatusBreakdown(req.user!.id, req.user!.role === 'admin');
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch payment status', error: err.message });
  }
}

export async function getRevenuePerTrip(req: AuthRequest, res: Response) {
  try {
    const data = await crmService.getRevenuePerTrip(req.user!.id, req.user!.role === 'admin');
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch revenue per trip', error: err.message });
  }
}

export async function getLeadSources(req: AuthRequest, res: Response) {
  try {
    const data = await crmService.getLeadSources(req.user!.id, req.user!.role === 'admin');
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch lead sources', error: err.message });
  }
}

export async function getOrganizerAnalytics(req: AuthRequest, res: Response) {
  try {
    const organizerId = req.user!.role === 'admin' ? (req.query.organizerId as string) : req.user!.id;
    if (!organizerId) return res.status(400).json({ success: false, message: 'Organizer ID required' });
    const data = await crmService.getOrganizerAnalytics(
      organizerId,
      req.query.startDate as string,
      req.query.endDate as string
    );
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch analytics', error: err.message });
  }
}

export async function getUserAnalytics(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.role === 'admin' ? (req.query.userId as string) : req.user!.id;
    if (!userId) return res.status(400).json({ success: false, message: 'User ID required' });
    const data = await crmService.getUserAnalytics(userId);
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch user analytics', error: err.message });
  }
}

export async function getAdminAnalytics(req: AuthRequest, res: Response) {
  try {
    const data = await crmService.getAdminAnalytics(
      req.query.startDate as string,
      req.query.endDate as string
    );
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch admin analytics', error: err.message });
  }
}

export async function getLeadSourcesBreakdown(req: AuthRequest, res: Response) {
  try {
    const data = await crmService.getLeadSourcesBreakdown();
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch lead sources', error: err.message });
  }
}

export async function getTicketCategories(req: AuthRequest, res: Response) {
  try {
    const data = await crmService.getTicketCategoryBreakdown();
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch ticket categories', error: err.message });
  }
}

// ─── Import / Export ──────────────────────────────────────────────────────────

export async function importLeads(req: AuthRequest, res: Response) {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });
    const result = await crmService.importLeadsFromFile(req.file as any, req.user!.id);
    res.json({ success: true, count: result.stats.successfulImports, message: `Successfully imported ${result.stats.successfulImports} leads` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function exportLeads(req: AuthRequest, res: Response) {
  try {
    const exportAllUsers = req.query.exportAllUsers === 'true';
    const { csv, filename } = await crmService.exportLeadsToCsv(req.user!.id, req.user!.role === 'admin', exportAllUsers);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to export data' });
  }
}

// ─── Pipeline stage ───────────────────────────────────────────────────────────

export async function updatePipelineStage(req: AuthRequest, res: Response) {
  try {
    const lead = await crmService.updatePipelineStage(req.params.id, req.body.pipelineStage);
    res.json({ success: true, data: lead });
  } catch (err: any) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
}

// ─── Activities ───────────────────────────────────────────────────────────────

export async function recordActivity(req: AuthRequest, res: Response) {
  try {
    const { leadId, eventType, metadata } = req.body;
    const activity = await crmService.recordActivity(leadId, eventType, metadata);
    res.status(201).json({ success: true, data: activity });
  } catch (err: any) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
}

export async function getActivities(req: AuthRequest, res: Response) {
  try {
    const activities = await crmService.getActivitiesForLead(req.params.leadId);
    res.json({ success: true, data: activities });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// ─── Rescore ──────────────────────────────────────────────────────────────────

export async function rescoreLeads(req: AuthRequest, res: Response) {
  try {
    const { total, updated } = await crmService.rescoreLeads(req.user!.id);
    res.json({ success: true, message: `Rescored ${updated} leads`, total, updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// ─── Notifications ────────────────────────────────────────────────────────────

export async function getNotifications(req: AuthRequest, res: Response) {
  try {
    const { limit, skip, unreadOnly } = req.query;
    const result = await crmService.getUserNotifications(req.user!.id, {
      limit: limit ? Number(limit) : undefined,
      skip: skip ? Number(skip) : undefined,
      unreadOnly: unreadOnly === 'true',
    });
    res.json({ success: true, data: result.notifications, unreadCount: result.unreadCount });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch notifications', error: err.message });
  }
}

export async function markNotificationRead(req: AuthRequest, res: Response) {
  try {
    const notification = await crmService.markNotificationRead(req.params.id);
    res.json({ success: true, data: notification });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Failed to mark notification as read', error: err.message });
  }
}

export async function markAllNotificationsRead(req: AuthRequest, res: Response) {
  try {
    await crmService.markAllNotificationsRead(req.user!.id);
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Failed to mark all as read', error: err.message });
  }
}
