import { Router } from 'express';
import { z } from 'zod';
import { Trip } from '../models/Trip';
import { authenticateJwt, requireRole } from '../middleware/auth';

const router = Router();

const createTripSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  categories: z.array(z.string()).default([]),
  destination: z.string().min(1),
  location: z.object({ coordinates: z.tuple([z.number(), z.number()]) }).optional(),
  schedule: z.array(z.object({ day: z.number(), title: z.string(), activities: z.array(z.string()).default([]) })).default([]),
  images: z.array(z.string()).default([]),
  capacity: z.number().int().positive(),
  price: z.number().positive(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
});

router.post('/', authenticateJwt, requireRole(['organizer','admin']), async (req, res) => {
  const parsed = createTripSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const body = parsed.data;
  const organizerId = (req as any).auth.userId;
  const trip = await Trip.create({ ...body, organizerId, location: body.location ? { type: 'Point', coordinates: body.location.coordinates } : undefined });
  res.status(201).json(trip);
});

router.get('/', async (req, res) => {
  const { q, category, minPrice, maxPrice, dest, from, to } = req.query as Record<string, string>;
  const filter: any = {};
  if (q) filter.$text = { $search: q };
  if (category) filter.categories = category;
  if (dest) filter.destination = dest;
  if (minPrice || maxPrice) filter.price = { ...(minPrice ? { $gte: Number(minPrice) } : {}), ...(maxPrice ? { $lte: Number(maxPrice) } : {}) };
  if (from || to) filter.startDate = { ...(from ? { $gte: new Date(from) } : {}), ...(to ? { $lte: new Date(to) } : {}) };
  const trips = await Trip.find(filter).lean().limit(50);
  res.json(trips);
});

router.get('/:id', async (req, res) => {
  const trip = await Trip.findById(req.params.id).lean();
  if (!trip) return res.status(404).json({ error: 'Not found' });
  res.json(trip);
});

router.post('/:id/join', authenticateJwt, async (req, res) => {
  try {
    const userId = (req as any).auth.userId;
    const trip = await Trip.findById(req.params.id);
    
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    if (trip.participants.length >= trip.capacity) {
      return res.status(400).json({ error: 'Trip is full' });
    }
    if (trip.participants.includes(userId)) {
      return res.status(400).json({ error: 'Already joined this trip' });
    }
    
    trip.participants.push(userId);
    await trip.save();
    
    res.json({ message: 'Successfully joined trip', trip });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id/leave', authenticateJwt, async (req, res) => {
  try {
    const userId = (req as any).auth.userId;
    const trip = await Trip.findById(req.params.id);
    
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    if (!trip.participants.includes(userId)) {
      return res.status(400).json({ error: 'Not part of this trip' });
    }
    
    trip.participants = trip.participants.filter(id => id.toString() !== userId);
    await trip.save();
    
    res.json({ message: 'Successfully left trip', trip });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;


