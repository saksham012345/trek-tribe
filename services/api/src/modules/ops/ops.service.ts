/**
 * Operations service — Sprint 5
 *
 * Rooms, transport, checklists, attendance, equipment, permits, the emergency
 * plan, documents, medical declarations and certifications.
 *
 * No req/res objects — pure data in, data out.
 */

import { prisma } from '../../lib/prisma';

export class OpsError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

// Ownership is checked against the trip's organizer every time rather than
// trusted from the request. An ops table keyed to a participant is three joins
// away from the organizer who may read it, and "it was in the URL" is not a
// permission.
async function assertTripOwned(tripId: string, organizerId: string) {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: { organizerId: true },
  });
  if (!trip) throw new OpsError('Trip not found', 404);
  if (trip.organizerId !== organizerId) throw new OpsError('Not your trip', 403);
}

async function assertParticipantOwned(participantId: string, organizerId: string) {
  const p = await prisma.bookingParticipant.findUnique({
    where: { id: participantId },
    select: { booking: { select: { trip: { select: { organizerId: true } } } } },
  });
  if (!p) throw new OpsError('Participant not found', 404);
  if (p.booking.trip.organizerId !== organizerId) throw new OpsError('Not your participant', 403);
}

// ─── Rooms ───────────────────────────────────────────────────────────────────

export async function listAccommodation(tripId: string, organizerId: string) {
  await assertTripOwned(tripId, organizerId);
  return prisma.accommodation.findMany({
    where: { tripId },
    orderBy: { createdAt: 'asc' },
    include: {
      rooms: {
        orderBy: { label: 'asc' },
        include: {
          assignments: {
            include: { participant: { select: { id: true, name: true, email: true } } },
          },
        },
      },
    },
  });
}

export async function createAccommodation(tripId: string, organizerId: string, data: any) {
  await assertTripOwned(tripId, organizerId);
  return prisma.accommodation.create({ data: { ...data, tripId } });
}

export async function createRoom(accommodationId: string, organizerId: string, data: any) {
  const acc = await prisma.accommodation.findUnique({
    where: { id: accommodationId },
    select: { tripId: true },
  });
  if (!acc) throw new OpsError('Accommodation not found', 404);
  await assertTripOwned(acc.tripId, organizerId);
  return prisma.room.create({ data: { ...data, accommodationId } });
}

export interface RoomAssignmentResult {
  assignment: unknown;
  warning: string | null;
}

/**
 * Assign a participant to a room.
 *
 * Two rules, and they behave differently on purpose:
 *
 *   - A participant already assigned somewhere is refused. That is a fact the
 *     database settles via UNIQUE(participant_id); this check exists only to
 *     turn the constraint violation into a readable message.
 *
 *   - A room over its capacity is allowed, and warned about. An organiser at
 *     11pm in a hill station may have a reason to put five people in four beds,
 *     and a hard block would leave them with no way to record what actually
 *     happened. The warning is returned so the screen can show it; nothing is
 *     stopped.
 */
export async function assignRoom(
  roomId: string,
  participantId: string,
  organizerId: string,
  assignedBy?: string
): Promise<RoomAssignmentResult> {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: { accommodation: { select: { tripId: true } }, assignments: true },
  });
  if (!room) throw new OpsError('Room not found', 404);
  await assertTripOwned(room.accommodation.tripId, organizerId);
  await assertParticipantOwned(participantId, organizerId);

  const existing = await prisma.roomAssignment.findUnique({ where: { participantId } });
  if (existing) {
    throw new OpsError(
      existing.roomId === roomId
        ? 'This person is already in this room'
        : 'This person is already assigned to another room',
      409
    );
  }

  const assignment = await prisma.roomAssignment.create({
    data: { roomId, participantId, assignedBy },
  });

  const occupancy = room.assignments.length + 1;
  const warning =
    occupancy > room.capacity
      ? `Room ${room.label} now holds ${occupancy} people in ${room.capacity} bed${room.capacity === 1 ? '' : 's'}.`
      : null;

  return { assignment, warning };
}

export async function unassignRoom(participantId: string, organizerId: string) {
  await assertParticipantOwned(participantId, organizerId);
  const existing = await prisma.roomAssignment.findUnique({ where: { participantId } });
  if (!existing) throw new OpsError('This person is not in a room', 404);
  return prisma.roomAssignment.delete({ where: { participantId } });
}

// ─── Transport ───────────────────────────────────────────────────────────────

