import express from 'express';
import { authenticateJwt } from '../middleware/auth';
import { requireOrganizerOrAdmin } from '../middleware/roleCheck';
import { vendorAssignmentService } from '../services/vendorAssignmentService';
import { vendorPaymentService } from '../services/vendorPaymentService';

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

router.post('/:assignmentId/payments', async (req, res) => {
  try {
    const organizerId = (req as any).auth.userId;
    const { amount, note, totalAmount, dueDate } = req.body;
    const entry = await vendorPaymentService.recordPayment(
      organizerId,
      req.params.assignmentId,
      amount,
      note,
      totalAmount,
      dueDate ? new Date(dueDate) : undefined
    );
    res.status(201).json(entry);
  } catch (err: any) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

router.get('/:assignmentId/payments', async (req, res) => {
  try {
    const organizerId = (req as any).auth.userId;
    const summary = await vendorPaymentService.getPaymentSummary(organizerId, req.params.assignmentId);
    res.json(summary);
  } catch (err: any) {
    res.status(err.status || 404).json({ error: err.message });
  }
});

export default router;
