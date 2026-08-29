/**
 * Trip lifecycle controller — Sprint 4
 *
 * Handles req/res, delegates all logic to tripLifecycle.service.ts.
 * No business logic lives here.
 */

import { Request, Response } from 'express';
import * as lifecycle from './tripLifecycle.service';

function actorId(req: Request): string | null {
  return (req as any).user?.userId ?? null;
}

// Service errors are ownership and validation failures, not server faults, so
// they map to 4xx. Anything unrecognised is still a 500 — swallowing unknown
// errors into 400 is how real bugs get reported as user mistakes.
function fail(res: Response, error: any, whileDoing: string) {
  const message = error?.message ?? 'Unknown error';
  if (message === 'Trip not found' || message === 'Template not found') {
    return res.status(404).json({ error: message });
  }
  if (message === 'Not your trip') {
    return res.status(403).json({ error: message });
  }
  if (message === 'A scheduled trip needs a publish time') {
    return res.status(400).json({ error: message });
  }
  console.error(`❌ Error ${whileDoing}:`, error);
  return res.status(500).json({ error: `Failed ${whileDoing}`, message });
}

// ─── Publication ─────────────────────────────────────────────────────────────

export async function setPublication(req: Request, res: Response) {
  const userId = actorId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { publicationStatus, publishAt } = req.body ?? {};
  const allowed = ['draft', 'scheduled', 'published', 'archived'];
  if (!allowed.includes(publicationStatus)) {
    return res.status(400).json({ error: `publicationStatus must be one of ${allowed.join(', ')}` });
  }

  try {
    const trip = await lifecycle.setPublication(
      req.params.id,
      userId,
      publicationStatus,
      publishAt ? new Date(publishAt) : null
    );
    return res.json(trip);
  } catch (error: any) {
    return fail(res, error, 'setting publication status');
  }
}

// ─── Duplication ─────────────────────────────────────────────────────────────

export async function duplicateTrip(req: Request, res: Response) {
  const userId = actorId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const trip = await lifecycle.duplicateTrip(req.params.id, userId);
    return res.status(201).json(trip);
  } catch (error: any) {
    return fail(res, error, 'duplicating trip');
  }
}

// ─── Templates ───────────────────────────────────────────────────────────────

export async function listTemplates(req: Request, res: Response) {
  const userId = actorId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  try {
    return res.json(await lifecycle.listTemplates(userId));
  } catch (error: any) {
    return fail(res, error, 'listing templates');
  }
}

export async function createTemplate(req: Request, res: Response) {
  const userId = actorId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  if (!req.body?.name || !req.body?.title) {
    return res.status(400).json({ error: 'name and title are required' });
  }
  try {
    return res.status(201).json(await lifecycle.createTemplate(userId, req.body));
  } catch (error: any) {
    return fail(res, error, 'creating template');
  }
}

export async function deleteTemplate(req: Request, res: Response) {
  const userId = actorId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  try {
    await lifecycle.deleteTemplate(req.params.id, userId);
    return res.status(204).send();
  } catch (error: any) {
    return fail(res, error, 'deleting template');
  }
}

export async function createTripFromTemplate(req: Request, res: Response) {
  const userId = actorId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { startDate, endDate, title, price, capacity } = req.body ?? {};
  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'startDate and endDate are required' });
  }

  try {
    const trip = await lifecycle.createTripFromTemplate(req.params.id, userId, {
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      title,
      price,
      capacity,
    });
    return res.status(201).json(trip);
  } catch (error: any) {
    return fail(res, error, 'creating trip from template');
  }
}

// ─── Series ──────────────────────────────────────────────────────────────────

export async function listSeries(req: Request, res: Response) {
  const userId = actorId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  try {
    return res.json(await lifecycle.listSeries(userId));
  } catch (error: any) {
    return fail(res, error, 'listing series');
  }
}

export async function createSeries(req: Request, res: Response) {
  const userId = actorId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  if (!req.body?.name) return res.status(400).json({ error: 'name is required' });
  try {
    return res.status(201).json(await lifecycle.createSeries(userId, req.body));
  } catch (error: any) {
    return fail(res, error, 'creating series');
  }
}
