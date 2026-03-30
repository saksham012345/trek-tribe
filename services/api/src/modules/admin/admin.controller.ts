/**
 * Admin Controller
 *
 * Handles req/res, delegates all logic to admin.service.ts.
 * No business logic lives here.
 */

import { Request, Response } from 'express';
import * as adminService from './admin.service';
import { logger } from '../../utils/logger';

// ─── Dashboard ────────────────────────────────────────────────────────────────

export async function getDashboardStats(req: Request, res: Response) {
  try {
    const data = await adminService.getDashboardStats();
    res.json(data);
  } catch (error: any) {
    logger.error('Error fetching admin stats', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
}

export async function getUserStats(req: Request, res: Response) {
  try {
    const data = await adminService.getUserStats();
    res.json(data);
  } catch (error: any) {
    logger.error('Error fetching user stats', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch user statistics' });
  }
}

export async function getTripStats(req: Request, res: Response) {
  try {
    const data = await adminService.getTripStats();
    res.json(data);
  } catch (error: any) {
    logger.error('Error fetching trip stats', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch trip statistics' });
  }
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function listUsers(req: Request, res: Response) {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = (req.query.search as string) || '';
    const role = req.query.role as string;
    const data = await adminService.listUsers(page, limit, search, role);
    res.json(data);
  } catch (error: any) {
    logger.error('Error fetching users', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch users' });
  }
}

export async function listUserContacts(req: Request, res: Response) {
  try {
    const adminId = (req as any).auth.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const search = (req.query.search as string) || '';
    const role = req.query.role as string;
    const data = await adminService.listUserContacts(adminId, page, limit, search, role);
    res.json(data);
  } catch (error: any) {
    logger.error('Error fetching user contacts', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch user contacts' });
  }
}

export async function getUserContact(req: Request, res: Response) {
  try {
    const adminId = (req as any).auth.userId;
    const data = await adminService.getUserContact(adminId, req.params.id);
    res.json(data);
  } catch (error: any) {
    logger.error('Error fetching user contact details', { error: error.message });
    res.status(error.status || 500).json({ error: error.message || 'Failed to fetch user contact details' });
  }
}

export async function exportUserContacts(req: Request, res: Response) {
  try {
    const adminId = (req as any).auth.userId;
    const role = req.query.role as string;
    const { csv, filename } = await adminService.exportUserContacts(adminId, role);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (error: any) {
    logger.error('Error exporting user contacts', { error: error.message });
    res.status(500).json({ error: 'Failed to export user contacts' });
  }
}

export async function updateUserRole(req: Request, res: Response) {
  try {
    const adminId = (req as any).auth.userId;
    const data = await adminService.updateUserRole(adminId, req.params.id, req.body.role);
    res.json(data);
  } catch (error: any) {
    logger.error('Error updating user role', { error: error.message });
    res.status(error.status || 500).json({ error: error.message || 'Failed to update user role' });
  }
}

export async function deleteUser(req: Request, res: Response) {
  try {
    const adminId = (req as any).auth.userId;
    const data = await adminService.deleteUser(adminId, req.params.id);
    res.json(data);
  } catch (error: any) {
    logger.error('Error deleting user', { error: error.message });
    res.status(error.status || 500).json({ error: error.message || 'Failed to delete user' });
  }
}

// ─── Trips ────────────────────────────────────────────────────────────────────

export async function listTrips(req: Request, res: Response) {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = (req.query.search as string) || '';
    const status = req.query.status as string;
    const data = await adminService.listTrips(page, limit, search, status);
    res.json(data);
  } catch (error: any) {
    logger.error('Error fetching trips', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch trips' });
  }
}

export async function listPendingVerificationTrips(req: Request, res: Response) {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const data = await adminService.listPendingVerificationTrips(page, limit);
    res.json(data);
  } catch (error: any) {
    logger.error('Error fetching pending verification trips', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch pending verification trips' });
  }
}

export async function verifyTrip(req: Request, res: Response) {
  try {
    const adminId = (req as any).auth.userId;
    const data = await adminService.verifyTrip(adminId, req.params.id, req.body.adminNotes);
    res.json(data);
  } catch (error: any) {
    logger.error('Error approving trip', { error: error.message });
    res.status(error.status || 500).json({ error: error.message || 'Failed to approve trip' });
  }
}

export async function rejectTrip(req: Request, res: Response) {
  try {
    const adminId = (req as any).auth.userId;
    const data = await adminService.rejectTrip(adminId, req.params.id, req.body.rejectionReason, req.body.adminNotes);
    res.json(data);
  } catch (error: any) {
    logger.error('Error rejecting trip', { error: error.message });
    res.status(error.status || 500).json({ error: error.message || 'Failed to reject trip' });
  }
}

export async function updateTripStatus(req: Request, res: Response) {
  try {
    const adminId = (req as any).auth.userId;
    const data = await adminService.updateTripStatus(adminId, req.params.id, req.body.status);
    res.json(data);
  } catch (error: any) {
    logger.error('Error updating trip status', { error: error.message });
    res.status(error.status || 500).json({ error: error.message || 'Failed to update trip status' });
  }
}

export async function deleteTrip(req: Request, res: Response) {
  try {
    const adminId = (req as any).auth.userId;
    const data = await adminService.deleteTrip(adminId, req.params.id);
    res.json(data);
  } catch (error: any) {
    logger.error('Error deleting trip', { error: error.message });
    res.status(error.status || 500).json({ error: error.message || 'Failed to delete trip' });
  }
}

// ─── Email / cleanup ──────────────────────────────────────────────────────────

export async function getEmailStatus(req: Request, res: Response) {
  try {
    const data = await adminService.getEmailStatus();
    res.json(data);
  } catch (error: any) {
    logger.error('Error getting email service status', { error: error.message });
    res.status(500).json({ error: 'Failed to get email service status' });
  }
}

export async function getEmailHealth(req: Request, res: Response) {
  try {
    const data = await adminService.getEmailHealth();
    res.json(data);
  } catch (error: any) {
    logger.error('Error checking email health', { error: error.message });
    res.status(500).json({ error: 'Failed to check email health' });
  }
}

export async function performCleanup(req: Request, res: Response) {
  try {
    const adminId = (req as any).auth.userId;
    const data = await adminService.performCleanup(adminId);
    res.json(data);
  } catch (error: any) {
    logger.error('Error during system cleanup', { error: error.message });
    res.status(500).json({ error: 'Failed to perform system cleanup' });
  }
}

// ─── Organizer verifications ──────────────────────────────────────────────────

export async function getPendingOrganizerVerifications(req: Request, res: Response) {
  try {
    const data = await adminService.getPendingOrganizerVerifications();
    res.json(data);
  } catch (error: any) {
    logger.error('Error fetching pending verifications', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch pending verifications' });
  }
}

export async function approveOrganizerVerification(req: Request, res: Response) {
  try {
    const adminId = (req as any).auth.userId;
    const data = await adminService.approveOrganizerVerification(adminId, req.params.userId);
    res.json(data);
  } catch (error: any) {
    logger.error('Error approving organizer verification', { error: error.message });
    res.status(error.status || 500).json({ error: error.message || 'Failed to approve verification' });
  }
}

export async function rejectOrganizerVerification(req: Request, res: Response) {
  try {
    const adminId = (req as any).auth.userId;
    const data = await adminService.rejectOrganizerVerification(adminId, req.params.userId, req.body.reason);
    res.json(data);
  } catch (error: any) {
    logger.error('Error rejecting organizer verification', { error: error.message });
    res.status(error.status || 500).json({ error: error.message || 'Failed to reject verification' });
  }
}

export async function getAllOrganizerVerifications(req: Request, res: Response) {
  try {
    const data = await adminService.getAllOrganizerVerifications(req.query.status as string);
    res.json(data);
  } catch (error: any) {
    logger.error('Error fetching organizer verifications', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch verifications' });
  }
}

// ─── Verification requests ────────────────────────────────────────────────────

export async function listVerificationRequests(req: Request, res: Response) {
  try {
    const adminId = (req as any).auth.userId;
    const { status, requestType, priority, page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    const data = await adminService.listVerificationRequests(
      { status, requestType, priority },
      Number(page), Number(limit),
      sortBy as string, sortOrder as string
    );
    res.json(data);
    logger.info('Admin fetched verification requests', { adminId, count: data.data.length });
  } catch (error: any) {
    logger.error('Error fetching verification requests', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to fetch verification requests' });
  }
}

export async function getVerificationRequestById(req: Request, res: Response) {
  try {
    const adminId = (req as any).auth.userId;
    const data = await adminService.getVerificationRequestById(req.params.id);
    res.json(data);
    logger.info('Admin viewed verification request details', { adminId, requestId: req.params.id });
  } catch (error: any) {
    logger.error('Error fetching verification request details', { error: error.message });
    res.status(error.status || 500).json({ success: false, error: error.message || 'Failed to fetch verification request details' });
  }
}

export async function approveVerificationRequest(req: Request, res: Response) {
  try {
    const adminId = (req as any).auth.userId;
    const { trustScore, verificationBadge, enableRouting, adminNotes } = req.body;
    const data = await adminService.approveVerificationRequest(adminId, req.params.id, trustScore, verificationBadge, enableRouting, adminNotes);
    res.json(data);
  } catch (error: any) {
    logger.error('Error approving verification request', { error: error.message });
    res.status(error.status || 500).json({ success: false, error: error.message || 'Failed to approve verification request' });
  }
}

export async function rejectVerificationRequest(req: Request, res: Response) {
  try {
    const adminId = (req as any).auth.userId;
    const { rejectionReason, adminNotes } = req.body;
    const data = await adminService.rejectVerificationRequest(adminId, req.params.id, rejectionReason, adminNotes);
    res.json(data);
  } catch (error: any) {
    logger.error('Error rejecting verification request', { error: error.message });
    res.status(error.status || 500).json({ success: false, error: error.message || 'Failed to reject verification request' });
  }
}

export async function updateVerificationRequestStatus(req: Request, res: Response) {
  try {
    const adminId = (req as any).auth.userId;
    const { status, priority, adminNotes } = req.body;
    const data = await adminService.updateVerificationRequestStatus(adminId, req.params.id, status, priority, adminNotes);
    res.json(data);
  } catch (error: any) {
    logger.error('Error updating verification request status', { error: error.message });
    res.status(error.status || 500).json({ success: false, error: error.message || 'Failed to update verification request status' });
  }
}

export async function recalculateTrustScore(req: Request, res: Response) {
  try {
    const adminId = (req as any).auth.userId;
    const data = await adminService.recalculateTrustScore(adminId, req.params.id);
    res.json(data);
  } catch (error: any) {
    logger.error('Error recalculating trust score', { error: error.message });
    res.status(error.status || 500).json({ success: false, error: error.message || 'Failed to recalculate trust score' });
  }
}

// ─── Subscription management ──────────────────────────────────────────────────

export async function getUserSubscription(req: Request, res: Response) {
  try {
    const data = await adminService.getUserSubscription(req.params.id);
    res.json(data);
  } catch (error: any) {
    logger.error('Error fetching user subscription', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch subscription' });
  }
}

export async function overrideUserSubscription(req: Request, res: Response) {
  try {
    const adminId = (req as any).auth.userId;
    const { crmAccess, addTrips, setPlan } = req.body;
    const data = await adminService.overrideUserSubscription(adminId, req.params.id, crmAccess, addTrips, setPlan);
    res.json(data);
  } catch (error: any) {
    logger.error('Error updating subscription override', { error: error.message });
    res.status(error.status || 500).json({ error: error.message || 'Failed to update subscription' });
  }
}

// ─── Trust score ──────────────────────────────────────────────────────────────

export async function manageTrustScore(req: Request, res: Response) {
  try {
    const adminId = (req as any).auth.userId;
    const data = await adminService.manageTrustScore(adminId, req.params.id, req.body.manualScore);
    res.json(data);
  } catch (error: any) {
    logger.error('Error calculating trust score', { error: error.message });
    res.status(error.status || 500).json({ error: error.message || 'Failed to calculate trust score' });
  }
}

export async function verifyOrganizer(req: Request, res: Response) {
  try {
    const adminId = (req as any).auth.userId;
    const { status, notes } = req.body;
    const data = await adminService.verifyOrganizer(adminId, req.params.id, status, notes);
    res.json(data);
  } catch (error: any) {
    logger.error('Error verifying organizer', { error: error.message });
    res.status(error.status || 500).json({ error: error.message || 'Failed to verify organizer' });
  }
}

// ─── Retry jobs ───────────────────────────────────────────────────────────────

export async function listRetryJobs(req: Request, res: Response) {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const data = await adminService.listRetryJobs(page, limit);
    res.json(data);
  } catch (error: any) {
    logger.error('Error listing retry jobs', { error: error.message });
    res.status(500).json({ error: 'Failed to list retry jobs' });
  }
}

export async function retryJob(req: Request, res: Response) {
  try {
    const data = await adminService.retryJob(req.params.id);
    res.json(data);
  } catch (error: any) {
    logger.error('Error retrying job', { error: error.message });
    res.status(error.status || 500).json({ error: error.message || 'Failed to retry job' });
  }
}

export async function cancelJob(req: Request, res: Response) {
  try {
    const data = await adminService.cancelJob(req.params.id);
    res.json(data);
  } catch (error: any) {
    logger.error('Error cancelling job', { error: error.message });
    res.status(error.status || 500).json({ error: error.message || 'Failed to cancel job' });
  }
}
