/**
 * Team, invites and trip-leader scoping — Sprint 8
 *
 * No req/res objects — pure data in, data out.
 *
 * The sprint gate's sharpest condition is about this file: remove a leader's
 * assignment and the API must return nothing for that trip, "verified with a
 * direct request, not just the UI". So scoping is decided here, in the layer
 * every caller goes through, and never by whether a screen drew a link.
 */

import crypto from 'crypto';
import { prisma } from '../../lib/prisma';

export class TeamError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/** Invites live for a week. Long enough to survive a holiday, short enough that
 *  a forwarded email is not a permanent key to someone's business. */
export const INVITE_TTL_DAYS = 7;

// ─── Scoping ─────────────────────────────────────────────────────────────────

/**
 * Which trips this user may see for this organizer.
 *
 * `null` means "all of them" and is returned only for the organizer themselves,
 * an owner, a manager or an admin. A trip_leader gets an explicit list, and a
 * viewer with no assignments gets an empty one.
 *
 * An empty array is not the same as null and the difference is the whole gate:
 * `[]` must produce no rows, and a caller that treats a falsy value as "no
 * filter" turns a leader with nothing assigned into a leader who sees
 * everything. Callers use `applyTripScope` below rather than interpreting this
 * themselves.
 */
export async function visibleTripIdsFor(
  userId: string,
  organizerId: string,
  userRole: string
): Promise<string[] | null> {
  if (userRole === 'admin') return null;
  if (userId === organizerId) return null;

  const membership = await prisma.teamMembership.findFirst({
    where: { organizerId, userId, status: 'active' },
    include: { assignments: { select: { tripId: true } } },
  });

  // Not on the team at all. Not an error here - the caller decides whether that
  // is a 403 or simply an empty list - but it is emphatically not "all trips".
  if (!membership) return [];

  if (membership.role === 'owner' || membership.role === 'manager') return null;

  return membership.assignments.map((a) => a.tripId);
}

/**
 * Turn a scope into a Prisma `where` fragment.
 *
 * Exists so no caller has to remember that null means unrestricted and []
 * means nothing. Spreading the result into a where clause is always correct:
 *
 *     where: { organizerId, ...applyTripScope(scope) }
 */
export function applyTripScope(scope: string[] | null): Record<string, unknown> {
  if (scope === null) return {};
  return { id: { in: scope } };
}

/** The same, for tables that reference a trip rather than being one. */
export function applyTripScopeToField(
  scope: string[] | null,
  field = 'tripId'
): Record<string, unknown> {
  if (scope === null) return {};
  return { [field]: { in: scope } };
}

// ─── Invites ─────────────────────────────────────────────────────────────────

function newToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export async function inviteMember(
  organizerId: string,
  invitedBy: string,
  email: string,
  role: 'owner' | 'manager' | 'trip_leader' | 'viewer'
) {
  const normalised = email.trim().toLowerCase();

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + INVITE_TTL_DAYS);

  return prisma.teamInvite.create({
    data: { organizerId, email: normalised, role, token: newToken(), expiresAt, invitedBy },
  });
}

/**
 * Accept an invite.
 *
 * The gate: an expired invite cannot be accepted, only resent. Expiry is read
 * from the timestamp at the moment of acceptance rather than from a status
 * somebody set, so an invite that lapses while the page is open is refused when
 * the button is pressed, not when a job last ran.
 *
 * Accepting clears the token and fills user_id in the same statement that
 * creates the membership, so a link cannot be redeemed twice: there is no token
 * left to match.
 */
export async function acceptInvite(token: string, userId: string) {
  const invite = await prisma.teamInvite.findUnique({ where: { token } });

  if (!invite) throw new TeamError('This invite link is not valid', 404);
  if (invite.acceptedAt) throw new TeamError('This invite has already been used', 409);
  if (invite.expiresAt < new Date()) {
    throw new TeamError('This invite has expired. Ask for a new one to be sent.', 410);
  }

  // One transaction: the membership and the spent invite land together, so
  // there is no window where the token is gone but the person is not on the
  // team, or the other way round.
  return prisma.$transaction(async (tx) => {
    const existing = await tx.teamMembership.findFirst({
      where: { organizerId: invite.organizerId, userId, status: 'active' },
    });
    if (existing) {
      throw new TeamError('You are already on this team', 409);
    }

    const membership = await tx.teamMembership.create({
      data: {
        organizerId: invite.organizerId,
        userId,
        role: invite.role,
        status: 'active',
        invitedBy: invite.invitedBy,
      },
    });

    await tx.teamInvite.update({
      where: { id: invite.id },
      data: { token: null, acceptedAt: new Date(), userId },
    });

    return membership;
  });
}