export async function listTransport(tripId: string, organizerId: string) {
  await assertTripOwned(tripId, organizerId);
  return prisma.transportSegment.findMany({
    where: { tripId },
    orderBy: [{ departsAt: 'asc' }, { createdAt: 'asc' }],
    include: {
      assignments: {
        include: { participant: { select: { id: true, name: true } } },
      },
    },
  });
}

export async function createTransportSegment(tripId: string, organizerId: string, data: any) {
  await assertTripOwned(tripId, organizerId);
  return prisma.transportSegment.create({ data: { ...data, tripId } });
}

export async function assignTransport(
  segmentId: string,
  participantId: string,
  organizerId: string,
  seatLabel?: string
) {
  const seg = await prisma.transportSegment.findUnique({
    where: { id: segmentId },
    select: { tripId: true },
  });
  if (!seg) throw new OpsError('Segment not found', 404);
  await assertTripOwned(seg.tripId, organizerId);
  await assertParticipantOwned(participantId, organizerId);

  const existing = await prisma.transportAssignment.findUnique({
    where: { segmentId_participantId: { segmentId, participantId } },
  });
  if (existing) throw new OpsError('This person is already on this segment', 409);

  return prisma.transportAssignment.create({ data: { segmentId, participantId, seatLabel } });
}

// ─── Checklists ──────────────────────────────────────────────────────────────

