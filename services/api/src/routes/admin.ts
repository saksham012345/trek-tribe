/**
 * Admin Routes
 *
 * Thin router — delegates to admin controller.
 * Business logic lives in modules/admin/admin.service.ts
 */

import express from 'express';
import { authenticateJwt, requireRole } from '../middleware/auth';
import * as adminController from '../modules/admin/admin.controller';

const router = express.Router();

// All admin routes require admin role
router.use(authenticateJwt);
router.use(requireRole(['admin']));

// ─── Dashboard stats ──────────────────────────────────────────────────────────
router.get('/stats', adminController.getDashboardStats);
router.get('/users/stats', adminController.getUserStats);
router.get('/trips/stats', adminController.getTripStats);

// ─── Users ────────────────────────────────────────────────────────────────────
router.get('/users', adminController.listUsers);
router.get('/users/contacts', adminController.listUserContacts);
router.get('/users/export-contacts', adminController.exportUserContacts);
router.get('/users/:id/contact', adminController.getUserContact);
router.patch('/users/:id/role', adminController.updateUserRole);
router.delete('/users/:id', adminController.deleteUser);
router.get('/users/:id/subscription', adminController.getUserSubscription);
router.post('/users/:id/subscription-override', adminController.overrideUserSubscription);
router.post('/users/:id/trust-score', adminController.manageTrustScore);
router.post('/users/:id/verify-organizer', adminController.verifyOrganizer);

// ─── Trips ────────────────────────────────────────────────────────────────────
router.get('/trips', adminController.listTrips);
router.get('/trips/pending-verifications', adminController.listPendingVerificationTrips);
router.post('/trips/:id/verify', adminController.verifyTrip);
router.post('/trips/:id/reject', adminController.rejectTrip);
router.patch('/trips/:id/status', adminController.updateTripStatus);
router.delete('/trips/:id', adminController.deleteTrip);

// ─── Email / cleanup ──────────────────────────────────────────────────────────
router.get('/email-status', adminController.getEmailStatus);
router.get('/email/health', adminController.getEmailHealth);
router.post('/cleanup', adminController.performCleanup);

// ─── Organizer verifications ──────────────────────────────────────────────────
router.get('/organizer-verifications/pending', adminController.getPendingOrganizerVerifications);
router.post('/organizer-verifications/:userId/approve', adminController.approveOrganizerVerification);
router.post('/organizer-verifications/:userId/reject', adminController.rejectOrganizerVerification);
router.get('/organizer-verifications/all', adminController.getAllOrganizerVerifications);

// ─── Verification requests ────────────────────────────────────────────────────
router.get('/verification-requests', adminController.listVerificationRequests);
router.get('/verification-requests/:id', adminController.getVerificationRequestById);
router.post('/verification-requests/:id/approve', adminController.approveVerificationRequest);
router.post('/verification-requests/:id/reject', adminController.rejectVerificationRequest);
router.put('/verification-requests/:id/status', adminController.updateVerificationRequestStatus);
router.post('/verification-requests/:id/recalculate-score', adminController.recalculateTrustScore);

// ─── Retry jobs ───────────────────────────────────────────────────────────────
router.get('/retries', adminController.listRetryJobs);
router.post('/retries/:id/retry', adminController.retryJob);
router.post('/retries/:id/cancel', adminController.cancelJob);

export default router;
