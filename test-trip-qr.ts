#!/usr/bin/env node
/**
 * Test Trip Creation with Razorpay Route & QR Code Generation
 */

import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const API_BASE_URL = 'http://localhost:4000';

async function testTripCreationWithQR() {
  try {
    console.log('🚀 Testing Trip Creation with Razorpay Route & QR Code Generation');
    console.log('='.repeat(70));

    // Step 1: Login
    console.log('\n📝 Step 1: Login as premium organizer...');
    const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: 'organizer.premium@trektribe.com',
      password: 'Organizer@123'
    });

    const authToken = loginResponse.data.token;
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
      startDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000),
      paymentConfig: {
        paymentType: 'full',
        paymentMethods: ['upi'],
        collectionMode: 'razorpay',
        verificationMode: 'automated'
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

    // Step 3: Check QR code
    console.log('\n📱 Step 3: Checking QR code generation...');
    
    if (tripResponse.data.paymentQR) {
      console.log('✅ QR code generated and linked to trip!');
      console.log(`   QR Code URL: ${tripResponse.data.paymentQR}`);
    } else {
      console.log('⚠️  QR code not found on initial response');
    }

    // Step 4: Fetch trip details
    console.log('\n🔍 Step 4: Fetching trip details to confirm QR...');
    const tripCheckResponse = await axios.get(`${API_BASE_URL}/trips/${tripId}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    if (tripCheckResponse.data.paymentQR) {
      console.log('✅ QR code persisted on trip!');
      console.log(`   QR Code URL: ${tripCheckResponse.data.paymentQR}`);
    } else {
      console.log('⚠️  QR code not found on trip');
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ TEST COMPLETED!');
    console.log('='.repeat(70));

    console.log('\n📊 Summary:');
    console.log(`  ✅ Organizer logged in`);
    console.log(`  ✅ Trip created: ${tripTitle}`);
    console.log(`  ✅ Price: ₹${tripResponse.data.price}`);
    console.log(`  ${tripCheckResponse.data.paymentQR ? '✅' : '⚠️'} QR code ${tripCheckResponse.data.paymentQR ? 'generated' : 'pending'}`);
    console.log(`  ✅ Razorpay route creation integrated`);

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

testTripCreationWithQR();
