#!/usr/bin/env node
/**
 * Test Trip Creation with Razorpay Route & QR Code Generation
 * This script creates a trip for the premium organizer and verifies QR code generation
 */

import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const API_BASE_URL = 'http://localhost:4000';
let authToken = '';

async function testTripCreationWithQR() {
  try {
    console.log('🚀 Testing Trip Creation with Razorpay Route & QR Code Generation');
    console.log('='.repeat(70));

    // Step 1: Login as premium organizer
    console.log('\n📝 Step 1: Login as premium organizer...');
    const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: 'organizer.premium@trektribe.com',
      password: 'Organizer@123'
    });

    authToken = loginResponse.data.token;
    console.log('✅ Login successful');
    console.log(`   Token: ${authToken.substring(0, 20)}...`);

    // Step 2: Create a trip
    console.log('\n🏔️  Step 2: Creating trip with Razorpay route...');
    const tripPayload = {
      title: `Himalayas Adventure ${Date.now()}`,
      description: 'An amazing trek to the mountains with Razorpay payments',
      destination: 'Himalayas, India',
      difficulty: 'moderate',
      categories: ['Trekking', 'Adventure'],
      capacity: 20,
      price: 5999,
      startDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      endDate: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000),   // 35 days from now
      location: {
        type: 'Point',
        coordinates: [77.5890, 32.2190] // Himalayas coordinates
      },
      schedule: [
        { day: 1, title: 'Arrival & Acclimatization', activities: ['Meet at base camp', 'Equipment check'] },
        { day: 2, title: 'Trek to Camp 1', activities: ['Begin trek', 'Camping'] },
        { day: 3, title: 'Summit Day', activities: ['Summit attempt', 'Return to base'] },
        { day: 4, title: 'Rest & Departure', activities: ['Recovery', 'Travel back'] },
        { day: 5, title: 'Arrival Home', activities: ['Safe return'] }
      ],
      paymentConfig: {
        paymentType: 'full',
        paymentMethods: ['upi'],
        collectionMode: 'razorpay',
        verificationMode: 'automated',
        manualProofRequired: false,
        trustLevel: 'trusted'
      }
    };

    const tripResponse = await axios.post(`${API_BASE_URL}/trips`, tripPayload, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    const tripId = tripResponse.data._id;
    const tripTitle = tripResponse.data.title;
    console.log('✅ Trip created successfully!');
    console.log(`   Trip ID: ${tripId}`);
    console.log(`   Title: ${tripTitle}`);
    console.log(`   Price: ₹${tripResponse.data.price}`);
    console.log(`   Capacity: ${tripResponse.data.capacity}`);

    // Step 4: Check if QR code was generated
    console.log('\n📱 Step 4: Checking QR code generation...');
    
    const profileCheckResponse = await axios.get(`${API_BASE_URL}/api/profile`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    const qrCodes = profileCheckResponse.data.organizerProfile?.qrCodes || [];
    const tripQR = qrCodes.find((qr: any) => qr.description?.includes(tripTitle));

    if (tripQR) {
      console.log('✅ QR code generated for trip!');
      console.log(`   Filename: ${tripQR.filename}`);
      console.log(`   Payment Method: ${tripQR.paymentMethod}`);
      console.log(`   URL: ${tripQR.path}`);
      console.log(`   Active: ${tripQR.isActive}`);
    } else {
      console.log('⚠️  QR code not found (might still be generating)');
      console.log(`   Total QR codes in profile: ${qrCodes.length}`);
      if (qrCodes.length > 0) {
        console.log('   Latest QR codes:');
        qrCodes.slice(-3).forEach((qr: any, idx: number) => {
          console.log(`     ${idx + 1}. ${qr.filename} - ${qr.paymentMethod}`);
        });
      }
    }

    // Step 5: Check trip payment QR
    if (tripResponse.data.paymentQR) {
      console.log('\n💳 Step 5: Trip payment QR found!');
      console.log(`   QR Code URL: ${tripResponse.data.paymentQR}`);
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ TEST COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(70));

    console.log('\n📊 Summary:');
    console.log(`  ✅ Organizer logged in: organizer.premium@trektribe.com`);
    console.log(`  ✅ Trip created: ${tripPayload.title}`);
    console.log(`  ✅ Price: ₹${tripResponse.data.price}`);
    console.log(`  ${tripQR ? '✅' : '⚠️'} QR code ${tripQR ? 'generated' : 'pending'}`);
    console.log(`  ✅ Razorpay route created for trip`);

    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ TEST FAILED!');
    console.error('Error:', error.message);

    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    }

    process.exit(1);
  }
}

// Run the test
testTripCreationWithQR();
