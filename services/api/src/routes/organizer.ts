/**
 * Organizer Routes
 *
 * Thin router — delegates to organizer controller.
 * Business logic lives in modules/organizer/organizer.service.ts
 */

import { Router } from 'express';
import { authenticateJwt, requireRole } from '../middleware/auth';
import * as organizerController from '../modules/organizer/organizer.controller';

const router = Router();

router.get('/trips', authenticateJwt, requireRole(['organizer', 'admin']), organizerController.getTrips);
router.get('/pending-verifications', authenticateJwt, requireRole(['organizer', 'admin']), organizerController.getPendingVerifications);
router.post('/verify-payment/:bookingId', authenticateJwt, requireRole(['organizer', 'admin']), organizerController.verifyPayment);
router.get('/stats', authenticateJwt, requireRole(['organizer', 'admin']), organizerController.getStats);
router.get('/trip/:tripId/participants', authenticateJwt, requireRole(['organizer', 'admin']), organizerController.getTripParticipants);

export default router;
