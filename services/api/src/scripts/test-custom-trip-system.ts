
process.env.NODE_ENV = 'test';
process.env.DISABLE_AUTO_START = 'true';

import mongoose from 'mongoose';
import request from 'supertest';
// REMOVED static import
import { User } from '../models/User';
import { CustomTripRequest } from '../models/CustomTripRequest';
import { Trip } from '../models/Trip';
import jwt from 'jsonwebtoken';
import { MongoMemoryServer } from 'mongodb-memory-server';

// Helper to create token
const createToken = (userId: string, role: string) => {
    return jwt.sign({ userId, role }, process.env.JWT_SECRET || 'test-secret-key-12345', { expiresIn: '1h' });
};

async function runTest() {
    let mongoServer: MongoMemoryServer;
    let app: any;

    try {
        console.log('🚀 Starting Custom Trip System Integration Test...');

        // 1. Setup InMemory DB
        mongoServer = await MongoMemoryServer.create();
        const mongoUri = mongoServer.getUri();
        console.log(`✅ In-Memory MongoDB started at ${mongoUri}`);

        // Set fallback for app if it connects late
        process.env.MONGODB_URI = mongoUri;

        // Dynamic Import to prevent auto-start and ensure env vars are set
        const module = await import('../index');
        app = module.default;

        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(mongoUri);
        }

        // Cleanup
        await User.deleteMany({});
        await CustomTripRequest.deleteMany({});
        await Trip.deleteMany({});

        console.log('✅ Cleaned up old test data.');

        // 2. Create Users
        const traveler = await User.create({
            name: 'Test Traveler',
            email: 'test-traveler@example.com',
            passwordHash: 'hashed',
            role: 'traveler'
        });

        const highTrustOrg = await User.create({
            name: 'High Trust Org',
            email: 'test-org-high@example.com',
            passwordHash: 'hashed',
            role: 'organizer',
            organizerVerificationStatus: 'approved',
            organizerProfile: {
                businessInfo: { companyName: 'High Trust Co' },
                trustScore: { overall: 90 } // Eligible for Auto-Convert
            }
        });

        const midTrustOrg = await User.create({
            name: 'Mid Trust Org',
            email: 'test-org-mid@example.com',
            passwordHash: 'hashed',
            role: 'organizer',
            organizerVerificationStatus: 'approved',
            organizerProfile: {
                businessInfo: { companyName: 'Mid Trust Co' },
                trustScore: { overall: 70 } // Eligible for Routing, Manual Review
            }
        });

        const lowTrustOrg = await User.create({
            name: 'Low Trust Org',
            email: 'test-org-low@example.com',
            passwordHash: 'hashed',
            role: 'organizer',
            organizerVerificationStatus: 'approved',
            organizerProfile: {
                businessInfo: { companyName: 'Low Trust Co' },
                trustScore: { overall: 40 } // Not Eligible
            }
        });

        const travelerToken = createToken(traveler._id.toString(), 'traveler');
        const highKeepToken = createToken(highTrustOrg._id.toString(), 'organizer');
        const midToken = createToken(midTrustOrg._id.toString(), 'organizer');
        const lowToken = createToken(lowTrustOrg._id.toString(), 'organizer');

        console.log('✅ Users created.');

        // 3. Submit Request
        const tripRes = await request(app)
            .post('/api/custom-trips')
            .set('Authorization', `Bearer ${travelerToken}`)
            .send({
                destination: 'Manali',
                tripType: 'adventure',
                budget: 50000,
                numberOfTravelers: 4,
                privacyLevel: 'private'
            });

        if (tripRes.status !== 201) throw new Error(`Create Request Failed: ${JSON.stringify(tripRes.body)}`);
        const requestId = tripRes.body._id;
        console.log('✅ Custom Trip Request submitted.');

        // 4. Verify Routing
        const createdReq = await CustomTripRequest.findById(requestId);
        const assignedIds = createdReq?.assignedOrganizers.map(id => id.toString());

        if (assignedIds?.includes(highTrustOrg._id.toString()) &&
            assignedIds?.includes(midTrustOrg._id.toString()) &&
            !assignedIds?.includes(lowTrustOrg._id.toString())) {
            console.log('✅ Routing Verified: High & Mid trust organizers assigned. Low trust excluded.');
        } else {
            throw new Error(`Routing Failed. Assigned: ${assignedIds}`);
        }

        // 5. Submit Proposals
        // 5a. Invalid Proposal (Contact Info)
        const invalidPropRes = await request(app)
            .post(`/api/custom-trips/${requestId}/proposal`)
            .set('Authorization', `Bearer ${midToken}`)
            .send({
                price: 45000,
                itinerarySummary: 'Great trip.',
                inclusions: ['Food'],
                exclusions: [],
                qualitySnapshot: {
                    stayType: 'Hotel', comfortLevel: 'High', transportType: 'Bus', maxGroupSize: '10', safetyPlanPresent: true
                },
                valueStatement: 'Call me at 9999999999 for details', // Invalid
                cancellationPolicy: 'Strict'
            });

        if (invalidPropRes.status === 400 && invalidPropRes.body.error.includes('contact information')) {
            console.log('✅ Contact Info Blocking Verified.');
        } else {
            throw new Error(`Contact Info Blocking Failed. Status: ${invalidPropRes.status}, Body: ${JSON.stringify(invalidPropRes.body)}`);
        }

        // 5b. Valid Proposal (High Trust)
        const highPropRes = await request(app)
            .post(`/api/custom-trips/${requestId}/proposal`)
            .set('Authorization', `Bearer ${highKeepToken}`)
            .send({
                price: 55000,
                itinerarySummary: 'Luxury Manali Experience',
                inclusions: ['5 Star Stay', 'Private Cab'],
                exclusions: ['Flights'],
                qualitySnapshot: {
                    stayType: 'Luxury Resort', comfortLevel: 'Premium', transportType: 'Private SUV', maxGroupSize: '4', safetyPlanPresent: true
                },
                valueStatement: 'We provide the best curated experience with comprehensive safety.',
                cancellationPolicy: 'Flexible'
            });

        if (highPropRes.status !== 201) throw new Error(`High Trust Proposal Failed: ${JSON.stringify(highPropRes.body)}`);
        console.log('✅ High Trust Proposal Submitted.');

        // 6. Select Proposal & Auto-Convert
        // Fetch request again to get proposal ID
        const reqWithProposals = await CustomTripRequest.findById(requestId);
        const proposalId = reqWithProposals?.proposals[0]._id;

        const selectRes = await request(app)
            .post(`/api/custom-trips/${requestId}/select-proposal`)
            .set('Authorization', `Bearer ${travelerToken}`)
            .send({ proposalId });

        if (selectRes.status === 200 && selectRes.body.conversionStatus === 'auto') {
            console.log('✅ Auto-Conversion Verified: Trip created.');
            if (!selectRes.body.tripId) throw new Error('Trip ID missing in response');
        } else {
            throw new Error(`Auto-Conversion Failed: ${JSON.stringify(selectRes.body)}`);
        }

        // 7. Verify Trip Data
        const trip = await Trip.findById(selectRes.body.tripId);
        if (trip && trip.isPrivate && trip.status === 'active') {
            console.log('✅ Private Trip Entity Verified.');
        } else {
            throw new Error('Trip entity verification failed');
        }

        console.log('🎉 ALL TESTS PASSED SUCCESSFULLY');

        await mongoose.disconnect();
        await mongoServer.stop();
        process.exit(0);

    } catch (error) {
        console.error('❌ TEST FAILED:', error);
        await mongoose.disconnect();
        if (mongoServer!) await mongoServer.stop();
        process.exit(1);
    }
}

runTest();
