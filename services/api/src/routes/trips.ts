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
  // Additional fields from frontend
  difficultyLevel: z.enum(['beginner', 'intermediate', 'advanced']).default('intermediate'),
  includedItems: z.array(z.string()).default([]),
  excludedItems: z.array(z.string()).default([]),
  requirements: z.array(z.string()).default([]),
  cancellationPolicy: z.string().default('moderate'),
  itinerary: z.string().default(''),
  coverImage: z.string().optional(),
  itineraryPdf: z.string().optional(),
});

// Async error wrapper
const asyncHandler = (fn: Function) => (req: any, res: any, next: any) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

router.post('/', authenticateJwt, requireRole(['organizer','admin']), asyncHandler(async (req: any, res: any) => {
  try {
    // Enhanced validation with better error messages
    const parsed = createTripSchema.safeParse(req.body);
    if (!parsed.success) {
      const errorMessages = Object.entries(parsed.error.flatten().fieldErrors)
        .map(([field, errors]) => `${field}: ${errors?.join(', ')}`)
        .join('; ');
      return res.status(400).json({ 
        error: 'Validation failed',
        details: errorMessages,
        fields: parsed.error.flatten().fieldErrors
      });
    }
    
    const body = parsed.data;
    const organizerId = req.auth.userId;
    
    // Additional validation
    if (body.startDate >= body.endDate) {
      return res.status(400).json({ 
        error: 'End date must be after start date' 
      });
    }
    
    if (new Date(body.startDate) < new Date()) {
      return res.status(400).json({ 
        error: 'Start date cannot be in the past' 
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
    
    console.log('Trip created successfully:', trip._id);
    
    res.status(201).json({
      message: 'Trip created successfully',
      trip: {
        id: trip._id,
        title: trip.title,
        destination: trip.destination,
        price: trip.price,
        capacity: trip.capacity,
        startDate: trip.startDate,
        endDate: trip.endDate,
        categories: trip.categories
      }
    });
    
  } catch (error: any) {
    console.error('Error creating trip:', error);
    
    // Handle specific MongoDB errors
    if (error.code === 11000) {
      return res.status(409).json({ 
        error: 'Trip with this title already exists' 
      });
    }
    
    if (error.name === 'ValidationError') {
      const errorMessages = Object.values(error.errors)
        .map((err: any) => err.message)
        .join(', ');
      return res.status(400).json({ 
        error: 'Database validation failed',
        details: errorMessages
      });
    }
    
    if (error.message === 'Database operation timeout') {
      return res.status(503).json({ 
        error: 'Service temporarily unavailable. Please try again.' 
      });
    }
    
    // Generic error
    res.status(500).json({ 
      error: 'Failed to create trip. Please try again later.',
      ...(process.env.NODE_ENV !== 'production' && { details: error.message })
    });
  }
}));

router.get('/', asyncHandler(async (req: any, res: any) => {
  try {
    const { 
      q, 
      category, 
      minPrice, 
      maxPrice, 
      destination, 
      dateFrom, 
      dateTo,
      difficultyLevel,
      organizerId,
      status = 'active',
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = 1,
      limit = 12,
      latitude,
      longitude,
      radius = 50 // km
    } = req.query as Record<string, string>;
    
    const filter: any = { status };
    
    // Text search
    if (q) {
      filter.$or = [
        { $text: { $search: q } },
        { title: { $regex: q, $options: 'i' } },
        { destination: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } }
      ];
    }
    
    // Category filter
    if (category) {
      filter.categories = { $in: Array.isArray(category) ? category : [category] };
    }
    
    // Destination filter
    if (destination) {
      filter.destination = { $regex: destination, $options: 'i' };
    }
    
    // Price range filter
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }
    
    // Date range filter
    if (dateFrom || dateTo) {
      filter.startDate = {};
      if (dateFrom) filter.startDate.$gte = new Date(dateFrom);
      if (dateTo) filter.startDate.$lte = new Date(dateTo);
    }
    
    // Difficulty level filter
    if (difficultyLevel) {
      filter.difficultyLevel = { $in: Array.isArray(difficultyLevel) ? difficultyLevel : [difficultyLevel] };
    }
    
    // Organizer filter
    if (organizerId) {
      filter.organizerId = organizerId;
    }
    
    // Location-based search (within radius)
    if (latitude && longitude) {
      filter.location = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(longitude), parseFloat(latitude)]
          },
          $maxDistance: parseFloat(String(radius)) * 1000 // Convert km to meters
        }
      };
    }
    
    // Pagination
    const pageNum = parseInt(String(page));
    const limitNum = parseInt(String(limit));
    const skip = (pageNum - 1) * limitNum;
    
    // Sort configuration
    const sortConfig: any = {};
    switch (sortBy) {
      case 'price':
        sortConfig.price = sortOrder === 'desc' ? -1 : 1;
        break;
      case 'date':
        sortConfig.startDate = sortOrder === 'desc' ? -1 : 1;
        break;
      case 'rating':
        sortConfig.averageRating = sortOrder === 'desc' ? -1 : 1;
        break;
      case 'popularity':
        sortConfig.bookingCount = -1;
        break;
      default:
        sortConfig.createdAt = sortOrder === 'desc' ? -1 : 1;
    }
    
    // Execute search with population
    const trips = await Trip.find(filter)
      .populate('organizerId', 'name averageRating totalRatings profilePicture')
      .sort(sortConfig)
      .skip(skip)
      .limit(limitNum)
      .lean();
    
    // Increment view count for displayed trips
    if (trips.length > 0) {
      await Trip.updateMany(
        { _id: { $in: trips.map(t => t._id) } },
        { $inc: { viewCount: 1 } }
      );
    }
    
    // Get total count for pagination
    const totalCount = await Trip.countDocuments(filter);
    
    // Get filter statistics for frontend
    const filterStats = await getFilterStatistics(filter);
    
    res.json({
      success: true,
      trips,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(totalCount / limitNum),
        totalCount,
        hasMore: skip + trips.length < totalCount,
        limit: limitNum
      },
      filters: {
        applied: {
          q: q || null,
          category: category || null,
          destination: destination || null,
          priceRange: minPrice || maxPrice ? [minPrice, maxPrice] : null,
          dateRange: dateFrom || dateTo ? [dateFrom, dateTo] : null,
          difficultyLevel: difficultyLevel || null,
          location: latitude && longitude ? { latitude, longitude, radius } : null
        },
        statistics: filterStats
      }
    });
    
  } catch (error: any) {
    console.error('Error searching trips:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to search trips' 
    });
  }
}));

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

