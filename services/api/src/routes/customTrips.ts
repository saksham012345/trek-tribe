import express from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { authenticateJwt } from '../middleware/auth';
import { CustomTripRequest, Proposal, CustomTripRequestDocument } from '../models/CustomTripRequest';
import { Trip } from '../models/Trip';
import { User } from '../models/User';
import { RoutingService } from '../services/routingService';
import { AIQualityService } from '../services/aiQualityService';
import { logger } from '../utils/logger';

const router = express.Router();

// Helper: Regex to detect contact info (Phone, Email, URLs)
const CONTACT_INFO_REGEX = /((?:\+|00)[1-9]\d{0,3}[\s-.]?)?\d{3}[\s-.]?\d{3}[\s-.]?\d{4}|[\w.-]+@[\w.-]+\.[a-zA-Z]{2,}|(?:https?:\/\/)?(?:www\.)?[\w-]+\.[a-z]{2,}/gi;

function hasContactInfo(text: string): boolean {
    return CONTACT_INFO_REGEX.test(text);
}

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
    tripType: z.enum(['relaxed', 'adventure', 'cultural', 'religious', 'wildlife', 'mixed']).default('mixed'),
    experienceLevel: z.enum(['beginner', 'intermediate', 'advanced']).default('beginner'),
    ageGroup: z.enum(['18-25', '25-40', '40-60', 'family', 'seniors', 'mixed']).default('mixed'),
    specialNeeds: z.string().optional(),
    privacyLevel: z.enum(['private', 'invite-only']).default('private'),
    preferences: z.string().optional()
});

