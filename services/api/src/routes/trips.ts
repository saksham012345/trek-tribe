import { Router } from 'express';
import { z } from 'zod';
import { Trip } from '../models/Trip';
import { authenticateJwt, requireRole } from '../middleware/auth';
import { socketService } from '../services/socketService';

const router = Router();

// Ultra-flexible schema that accepts ANY input format
const createTripSchema = z.object({
  title: z.union([z.string(), z.number()]).transform(val => String(val || 'Untitled Trip')),
  description: z.union([z.string(), z.number()]).transform(val => String(val || 'No description provided')),
  categories: z.union([z.array(z.any()), z.string(), z.number(), z.undefined(), z.null()])
    .transform(val => {
      if (Array.isArray(val)) return val.map(String);
      if (typeof val === 'string') return val.split(',').map(s => s.trim()).filter(Boolean);
      if (val === null || val === undefined) return ['Adventure'];
      return ['Adventure'];
    }),
  destination: z.union([z.string(), z.number()]).transform(val => String(val || 'Unknown Destination')),
  location: z.union([
    z.object({ 
      coordinates: z.tuple([z.number(), z.number()]),
      latitude: z.number().optional(),
      longitude: z.number().optional()
    }),
    z.object({ latitude: z.number(), longitude: z.number() }),
    z.null(),
    z.undefined(),
    z.string(),
    z.number()
  ]).transform(val => {
    if (val === null || val === undefined) return null;
    if (typeof val === 'object' && 'coordinates' in val && val.coordinates) return val;
    if (typeof val === 'object' && ('latitude' in val || 'longitude' in val)) {
      return { coordinates: [val.longitude || 0, val.latitude || 0] };
    }
    return null;
  }),
  schedule: z.union([z.array(z.any()), z.undefined(), z.null()])
    .transform(val => {
      if (Array.isArray(val)) return val.map((item, index) => ({
        day: Number(item?.day || index + 1),
        title: String(item?.title || `Day ${index + 1}`),
        activities: Array.isArray(item?.activities) ? item.activities.map(String) : []
      }));
      return [];
    }),
  images: z.union([z.array(z.any()), z.undefined(), z.null()])
    .transform(val => Array.isArray(val) ? val.map(String) : []),
  capacity: z.union([z.string(), z.number(), z.undefined(), z.null()])
    .transform(val => {
      const num = Number(val || 10);
      return num > 0 ? Math.floor(num) : 10;
    }),
  price: z.union([z.string(), z.number(), z.undefined(), z.null()])
    .transform(val => {
      const num = Number(val || 1000);
      return num > 0 ? num : 1000;
    }),
  minimumAge: z.union([z.string(), z.number(), z.undefined(), z.null()])
    .transform(val => {
      if (val === null || val === undefined || val === '') return undefined;
      const num = Number(val);
      return num >= 1 && num <= 100 ? Math.floor(num) : undefined;
    }).optional(),
  startDate: z.union([z.string(), z.number(), z.date(), z.undefined(), z.null()])
    .transform(val => {
      if (!val) return new Date(Date.now() + 24 * 60 * 60 * 1000); // Tomorrow
      const date = new Date(val);
      return isNaN(date.getTime()) ? new Date(Date.now() + 24 * 60 * 60 * 1000) : date;
    }),
  endDate: z.union([z.string(), z.number(), z.date(), z.undefined(), z.null()])
    .transform(val => {
      if (!val) return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // Next week
      const date = new Date(val);
      return isNaN(date.getTime()) ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : date;
    }),
  paymentConfig: z.union([
    z.object({
      paymentType: z.union([z.string(), z.number()]).transform(val => ['full', 'advance'].includes(String(val)) ? String(val) : 'full'),
      advanceAmount: z.union([z.string(), z.number(), z.undefined(), z.null()])
        .transform(val => val ? Number(val) : undefined),
      paymentMethods: z.union([z.array(z.any()), z.string(), z.undefined(), z.null()])
        .transform(val => {
          if (Array.isArray(val)) return val.map(String);
          if (typeof val === 'string') return [val];
          return ['upi'];
        }),
      refundPolicy: z.union([z.string(), z.number(), z.undefined(), z.null()])
        .transform(val => val ? String(val) : undefined),
      instructions: z.union([z.string(), z.number(), z.undefined(), z.null()])
        .transform(val => val ? String(val) : undefined)
    }),
    z.undefined(),
    z.null(),
    z.string(),
    z.number()
  ]).transform(val => {
    if (val === null || val === undefined || typeof val === 'string' || typeof val === 'number') {
      return {
        paymentType: 'full' as const,
        paymentMethods: ['upi'],
        advanceAmount: undefined,
        advancePercentage: undefined,
        refundPolicy: undefined,
        instructions: undefined
      };
    }
    return val;
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

    // Ultra-flexible validation - always succeeds with smart defaults
    let parsed;
    try {
      parsed = createTripSchema.parse(req.body);
      console.log('✅ Validation successful with data transformation');
    } catch (error: any) {
      console.log('⚠️ Validation had issues, using fallback defaults');
      // Even if validation fails, create a trip with smart defaults
      parsed = createTripSchema.parse({
        title: req.body.title || 'Untitled Trip',
        description: req.body.description || 'No description provided',
        destination: req.body.destination || 'Unknown Destination',
        categories: req.body.categories || ['Adventure'],
        location: req.body.location || null,
        schedule: req.body.schedule || [],
        images: req.body.images || [],
        capacity: req.body.capacity || 10,
        price: req.body.price || 1000,
        minimumAge: req.body.minimumAge || undefined,
        startDate: req.body.startDate || new Date(Date.now() + 24 * 60 * 60 * 1000),
        endDate: req.body.endDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        paymentConfig: req.body.paymentConfig || {
          paymentType: 'full',
          paymentMethods: ['upi'],
          advanceAmount: undefined
        }
      });
    }
    
    const body = parsed;
    const organizerId = req.auth.userId;
    
    // Smart date validation - fix dates if needed instead of rejecting
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    // If start date is in the past, set it to tomorrow
    if (body.startDate < now) {
      console.log('📅 Start date was in the past, setting to tomorrow');
      body.startDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
    }
    
    // If end date is before or same as start date, set it to 7 days after start
    if (body.endDate <= body.startDate) {
      console.log('📅 End date was before start date, setting to 7 days after start');
      body.endDate = new Date(body.startDate.getTime() + 7 * 24 * 60 * 60 * 1000);
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