/**
 * Resend an invite.
 *
 * This is the only thing that may be done with an expired one, and it issues a
 * fresh token rather than extending the old. Extending would mean a link that
 * was forwarded, screenshotted or logged months ago quietly comes back to life.
 */
export async function resendInvite(inviteId: string, organizerId: string) {
  const invite = await prisma.teamInvite.findUnique({ where: { id: inviteId } });
  if (!invite || invite.organizerId !== organizerId) {
    throw new TeamError('Invite not found', 404);
  }
  if (invite.acceptedAt) throw new TeamError('This invite has already been accepted', 409);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + INVITE_TTL_DAYS);

  return prisma.teamInvite.update({
    where: { id: inviteId },
    data: { token: newToken(), expiresAt },
  });
}

export async function listInvites(organizerId: string) {
  const invites = await prisma.teamInvite.findMany({
    where: { organizerId },
    orderBy: { createdAt: 'desc' },
  });
  const now = new Date();
  // "expired" is derived, never stored - the same posture as permits in
  // Sprint 5. The token itself is never returned to a listing.
  return invites.map(({ token, ...rest }) => ({
    ...rest,
    state: rest.acceptedAt ? 'accepted' : rest.expiresAt < now ? 'expired' : 'pending',
  }));
}

// ─── Membership ──────────────────────────────────────────────────────────────

export async function listTeam(organizerId: string) {
  return prisma.teamMembership.findMany({
    where: { organizerId, status: { not: 'removed' } },
    orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
    include: { assignments: { select: { tripId: true } } },
  });
}

export async function removeMember(membershipId: string, organizerId: string) {
  const m = await prisma.teamMembership.findUnique({ where: { id: membershipId } });
  if (!m || m.organizerId !== organizerId) throw new TeamError('Member not found', 404);
  if (m.role === 'owner') throw new TeamError('An owner cannot be removed', 409);

  // Status change rather than a delete, so the history of who had access when
  // survives. The partial unique index only covers active rows, so this frees
  // the person to be re-invited later.
  return prisma.teamMembership.update({
    where: { id: membershipId },
    data: { status: 'removed', removedAt: new Date() },
  });
}

export async function setMemberRole(
  membershipId: string,
  organizerId: string,
  role: 'owner' | 'manager' | 'trip_leader' | 'viewer'
) {
  const m = await prisma.teamMembership.findUnique({ where: { id: membershipId } });
  if (!m || m.organizerId !== organizerId) throw new TeamError('Member not found', 404);
  return prisma.teamMembership.update({ where: { id: membershipId }, data: { role } });
}

// ─── Trip leader assignments ─────────────────────────────────────────────────

export async function assignLeaderToTrip(
  membershipId: string,
  tripId: string,
  organizerId: string,
  assignedBy?: string
) {
  const [m, trip] = await Promise.all([
    prisma.teamMembership.findUnique({ where: { id: membershipId } }),
    prisma.trip.findUnique({ where: { id: tripId }, select: { organizerId: true } }),
  ]);
  if (!m || m.organizerId !== organizerId) throw new TeamError('Member not found', 404);
  if (!trip || trip.organizerId !== organizerId) throw new TeamError('Trip not found', 404);

  return prisma.tripLeaderAssignment.upsert({
    where: { membershipId_tripId: { membershipId, tripId } },
    create: { membershipId, tripId, assignedBy },
    update: {},
  });
}

/**
 * Remove an assignment.
 *
 * This is the gate's test case: after this returns, a direct API request from
 * that leader for that trip must come back with nothing. It does, because
 * visibleTripIdsFor rebuilds the list from assignment rows on every call - there
 * is no cached scope, no session claim and no token carrying the old list.
 */
export async function unassignLeaderFromTrip(
  membershipId: string,
  tripId: string,
  organizerId: string
) {
  const m = await prisma.teamMembership.findUnique({ where: { id: membershipId } });
  if (!m || m.organizerId !== organizerId) throw new TeamError('Member not found', 404);

  const existing = await prisma.tripLeaderAssignment.findUnique({
    where: { membershipId_tripId: { membershipId, tripId } },
  });
  if (!existing) throw new TeamError('That trip is not assigned to this person', 404);

  return prisma.tripLeaderAssignment.delete({
    where: { membershipId_tripId: { membershipId, tripId } },
  });
}
