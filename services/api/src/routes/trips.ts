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
import * as lifecycleController from '../modules/trips/tripLifecycle.controller';

const router = Router();

// Async error wrapper
const asyncHandler = (fn: Function) => (req: any, res: any, next: any) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// ─── Routes ───────────────────────────────────────────────────────────────────

router.post('/', authenticateJwt, requireRole(['organizer', 'admin']), requireEmailVerified, verifyOrganizerApproved, asyncHandler(tripsController.createTrip));

router.get('/', cacheMiddleware(300), asyncHandler(tripsController.listTrips));

router.get('/by-slug/:slug', cacheMiddleware(300), trackTripView, asyncHandler(tripsController.getTripBySlug));

// ─── Sprint 4: templates and series ──────────────────────────────────────────
// Registered above '/:id' deliberately. Express matches in order, so a literal
// path that shares a prefix with a parameter route has to come first or the
// parameter swallows it — '/templates' would arrive as a trip with id
// "templates". The two-segment names below happen not to collide today, but
// the ordering is what keeps that true when someone adds '/templates' later.
router.get('/templates/list', authenticateJwt, requireRole(['organizer', 'admin']), asyncHandler(lifecycleController.listTemplates));
router.post('/templates', authenticateJwt, requireRole(['organizer', 'admin']), asyncHandler(lifecycleController.createTemplate));
router.delete('/templates/:id', authenticateJwt, requireRole(['organizer', 'admin']), asyncHandler(lifecycleController.deleteTemplate));
router.post('/templates/:id/create-trip', authenticateJwt, requireRole(['organizer', 'admin']), asyncHandler(lifecycleController.createTripFromTemplate));

router.get('/series/list', authenticateJwt, requireRole(['organizer', 'admin']), asyncHandler(lifecycleController.listSeries));
router.post('/series', authenticateJwt, requireRole(['organizer', 'admin']), asyncHandler(lifecycleController.createSeries));

router.get('/:id', cacheMiddleware(300), trackTripView, asyncHandler(tripsController.getTripById));

router.post('/:id/join', authenticateJwt, asyncHandler(tripsController.joinTrip));

router.delete('/:id/leave', authenticateJwt, asyncHandler(tripsController.leaveTrip));

router.put('/:id', authenticateJwt, requireRole(['organizer', 'admin']), asyncHandler(tripsController.updateTrip));

router.delete('/:id', authenticateJwt, requireRole(['organizer', 'admin']), asyncHandler(tripsController.deleteTrip));

// ─── Sprint 4: publication and duplication ───────────────────────────────────
// Organizer-owned actions. Ownership is checked in the service against the
// authenticated user, not taken from the request body.

router.post('/:id/publication', authenticateJwt, requireRole(['organizer', 'admin']), asyncHandler(lifecycleController.setPublication));
router.post('/:id/duplicate', authenticateJwt, requireRole(['organizer', 'admin']), asyncHandler(lifecycleController.duplicateTrip));

export default router;
