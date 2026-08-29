/**
 * Operations controller — Sprint 5
 *
 * Handles req/res, delegates all logic to ops.service.ts.
 * No business logic lives here.
 */

import { Request, Response } from 'express';
import * as ops from './ops.service';
import { OpsError } from './ops.service';

function actorId(req: Request): string | null {
  return (req as any).user?.userId ?? null;
}

// OpsError carries its own status because the service is the thing that knows
// whether a miss was "not found" or "not yours". Anything else is a 500 —
// folding unknown errors into 400 is how real bugs get reported as user
// mistakes.
function fail(res: Response, error: any, whileDoing: string) {
  if (error instanceof OpsError) {
    return res.status(error.status).json({ error: error.message });
  }
  console.error(`❌ Error ${whileDoing}:`, error);
  return res.status(500).json({ error: `Failed ${whileDoing}`, message: error?.message });
}

function run(
  whileDoing: string,
  handler: (req: Request, userId: string) => Promise<unknown>,
  status = 200
) {
  return async (req: Request, res: Response) => {
    const userId = actorId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const result = await handler(req, userId);
      return res.status(status).json(result);
    } catch (error: any) {
      return fail(res, error, whileDoing);
    }
  };
}

function parseDate(value: unknown, fallback?: Date): Date {
  if (typeof value === 'string') {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }
  if (fallback) return fallback;
  throw new OpsError('A valid date is required', 400);
}

// ─── Rooms ───────────────────────────────────────────────────────────────────

export const listAccommodation = run('listing accommodation', (req, uid) =>
  ops.listAccommodation(req.params.tripId, uid)
);

export const createAccommodation = run(
  'creating accommodation',
  (req, uid) => {
    if (!req.body?.name) throw new OpsError('name is required', 400);
    return ops.createAccommodation(req.params.tripId, uid, req.body);
  },
  201
);

export const createRoom = run(
  'creating room',
  (req, uid) => {
    if (!req.body?.label) throw new OpsError('label is required', 400);
    if (typeof req.body?.capacity !== 'number') throw new OpsError('capacity must be a number', 400);
    return ops.createRoom(req.params.accommodationId, uid, req.body);
  },
  201
);

// Returns { assignment, warning }. The warning is over-capacity: the assignment
// still happened, and the screen decides how loudly to say so.
export const assignRoom = run(
  'assigning room',
  (req, uid) => {
    if (!req.body?.participantId) throw new OpsError('participantId is required', 400);
    return ops.assignRoom(req.params.roomId, req.body.participantId, uid, uid);
  },
  201
);

export const unassignRoom = run('removing room assignment', (req, uid) =>
  ops.unassignRoom(req.params.participantId, uid)
);

// ─── Transport ───────────────────────────────────────────────────────────────

export const listTransport = run('listing transport', (req, uid) =>
  ops.listTransport(req.params.tripId, uid)
);

export const createTransportSegment = run(
  'creating transport segment',
  (req, uid) => {
    const { mode, fromLocation, toLocation } = req.body ?? {};
    if (!mode || !fromLocation || !toLocation) {
      throw new OpsError('mode, fromLocation and toLocation are required', 400);
    }
    return ops.createTransportSegment(req.params.tripId, uid, req.body);
  },
  201
);

export const assignTransport = run(
  'assigning transport',
  (req, uid) => {
    if (!req.body?.participantId) throw new OpsError('participantId is required', 400);
    return ops.assignTransport(req.params.segmentId, req.body.participantId, uid, req.body.seatLabel);
  },
  201
);

// ─── Checklists ──────────────────────────────────────────────────────────────

export const listChecklistTemplates = run('listing checklist templates', (_req, uid) =>
  ops.listChecklistTemplates(uid)
);

export const createChecklistTemplate = run(
  'creating checklist template',
  (req, uid) => {
    if (!req.body?.label) throw new OpsError('label is required', 400);
    return ops.createChecklistTemplate(uid, req.body);
  },
  201
);

export const getBookingChecklist = run('reading booking checklist', (req, uid) =>
  ops.getBookingChecklist(req.params.bookingId, uid)
);