// Helper function to get filter statistics
async function getFilterStatistics(baseFilter: any) {
  try {
    const [categories, destinations, priceRange, difficultyLevels] = await Promise.all([
      Trip.aggregate([
        { $match: { ...baseFilter, categories: { $exists: true } } },
        { $unwind: '$categories' },
        { $group: { _id: '$categories', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      Trip.aggregate([
        { $match: { ...baseFilter, destination: { $exists: true } } },
        { $group: { _id: '$destination', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),
      Trip.aggregate([
        { $match: baseFilter },
        { $group: { 
          _id: null, 
          minPrice: { $min: '$price' }, 
          maxPrice: { $max: '$price' },
          avgPrice: { $avg: '$price' }
        }}
      ]),
      Trip.aggregate([
        { $match: { ...baseFilter, difficultyLevel: { $exists: true } } },
        { $group: { _id: '$difficultyLevel', count: { $sum: 1 } } }
      ])
    ]);
    
    return {
      categories,
      destinations,
      priceRange: priceRange[0] || { minPrice: 0, maxPrice: 10000, avgPrice: 0 },
      difficultyLevels
    };
  } catch (error) {
    console.error('Error getting filter statistics:', error);
    return {
      categories: [],
      destinations: [],
      priceRange: { minPrice: 0, maxPrice: 10000, avgPrice: 0 },
      difficultyLevels: []
    };
  }
}

export default router;

