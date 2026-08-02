import express from 'express';
import { authenticateJwt } from '../middleware/auth';
import { requireOrganizerOrAdmin } from '../middleware/roleCheck';
import { vendorAssignmentService } from '../services/vendorAssignmentService';

const router = express.Router();

router.use(authenticateJwt);
router.use(requireOrganizerOrAdmin);

router.post('/:tripId/vendors', async (req, res) => {
  try {
    const organizerId = (req as any).auth.userId;
    const { vendorId, category } = req.body;
    const assignment = await vendorAssignmentService.assignVendor(organizerId, req.params.tripId, vendorId, category);
    res.status(201).json(assignment);
  } catch (err: any) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

router.get('/:tripId/vendors', async (req, res) => {
  const organizerId = (req as any).auth.userId;
  const assignments = await vendorAssignmentService.listAssignments(organizerId, req.params.tripId);
  res.json(assignments);
});

export default router;
