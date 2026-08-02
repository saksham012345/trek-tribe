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

router.post('/:id/documents', async (req, res) => {
  try {
    const organizerId = (req as any).auth.userId;
    const { fileName, fileUrl } = req.body;
    const doc = await vendorService.addDocument(organizerId, req.params.id, fileName, fileUrl);
    res.status(201).json(doc);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

router.get('/:id/documents', async (req, res) => {
  try {
    const organizerId = (req as any).auth.userId;
    const docs = await vendorService.listDocuments(organizerId, req.params.id);
    res.json(docs);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

router.delete('/:id/documents/:documentId', async (req, res) => {
  try {
    const organizerId = (req as any).auth.userId;
    await vendorService.deleteDocument(organizerId, req.params.id, req.params.documentId);
    res.status(204).send();
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

export default router;
