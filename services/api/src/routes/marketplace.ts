/**
 * Marketplace Routes
 *
 * Thin router — delegates to marketplace controller.
 * Business logic lives in modules/marketplace/marketplace.service.ts
 */

import { Router } from 'express';
import { authenticateJwt, requireRole } from '../middleware/auth';
import * as marketplaceController from '../modules/marketplace/marketplace.controller';

const router = Router();

router.post('/organizer/onboard', authenticateJwt, requireRole(['organizer', 'admin']), marketplaceController.onboardOrganizer);
router.get('/organizer/status/:id?', authenticateJwt, requireRole(['organizer', 'admin']), marketplaceController.getOrganizerStatus);
router.post('/orders/create', authenticateJwt, requireRole(['traveler', 'organizer', 'admin']), marketplaceController.createOrder);
router.post('/payments/split', authenticateJwt, requireRole(['admin']), marketplaceController.splitPayment);
router.post('/refunds/initiate', authenticateJwt, requireRole(['admin']), marketplaceController.initiateRefund);
router.get('/organizer/settlements', authenticateJwt, requireRole(['organizer', 'admin']), marketplaceController.getSettlements);
router.get('/orders/:id', authenticateJwt, requireRole(['organizer', 'admin']), marketplaceController.getOrderById);
router.get('/config', authenticateJwt, requireRole(['organizer', 'admin']), marketplaceController.getConfig);

export default router;
