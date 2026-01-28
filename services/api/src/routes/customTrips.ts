import express from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { authenticateJwt } from '../middleware/auth';
import { CustomTripRequest, Proposal } from '../models/CustomTripRequest';
import { Trip } from '../models/Trip';
import { User } from '../models/User';
import { logger } from '../utils/logger';

const router = express.Router();

// -------------------------------------------------------------------------
// 1. Submit Custom Trip Request (Traveler)
// -------------------------------------------------------------------------
const createRequestSchema = z.object({
    destination: z.string().min(3),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    flexibleDates: z.boolean().default(false),
    budget: z.number().optional(),
    numberOfTravelers: z.number().min(1).default(1),
    preferences: z.string().optional()
});

router.post('/', authenticateJwt, async (req, res) => {
    try {
        const userId = (req as any).auth.userId;
        const body = createRequestSchema.parse(req.body);

        const request = await CustomTripRequest.create({
            travelerId: userId,
            ...body,
            startDate: body.startDate ? new Date(body.startDate) : undefined,
            endDate: body.endDate ? new Date(body.endDate) : undefined,
            status: 'open'
        });

        res.status(201).json(request);
    } catch (error: any) {
        logger.error('Failed to create custom trip request', { error: error.message });
        res.status(400).json({ error: error.message });
    }
});

// -------------------------------------------------------------------------
// 2. List Requests
// -------------------------------------------------------------------------
router.get('/', authenticateJwt, async (req, res) => {
    try {
        const userId = (req as any).auth.userId;
        const user = await User.findById(userId);
        const role = user?.role;

        let query: any = {};

        if (role === 'traveler') {
            query.travelerId = userId;
        } else if (role === 'organizer') {
            // Organizer sees requests assigned to them OR open requests (if we allow open marketplace later)
            // For now, only assigned
            query.assignedOrganizers = userId;
        } else if (role === 'admin' || role === 'agent') {
            // Admin sees all
        }

        const requests = await CustomTripRequest.find(query)
            .populate('travelerId', 'name email phone')
            .populate('assignedOrganizers', 'name businessInfo')
            .populate('proposals.organizerId', 'name businessInfo')
            .sort({ createdAt: -1 });

        res.json(requests);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// -------------------------------------------------------------------------
// 3. Assign Organizers (Admin Only)
// -------------------------------------------------------------------------
router.post('/:id/assign', authenticateJwt, async (req, res) => {
    try {
        const { organizerIds } = z.object({ organizerIds: z.array(z.string()) }).parse(req.body);
        const requestId = req.params.id;

        // Verify Admin
        const user = await User.findById((req as any).auth.userId);
        if (user?.role !== 'admin' && user?.role !== 'agent') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const request = await CustomTripRequest.findById(requestId);
        if (!request) return res.status(404).json({ error: 'Request not found' });

        request.assignedOrganizers = organizerIds.map(id => new mongoose.Types.ObjectId(id));
        request.status = 'assigned_to_organizers';
        await request.save();

        res.json(request);
        // TODO: Notify organizers
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// -------------------------------------------------------------------------
// 4. Submit Proposal (Organizer)
// -------------------------------------------------------------------------
const proposalSchema = z.object({
    price: z.number(),
    currency: z.string().default('INR'),
    itinerarySummary: z.string(),
    inclusions: z.array(z.string()),
    exclusions: z.array(z.string()),
    validUntil: z.string().optional()
});

router.post('/:id/proposal', authenticateJwt, async (req, res) => {
    try {
        const userId = (req as any).auth.userId;
        const requestId = req.params.id;
        const body = proposalSchema.parse(req.body);

        const request = await CustomTripRequest.findOne({
            _id: requestId,
            assignedOrganizers: userId
        });

        if (!request) return res.status(404).json({ error: 'Request not found or access denied' });

        const proposal: Proposal = {
            organizerId: new mongoose.Types.ObjectId(userId),
            price: body.price,
            currency: body.currency,
            itinerarySummary: body.itinerarySummary,
            inclusions: body.inclusions,
            exclusions: body.exclusions,
            validUntil: body.validUntil ? new Date(body.validUntil) : undefined,
            status: 'pending',
            createdAt: new Date()
        };

        request.proposals.push(proposal);
        await request.save();

        res.status(201).json(request);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

// -------------------------------------------------------------------------
// 5. Accept Proposal & Convert to Private Trip (Admin Only)
// -------------------------------------------------------------------------
router.post('/:id/proposals/:proposalId/accept', authenticateJwt, async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // Verify Admin
        const user = await User.findById((req as any).auth.userId);
        if (user?.role !== 'admin' && user?.role !== 'agent') {
            await session.abortTransaction();
            return res.status(403).json({ error: 'Admin access required' });
        }

        const { id, proposalId } = req.params;
        const request = await CustomTripRequest.findById(id).session(session);
        if (!request) {
            await session.abortTransaction();
            return res.status(404).json({ error: 'Request not found' });
        }

        const proposal = request.proposals.find(p => (p as any)._id.toString() === proposalId);
        if (!proposal) {
            await session.abortTransaction();
            return res.status(404).json({ error: 'Proposal not found' });
        }

        // 1. Create Private Trip
        const newTrip = new Trip({
            organizerId: proposal.organizerId,
            title: `Private Trip to ${request.destination} for ${(request as any).travelerId.name || 'Traveler'}`, // Ideally fetch traveler name
            description: proposal.itinerarySummary,
            destination: request.destination,
            startDate: request.startDate || new Date(), // Fallback if flexible
            endDate: request.endDate || new Date(),
            price: proposal.price,
            capacity: request.numberOfTravelers,
            status: 'active', // ready to book
            isPrivate: true,
            allowedUserIds: [request.travelerId],
            paymentConfig: {
                paymentType: 'full',
                paymentMethods: ['upi', 'card'],
                collectionMode: 'razorpay'
            },
            schedule: [], // Populate properly if itinerary available
            livePhotos: [], // Initially empty
            safetyDisclaimer: 'Standard safety disclaimer',
            images: [] // Placeholder
        });

        // Quick validation fix: Trip requires some fields like schedule/images. 
        // We might need to make them optional or fill dummy data.
        newTrip.schedule = [{ day: 1, title: 'Arrival', activities: ['Arrival'] }];

        await newTrip.save({ session });

        // 2. Update Request Status
        request.status = 'converted';
        request.convertedTripId = newTrip._id as any;
        proposal.status = 'accepted';

        // Reject others
        request.proposals.forEach(p => {
            if ((p as any)._id.toString() !== proposalId) {
                p.status = 'rejected';
            }
        });

        await request.save({ session });
        await session.commitTransaction();

        res.json({
            message: 'Proposal accepted and private trip created',
            tripId: newTrip._id
        });

    } catch (error: any) {
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        logger.error('Failed to convert trip', { error: error.message });
        res.status(500).json({ error: error.message });
    } finally {
        session.endSession();
    }
});

export default router;
