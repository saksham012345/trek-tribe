/**
 * Analytics Routes
 *
 * Thin router — delegates to analytics controller.
 * Business logic lives in modules/analytics/analytics.service.ts
 */

import { Router } from 'express';
import { authenticateJwt, requireRole } from '../middleware/auth';
import * as analyticsController from '../modules/analytics/analytics.controller';

const router = Router();

router.get('/dashboard', authenticateJwt, analyticsController.getDashboard);
router.get('/revenue', authenticateJwt, requireRole(['admin', 'organizer']), analyticsController.getRevenue);
router.get('/trips', authenticateJwt, analyticsController.getTrips);
router.get('/users', authenticateJwt, requireRole(['admin']), analyticsController.getUsers);
router.get('/leads', authenticateJwt, analyticsController.getLeads);
router.get('/performance', authenticateJwt, requireRole(['admin']), analyticsController.getPerformance);
router.get('/retention', authenticateJwt, requireRole(['admin']), analyticsController.getRetention);
router.get('/activity', authenticateJwt, requireRole(['admin']), analyticsController.getActivity);
router.get('/top-organizers', authenticateJwt, requireRole(['admin']), analyticsController.getTopOrganizers);

export default router;
