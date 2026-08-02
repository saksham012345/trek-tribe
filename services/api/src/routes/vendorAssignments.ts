import express from 'express';
import { authenticateJwt } from '../middleware/auth';
import { requireOrganizerOrAdmin } from '../middleware/roleCheck';
import { vendorAssignmentService } from '../services/vendorAssignmentService';

const router = express.Router();

router.use(authenticateJwt);
router.use(requireOrganizerOrAdmin);

router.delete('/:assignmentId', async (req, res) => {
  try {
    const organizerId = (req as any).auth.userId;
    await vendorAssignmentService.unassignVendor(organizerId, req.params.assignmentId);
    res.status(204).send();
  } catch (err: any) {
    res.status(err.status || 404).json({ error: err.message });
  }
});

export default router;
