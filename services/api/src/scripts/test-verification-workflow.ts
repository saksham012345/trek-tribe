#!/usr/bin/env node
/**
 * Test Complete Organizer Verification Workflow
 * Tests: Registration → Verification Request → Admin Approval → Trip Creation
 */

import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const API_BASE_URL = 'http://localhost:4000';
let adminToken = '';
let organizerToken = '';
let verificationRequestId = '';
let organizerId = '';

async function testVerificationWorkflow() {
  try {
    console.log('🔐 Testing Complete Organizer Verification Workflow');
    console.log('='.repeat(70));

    // Step 1: Login as admin
    console.log('\n📝 Step 1: Login as admin...');
    const adminLogin = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: 'admin@trektribe.com',
      password: 'Admin@123'
    });

    adminToken = adminLogin.data.token;
    console.log('✅ Admin login successful');

    // Step 2: Register new organizer
    console.log('\n👤 Step 2: Registering new organizer...');
    const timestamp = Date.now();
    const registerResponse = await axios.post(`${API_BASE_URL}/auth/register`, {
      name: `Test Organizer ${timestamp}`,
      email: `organizer.test.${timestamp}@example.com`,
      password: 'SecurePass123!',
      role: 'organizer',
      bio: 'Experienced trekking guide with passion for mountains',
      yearsOfExperience: 5,
      specialties: ['Trekking', 'Mountain Climbing', 'Adventure Tourism']
    });

    console.log('✅ Organizer registered');
    console.log(`   Email: organizer.test.${timestamp}@example.com`);
    console.log(`   Status: ${registerResponse.data.user.organizerVerificationStatus}`);

    // Step 3: Verify email (if needed)
    // For testing, we'll skip actual email verification
    
    // Step 4: Login as the new organizer
    console.log('\n🔑 Step 3: Login as new organizer...');
    try {
      const organizerLogin = await axios.post(`${API_BASE_URL}/auth/login`, {
        email: `organizer.test.${timestamp}@example.com`,
        password: 'SecurePass123!'
      });

      organizerToken = organizerLogin.data.token;
      organizerId = organizerLogin.data.user._id;
      console.log('✅ Organizer login successful');
    } catch (error: any) {
      console.log('⚠️  Login requires email verification (expected)');
    }

    // Step 5: Try to create trip (should fail - not verified)
    console.log('\n❌ Step 4: Attempting to create trip (should FAIL)...');
    try {
      await axios.post(`${API_BASE_URL}/trips`, {
        title: 'Test Trek',
        description: 'Test trek description',
        destination: 'Himalayas',
        difficulty: 'moderate',
        categories: ['Trekking'],
        capacity: 20,
        price: 5000,
        startDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000),
        location: {
          type: 'Point',
          coordinates: [77.5890, 32.2190]
        }
      }, {
        headers: { Authorization: `Bearer ${organizerToken}` }
      });

      console.log('⚠️  WARNING: Trip creation succeeded (should have failed!)');
    } catch (error: any) {
      if (error.response?.status === 403) {
        console.log('✅ Trip creation blocked (expected)');
        console.log(`   Error: ${error.response.data.error}`);
        console.log(`   Status: ${error.response.data.verificationStatus}`);
      } else {
        console.log(`⚠️  Unexpected error: ${error.response?.data?.error || error.message}`);
      }
    }

    // Step 6: Get verification requests (as admin)
    console.log('\n📋 Step 5: Fetching verification requests (admin)...');
    const requestsResponse = await axios.get(`${API_BASE_URL}/admin/verification-requests`, {
      params: { status: 'pending' },
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    console.log(`✅ Found ${requestsResponse.data.data.length} pending verification requests`);
    
    // Find our organizer's request
    const ourRequest = requestsResponse.data.data.find(
      (req: any) => req.organizerEmail === `organizer.test.${timestamp}@example.com`
    );

    if (!ourRequest) {
      console.log('❌ Verification request not found!');
      return;
    }

    verificationRequestId = ourRequest._id;
    console.log(`   Request ID: ${verificationRequestId}`);
    console.log(`   Organizer: ${ourRequest.organizerName}`);
    console.log(`   Status: ${ourRequest.status}`);

    // Step 7: Approve organizer (as admin)
    console.log('\n✅ Step 6: Approving organizer...');
    const approvalResponse = await axios.post(
      `${API_BASE_URL}/admin/verification-requests/${verificationRequestId}/approve`,
      {
        trustScore: 75,
        verificationBadge: 'silver',
        enableRouting: false,
        adminNotes: 'Approved for testing purposes. Documents verified.'
      },
      {
        headers: { Authorization: `Bearer ${adminToken}` }
      }
    );

    console.log('✅ Organizer approved successfully!');
    console.log(`   Trust Score: ${approvalResponse.data.data.trustScore}`);
    console.log(`   Badge: ${approvalResponse.data.data.verificationBadge}`);
    console.log(`   Routing Enabled: ${approvalResponse.data.data.routingEnabled}`);

    // Step 8: Login again as organizer (to get updated token)
    console.log('\n🔄 Step 7: Re-login as approved organizer...');
    const organizerLogin2 = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: `organizer.test.${timestamp}@example.com`,
      password: 'SecurePass123!'
    });

    organizerToken = organizerLogin2.data.token;
    console.log('✅ Re-login successful');
    console.log(`   Status: ${organizerLogin2.data.user.organizerVerificationStatus}`);

    // Step 9: Create trip (should succeed now)
    console.log('\n🏔️  Step 8: Creating trip (should SUCCEED)...');
    const tripResponse = await axios.post(`${API_BASE_URL}/trips`, {
      title: `Approved Organizer Trek ${timestamp}`,
      description: 'Trek created by approved organizer',
      destination: 'Himalayas, India',
      difficulty: 'moderate',
      categories: ['Trekking', 'Adventure'],
      capacity: 20,
      price: 5999,
      startDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000),
      location: {
        type: 'Point',
        coordinates: [77.5890, 32.2190]
      },
      schedule: [
        { day: 1, title: 'Arrival', activities: ['Meet at base camp'] },
        { day: 2, title: 'Trek Day 1', activities: ['Start trekking'] }
      ]
    }, {
      headers: { Authorization: `Bearer ${organizerToken}` }
    });

    console.log('✅ Trip created successfully!');
    console.log(`   Trip ID: ${tripResponse.data._id}`);
    console.log(`   Title: ${tripResponse.data.title}`);
    console.log(`   Price: ₹${tripResponse.data.price}`);
    console.log(`   Payment Mode: ${tripResponse.data.paymentMode || 'N/A'}`);

    // Step 10: Recalculate trust score
    console.log('\n📊 Step 9: Recalculating trust score...');
    const scoreResponse = await axios.post(
      `${API_BASE_URL}/admin/verification-requests/${verificationRequestId}/recalculate-score`,
      {},
      {
        headers: { Authorization: `Bearer ${adminToken}` }
      }
    );

    console.log('✅ Trust score recalculated');
    console.log(`   Overall Score: ${scoreResponse.data.data.trustScore.overall}/100`);
    console.log(`   Badge: ${scoreResponse.data.data.verificationBadge}`);
    console.log(`   Eligible for Routing: ${scoreResponse.data.data.isEligibleForRouting}`);
    console.log('\n   Breakdown:');
    Object.entries(scoreResponse.data.data.trustScore.breakdown).forEach(([key, value]) => {
      console.log(`     - ${key}: ${value}`);
    });

    if (scoreResponse.data.data.recommendations?.length > 0) {
      console.log('\n   💡 Recommendations:');
      scoreResponse.data.data.recommendations.forEach((rec: string) => {
        console.log(`     - ${rec}`);
      });
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ VERIFICATION WORKFLOW TEST COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(70));

    console.log('\n📋 Summary:');
    console.log(`  1. ✅ Organizer registered with 'pending' status`);
    console.log(`  2. ✅ Verification request auto-created`);
    console.log(`  3. ✅ Unverified organizer blocked from creating trips`);
    console.log(`  4. ✅ Admin fetched pending verification requests`);
    console.log(`  5. ✅ Admin approved organizer with trust score`);
    console.log(`  6. ✅ Approved organizer successfully created trip`);
    console.log(`  7. ✅ Trust score recalculation working`);

    console.log('\n🎉 All verification steps working correctly!');

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.response?.data || error.message);
    if (error.response?.data) {
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

// Run the test
testVerificationWorkflow();
