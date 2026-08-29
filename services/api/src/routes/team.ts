/**
 * Team Routes — Sprint 8
 *
 * Thin router — delegates to modules/team/team.controller.ts.
 *
 * accept-invite is the one route open to any signed-in user: the person
 * accepting is not on the team yet, so requiring team membership to join a team
 * would be a closed loop.
 */

import { Router } from 'express';
import { authenticateJwt, requireRole } from '../middleware/auth';
import * as teamController from '../modules/team/team.controller';

const router = Router();

const asyncHandler = (fn: Function) => (req: any, res: any, next: any) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const owner = [authenticateJwt, requireRole(['organizer', 'admin'])];

// Any signed-in user may redeem an invite addressed to them.
router.post('/accept-invite', authenticateJwt, asyncHandler(teamController.acceptInvite));

// And any signed-in user may ask what they can see. This is the endpoint the
// sprint gate is checked against directly.
router.get('/my-scope', authenticateJwt, asyncHandler(teamController.myScope));

router.get('/', ...owner, asyncHandler(teamController.listTeam));
router.get('/invites', ...owner, asyncHandler(teamController.listInvites));
router.post('/invites', ...owner, asyncHandler(teamController.inviteMember));
router.post('/invites/:id/resend', ...owner, asyncHandler(teamController.resendInvite));

router.patch('/members/:id/role', ...owner, asyncHandler(teamController.setMemberRole));
router.delete('/members/:id', ...owner, asyncHandler(teamController.removeMember));

router.post('/members/:id/trips', ...owner, asyncHandler(teamController.assignTrip));
router.delete('/members/:id/trips/:tripId', ...owner, asyncHandler(teamController.unassignTrip));

export default router;
