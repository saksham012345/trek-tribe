/**
 * Finance controller — Sprint 6 (no GST)
 *
 * Handles req/res, delegates all logic to reconciliation.service.ts.
 * No business logic lives here, and nothing here computes tax.
 */

import { Request, Response } from 'express';
import * as finance from './reconciliation.service';

function resolveOrganizerId(req: Request): string | null {
  const userId = (req as any).user?.userId;
  const role = (req as any).user?.role;
  if (!userId) return null;
  // An admin may read another organizer's finances; an organizer always reads
  // their own, and the query param is ignored for them rather than honoured, so
  // it cannot be used to read across accounts.
  if (role === 'admin' && typeof req.query.organizerId === 'string') {
    return req.query.organizerId;
  }
  return userId;
}

/**
 * Default window is the last twelve months. Reconciliation over "everything
 * ever" gets slower every month and nobody reads past the recent rows anyway;
 * an explicit from/to is honoured when someone needs further back.
 */
function resolveWindow(req: Request): { from: Date; to: Date } {
  const to = typeof req.query.to === 'string' ? new Date(req.query.to) : new Date();
  const from =
    typeof req.query.from === 'string'
      ? new Date(req.query.from)
      : new Date(to.getFullYear() - 1, to.getMonth(), to.getDate());

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new Error('from and to must be valid dates');
  }
  return { from, to };
}

export async function getReconciliation(req: Request, res: Response) {
  const organizerId = resolveOrganizerId(req);
  if (!organizerId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { from, to } = resolveWindow(req);
    return res.json(await finance.reconcile(organizerId, from, to));
  } catch (error: any) {
    if (/valid dates/.test(error?.message ?? '')) {
      return res.status(400).json({ error: error.message });
    }
    console.error('❌ Error reconciling:', error);
    return res.status(500).json({ error: 'Failed to reconcile', message: error?.message });
  }
}

export async function getCashFlow(req: Request, res: Response) {
  const organizerId = resolveOrganizerId(req);
  if (!organizerId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { from, to } = resolveWindow(req);
    return res.json(await finance.getCashFlow(organizerId, from, to));
  } catch (error: any) {
    if (/valid dates/.test(error?.message ?? '')) {
      return res.status(400).json({ error: error.message });
    }
    console.error('❌ Error reading cash flow:', error);
    return res.status(500).json({ error: 'Failed to read cash flow', message: error?.message });
  }
}

export async function getPayoutReadiness(req: Request, res: Response) {
  const organizerId = resolveOrganizerId(req);
  if (!organizerId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    return res.json(await finance.getPayoutReadiness(organizerId));
  } catch (error: any) {
    console.error('❌ Error reading payout readiness:', error);
    return res.status(500).json({ error: 'Failed to read payout readiness', message: error?.message });
  }
}
