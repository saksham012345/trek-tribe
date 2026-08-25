import express from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { authenticateJwt } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { User } from '../models/User';
import { RoutingService } from '../services/routingService';
import { AIQualityService } from '../services/aiQualityService';
import { logger } from '../utils/logger';

const router = express.Router();

/**
 * The stored ageGroup values contain hyphens and start with a digit ('25-40'),
 * neither of which a Prisma enum member can do, so the members are age_25_40
 * and the mapping happens at the edges. The column still holds '25-40', which
 * means a backfill needs no translation.
 */
const AGE_GROUP_TO_MEMBER: Record<string, string> = {
    '18-25': 'age_18_25',
    '25-40': 'age_25_40',
    '40-60': 'age_40_60',
    family: 'family',
    seniors: 'seniors',
    mixed: 'mixed'
};
const MEMBER_TO_AGE_GROUP: Record<string, string> = Object.fromEntries(
    Object.entries(AGE_GROUP_TO_MEMBER).map(([value, member]) => [member, value])
);

const ageGroupToMember = (value?: string) =>
    (AGE_GROUP_TO_MEMBER[value ?? 'mixed'] ?? 'mixed') as any;

/** Put the request back into the shape callers read. */
function shapeRequest(request: any) {
    return {
        ...request,
        _id: request.id,
        ageGroup: MEMBER_TO_AGE_GROUP[request.ageGroup] ?? request.ageGroup,
        privacyLevel: request.privacyLevel === 'invite_only' ? 'invite-only' : request.privacyLevel,
        proposals: (request.proposals ?? []).map((proposal: any) => ({
            ...proposal,
            _id: proposal.id,
            // qualitySnapshot was a nested object and callers still read it.
            qualitySnapshot: {
                stayType: proposal.stayType,
                comfortLevel: proposal.comfortLevel,
                transportType: proposal.transportType,
                maxGroupSize: proposal.maxGroupSize,
                safetyPlanPresent: proposal.safetyPlanPresent
            }
        }))
    };
}

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
        // The ageGroup and privacyLevel values keep the hyphens Mongo stored
        // ('25-40', 'invite-only'); Prisma enum members cannot contain one, so
        // the request values are translated on the way in and back on the way
        // out. See ageGroupToMember / memberToAgeGroup below.
        const created = await prisma.customTripRequest.create({
            data: {
                travelerId: userId,
                destination: body.destination,
                startDate: body.startDate ? new Date(body.startDate) : undefined,
                endDate: body.endDate ? new Date(body.endDate) : undefined,
                flexibleDates: body.flexibleDates,
                budget: body.budget,
                numberOfTravelers: body.numberOfTravelers,
                tripType: body.tripType,
                experienceLevel: body.experienceLevel,
                ageGroup: ageGroupToMember(body.ageGroup),
                specialNeeds: body.specialNeeds,
                privacyLevel: body.privacyLevel === 'invite-only' ? 'invite_only' : 'private',
                preferences: body.preferences,
                status: 'open',
                assignedOrganizers: []
            }
        });

        // 2. Trigger Routing Logic
        const matchedOrganizers = await RoutingService.findMatchingOrganizers(created as any);

        const request = await prisma.customTripRequest.update({
            where: { id: created.id },
            data: {
                assignedOrganizers: matchedOrganizers.map(String),
                ...(matchedOrganizers.length > 0 ? { status: 'assigned_to_organizers' as const } : {})
            }
        });

        // TODO: Notification Service -> Notify matched organizers

        res.status(201).json(shapeRequest(request));
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
            // assignedOrganizers is a text array; `has` is Mongo's implicit
            // "array contains" spelled out.
            query.assignedOrganizers = { has: userId };
        } else if (role === 'admin' || role === 'agent') {
            // Admin sees all
        }

        // The two populate() calls are gone - users are still Mongo documents -
        // and nothing in the response read either of them.
        const requests = await prisma.customTripRequest.findMany({
            where: query,
            include: { proposals: true },
            orderBy: { createdAt: 'desc' }
        });

        res.json(requests.map(shapeRequest));
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
        stayType: z.string().optional(), // Updated to optional to match loose input, or fix interface
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

        const request = await prisma.customTripRequest.findFirst({
            where: { id: requestId, assignedOrganizers: { has: userId } }
        });

        if (!request) return res.status(404).json({ error: 'Request not found or access denied' });

        if (request.status !== 'open' && request.status !== 'assigned_to_organizers') {
            return res.status(400).json({ error: 'This request is no longer accepting proposals' });
        }

        // 2. Create Proposal.
        //
        // One proposal per organizer per request, which the array this replaces
        // could not enforce - an organizer who submitted twice appeared twice
        // in what is meant to be a sealed-bid list.
        //
        // qualitySnapshot was a nested object whose first four fields were
        // marked required while the object itself was optional, so the
        // requirement only applied when a snapshot was sent at all. They are
        // nullable columns, which is what that actually meant.
        try {
            await prisma.customTripProposal.create({
                data: {
                    requestId,
                    organizerId: userId,
                    price: body.price,
                    currency: body.currency,
                    itinerarySummary: body.itinerarySummary,
                    inclusions: body.inclusions,
                    exclusions: body.exclusions,
                    stayType: body.qualitySnapshot?.stayType,
                    comfortLevel: body.qualitySnapshot?.comfortLevel,
                    transportType: body.qualitySnapshot?.transportType,
                    maxGroupSize: body.qualitySnapshot?.maxGroupSize,
                    safetyPlanPresent: body.qualitySnapshot?.safetyPlanPresent ?? false,
                    valueStatement: body.valueStatement,
                    priceBreakdown: body.priceBreakdown,
                    cancellationPolicy: body.cancellationPolicy,
                    validUntil: body.validUntil
                        ? new Date(body.validUntil)
                        : new Date(Date.now() + 48 * 60 * 60 * 1000), // Default 48h
                    status: 'pending',
                    sealed: true
                }
            });
        } catch (error: any) {
            if (error?.code === 'P2002') {
                return res.status(409).json({ error: 'You have already submitted a proposal for this request' });
            }
            throw error;
        }

        const withProposal = await prisma.customTripRequest.findUnique({
            where: { id: requestId },
            include: { proposals: true }
        });

        res.status(201).json(shapeRequest(withProposal!));
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

