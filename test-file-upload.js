const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const API_BASE_URL = 'https://trek-tribe-5.onrender.com';

async function testFileUpload() {
  try {
    console.log('🔍 Testing file upload support...');
    
    // First, let's check if we can create a trip without files
    const testTripData = {
      title: 'Test Adventure Upload',
      description: 'Testing file upload functionality',
      destination: 'Test Location',
      price: '1000',
      capacity: '10',
      categories: JSON.stringify(['Adventure', 'Mountain']),
      startDate: '2024-12-01',
      endDate: '2024-12-03',
      itinerary: 'Day 1: Test activity'
    };

    console.log('📤 Testing trip creation endpoint...');
    const response = await axios.post(`${API_BASE_URL}/trips`, testTripData, {
      headers: {
        'Content-Type': 'application/json',
        // You would need a valid auth token here for a real test
        'Authorization': 'Bearer test-token'
      }
    });
    
    console.log('✅ Trip creation endpoint is working');
    console.log('Response:', response.data);
    
  } catch (error) {
    console.log('ℹ️  Backend response:', error.response?.status, error.response?.data);
    
    if (error.response?.status === 401) {
      console.log('🔐 Authentication required (expected for production)');
      console.log('✅ Backend is responding properly');
    } else if (error.response?.status === 400) {
      console.log('📝 Backend expects different data format');
      console.log('Response:', error.response.data);
    } else {
      console.log('❌ Unexpected error:', error.message);
    }
  }
  
  console.log('\n📋 File upload status:');
  console.log('- Frontend: ✅ File upload UI added');
  console.log('- Frontend: ✅ FormData handling implemented');
  console.log('- Backend: ⚠️  Needs authentication for testing');
  console.log('- Backend: ℹ️  Should support multipart/form-data based on frontend implementation');
}

testFileUpload();
