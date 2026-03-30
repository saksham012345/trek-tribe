/**
 * Trips Routes
 *
 * Thin router — delegates to modules/trips/trips.controller.ts.
 * Business logic lives in modules/trips/trips.service.ts
 */

import { Router } from 'express';
import { authenticateJwt, requireRole, requireEmailVerified } from '../middleware/auth';
import { verifyOrganizerApproved } from '../middleware/verifyOrganizer';
import { trackTripView } from '../middleware/tripViewTracker';
import { cacheMiddleware } from '../utils/cache';
import * as tripsController from '../modules/trips/trips.controller';

const router = Router();

// Async error wrapper
const asyncHandler = (fn: Function) => (req: any, res: any, next: any) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// ─── Routes ───────────────────────────────────────────────────────────────────

router.post('/', authenticateJwt, requireRole(['organizer', 'admin']), requireEmailVerified, verifyOrganizerApproved, asyncHandler(tripsController.createTrip));

router.get('/', cacheMiddleware(300), asyncHandler(tripsController.listTrips));

router.get('/by-slug/:slug', cacheMiddleware(300), trackTripView, asyncHandler(tripsController.getTripBySlug));

router.get('/:id', cacheMiddleware(300), trackTripView, asyncHandler(tripsController.getTripById));

router.post('/:id/join', authenticateJwt, asyncHandler(tripsController.joinTrip));

router.delete('/:id/leave', authenticateJwt, asyncHandler(tripsController.leaveTrip));

router.put('/:id', authenticateJwt, requireRole(['organizer', 'admin']), asyncHandler(tripsController.updateTrip));

router.delete('/:id', authenticateJwt, requireRole(['organizer', 'admin']), asyncHandler(tripsController.deleteTrip));

export default router;