// -------------------------------------------------------------------------
// 4. Select Proposal & Convert (Traveler)
// -------------------------------------------------------------------------
router.post('/:id/select-proposal', authenticateJwt, async (req, res) => {
    // mongoose.startSession() is gone. The request, its proposals and the trip
    // that may be created from them are all Postgres rows now, so the
    // transaction is a Postgres one - and unlike the Mongo session, it actually
    // covered the trip: newTrip.save({ session }) was on a different database
    // from the session, so the trip was never part of the transaction it looked
    // like it was in.
    try {
        const userId = (req as any).auth.userId;
        const { proposalId } = req.body;
        const requestId = req.params.id;

        const request = await prisma.customTripRequest.findFirst({
            where: { id: requestId, travelerId: userId }, // Ensure owner
            include: { proposals: true }
        });

        if (!request) {
            return res.status(404).json({ error: 'Request not found' });
        }

        const proposal = request.proposals.find(pr => pr.id === proposalId);
        if (!proposal) {
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

        // Accept this one and reject the rest. A partial unique index allows at
        // most one accepted proposal per request, so the rejections go first -
        // and both happen in one transaction, because a half-applied selection
        // would leave a request with two live proposals.
        await prisma.$transaction([
            prisma.customTripProposal.updateMany({
                where: { requestId, id: { not: proposalId } },
                data: { status: 'rejected' }
            }),
            prisma.customTripProposal.update({
                where: { id: proposalId },
                data: { status: 'accepted', sealed: false } // Reveal details if hidden
            })
        ]);

        if (canAutoConvert) {
            // --- Auto Conversion Path ---

            // Create Trip Entity.
            //
            // customRequestId is stored now. It was set here and dropped
            // silently: the field is not in the Mongoose schema, and Mongoose
            // in strict mode discards unknown paths - so the link from a
            // converted trip back to the request that produced it has never
            // existed.
            //
            // collectionMode is not passed: it could only ever be 'razorpay',
            // which is why it is no longer a column.
            const newTrip = await prisma.$transaction(async (tx) => {
                const trip = await tx.trip.create({
                    data: {
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
                        paymentType: 'full',
                        paymentMethods: ['upi', 'card'], // Default
                        images: [],
                        safetyDisclaimer: 'Standard safety disclaimer applies.',
                        customRequestId: request.id,
                        schedule: {
                            create: [
                                { day: 1, title: 'Day 1', activities: ['Details in Itinerary'] } // Placeholder
                            ]
                        }
                    }
                });

                await tx.customTripRequest.update({
                    where: { id: request.id },
                    data: {
                        status: 'converted',
                        convertedTripId: trip.id,
                        adminNotes: `Auto-converted based on TrustScore & AI. AI Score: ${aiResult.score}`
                    }
                });

                return trip;
            });

            res.json({
                message: 'Proposal accepted and trip created successfully.',
                tripId: newTrip.id,
                conversionStatus: 'auto'
            });

        } else {
            // --- Manual Review Path ---
            await prisma.customTripRequest.update({
                where: { id: request.id },
                data: {
                    status: 'needs_review',
                    adminNotes: `Flagged for review. TrustEligible: ${isTrustEligible}, AI Score: ${aiResult.score}, Risks: ${aiResult.reasons.join(', ')}`
                }
            });

            res.json({
                message: 'Proposal selected. Waiting for Admin verification before trip creation.',
                conversionStatus: 'manual_review',
                reasons: aiResult.reasons
            });
        }

    } catch (error: any) {
        logger.error('Failed to select proposal', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

export default router;
