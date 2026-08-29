/**
 * Operations Routes — Sprint 5
 *
 * Thin router — delegates to modules/ops/ops.controller.ts.
 * Business logic lives in modules/ops/ops.service.ts
 *
 * Every route is organizer/admin only, and ownership is re-checked in the
 * service against the authenticated user. Being able to name a trip id in a URL
 * is not permission to read its participants' medical records.
 */

import { Router } from 'express';
import { authenticateJwt, requireRole } from '../middleware/auth';
import * as opsController from '../modules/ops/ops.controller';

const router = Router();

const asyncHandler = (fn: Function) => (req: any, res: any, next: any) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const organizer = [authenticateJwt, requireRole(['organizer', 'admin'])];

// ─── Literal paths first ─────────────────────────────────────────────────────
// Registered above the :tripId routes so a literal segment is never swallowed
// by the parameter.

router.get('/checklist-templates', ...organizer, asyncHandler(opsController.listChecklistTemplates));
router.post('/checklist-templates', ...organizer, asyncHandler(opsController.createChecklistTemplate));

router.get('/certifications', ...organizer, asyncHandler(opsController.listCertifications));
router.post('/certifications', ...organizer, asyncHandler(opsController.createCertification));

router.get('/documents', ...organizer, asyncHandler(opsController.listDocuments));
router.post('/documents', ...organizer, asyncHandler(opsController.createDocument));
router.delete('/documents/:id', ...organizer, asyncHandler(opsController.deleteDocument));

router.post('/rooms/:roomId/assign', ...organizer, asyncHandler(opsController.assignRoom));
router.post('/accommodation/:accommodationId/rooms', ...organizer, asyncHandler(opsController.createRoom));

router.post('/transport/:segmentId/assign', ...organizer, asyncHandler(opsController.assignTransport));

router.post('/equipment/:equipmentId/issue', ...organizer, asyncHandler(opsController.issueEquipment));
router.post('/equipment-assignments/:assignmentId/return', ...organizer, asyncHandler(opsController.returnEquipment));

router.get('/bookings/:bookingId/checklist', ...organizer, asyncHandler(opsController.getBookingChecklist));
router.put('/bookings/:bookingId/checklist/:templateId', ...organizer, asyncHandler(opsController.toggleChecklistItem));

router.delete('/participants/:participantId/room', ...organizer, asyncHandler(opsController.unassignRoom));
router.get('/participants/:participantId/medical', ...organizer, asyncHandler(opsController.getMedicalDeclaration));
router.put('/participants/:participantId/medical', ...organizer, asyncHandler(opsController.upsertMedicalDeclaration));

// ─── Trip-scoped ─────────────────────────────────────────────────────────────

router.get('/trips/:tripId/accommodation', ...organizer, asyncHandler(opsController.listAccommodation));
router.post('/trips/:tripId/accommodation', ...organizer, asyncHandler(opsController.createAccommodation));

router.get('/trips/:tripId/transport', ...organizer, asyncHandler(opsController.listTransport));
router.post('/trips/:tripId/transport', ...organizer, asyncHandler(opsController.createTransportSegment));

router.get('/trips/:tripId/attendance', ...organizer, asyncHandler(opsController.getAttendance));
router.post('/trips/:tripId/attendance', ...organizer, asyncHandler(opsController.markAttendance));

router.get('/trips/:tripId/equipment', ...organizer, asyncHandler(opsController.listEquipment));
router.post('/trips/:tripId/equipment', ...organizer, asyncHandler(opsController.createEquipment));

router.get('/trips/:tripId/permits', ...organizer, asyncHandler(opsController.listPermits));
router.post('/trips/:tripId/permits', ...organizer, asyncHandler(opsController.createPermit));

router.get('/trips/:tripId/emergency-plan', ...organizer, asyncHandler(opsController.getEmergencyPlan));
router.put('/trips/:tripId/emergency-plan', ...organizer, asyncHandler(opsController.upsertEmergencyPlan));

export default router;
