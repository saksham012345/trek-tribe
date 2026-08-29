/**
 * Team controller — Sprint 8
 *
 * Handles req/res, delegates all logic to team.service.ts.
 * No business logic lives here.
 */

import { Request, Response } from 'express';
import * as team from './team.service';
import { TeamError } from './team.service';

const ROLES = ['owner', 'manager', 'trip_leader', 'viewer'] as const;
type Role = (typeof ROLES)[number];

function actor(req: Request): { id: string; role: string } | null {
  const id = (req as any).user?.userId;
  const role = (req as any).user?.role;
  return id ? { id, role } : null;
}

function fail(res: Response, error: any, whileDoing: string) {
  if (error instanceof TeamError) {
    return res.status(error.status).json({ error: error.message });
  }
  console.error(`❌ Error ${whileDoing}:`, error);
  return res.status(500).json({ error: `Failed ${whileDoing}`, message: error?.message });
}

/**
 * The organizer whose team is being read or changed.
 *
 * An organizer manages their own; an admin may name another. A team member is
 * never allowed to nominate an organizer id, so being on one team is not a way
 * to read another.
 */
function organizerScope(req: Request): string | null {
  const a = actor(req);
  if (!a) return null;
  if (a.role === 'admin' && typeof req.query.organizerId === 'string') {
    return req.query.organizerId;
  }
  return a.id;
}

// ─── Invites ─────────────────────────────────────────────────────────────────

export async function listInvites(req: Request, res: Response) {
  const organizerId = organizerScope(req);
  if (!organizerId) return res.status(401).json({ error: 'Unauthorized' });
  try {
    return res.json(await team.listInvites(organizerId));
  } catch (e) {
    return fail(res, e, 'listing invites');
  }
}

export async function inviteMember(req: Request, res: Response) {
  const a = actor(req);
  const organizerId = organizerScope(req);
  if (!a || !organizerId) return res.status(401).json({ error: 'Unauthorized' });

  const { email, role } = req.body ?? {};
  if (typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ error: 'A valid email is required' });
  }
  if (!ROLES.includes(role)) {
    return res.status(400).json({ error: `role must be one of ${ROLES.join(', ')}` });
  }

  try {
    const invite = await team.inviteMember(organizerId, a.id, email, role as Role);
    // The token goes out in the invite link, not in a listing, but the creating
    // call needs it once so the caller can build that link.
    return res.status(201).json(invite);
  } catch (e) {
    return fail(res, e, 'creating invite');
  }
}

export async function acceptInvite(req: Request, res: Response) {
  const a = actor(req);
  if (!a) return res.status(401).json({ error: 'Unauthorized' });

  const token = typeof req.body?.token === 'string' ? req.body.token : null;
  if (!token) return res.status(400).json({ error: 'token is required' });

  try {
    return res.json(await team.acceptInvite(token, a.id));
  } catch (e) {
    return fail(res, e, 'accepting invite');
  }
}

export async function resendInvite(req: Request, res: Response) {
  const organizerId = organizerScope(req);
  if (!organizerId) return res.status(401).json({ error: 'Unauthorized' });
  try {
    return res.json(await team.resendInvite(req.params.id, organizerId));
  } catch (e) {
    return fail(res, e, 'resending invite');
  }
}

// ─── Membership ──────────────────────────────────────────────────────────────

export async function listTeam(req: Request, res: Response) {
  const organizerId = organizerScope(req);
  if (!organizerId) return res.status(401).json({ error: 'Unauthorized' });
  try {
    return res.json(await team.listTeam(organizerId));
  } catch (e) {
    return fail(res, e, 'listing team');
  }
}

export async function removeMember(req: Request, res: Response) {
  const organizerId = organizerScope(req);
  if (!organizerId) return res.status(401).json({ error: 'Unauthorized' });
  try {
    return res.json(await team.removeMember(req.params.id, organizerId));
  } catch (e) {
    return fail(res, e, 'removing member');
  }
}

export async function setMemberRole(req: Request, res: Response) {
  const organizerId = organizerScope(req);
  if (!organizerId) return res.status(401).json({ error: 'Unauthorized' });
  if (!ROLES.includes(req.body?.role)) {
    return res.status(400).json({ error: `role must be one of ${ROLES.join(', ')}` });
  }
  try {
    return res.json(await team.setMemberRole(req.params.id, organizerId, req.body.role as Role));
  } catch (e) {
    return fail(res, e, 'changing role');
  }
}

// ─── Trip leader assignments ─────────────────────────────────────────────────

export async function assignTrip(req: Request, res: Response) {
  const a = actor(req);
  const organizerId = organizerScope(req);
  if (!a || !organizerId) return res.status(401).json({ error: 'Unauthorized' });
  if (typeof req.body?.tripId !== 'string') {
    return res.status(400).json({ error: 'tripId is required' });
  }
  try {
    const assignment = await team.assignLeaderToTrip(
      req.params.id,
      req.body.tripId,
      organizerId,
      a.id
    );
    return res.status(201).json(assignment);
  } catch (e) {
    return fail(res, e, 'assigning trip');
  }
}

export async function unassignTrip(req: Request, res: Response) {
  const organizerId = organizerScope(req);
  if (!organizerId) return res.status(401).json({ error: 'Unauthorized' });
  try {
    await team.unassignLeaderFromTrip(req.params.id, req.params.tripId, organizerId);
    return res.json({ removed: true });
  } catch (e) {
    return fail(res, e, 'removing assignment');
  }
}

// ─── Scope, readable by the holder ───────────────────────────────────────────

/**
 * What the caller can currently see for this organizer.
 *
 * Exposed so the gate's check can be made directly rather than through a
 * screen: assign a trip, call this, remove the assignment, call it again, and
 * the trip is gone from the answer without anything else happening.
 */
export async function myScope(req: Request, res: Response) {
  const a = actor(req);
  if (!a) return res.status(401).json({ error: 'Unauthorized' });

  const organizerId =
    typeof req.query.organizerId === 'string' ? req.query.organizerId : a.id;

  try {
    const scope = await team.visibleTripIdsFor(a.id, organizerId, a.role);
    return res.json({
      organizerId,
      unrestricted: scope === null,
      tripIds: scope ?? [],
    });
  } catch (e) {
    return fail(res, e, 'reading scope');
  }
}