export const toggleChecklistItem = run('toggling checklist item', (req, uid) => {
  if (typeof req.body?.isDone !== 'boolean') throw new OpsError('isDone must be a boolean', 400);
  return ops.toggleChecklistItem(
    req.params.bookingId,
    req.params.templateId,
    uid,
    req.body.isDone,
    uid
  );
});

// ─── Attendance ──────────────────────────────────────────────────────────────

export const getAttendance = run('reading attendance', (req, uid) =>
  ops.getAttendance(req.params.tripId, uid, parseDate(req.query.date, new Date()))
);

export const markAttendance = run('marking attendance', (req, uid) => {
  const { participantId, state } = req.body ?? {};
  const allowed = ['present', 'absent', 'late', 'excused'];
  if (!participantId) throw new OpsError('participantId is required', 400);
  if (!allowed.includes(state)) throw new OpsError(`state must be one of ${allowed.join(', ')}`, 400);
  return ops.markAttendance(
    req.params.tripId,
    participantId,
    uid,
    parseDate(req.body?.onDate, new Date()),
    state,
    uid,
    req.body?.notes
  );
});

// ─── Equipment ───────────────────────────────────────────────────────────────

export const listEquipment = run('listing equipment', (req, uid) =>
  ops.listEquipment(req.params.tripId, uid)
);

export const createEquipment = run(
  'creating equipment',
  (req, uid) => {
    if (!req.body?.name) throw new OpsError('name is required', 400);
    return ops.createEquipment(req.params.tripId, uid, req.body);
  },
  201
);

export const issueEquipment = run(
  'issuing equipment',
  (req, uid) => {
    if (!req.body?.participantId) throw new OpsError('participantId is required', 400);
    return ops.issueEquipment(req.params.equipmentId, req.body.participantId, uid, req.body.units ?? 1);
  },
  201
);

export const returnEquipment = run('returning equipment', (req, uid) =>
  ops.returnEquipment(req.params.assignmentId, uid)
);

// ─── Permits, certifications, emergency plan ─────────────────────────────────

export const listPermits = run('listing permits', (req, uid) =>
  ops.listPermits(req.params.tripId, uid)
);

export const createPermit = run(
  'creating permit',
  (req, uid) => {
    if (!req.body?.name) throw new OpsError('name is required', 400);
    return ops.createPermit(req.params.tripId, uid, req.body);
  },
  201
);

export const listCertifications = run('listing certifications', (_req, uid) =>
  ops.listCertifications(uid)
);

export const createCertification = run(
  'creating certification',
  (req, uid) => {
    if (!req.body?.name) throw new OpsError('name is required', 400);
    return ops.createCertification(uid, req.body);
  },
  201
);

export const getEmergencyPlan = run('reading emergency plan', (req, uid) =>
  ops.getEmergencyPlan(req.params.tripId, uid)
);

export const upsertEmergencyPlan = run('saving emergency plan', (req, uid) =>
  ops.upsertEmergencyPlan(req.params.tripId, uid, req.body ?? {})
);

// ─── Documents ───────────────────────────────────────────────────────────────

export const listDocuments = run('listing documents', (req, uid) =>
  ops.listDocuments(uid, {
    tripId: typeof req.query.tripId === 'string' ? req.query.tripId : undefined,
    bookingId: typeof req.query.bookingId === 'string' ? req.query.bookingId : undefined,
    participantId:
      typeof req.query.participantId === 'string' ? req.query.participantId : undefined,
  })
);

export const createDocument = run(
  'creating document',
  (req, uid) => {
    if (!req.body?.title || !req.body?.fileUrl) {
      throw new OpsError('title and fileUrl are required', 400);
    }
    return ops.createDocument(uid, req.body);
  },
  201
);

export const deleteDocument = run('deleting document', async (req, uid) => {
  await ops.deleteDocument(req.params.id, uid);
  return { deleted: true };
});

// ─── Medical declarations ────────────────────────────────────────────────────

export const getMedicalDeclaration = run('reading medical declaration', (req, uid) =>
  ops.getMedicalDeclaration(req.params.participantId, uid)
);

export const upsertMedicalDeclaration = run('saving medical declaration', (req, uid) =>
  ops.upsertMedicalDeclaration(req.params.participantId, uid, req.body ?? {})
);