router.post('/', authenticateJwt, async (req, res) => {
    try {
        const userId = (req as any).auth.userId;
        const body = createRequestSchema.parse(req.body);

        // 1. Create Request
        const request = await CustomTripRequest.create({
            travelerId: userId,
            ...body,
            startDate: body.startDate ? new Date(body.startDate) : undefined,
            endDate: body.endDate ? new Date(body.endDate) : undefined,
            status: 'open',
            assignedOrganizers: [] // Populated by matching logic
        }) as CustomTripRequestDocument;

        // 2. Trigger Routing Logic
        const matchedOrganizers = await RoutingService.findMatchingOrganizers(request);

        request.assignedOrganizers = matchedOrganizers;
        if (matchedOrganizers.length > 0) {
            request.status = 'assigned_to_organizers';
        }
        await request.save();

        // TODO: Notification Service -> Notify matched organizers

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
            // Organizer sees requests assigned to them
            query.assignedOrganizers = userId;
        } else if (role === 'admin' || role === 'agent') {
            // Admin sees all
        }

        const requests = await CustomTripRequest.find(query)
            .populate('travelerId', 'name email phone')
            .populate('assignedOrganizers', 'name businessInfo')
            // Don't leak other proposals info generally, but for traveler own requests, they need them
            // We'll handle "sealed" logic in the response mapping if strictly needed
            .sort({ createdAt: -1 });

        res.json(requests);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// -------------------------------------------------------------------------
// 3. Submit Proposal (Organizer)
// -------------------------------------------------------------------------
const proposalSchema = z.object({
    price: z.number(),
    currency: z.string().default('INR'),
    itinerarySummary: z.string(),
    inclusions: z.array(z.string()),
    exclusions: z.array(z.string()),
    qualitySnapshot: z.object({
        stayType: z.string(),
        comfortLevel: z.string(),
        transportType: z.string(),
        maxGroupSize: z.string(),
        safetyPlanPresent: z.boolean()
    }),
    valueStatement: z.string().max(500),
    priceBreakdown: z.string().optional(),
    cancellationPolicy: z.string(),
    validUntil: z.string().optional()
});

router.post('/:id/proposal', authenticateJwt, async (req, res) => {
    try {
        const userId = (req as any).auth.userId;
        const requestId = req.params.id;
        const body = proposalSchema.parse(req.body);

        // 1. Validation: Contact Info Blocking
        if (hasContactInfo(body.valueStatement) || hasContactInfo(body.itinerarySummary)) {
            return res.status(400).json({
                error: 'Off-platform contact information is not allowed. Please keep all communication within the platform.'
            });
        }

        const request = await CustomTripRequest.findOne({
            _id: requestId,
            assignedOrganizers: userId
        });

        if (!request) return res.status(404).json({ error: 'Request not found or access denied' });

        if (request.status !== 'open' && request.status !== 'assigned_to_organizers') {
            return res.status(400).json({ error: 'This request is no longer accepting proposals' });
        }

        // 2. Create Proposal
        const proposal: Proposal = {
            organizerId: new mongoose.Types.ObjectId(userId),
            price: body.price,
            currency: body.currency,
            itinerarySummary: body.itinerarySummary,
            inclusions: body.inclusions,
            exclusions: body.exclusions,
            qualitySnapshot: body.qualitySnapshot,
            valueStatement: body.valueStatement,
            priceBreakdown: body.priceBreakdown,
            cancellationPolicy: body.cancellationPolicy,
            validUntil: body.validUntil ? new Date(body.validUntil) : new Date(Date.now() + 48 * 60 * 60 * 1000), // Default 48h
            status: 'pending',
            sealed: true,
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
// 4. Select Proposal & Convert (Traveler)
// -------------------------------------------------------------------------
router.post('/:id/select-proposal', authenticateJwt, async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const userId = (req as any).auth.userId;
        const { proposalId } = req.body;
        const requestId = req.params.id;

        const request = await CustomTripRequest.findOne({
            _id: requestId,
            travelerId: userId // Ensure owner
        }).session(session);

        if (!request) {
            await session.abortTransaction();
            return res.status(404).json({ error: 'Request not found' });
        }

        const proposal = request.proposals.find(p => (p as any)._id.toString() === proposalId);
        if (!proposal) {
            await session.abortTransaction();
            return res.status(404).json({ error: 'Proposal not found' });
        }

        // 1. AI Quality Analysis
        const aiResult = await AIQualityService.analyzeTripProposal(proposal, request);

        // 2. Check Auto-Conversion Eligibility
        const isTrustEligible = await RoutingService.isEligibleForAutoConversion(proposal.organizerId);

        // Conditions for Auto-Convert:
        // - Organizer Trust Score >= 80
        // - AI Analysis Approved (Risk != High, Score >= 70)
        const canAutoConvert = isTrustEligible && aiResult.isApproved;

        // Update Proposal Status
        proposal.status = 'accepted';
        proposal.sealed = false; // Reveal details if hidden

        // Expire others
        request.proposals.forEach(p => {
            if ((p as any)._id.toString() !== proposalId) {
                p.status = 'rejected';
            }
        });

        if (canAutoConvert) {
            // --- Auto Conversion Path ---

            // Create Trip Entity
            const newTrip = new Trip({
                organizerId: proposal.organizerId,
                title: `Private: ${request.destination} - ${request.tripType}`,
                description: proposal.itinerarySummary,
                destination: request.destination,
                startDate: request.startDate || new Date(),
                endDate: request.endDate || new Date(),
                price: proposal.price,
                capacity: request.numberOfTravelers,
                status: 'active', // Ready
                isPrivate: true,
                allowedUserIds: [request.travelerId],
                paymentConfig: {
                    paymentType: 'full',
                    paymentMethods: ['upi', 'card'], // Default
                    collectionMode: 'razorpay'
                },
                schedule: [{ day: 1, title: 'Day 1', activities: ['Details in Itinerary'] }], // Placeholder
                images: [],
                safetyDisclaimer: 'Standard safety disclaimer applies.',
                // Link back
                customRequestId: request._id
            });

            await newTrip.save({ session });

            request.status = 'converted';
            request.convertedTripId = newTrip._id as any;
            request.adminNotes = `Auto-converted based on TrustScore & AI. AI Score: ${aiResult.score}`;

            await request.save({ session });
            await session.commitTransaction();

            res.json({
                message: 'Proposal accepted and trip created successfully.',
                tripId: newTrip._id,
                conversionStatus: 'auto'
            });

        } else {
            // --- Manual Review Path ---
            request.status = 'needs_review';
            request.adminNotes = `Flagged for review. TrustEligible: ${isTrustEligible}, AI Score: ${aiResult.score}, Risks: ${aiResult.reasons.join(', ')}`;

            await request.save({ session });
            await session.commitTransaction();

            res.json({
                message: 'Proposal selected. Waiting for Admin verification before trip creation.',
                conversionStatus: 'manual_review',
                reasons: aiResult.reasons
            });
        }

    } catch (error: any) {
        if (session.inTransaction()) await session.abortTransaction();
        logger.error('Failed to select proposal', { error: error.message });
        res.status(500).json({ error: error.message });
    } finally {
        session.endSession();
    }
});

export default router;
