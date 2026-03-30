/**
 * CRM Routes
 *
 * Thin router — validates requests, delegates to controllers.
 * Business logic lives in modules/crm/crm.service.ts
 */

import express from 'express';
import multer from 'multer';
import leadController from '../controllers/leadController';
import ticketController from '../controllers/ticketController';
import verificationController from '../controllers/verificationController';
import subscriptionController from '../controllers/subscriptionController';
import bankDetailsController from '../controllers/bankDetailsController';
import * as crmController from '../modules/crm/crm.controller';
import {
  requireAdmin,
  requireOrganizerOrAdmin,
} from '../middleware/roleCheck';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Multer for legacy CSV import endpoint
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, 'uploads/crm_imports/'),
    filename: (_req, file, cb) => cb(null, `import-${Date.now()}-${file.originalname}`),
  }),
});

// All CRM routes require authentication
router.use(authenticateToken);

// ─── Lead management ──────────────────────────────────────────────────────────
router.post('/leads', requireOrganizerOrAdmin, leadController.createLead);
router.get('/leads', requireOrganizerOrAdmin, leadController.getLeads);
router.get('/leads/:id', requireOrganizerOrAdmin, leadController.getLeadById);
router.put('/leads/:id', requireOrganizerOrAdmin, leadController.updateLead);
router.post('/leads/:id/interactions', requireOrganizerOrAdmin, leadController.addInteraction);
router.post('/leads/:id/convert', requireOrganizerOrAdmin, leadController.convertLead);

// ─── Lead pipeline, activities, rescore ──────────────────────────────────────
router.patch('/leads/:id/pipeline-stage', requireOrganizerOrAdmin, crmController.updatePipelineStage);
router.post('/leads/activities', requireOrganizerOrAdmin, crmController.recordActivity);
router.get('/leads/activities/:leadId', requireOrganizerOrAdmin, crmController.getActivities);
router.post('/leads/rescore', requireOrganizerOrAdmin, crmController.rescoreLeads);

// ─── CRM stats ────────────────────────────────────────────────────────────────
router.get('/stats', requireOrganizerOrAdmin, crmController.getStats);

// ─── Support tickets ──────────────────────────────────────────────────────────
router.post('/tickets', ticketController.createTicket);
router.get('/tickets', ticketController.getTickets);
router.get('/tickets/:id', ticketController.getTicketById);
router.put('/tickets/:id/status', requireAdmin, ticketController.updateTicketStatus);
router.post('/tickets/:id/messages', ticketController.addMessage);
router.put('/tickets/:id/assign', requireAdmin, ticketController.assignTicket);
router.post('/tickets/:id/resolve', requireAdmin, ticketController.resolveTicket);

// ─── Trip verification ────────────────────────────────────────────────────────
router.post('/verifications', requireOrganizerOrAdmin, verificationController.submitForVerification);
router.get('/verifications', requireOrganizerOrAdmin, verificationController.getVerifications);
router.get('/verifications/trip/:tripId', verificationController.getVerificationByTripId);
router.put('/verifications/trip/:tripId/status', requireAdmin, verificationController.updateVerificationStatus);
router.put('/verifications/trip/:tripId/checklist', requireAdmin, verificationController.updateChecklistItem);

// ─── Subscriptions ────────────────────────────────────────────────────────────
router.post('/subscriptions/trial', requireOrganizerOrAdmin, subscriptionController.createTrialSubscription);
router.post('/subscriptions/purchase/trip-package', requireOrganizerOrAdmin, subscriptionController.purchaseTripPackage);
router.post('/subscriptions/purchase/crm-bundle', requireOrganizerOrAdmin, subscriptionController.purchaseCRMBundle);
router.get('/subscriptions/my', requireOrganizerOrAdmin, subscriptionController.getSubscription);
router.get('/subscriptions/:organizerId', requireAdmin, subscriptionController.getSubscription);
router.get('/subscriptions', requireAdmin, subscriptionController.getAllSubscriptions);
router.post('/subscriptions/use-trip-slot', requireAdmin, subscriptionController.useTripSlot);

// ─── Bank details ─────────────────────────────────────────────────────────────
router.put('/bank-details', requireOrganizerOrAdmin, bankDetailsController.updateBankDetails);
router.get('/bank-details', requireOrganizerOrAdmin, bankDetailsController.getBankDetails);
router.get('/bank-details/:organizerId', requireAdmin, bankDetailsController.getFullBankDetails);
router.delete('/bank-details', requireOrganizerOrAdmin, bankDetailsController.deleteBankDetails);

// ─── Analytics ────────────────────────────────────────────────────────────────
router.get('/analytics/bookings-over-time', requireOrganizerOrAdmin, crmController.getBookingsOverTime);
router.get('/analytics/payment-status', requireOrganizerOrAdmin, crmController.getPaymentStatus);
router.get('/analytics/revenue-per-trip', requireOrganizerOrAdmin, crmController.getRevenuePerTrip);
router.get('/analytics/lead-sources', requireOrganizerOrAdmin, crmController.getLeadSources);
router.get('/analytics/organizer', requireOrganizerOrAdmin, crmController.getOrganizerAnalytics);
router.get('/analytics/user', crmController.getUserAnalytics);
router.get('/analytics/admin', requireAdmin, crmController.getAdminAnalytics);
// Note: duplicate /analytics/lead-sources below kept for backward compat (admin-only variant)
router.get('/analytics/lead-sources-admin', requireAdmin, crmController.getLeadSourcesBreakdown);
router.get('/analytics/ticket-categories', requireAdmin, crmController.getTicketCategories);

// ─── Lead import / export ─────────────────────────────────────────────────────
router.post('/import/leads', requireOrganizerOrAdmin, upload.single('file'), crmController.importLeads);
router.get('/export/leads', requireOrganizerOrAdmin, crmController.exportLeads);

// ─── Notifications ────────────────────────────────────────────────────────────
router.get('/notifications', crmController.getNotifications);
router.put('/notifications/:id/read', crmController.markNotificationRead);
router.put('/notifications/read-all', crmController.markAllNotificationsRead);

export default router;
