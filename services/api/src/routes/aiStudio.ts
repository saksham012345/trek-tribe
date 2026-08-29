/**
 * AI Routes — Sprint 9
 *
 * Thin router — delegates to modules/ai/ai.controller.ts.
 *
 * Named aiStudio to avoid colliding with routes/ai.ts, which is the existing
 * chat surface. The two are unrelated: that one talks to travellers, this one
 * drafts content for organizers.
 */

import { Router } from 'express';
import { authenticateJwt, requireRole } from '../middleware/auth';
import * as c from '../modules/ai/ai.controller';

const router = Router();

const asyncHandler = (fn: Function) => (req: any, res: any, next: any) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const organizer = [authenticateJwt, requireRole(['organizer', 'admin'])];

router.get('/status', ...organizer, asyncHandler(c.getStatus));
router.put('/quota', ...organizer, asyncHandler(c.setQuota));

router.post('/generate', ...organizer, asyncHandler(c.generate));

router.get('/drafts', ...organizer, asyncHandler(c.listDrafts));
router.post('/drafts/:id/accept', ...organizer, asyncHandler(c.acceptDraft));
router.post('/drafts/:id/discard', ...organizer, asyncHandler(c.discardDraft));

router.get('/spend', ...organizer, asyncHandler(c.getSpend));

export default router;
