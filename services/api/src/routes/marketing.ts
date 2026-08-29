/**
 * Marketing Routes — Sprint 7
 *
 * Thin router — delegates to modules/marketing/marketing.controller.ts.
 *
 * There is no PATCH or DELETE for notes. They are append-only and the database
 * refuses both, so such a route could only ever return an error.
 */

import { Router } from 'express';
import { authenticateJwt, requireRole } from '../middleware/auth';
import * as c from '../modules/marketing/marketing.controller';

const router = Router();

const asyncHandler = (fn: Function) => (req: any, res: any, next: any) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const organizer = [authenticateJwt, requireRole(['organizer', 'admin'])];

router.get('/banners', ...organizer, asyncHandler(c.listBanners));
router.post('/banners', ...organizer, asyncHandler(c.createBanner));
router.patch('/banners/:id/paused', ...organizer, asyncHandler(c.setBannerPaused));

router.get('/campaigns', ...organizer, asyncHandler(c.listCampaigns));
router.post('/campaigns', ...organizer, asyncHandler(c.createCampaign));

router.get('/referrals', ...organizer, asyncHandler(c.listReferrals));
router.post('/referrals', ...organizer, asyncHandler(c.createReferral));

router.get('/review-requests', ...organizer, asyncHandler(c.listReviewRequests));
router.post('/review-requests', ...organizer, asyncHandler(c.requestReview));
router.post('/review-requests/:bookingId/match', ...organizer, asyncHandler(c.matchReviewBack));

router.get('/notes', ...organizer, asyncHandler(c.listNotes));
router.post('/notes', ...organizer, asyncHandler(c.addNote));

router.get('/customers', ...organizer, asyncHandler(c.listCrmCustomers));

router.get('/discount-floor', ...organizer, asyncHandler(c.getFloor));
router.put('/discount-floor', ...organizer, asyncHandler(c.setFloor));

router.get('/coupons', ...organizer, asyncHandler(c.listCoupons));
router.post('/coupons', ...organizer, asyncHandler(c.createCoupon));
router.post('/coupons/quote', ...organizer, asyncHandler(c.quoteDiscount));

export default router;
