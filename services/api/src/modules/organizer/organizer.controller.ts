/**
 * Organizer Controller
 *
 * Handles req/res, delegates all logic to organizer.service.ts.
 * No business logic lives here.
 */

import { Request, Response } from 'express';
import * as organizerService from './organizer.service';
import { logger } from '../../utils/logger';

// ─── Trips ────────────────────────────────────────────────────────────────────

export async function getTrips(req: Request, res: Response) {
  try {
    const organizerId = (req as any).auth.userId;
    const data = await organizerService.getOrganizerTrips(organizerId);
    res.json(data);
  } catch (error: any) {
    logger.error('Error fetching organizer trips', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch trips' });
  }
}

// ─── Pending verifications ────────────────────────────────────────────────────

export async function getPendingVerifications(req: Request, res: Response) {
  try {
    const organizerId = (req as any).auth.userId;
    const data = await organizerService.getPendingVerifications(organizerId);
    res.json(data);
  } catch (error: any) {
    logger.error('Error fetching pending verifications', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch pending verifications' });
  }
}

// ─── Verify payment ───────────────────────────────────────────────────────────

export async function verifyPayment(req: Request, res: Response) {
  try {
    const organizerId = (req as any).auth.userId;
    const { bookingId } = req.params;
    const { action, notes } = req.body;

    const result = await organizerService.verifyPayment(organizerId, bookingId, action, notes);
    res.json(result);
  } catch (error: any) {
    logger.error('Error processing payment verification', {
      error: error.message,
      bookingId: req.params.bookingId,
    });
    res.status(error.status || 500).json({ error: error.message || 'Failed to process payment verification' });
  }
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export async function getStats(req: Request, res: Response) {
  try {
    const organizerId = (req as any).auth.userId;
    const data = await organizerService.getOrganizerStats(organizerId);
    res.json(data);
  } catch (error: any) {
    logger.error('Error fetching organizer stats', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
}

// ─── Trip participants ────────────────────────────────────────────────────────

export async function getTripParticipants(req: Request, res: Response) {
  try {
    const organizerId = (req as any).auth.userId;
    const { tripId } = req.params;
    const data = await organizerService.getTripParticipants(organizerId, tripId);
    res.json(data);
  } catch (error: any) {
    logger.error('Error fetching trip participants', { error: error.message, tripId: req.params.tripId });
    res.status(error.status || 500).json({ error: error.message || 'Failed to fetch trip participants' });
  }
}
