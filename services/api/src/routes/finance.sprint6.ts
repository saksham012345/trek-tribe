/**
 * Finance Routes — Sprint 6 (no GST)
 *
 * Thin router — delegates to modules/finance/finance.controller.ts.
 *
 * Deliberately a separate router from routes/finance.ts: that one is trip
 * finance, this one is organizer-level money, and merging them would put
 * invoice and GST routes next to these when the entry gate finally clears.
 */

import { Router } from 'express';
import { authenticateJwt, requireRole } from '../middleware/auth';
import * as financeController from '../modules/finance/finance.controller';

const router = Router();

const asyncHandler = (fn: Function) => (req: any, res: any, next: any) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const organizer = [authenticateJwt, requireRole(['organizer', 'admin'])];

router.get('/reconciliation', ...organizer, asyncHandler(financeController.getReconciliation));
router.get('/cash-flow', ...organizer, asyncHandler(financeController.getCashFlow));
router.get('/payout-readiness', ...organizer, asyncHandler(financeController.getPayoutReadiness));

export default router;
