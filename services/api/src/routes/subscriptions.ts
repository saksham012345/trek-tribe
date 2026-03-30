import { Router } from 'express';
import { authenticateJwt, requireRole } from '../middleware/auth';
import * as subscriptionsController from '../modules/subscriptions/subscriptions.controller';

const router = Router();

/**
 * GET /api/subscriptions/plans
 */
router.get('/plans', subscriptionsController.getPlans);

/**
 * GET /api/subscriptions/my
 */
router.get('/my', authenticateJwt, subscriptionsController.getMySubscription);

/**
 * POST /api/subscriptions/create-order
 */
router.post('/create-order', authenticateJwt, requireRole(['organizer', 'admin']), subscriptionsController.createOrder);

/**
 * POST /api/subscriptions/verify-payment
 */
router.post('/verify-payment', authenticateJwt, requireRole(['organizer', 'admin']), subscriptionsController.verifyPayment);

/**
 * POST /api/subscriptions/cancel
 */
router.post('/cancel', authenticateJwt, requireRole(['organizer']), subscriptionsController.cancelSubscription);

/**
 * GET /api/subscriptions/payment-history
 */
router.get('/payment-history', authenticateJwt, subscriptionsController.getPaymentHistory);

/**
 * POST /api/subscriptions/increment-trip
 */
router.post('/increment-trip', authenticateJwt, requireRole(['organizer']), subscriptionsController.incrementTrip);

/**
 * GET /api/subscriptions/check-eligibility
 */
router.get('/check-eligibility', authenticateJwt, requireRole(['organizer']), subscriptionsController.checkEligibility);

/**
 * POST /api/subscriptions/webhook
 */
router.post('/webhook', subscriptionsController.handleWebhook);

/**
 * GET /api/subscriptions/verify-crm-access
 */
router.get('/verify-crm-access', authenticateJwt, subscriptionsController.verifyCrmAccess);

/**
 * POST /api/subscriptions/check-feature-access
 */
router.post('/check-feature-access', authenticateJwt, subscriptionsController.checkFeatureAccess);

/**
 * GET /api/subscriptions/verify-organizer-info
 */
router.get('/verify-organizer-info', authenticateJwt, requireRole(['organizer']), subscriptionsController.verifyOrganizerInfo);

/**
 * PATCH /api/subscriptions/:organizerId — Admin only
 */
router.patch('/:organizerId', authenticateJwt, requireRole(['admin']), subscriptionsController.adminUpdateSubscription);

/**
 * GET /api/subscriptions/:organizerId
 */
router.get('/:organizerId', authenticateJwt, subscriptionsController.getSubscriptionByOrganizerId);

export default router;
