import express, { Request, Response } from 'express';
import { z } from 'zod';
import { authenticateToken } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { upsertRacingSafely } from '../lib/upsert';
import { withMongoId, asPopulated } from '../lib/apiShape';
import { User } from '../models/User';
import { logger } from '../utils/logger';

/** Load the Mongo users behind a set of ids. populate() cannot cross databases. */
async function loadUsers(ids: string[]) {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return new Map<string, any>();
  const users = await User.find({ _id: { $in: unique } })
    .select('name profilePhoto location organizerProfile')
    .lean();
  return new Map(users.map((u: any) => [u._id.toString(), u]));
}

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

    // The organizer's attendance is created with the event, so an event never
    // exists for a moment with nobody attending. attendees[] and invitees[] were
    // two arrays; they are rows with a kind now, and one row per person.
    const event = await prisma.event.create({
      data: {
        title: parsed.data.title,
        description: parsed.data.description,
        eventType: parsed.data.eventType,
        startDate: new Date(parsed.data.startDate),
        endDate: new Date(parsed.data.endDate),
        location: parsed.data.location,
        isVirtual: parsed.data.isVirtual ?? false,
        virtualLink: parsed.data.virtualLink,
        groupId: parsed.data.groupId,
        coverImage: parsed.data.coverImage,
        capacity: parsed.data.capacity,
        tags: parsed.data.tags ?? [],
        price: parsed.data.price,
        isPaid: parsed.data.isPaid ?? false,
        organizerId: userId,
        status: 'upcoming',
        participants: { create: [{ userId, kind: 'attendee' }] }
      }
    });

    // Award reputation points for creating an event
    await User.findByIdAndUpdate(userId, {
      $inc: { 'reputation.points': 30 }
    });

    logger.info('Event created', { eventId: event.id, userId });

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
    else filter.status = { in: ['upcoming', 'ongoing'] }; // Default to active events

    const [events, totalEvents] = await Promise.all([
      prisma.event.findMany({
        where: filter,
        orderBy: { startDate: 'asc' },
        skip,
        take: limit,
        include: { _count: { select: { participants: true } } }
      }),
      prisma.event.count({ where: filter })
    ]);

    const organizers = await loadUsers(events.map(e => e.organizerId));

    res.json({
      success: true,
      events: events.map(e => ({
        ...withMongoId(e),
        organizerId: asPopulated(organizers.get(e.organizerId)),
        attendeeCount: e._count.participants
      })),
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
    const event = await prisma.event.findUnique({
      where: { id: req.params.eventId },
      include: { participants: true }
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const users = await loadUsers([event.organizerId, ...event.participants.map(p => p.userId)]);
    const asUser = (id: string) => asPopulated(users.get(id));
    const attendees = event.participants.filter(p => p.kind === 'attendee');

    res.json({
      success: true,
      event: {
        ...withMongoId(event),
        organizerId: asUser(event.organizerId),
        attendees: attendees.map(p => asUser(p.userId)),
        invitees: event.participants.filter(p => p.kind === 'invitee').map(p => asUser(p.userId)),
        attendeeCount: attendees.length
      }
    });
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

    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const attendeeCountBefore = await prisma.eventParticipant.count({
      where: { eventId, kind: 'attendee' }
    });

    const already = await prisma.eventParticipant.findUnique({
      where: { eventId_userId: { eventId, userId } }
    });
    if (already && already.kind === 'attendee') {
      return res.status(400).json({ error: 'Already RSVPed to this event' });
    }

    // Check capacity
    if (event.capacity && attendeeCountBefore >= event.capacity) {
      return res.status(400).json({ error: 'Event is at full capacity' });
    }

    // An invitee who joins becomes an attendee rather than getting a second row -
    // the unique constraint on (eventId, userId) is what makes that the only
    // possible outcome.
    await upsertRacingSafely(() => prisma.eventParticipant.upsert({
      where: { eventId_userId: { eventId, userId } },
      create: { eventId, userId, kind: 'attendee' },
      update: { kind: 'attendee' }
    }));

    const attendeeCount = await prisma.eventParticipant.count({
      where: { eventId, kind: 'attendee' }
    });

    // Award reputation points for attending an event
    await User.findByIdAndUpdate(userId, {
      $inc: { 'reputation.points': 10 }
    });

    logger.info('User RSVPed to event', { eventId, userId });

    res.json({
      success: true,
      message: 'RSVP successful',
      attendeeCount
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

    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const membership = await prisma.eventParticipant.findUnique({
      where: { eventId_userId: { eventId, userId } }
    });
    if (!membership || membership.kind !== 'attendee') {
      return res.status(400).json({ error: 'Not RSVPed to this event' });
    }

    if (event.organizerId.toString() === userId) {
      return res.status(400).json({ error: 'Event organizer cannot cancel RSVP' });
    }

    await prisma.eventParticipant.delete({
      where: { eventId_userId: { eventId, userId } }
    });

    const attendeeCount = await prisma.eventParticipant.count({
      where: { eventId, kind: 'attendee' }
    });

    logger.info('User canceled RSVP to event', { eventId, userId });

    res.json({
      success: true,
      message: 'RSVP canceled successfully',
      attendeeCount
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

    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (event.organizerId.toString() !== userId) {
      return res.status(403).json({ error: 'Only the event organizer can delete this event' });
    }

    // Participants go with it by cascade.
    await prisma.event.delete({ where: { id: eventId } });

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
