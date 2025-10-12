import { Router } from 'express';
import { z } from 'zod';
import { Trip } from '../models/Trip';
import { authenticateJwt, requireRole } from '../middleware/auth';
import { socketService } from '../services/socketService';

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
  paymentConfig: z.object({
    paymentType: z.enum(['full', 'advance']).default('full'),
    advanceAmount: z.number().positive().optional(),
    advancePercentage: z.number().min(0).max(100).optional(),
    paymentMethods: z.array(z.string()).default(['upi']),
    refundPolicy: z.string().optional(),
    instructions: z.string().optional()
  }).optional()
});

// Async error wrapper
const asyncHandler = (fn: Function) => (req: any, res: any, next: any) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

router.post('/', authenticateJwt, requireRole(['organizer','admin']), asyncHandler(async (req: any, res: any) => {
  try {
    console.log('📥 Received trip creation request:', {
      title: req.body.title,
      destination: req.body.destination,
      price: req.body.price,
      capacity: req.body.capacity,
      startDate: req.body.startDate,
      endDate: req.body.endDate,
      categories: req.body.categories,
      hasImages: !!req.body.images,
      hasSchedule: !!req.body.schedule,
      hasPaymentConfig: !!req.body.paymentConfig
    });

    // Enhanced validation with better error messages
    const parsed = createTripSchema.safeParse(req.body);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      const errorMessages = Object.entries(fieldErrors)
        .map(([field, errors]) => `${field}: ${errors?.join(', ')}`)
        .join('; ');
      
      console.error('❌ Validation failed:', fieldErrors);
      
      return res.status(400).json({ 
        success: false,
        error: 'Validation failed - please check all required fields',
        details: errorMessages,
        fields: fieldErrors,
        hint: 'Required fields: title, description, destination, price, capacity, startDate, endDate'
      });
    }
    
    const body = parsed.data;
    const organizerId = req.auth.userId;
    
    // Additional validation
    if (body.startDate >= body.endDate) {
      console.error('❌ Date validation failed: End date must be after start date');
      return res.status(400).json({ 
        success: false,
        error: 'End date must be after start date',
        details: `Start: ${body.startDate}, End: ${body.endDate}`
      });
    }
    
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    if (new Date(body.startDate) < now) {
      console.error('❌ Date validation failed: Start date is in the past');
      return res.status(400).json({ 
        success: false,
        error: 'Start date cannot be in the past',
        details: `Provided: ${body.startDate}, Current: ${now.toISOString()}`
      });
    }
    
    console.log('Creating trip:', {
      title: body.title,
      organizerId,
      destination: body.destination
    });
    
    // Create trip with timeout
    const createPromise = Trip.create({
      ...body, 
      organizerId, 
      location: body.location ? { type: 'Point', coordinates: body.location.coordinates } : undefined,
      participants: [],
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Database operation timeout')), 10000)
    );
    
    const trip = await Promise.race([createPromise, timeoutPromise]) as any;
    
    console.log('✅ Trip created successfully:', trip._id);
    
    // Broadcast real-time update
    socketService.broadcastTripUpdate(trip, 'created');
    
    res.status(201).json({
      success: true,
      message: 'Trip created successfully',
      trip: {
        id: trip._id,
        title: trip.title,
        destination: trip.destination,
        price: trip.price,
        capacity: trip.capacity,
        startDate: trip.startDate,
        endDate: trip.endDate,
        categories: trip.categories,
        organizerId: trip.organizerId
      }
    });
    
  } catch (error: any) {
    console.error('Error creating trip:', error);
    
    // Handle specific MongoDB errors
    if (error.code === 11000) {
      console.error('❌ Duplicate trip title');
      return res.status(409).json({ 
        success: false,
        error: 'Trip with this title already exists',
        hint: 'Please use a different title for your trip'
      });
    }
    
    if (error.name === 'ValidationError') {
      const errorMessages = Object.values(error.errors)
        .map((err: any) => err.message)
        .join(', ');
      console.error('❌ Database validation error:', errorMessages);
      return res.status(400).json({ 
        success: false,
        error: 'Database validation failed',
        details: errorMessages,
        hint: 'Please check all required fields are provided correctly'
      });
    }
    
    if (error.message === 'Database operation timeout') {
      console.error('❌ Database timeout');
      return res.status(503).json({ 
        success: false,
        error: 'Service temporarily unavailable. Please try again.',
        hint: 'The server is experiencing high load. Please retry in a moment.'
      });
    }
    
    // Generic error
    console.error('❌ Unexpected error creating trip:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to create trip. Please try again later.',
      ...(process.env.NODE_ENV !== 'production' && { 
        details: error.message,
        stack: error.stack 
      })
    });
  }
}));

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
    
    trip.participants = trip.participants.filter((id: any) => id.toString() !== userId);
    await trip.save();
    
    res.json({ message: 'Successfully left trip', trip });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update trip endpoint
router.put('/:id', authenticateJwt, requireRole(['organizer','admin']), async (req, res) => {
  try {
    const userId = (req as any).auth.userId;
    const trip = await Trip.findById(req.params.id);
    
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    
    // Check if user is the organizer or admin
    if (trip.organizerId.toString() !== userId && (req as any).auth.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to update this trip' });
    }
    
    // Create update schema (similar to create but all fields optional)
    const updateTripSchema = z.object({
      title: z.string().min(1).optional(),
      description: z.string().min(1).optional(),
      categories: z.array(z.string()).optional(),
      destination: z.string().min(1).optional(),
      location: z.object({ coordinates: z.tuple([z.number(), z.number()]) }).optional(),
      schedule: z.array(z.object({ day: z.number(), title: z.string(), activities: z.array(z.string()).default([]) })).optional(),
      images: z.array(z.string()).optional(),
      capacity: z.number().int().positive().optional(),
      price: z.number().positive().optional(),
      startDate: z.coerce.date().optional(),
      endDate: z.coerce.date().optional(),
      itinerary: z.string().optional(),
      coverImage: z.string().optional(),
      itineraryPdf: z.string().optional(),
      status: z.enum(['active', 'cancelled', 'completed']).optional()
    });
    
    const parsed = updateTripSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    
    const updateData = parsed.data;
    
    // Handle location transformation if provided
    if (updateData.location) {
      (updateData as any).location = { type: 'Point', coordinates: updateData.location.coordinates };
    }
    
    // Update the trip
    const updatedTrip = await Trip.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );
    
    res.json(updatedTrip);
  } catch (error: any) {
    console.error('Error updating trip:', error);
    res.status(500).json({ error: 'Failed to update trip' });
  }
});

// Delete trip endpoint
router.delete('/:id', authenticateJwt, requireRole(['organizer','admin']), async (req, res) => {
  try {
    const userId = (req as any).auth.userId;
    const trip = await Trip.findById(req.params.id);
    
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    
    // Check if user is the organizer or admin
    if (trip.organizerId.toString() !== userId && (req as any).auth.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to delete this trip' });
    }
    
    await Trip.findByIdAndDelete(req.params.id);
    
    res.json({ message: 'Trip deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting trip:', error);
    res.status(500).json({ error: 'Failed to delete trip' });
  }
});

export default router;


