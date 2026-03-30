/**
 * Marketplace Controller
 *
 * Handles req/res, delegates all logic to marketplace.service.ts.
 * No business logic lives here.
 */

import { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import * as marketplaceService from './marketplace.service';
import { logger } from '../../utils/logger';

// ─── Onboard organizer ────────────────────────────────────────────────────────

export async function onboardOrganizer(req: Request, res: Response) {
  try {
    const organizerId = req.user?.id as string;
    const userEmail = (req as any).user?.email || 'organizer@trektribe.in';
    const userPhone = (req as any).user?.phone || '';
    const data = await marketplaceService.onboardOrganizer(organizerId, userEmail, userPhone, req.body);
    res.json(data);
  } catch (error: any) {
    logger.error('Organizer onboarding failed', { error: error.message, userId: req.user?.id });
    if (error.status === 402) {
      return res.status(402).json({ error: 'Subscription required before onboarding', message: error.message });
    }
    if (error.status === 400) {
      return res.status(400).json({ error: 'Validation failed', details: error.details });
    }
    res.status(400).json({ error: 'Onboarding failed', message: error.message });
  }
}

// ─── Organizer status ─────────────────────────────────────────────────────────

export async function getOrganizerStatus(req: Request, res: Response) {
  try {
    const organizerId = req.params.id || req.user?.id;
    const data = await marketplaceService.getOrganizerStatus(organizerId as string);
    res.json(data);
  } catch (error: any) {
    logger.error('Failed to get organizer status', { error: error.message, organizerId: req.params.id || req.user?.id });
    res.status(500).json({ error: 'Failed to retrieve organizer status', message: error.message });
  }
}

// ─── Create order ─────────────────────────────────────────────────────────────

export async function createOrder(req: Request, res: Response) {
  await Promise.all([
    body('amount').isInt({ min: 100, max: 10000000 }).run(req),
    body('currency').optional().isString().isIn(['INR']).run(req),
    body('organizerId').isString().isLength({ min: 12, max: 48 }).run(req),
    body('tripId').optional().isString().isLength({ min: 8, max: 64 }).run(req),
  ]);
  const vErrors = validationResult(req);
  if (!vErrors.isEmpty()) return res.status(400).json({ errors: vErrors.array() });

  try {
    const { amount, currency, organizerId, tripId, notes } = req.body;
    const order = await marketplaceService.createOrder(req.user!.id, amount, currency, organizerId, tripId, notes);
    res.json({ success: true, order });
  } catch (error: any) {
    logger.error('Order creation failed', { error: error.message });
    res.status(400).json({ error: error.message });
  }
}

// ─── Split payment ────────────────────────────────────────────────────────────

export async function splitPayment(req: Request, res: Response) {
  await Promise.all([
    body('orderId').isString().isLength({ min: 10, max: 64 }).run(req),
    body('paymentId').isString().isLength({ min: 10, max: 64 }).run(req),
  ]);
  const vErrors = validationResult(req);
  if (!vErrors.isEmpty()) return res.status(400).json({ errors: vErrors.array() });

  try {
    const { orderId, paymentId } = req.body;
    const transfer = await marketplaceService.splitPayment(orderId, paymentId);
    res.json({ success: true, transfer });
  } catch (error: any) {
    logger.error('Split payment failed', { error: error.message });
    res.status(400).json({ error: error.message });
  }
}

// ─── Initiate refund ──────────────────────────────────────────────────────────

export async function initiateRefund(req: Request, res: Response) {
  await Promise.all([
    body('orderId').isString().isLength({ min: 10, max: 64 }).run(req),
    body('amount').isInt({ min: 1 }).run(req),
    body('reason').optional().isString().isLength({ max: 256 }).run(req),
  ]);
  const vErrors = validationResult(req);
  if (!vErrors.isEmpty()) return res.status(400).json({ errors: vErrors.array() });

  try {
    const { orderId, amount, reason } = req.body;
    const refund = await marketplaceService.initiateRefund(orderId, amount, reason, req.user?.id);
    res.json({ success: true, refund });
  } catch (error: any) {
    logger.error('Refund initiation failed', { error: error.message });
    res.status(error.status || 400).json({ error: error.message });
  }
}

// ─── Settlements ──────────────────────────────────────────────────────────────

export async function getSettlements(req: Request, res: Response) {
  try {
    const organizerId = req.user?.id as string;
    const data = await marketplaceService.getSettlements(organizerId);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

// ─── Order by ID ──────────────────────────────────────────────────────────────

export async function getOrderById(req: Request, res: Response) {
  try {
    const order = await marketplaceService.getOrderById(req.params.id);
    res.json(order);
  } catch (error: any) {
    res.status(error.status || 500).json({ error: error.message });
  }
}

// ─── Config ───────────────────────────────────────────────────────────────────

export async function getConfig(req: Request, res: Response) {
  try {
    const organizerId = req.user?.id as string;
    const data = await marketplaceService.getMarketplaceConfig(organizerId);
    res.json(data);
  } catch (error: any) {
    logger.error('Failed to get marketplace config', { error: error.message, organizerId: req.user?.id });
    res.status(500).json({ error: 'Failed to retrieve configuration', message: error.message });
  }
}
