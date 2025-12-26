import express, { Request, Response } from 'express';
import { z } from 'zod';
import { authenticateToken } from '../middleware/auth';
import { Event } from '../models/Event';
import { User } from '../models/User';
import { logger } from '../utils/logger';

const router = express.Router();

// Validation schema
const createEventSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(10).max(2000),
  eventType: z.enum(['trip', 'meetup', 'workshop', 'webinar', 'other']),
  startDate: z.string().transform(str => new Date(str)),
  endDate: z.string().transform(str => new Date(str)),
  location: z.string().max(200).optional(),
  isVirtual: z.boolean().optional(),
  virtualLink: z.string().url().optional(),
  groupId: z.string().optional(),
  coverImage: z.string().url().optional(),
  capacity: z.number().min(1).optional(),
  tags: z.array(z.string()).optional(),
  price: z.number().min(0).optional(),
  isPaid: z.boolean().optional()
});

/**
 * POST /api/events
 * Create a new event
 */
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).auth.userId;
    
    const parsed = createEventSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid event data',
        details: parsed.error.flatten()
      });
    }

    const event = new Event({
      ...parsed.data,
      organizerId: userId,
      attendees: [userId],
      attendeeCount: 1,
      status: 'upcoming'
    });

    await event.save();

    // Award reputation points for creating an event
    await User.findByIdAndUpdate(userId, {
      $inc: { 'reputation.points': 30 }
    });

    logger.info('Event created', { eventId: event._id, userId });

    res.status(201).json({
      success: true,
      message: 'Event created successfully',
      event
    });
  } catch (error: any) {
    logger.error('Error creating event', { error: error.message });
    res.status(500).json({ error: 'Failed to create event' });
  }
});

/**
 * GET /api/events
 * Get all events with filters
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 12;
    const skip = (page - 1) * limit;
    const eventType = req.query.eventType as string;
    const status = req.query.status as string;

    const filter: any = {};
    if (eventType) filter.eventType = eventType;
    if (status) filter.status = status;
    else filter.status = { $in: ['upcoming', 'ongoing'] }; // Default to active events

    const events = await Event.find(filter)
      .populate('organizerId', 'name profilePhoto')
      .sort({ startDate: 1 })
      .skip(skip)
      .limit(limit);

    const totalEvents = await Event.countDocuments(filter);

    res.json({
      success: true,
      events,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalEvents / limit),
        totalEvents,
        hasNext: page < Math.ceil(totalEvents / limit),
        hasPrev: page > 1
      }
    });
  } catch (error: any) {
    logger.error('Error fetching events', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

/**
 * GET /api/events/:eventId
 * Get a specific event
 */
router.get('/:eventId', async (req: Request, res: Response) => {
  try {
    const event = await Event.findById(req.params.eventId)
      .populate('organizerId', 'name profilePhoto organizerProfile')
      .populate('attendees', 'name profilePhoto location');

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json({ success: true, event });
  } catch (error: any) {
    logger.error('Error fetching event', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch event' });
  }
});

/**
 * POST /api/events/:eventId/rsvp
 * RSVP to an event
 */
router.post('/:eventId/rsvp', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).auth.userId;
    const { eventId } = req.params;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (event.attendees.includes(userId)) {
      return res.status(400).json({ error: 'Already RSVPed to this event' });
    }

    // Check capacity
    if (event.capacity && event.attendeeCount >= event.capacity) {
      return res.status(400).json({ error: 'Event is at full capacity' });
    }

    event.attendees.push(userId);
    event.attendeeCount = event.attendees.length;
    await event.save();

    // Award reputation points for attending an event
    await User.findByIdAndUpdate(userId, {
      $inc: { 'reputation.points': 10 }
    });

    logger.info('User RSVPed to event', { eventId, userId });

    res.json({
      success: true,
      message: 'RSVP successful',
      attendeeCount: event.attendeeCount
    });
  } catch (error: any) {
    logger.error('Error RSVPing to event', { error: error.message });
    res.status(500).json({ error: 'Failed to RSVP to event' });
  }
});

/**
 * POST /api/events/:eventId/cancel-rsvp
 * Cancel RSVP to an event
 */
router.post('/:eventId/cancel-rsvp', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).auth.userId;
    const { eventId } = req.params;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (!event.attendees.includes(userId)) {
      return res.status(400).json({ error: 'Not RSVPed to this event' });
    }

    if (event.organizerId.toString() === userId) {
      return res.status(400).json({ error: 'Event organizer cannot cancel RSVP' });
    }

    event.attendees = event.attendees.filter(id => id.toString() !== userId);
    event.attendeeCount = event.attendees.length;
    await event.save();

    logger.info('User canceled RSVP to event', { eventId, userId });

    res.json({
      success: true,
      message: 'RSVP canceled successfully',
      attendeeCount: event.attendeeCount
    });
  } catch (error: any) {
    logger.error('Error canceling RSVP', { error: error.message });
    res.status(500).json({ error: 'Failed to cancel RSVP' });
  }
});

/**
 * DELETE /api/events/:eventId
 * Delete an event (organizer only)
 */
router.delete('/:eventId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).auth.userId;
    const { eventId } = req.params;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (event.organizerId.toString() !== userId) {
      return res.status(403).json({ error: 'Only the event organizer can delete this event' });
    }

    await Event.findByIdAndDelete(eventId);

    logger.info('Event deleted', { eventId, userId });

    res.json({
      success: true,
      message: 'Event deleted successfully'
    });
  } catch (error: any) {
    logger.error('Error deleting event', { error: error.message });
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

export default router;