export async function listChecklistTemplates(organizerId: string) {
  return prisma.checklistTemplate.findMany({
    where: { organizerId },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
}

export async function createChecklistTemplate(organizerId: string, data: any) {
  return prisma.checklistTemplate.create({ data: { ...data, organizerId } });
}

export async function getBookingChecklist(bookingId: string, organizerId: string) {
  const booking = await prisma.groupBooking.findUnique({
    where: { id: bookingId },
    select: { trip: { select: { organizerId: true } } },
  });
  if (!booking) throw new OpsError('Booking not found', 404);
  if (booking.trip.organizerId !== organizerId) throw new OpsError('Not your booking', 403);

  const [templates, items] = await Promise.all([
    prisma.checklistTemplate.findMany({
      where: { organizerId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.bookingChecklistItem.findMany({ where: { bookingId } }),
  ]);

  const byTemplate = new Map(items.map((i) => [i.templateId, i]));

  // Templates without a row yet read as not done. The row is created on first
  // toggle, not eagerly for every booking - otherwise adding one template would
  // write a row against every booking that ever existed.
  return templates.map((t) => ({
    templateId: t.id,
    label: t.label,
    description: t.description,
    isRequired: t.isRequired,
    isDone: byTemplate.get(t.id)?.isDone ?? false,
    completedAt: byTemplate.get(t.id)?.completedAt ?? null,
    notes: byTemplate.get(t.id)?.notes ?? null,
  }));
}

/**
 * Toggle one checklist item.
 *
 * An upsert against UNIQUE(booking_id, template_id), never an insert. The gate
 * is "toggle three times, row count unchanged" — that holds here regardless of
 * how many tabs are open or how fast the button is pressed, because the
 * constraint decides, not a read-then-write that two requests can interleave.
 */
export async function toggleChecklistItem(
  bookingId: string,
  templateId: string,
  organizerId: string,
  isDone: boolean,
  actorId?: string
) {
  const booking = await prisma.groupBooking.findUnique({
    where: { id: bookingId },
    select: { trip: { select: { organizerId: true } } },
  });
  if (!booking) throw new OpsError('Booking not found', 404);
  if (booking.trip.organizerId !== organizerId) throw new OpsError('Not your booking', 403);

  const template = await prisma.checklistTemplate.findUnique({ where: { id: templateId } });
  if (!template || template.organizerId !== organizerId) {
    throw new OpsError('Checklist item not found', 404);
  }

  return prisma.bookingChecklistItem.upsert({
    where: { bookingId_templateId: { bookingId, templateId } },
    create: {
      bookingId,
      templateId,
      isDone,
      completedAt: isDone ? new Date() : null,
      completedBy: isDone ? actorId : null,
    },
    update: {
      isDone,
      completedAt: isDone ? new Date() : null,
      completedBy: isDone ? actorId : null,
    },
  });
}

// ─── Attendance ──────────────────────────────────────────────────────────────

export async function getAttendance(tripId: string, organizerId: string, onDate: Date) {
  await assertTripOwned(tripId, organizerId);
  return prisma.attendanceRecord.findMany({
    where: { tripId, onDate },
    include: { participant: { select: { id: true, name: true } } },
  });
}

export async function markAttendance(
  tripId: string,
  participantId: string,
  organizerId: string,
  onDate: Date,
  state: 'present' | 'absent' | 'late' | 'excused',
  markedBy?: string,
  notes?: string
) {
  await assertTripOwned(tripId, organizerId);
  await assertParticipantOwned(participantId, organizerId);

  // Same shape as the checklist toggle, and for the same reason: marking twice
  // corrects the record rather than adding a second one.
  return prisma.attendanceRecord.upsert({
    where: { participantId_onDate: { participantId, onDate } },
    create: { tripId, participantId, onDate, state, markedBy, notes },
    update: { state, markedBy, notes, markedAt: new Date() },
  });
}

// ─── Equipment ───────────────────────────────────────────────────────────────

export async function listEquipment(tripId: string, organizerId: string) {
  await assertTripOwned(tripId, organizerId);
  return prisma.equipmentItem.findMany({
    where: { tripId },
    orderBy: { name: 'asc' },
    include: {
      assignments: {
        include: { participant: { select: { id: true, name: true } } },
      },
    },
  });
}

export async function createEquipment(tripId: string, organizerId: string, data: any) {
  await assertTripOwned(tripId, organizerId);
  return prisma.equipmentItem.create({ data: { ...data, tripId } });
}

export async function issueEquipment(
  equipmentId: string,
  participantId: string,
  organizerId: string,
  units = 1
) {
  const item = await prisma.equipmentItem.findUnique({
    where: { id: equipmentId },
    include: { assignments: true },
  });
  if (!item) throw new OpsError('Equipment not found', 404);
  await assertTripOwned(item.tripId, organizerId);
  await assertParticipantOwned(participantId, organizerId);

  const already = item.assignments.find((a) => a.participantId === participantId);
  if (already) throw new OpsError('This person already has this item', 409);

  const issued = item.assignments
    .filter((a) => a.returnedAt === null)
    .reduce((s, a) => s + a.units, 0);

  const assignment = await prisma.equipmentAssignment.create({
    data: { equipmentId, participantId, units },
  });

  // Same posture as room capacity: stock going negative is worth saying out
  // loud, not worth blocking a handover that has already physically happened.
  const warning =
    issued + units > item.totalUnits
      ? `${item.name}: ${issued + units} issued against ${item.totalUnits} in stock.`
      : null;

  return { assignment, warning };
}

export async function returnEquipment(assignmentId: string, organizerId: string) {
  const a = await prisma.equipmentAssignment.findUnique({
    where: { id: assignmentId },
    include: { equipment: { select: { tripId: true } } },
  });
  if (!a) throw new OpsError('Assignment not found', 404);
  await assertTripOwned(a.equipment.tripId, organizerId);
  return prisma.equipmentAssignment.update({
    where: { id: assignmentId },
    data: { returnedAt: new Date() },
  });
}

// ─── Permits, certifications and their expiry ────────────────────────────────

export type ExpiryState = 'expired' | 'expiring_soon' | 'valid' | 'no_expiry';

export interface CredentialRow {
  kind: 'permit' | 'certification';
  id: string;
  scopeId: string;
  name: string;
  expiresOn: Date | null;
  expiryState: ExpiryState;
}

/**
 * Expiry is read from v_expiring_credentials, which is the only place the word
 * "expired" is produced. The gate says an expired permit must read expired
 * however it is stored; that holds because it is stored one way — a date — and
 * derived in one place, rather than duplicated into a status column that goes
 * stale at midnight with nothing watching it.
 */
export async function getCredentials(scopeIds: string[]): Promise<CredentialRow[]> {
  if (scopeIds.length === 0) return [];
  const rows = await prisma.$queryRaw<any[]>`
    SELECT kind, id, scope_id, name, expires_on, expiry_state
    FROM v_expiring_credentials
    WHERE scope_id = ANY(${scopeIds})
    ORDER BY expires_on NULLS LAST
  `;
  return rows.map((r) => ({
    kind: r.kind,
    id: r.id,
    scopeId: r.scope_id,
    name: r.name,
    expiresOn: r.expires_on,
    expiryState: r.expiry_state,
  }));
}

export async function listPermits(tripId: string, organizerId: string) {
  await assertTripOwned(tripId, organizerId);
  const [permits, credentials] = await Promise.all([
    prisma.permit.findMany({ where: { tripId }, orderBy: { expiresOn: 'asc' } }),
    getCredentials([tripId]),
  ]);
  const stateById = new Map(credentials.map((c) => [c.id, c.expiryState]));
  return permits.map((p) => ({ ...p, expiryState: stateById.get(p.id) ?? 'no_expiry' }));
}

export async function createPermit(tripId: string, organizerId: string, data: any) {
  await assertTripOwned(tripId, organizerId);
  return prisma.permit.create({ data: { ...data, tripId } });
}

export async function listCertifications(organizerId: string) {
  const [certs, credentials] = await Promise.all([
    prisma.certification.findMany({ where: { organizerId }, orderBy: { expiresOn: 'asc' } }),
    getCredentials([organizerId]),
  ]);
  const stateById = new Map(credentials.map((c) => [c.id, c.expiryState]));
  return certs.map((c) => ({ ...c, expiryState: stateById.get(c.id) ?? 'no_expiry' }));
}

export async function createCertification(organizerId: string, data: any) {
  // Named fields rather than a spread of the request body.
  //
  // The spread had two faults, both invisible until something finally called
  // this. A date arrives from a date input as "2027-06-30", which Prisma
  // rejects as not ISO-8601, so every attempt answered 500. And verifiedAt and
  // verifiedBy are on this table: spreading the body let the organizer mark
  // their own certification verified by sending two extra fields.
  const onDate = (v: any) => {
    if (!v) return null;
    // A date-only value is midday UTC, not midnight, so a timezone shift
    // cannot move it to the day before.
    const d = typeof v === 'string' && /^d{4}-d{2}-d{2}$/.test(v) ? new Date(v + 'T12:00:00Z') : new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  return prisma.certification.create({
    data: {
      organizerId,
      name: String(data?.name ?? '').trim(),
      issuingBody: data?.issuingBody ? String(data.issuingBody).trim() : null,
      referenceCode: data?.referenceCode ? String(data.referenceCode).trim() : null,
      issuedOn: onDate(data?.issuedOn),
      expiresOn: onDate(data?.expiresOn),
      documentUrl: data?.documentUrl ? String(data.documentUrl) : null,
    },
  });
}

// ─── Emergency plan ──────────────────────────────────────────────────────────

export async function getEmergencyPlan(tripId: string, organizerId: string) {
  await assertTripOwned(tripId, organizerId);
  return prisma.emergencyPlan.findUnique({ where: { tripId } });
}

export async function upsertEmergencyPlan(tripId: string, organizerId: string, data: any) {
  await assertTripOwned(tripId, organizerId);
  return prisma.emergencyPlan.upsert({
    where: { tripId },
    create: { ...data, tripId },
    update: data,
  });
}

// ─── Documents ───────────────────────────────────────────────────────────────

/**
 * A document has exactly one subject. The database enforces it with a CHECK;
 * this rejects the same thing earlier so the caller gets a sentence rather than
 * a constraint-violation stack trace.
 */
export async function createDocument(organizerId: string, data: any) {
  const subjects = [data.tripId, data.bookingId, data.participantId].filter(Boolean);
  if (subjects.length !== 1) {
    throw new OpsError(
      'A document must belong to exactly one of a trip, a booking or a participant',
      400
    );
  }

  if (data.tripId) await assertTripOwned(data.tripId, organizerId);
  if (data.participantId) await assertParticipantOwned(data.participantId, organizerId);
  if (data.bookingId) {
    const b = await prisma.groupBooking.findUnique({
      where: { id: data.bookingId },
      select: { trip: { select: { organizerId: true } } },
    });
    if (!b) throw new OpsError('Booking not found', 404);
    if (b.trip.organizerId !== organizerId) throw new OpsError('Not your booking', 403);
  }

  return prisma.opsDocument.create({ data: { ...data, organizerId } });
}

export async function listDocuments(
  organizerId: string,
  filter: { tripId?: string; bookingId?: string; participantId?: string }
) {
  return prisma.opsDocument.findMany({
    where: { organizerId, ...filter },
    orderBy: { createdAt: 'desc' },
  });
}

export async function deleteDocument(id: string, organizerId: string) {
  const doc = await prisma.opsDocument.findUnique({ where: { id } });
  if (!doc) throw new OpsError('Document not found', 404);
  if (doc.organizerId !== organizerId) throw new OpsError('Not your document', 403);
  return prisma.opsDocument.delete({ where: { id } });
}

// ─── Medical declarations ────────────────────────────────────────────────────

export async function getMedicalDeclaration(participantId: string, organizerId: string) {
  await assertParticipantOwned(participantId, organizerId);
  return prisma.medicalDeclaration.findUnique({ where: { participantId } });
}

export async function upsertMedicalDeclaration(
  participantId: string,
  organizerId: string,
  data: any
) {
  await assertParticipantOwned(participantId, organizerId);
  return prisma.medicalDeclaration.upsert({
    where: { participantId },
    create: { ...data, participantId },
    update: data,
  });
}
