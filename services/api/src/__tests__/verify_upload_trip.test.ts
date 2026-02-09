import dotenv from 'dotenv';
dotenv.config();

import request from 'supertest';
import app from '../index';
import { describe, it, expect, beforeAll, jest } from '@jest/globals';
import path from 'path';

// Mock the upload service middleware to avoid real network calls during test
jest.mock('../services/uploadService', () => ({
    upload: {
        single: () => (req: any, res: any, next: any) => {
            // simulate file being processed
            req.file = {
                path: 'https://res.cloudinary.com/demo/image/upload/v123456789/test_image.jpg',
                filename: 'test_image',
                originalname: 'test_image.gif',
                mimetype: 'image/gif',
                size: 1024
            };
            next();
        }
    }
}));

describe('Cloudinary Integration & Trip Flow (Mocked)', () => {
    let organizerToken: string;
    let uploadedImageUrl: string = 'https://res.cloudinary.com/demo/image/upload/v123456789/test_image.jpg';
    let tripId: string;

    beforeAll(async () => {
        // 1. Register and Login as Organizer
        console.log('🔹 Attempting Registration');
        await request(app).post('/auth/register').send({
            name: 'Cloudinary User',
            email: 'cloud_mock@test.com',
            password: 'StrongP@ssw0rd!23',
            role: 'organizer',
            phone: '+919876543210'
        }).expect(201);
        console.log('✅ Registration Successful');

        console.log('🔹 Attempting Login');
        const loginRes = await request(app).post('/auth/login').send({
            email: 'cloud_mock@test.com',
            password: 'StrongP@ssw0rd!23'
        }).expect(200);

        organizerToken = loginRes.body.token;
        console.log('✅ Login Successful, Token:', organizerToken ? 'Present' : 'Missing');
    });

    it('should upload an image (mocked) and return Cloudinary URL', async () => {
        const imagePath = path.resolve(__dirname, 'fixtures', 'test_image.gif');

        // Even though mocked, we send the request to verify route handler logic
        const res = await request(app)
            .post('/api/uploads')
            .set('Authorization', `Bearer ${organizerToken}`)
            .attach('file', imagePath)
            .expect(200);

        expect(res.body).toHaveProperty('url');
        expect(res.body.url).toContain('https://res.cloudinary.com');
        expect(res.body.url).toBe(uploadedImageUrl);
        console.log('✅ Uploaded Image URL (Mocked):', res.body.url);
    });

    it('should create a trip using the uploaded image', async () => {
        const tripData = {
            title: 'Cloudinary Mock Trip',
            description: 'Testing image integration with mock',
            price: 5000,
            duration: 3,
            difficulty: 'easy',
            destination: 'Cloud Valley',
            location: {
                name: 'Cloud Valley',
                coordinates: [77.1025, 28.7041]
            },
            startDate: new Date(Date.now() + 86400000).toISOString(),
            endDate: new Date(Date.now() + 86400000 * 4).toISOString(),
            capacity: 10,
            meetingPoint: 'Base Camp',
            activities: ['Mocking'],
            included: ['Jest'],
            notIncluded: ['Bugs'],
            images: [uploadedImageUrl],
            hostPhone: '+919999999999',
            cancellationPolicy: 'moderate',
            requirements: ['Code']
        };

        const res = await request(app)
            .post('/trips')
            .set('Authorization', `Bearer ${organizerToken}`)
            .send(tripData)
            .expect(201);

        tripId = res.body._id || res.body.id;
        expect(res.body.images).toContain(uploadedImageUrl);
        console.log('✅ Trip Created with Image:', tripId);
    });

    it('should fetch the trip and verify image URL persistence', async () => {
        console.log('🔹 Fetching Trip ID:', tripId);
        // We explicitly activate it first if needed, but endpoint might filter
        // Let's just PUT /activate to be sure, like in comprehensive test
        await request(app)
            .put(`/trips/${tripId}`)
            .set('Authorization', `Bearer ${organizerToken}`)
            .send({ status: 'active' });

        const res = await request(app)
            .get(`/trips/${tripId}`)
            .set('Authorization', `Bearer ${organizerToken}`);

        if (res.status !== 200) {
            console.log('❌ Fetch Failed Status:', res.status);
            console.log('❌ Fetch Failed Body:', JSON.stringify(res.body, null, 2));
        }
        expect(res.status).toBe(200);

        expect(res.body.images).toContain(uploadedImageUrl);
        console.log('✅ Verified Image URL in Fetched Trip');
    });
});
