/**
 * AI controller — Sprint 9
 *
 * Handles req/res, delegates all logic to ai.service.ts.
 * No business logic lives here.
 */

import { Request, Response } from 'express';
import * as ai from './ai.service';
import { AiError } from './ai.service';
import { AiFeature } from './aiPolicy';

const FEATURES: AiFeature[] = [
  'trip_description',
  'trip_itinerary',
  'marketing_copy',
  'campaign_subject',
  'insight_summary',
];

function actor(req: Request): { id: string; role: string } | null {
  const id = (req as any).user?.userId;
  return id ? { id, role: (req as any).user?.role } : null;
}

function organizerScope(req: Request): string | null {
  const a = actor(req);
  if (!a) return null;
  if (a.role === 'admin' && typeof req.query.organizerId === 'string') return req.query.organizerId;
  return a.id;
}

function fail(res: Response, error: any, whileDoing: string) {
  if (error instanceof AiError) return res.status(error.status).json({ error: error.message });
  console.error(`❌ Error ${whileDoing}:`, error);
  return res.status(500).json({ error: `Failed ${whileDoing}`, message: error?.message });
}

/** What the studio needs to know before it offers a Generate button. */
export async function getStatus(req: Request, res: Response) {
  const organizerId = organizerScope(req);
  if (!organizerId) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const [quota, provider] = await Promise.all([
      ai.getQuota(organizerId),
      Promise.resolve(ai.providerName()),
    ]);
    return res.json({
      provider,
      quota,
      // Said plainly rather than left for the screen to work out from two nulls.
      canGenerate: provider !== null && quota !== null,
      blockedBecause:
        provider === null
          ? 'No AI provider is configured, so nothing can be generated and nothing is spent.'
          : quota === null
          ? 'No monthly quota is set. A missing quota is not an unlimited one — set a limit first.'
          : null,
    });
  } catch (e) {
    return fail(res, e, 'reading AI status');
  }
}

export async function setQuota(req: Request, res: Response) {
  const organizerId = organizerScope(req);
  if (!organizerId) return res.status(401).json({ error: 'Unauthorized' });
  const { monthlyRequestLimit, monthlyTokenLimit } = req.body ?? {};
  if (!Number.isInteger(monthlyRequestLimit)) {
    return res.status(400).json({ error: 'monthlyRequestLimit must be an integer' });
  }
  try {
    return res.json(
      await ai.setQuota(
        organizerId,
        monthlyRequestLimit,
        Number.isInteger(monthlyTokenLimit) ? monthlyTokenLimit : null
      )
    );
  } catch (e) {
    return fail(res, e, 'setting the AI quota');
  }
}

export async function generate(req: Request, res: Response) {
  const a = actor(req);
  const organizerId = organizerScope(req);
  if (!a || !organizerId) return res.status(401).json({ error: 'Unauthorized' });

  const { feature, inputs, tripId } = req.body ?? {};
  if (!FEATURES.includes(feature)) {
    return res.status(400).json({ error: `feature must be one of ${FEATURES.join(', ')}` });
  }
  if (inputs === null || typeof inputs !== 'object') {
    return res.status(400).json({ error: 'inputs must be an object' });
  }

  try {
    const outcome = await ai.generate(organizerId, a.id, feature, inputs, tripId);
    // A refusal is a 200 carrying a reason, not an error. It is an expected
    // outcome the screen renders, and turning it into a 4xx would make the
    // caller treat a working guard as a fault.
    return res.json(outcome);
  } catch (e) {
    return fail(res, e, 'generating');
  }
}

export async function listDrafts(req: Request, res: Response) {
  const organizerId = organizerScope(req);
  if (!organizerId) return res.status(401).json({ error: 'Unauthorized' });
  try {
    return res.json(await ai.listDrafts(organizerId));
  } catch (e) {
    return fail(res, e, 'listing drafts');
  }
}

export async function acceptDraft(req: Request, res: Response) {
  const a = actor(req);
  const organizerId = organizerScope(req);
  if (!a || !organizerId) return res.status(401).json({ error: 'Unauthorized' });
  try {
    return res.json(await ai.acceptDraft(req.params.id, organizerId, a.id));
  } catch (e) {
    return fail(res, e, 'accepting the draft');
  }
}

export async function discardDraft(req: Request, res: Response) {
  const organizerId = organizerScope(req);
  if (!organizerId) return res.status(401).json({ error: 'Unauthorized' });
  try {
    return res.json(await ai.discardDraft(req.params.id, organizerId));
  } catch (e) {
    return fail(res, e, 'discarding the draft');
  }
}

export async function getSpend(req: Request, res: Response) {
  const organizerId = organizerScope(req);
  if (!organizerId) return res.status(401).json({ error: 'Unauthorized' });
  try {
    return res.json(await ai.getSpend(organizerId));
  } catch (e) {
    return fail(res, e, 'reading AI spend');
  }
}
