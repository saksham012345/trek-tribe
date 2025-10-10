const axios = require('axios');

// Test configuration
const API_BASE_URL = 'http://localhost:4000';
const TEST_USER_TOKEN = ''; // We'll need a real token for authenticated endpoints

// Helper function to make API calls
async function makeApiCall(endpoint, method = 'GET', data = null, headers = {}) {
  try {
    const config = {
      method,
      url: `${API_BASE_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };
    
    if (data) {
      config.data = data;
    }
    
    const response = await axios(config);
    return {
      success: true,
      status: response.status,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      status: error.response?.status || 500,
      error: error.response?.data || error.message
    };
  }
}

// Test cases
const tests = [
  {
    name: 'Health Check',
    endpoint: '/chat/health',
    method: 'GET'
  },
  {
    name: 'Service Status',
    endpoint: '/chat/status',
    method: 'GET'
  },
  {
    name: 'AI Recommendations (Public)',
    endpoint: '/chat/recommendations',
    method: 'POST',
    data: {
      preferences: {
        budget: { min: 3000, max: 15000 },
        difficulty: 'intermediate',
        interests: ['adventure', 'nature']
      },
      context: {
        currentPage: '/trips',
        previousMessages: []
      }
    }
  },
  {
    name: 'Trip Availability Check',
    endpoint: '/chat/trip-availability/sample-trip-id',
    method: 'GET'
  },
  {
    name: 'Organizer Profile Info',
    endpoint: '/chat/organizer-profile/sample-trip-id',
    method: 'GET'
  },
  {
    name: 'Booking Assistance',
    endpoint: '/chat/booking-assistance',
    method: 'POST',
    data: {
      tripId: 'sample-trip-id',
      step: 'booking-form'
    }
  },
  {
    name: 'AI Smart Search',
    endpoint: '/chat/smart-search',
    method: 'POST',
    data: {
      query: 'Find adventure trips under 10000 in Himachal Pradesh',
      context: {
        currentFilters: {},
        userPreferences: {}
      }
    }
  },
  {
    name: 'Chat Message (Public)',
    endpoint: '/chat/message',
    method: 'POST',
    data: {
      message: 'What are the best trips for beginners?',
      context: {
        previousMessages: []
      }
    }
  }
];

// Run tests
async function runTests() {
  console.log('🤖 Starting AI Endpoints Test Suite\n');
  console.log('=' .repeat(60));
  
  let passedTests = 0;
  let totalTests = tests.length;
  
  for (const test of tests) {
    console.log(`\n📋 Testing: ${test.name}`);
    console.log(`   Endpoint: ${test.method} ${test.endpoint}`);
    
    const result = await makeApiCall(
      test.endpoint, 
      test.method, 
      test.data,
      test.headers
    );
    
    if (result.success) {
      console.log(`   ✅ PASS - Status: ${result.status}`);
      if (result.data?.success) {
        console.log(`   📊 Response: ${JSON.stringify(result.data).substring(0, 100)}...`);
      } else {
        console.log(`   📊 Response: ${JSON.stringify(result.data).substring(0, 100)}...`);
      }
      passedTests++;
    } else {
      console.log(`   ❌ FAIL - Status: ${result.status}`);
      console.log(`   💥 Error: ${JSON.stringify(result.error).substring(0, 200)}...`);
    }
  }
  
  console.log('\n' + '=' .repeat(60));
  console.log(`📊 Test Results: ${passedTests}/${totalTests} passed`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All tests passed! AI endpoints are working correctly.');
  } else {
    console.log(`⚠️  ${totalTests - passedTests} tests failed. Check server and endpoint implementation.`);
  }
  
  // Additional connectivity test
  console.log('\n🔍 Testing server connectivity...');
  const healthCheck = await makeApiCall('/health', 'GET');
  if (healthCheck.success) {
    console.log('✅ Server is running and accessible');
  } else {
    console.log('❌ Server connectivity issues. Make sure the API server is running on port 4000');
  }
}

// Additional authenticated tests (requires token)
async function runAuthenticatedTests() {
  if (!TEST_USER_TOKEN) {
    console.log('\n🔒 Skipping authenticated tests - no token provided');
    return;
  }
  
  console.log('\n🔐 Running authenticated tests...');
  
  const authHeaders = {
    'Authorization': `Bearer ${TEST_USER_TOKEN}`
  };
  
  const authTests = [
    {
      name: 'User Analytics',
      endpoint: '/chat/user-analytics',
      method: 'GET',
      headers: authHeaders
    },
    {
      name: 'AI Test (Admin)',
      endpoint: '/chat/test-ai',
      method: 'POST',
      data: { message: 'Test AI response' },
      headers: authHeaders
    }
  ];
  
  for (const test of authTests) {
    console.log(`\n📋 Testing: ${test.name}`);
    const result = await makeApiCall(test.endpoint, test.method, test.data, test.headers);
    
    if (result.success) {
      console.log(`   ✅ PASS - Status: ${result.status}`);
    } else {
      console.log(`   ❌ FAIL - Status: ${result.status}`);
      console.log(`   💥 Error: ${result.error}`);
    }
  }
}

// Performance test
async function runPerformanceTest() {
  console.log('\n⚡ Running performance test...');
  
  const startTime = Date.now();
  const promises = [];
  
  // Test concurrent requests
  for (let i = 0; i < 5; i++) {
    promises.push(
      makeApiCall('/chat/health', 'GET')
    );
  }
  
  const results = await Promise.all(promises);
  const endTime = Date.now();
  
  const successful = results.filter(r => r.success).length;
  console.log(`📈 Concurrent requests: ${successful}/5 successful`);
  console.log(`⏱️  Total time: ${endTime - startTime}ms`);
  console.log(`⚡ Average response time: ${(endTime - startTime) / 5}ms per request`);
}

// Run the test suite
async function main() {
  console.log('🚀 Trek Tribe AI Endpoints Test Suite');
  console.log('🕐 Started at:', new Date().toLocaleString());
  
  await runTests();
  await runAuthenticatedTests();
  await runPerformanceTest();
  
  console.log('\n🏁 Test suite completed at:', new Date().toLocaleString());
}

// Export for use in other scripts
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  runTests,
  runAuthenticatedTests,
  runPerformanceTest,
  makeApiCall
};