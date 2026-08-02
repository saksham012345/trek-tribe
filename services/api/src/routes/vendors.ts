import express from 'express';
import { authenticateJwt } from '../middleware/auth';
import { requireOrganizerOrAdmin } from '../middleware/roleCheck';
import { vendorService } from '../services/vendorService';

const router = express.Router();

router.use(authenticateJwt);
router.use(requireOrganizerOrAdmin);

router.post('/', async (req, res) => {
  try {
    const organizerId = (req as any).auth.userId;
    const vendor = await vendorService.createVendor(organizerId, req.body);
    res.status(201).json(vendor);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  const organizerId = (req as any).auth.userId;
  const vendors = await vendorService.listVendors(organizerId);
  res.json(vendors);
});

router.get('/:id', async (req, res) => {
  const organizerId = (req as any).auth.userId;
  const vendor = await vendorService.getVendor(organizerId, req.params.id);
  if (!vendor) return res.status(404).json({ error: 'Vendor not found' });
  res.json(vendor);
});

router.put('/:id', async (req, res) => {
  try {
    const organizerId = (req as any).auth.userId;
    const vendor = await vendorService.updateVendor(organizerId, req.params.id, req.body);
    res.json(vendor);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const organizerId = (req as any).auth.userId;
    await vendorService.deleteVendor(organizerId, req.params.id);
    res.status(204).send();
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

export default router;
