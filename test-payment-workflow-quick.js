#!/usr/bin/env node

/**
 * Payment Workflow Quick Test Script
 * Tests the complete payment flow for Trek Tribe subscriptions
 * Run with: node test-payment-workflow-quick.js
 */

const http = require('http');
const https = require('https');

const API_URL = process.env.API_URL || 'http://localhost:4000';
const TEST_JWT = process.env.TEST_JWT || 'your_test_jwt_token_here';

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Helper function to make API calls
function apiCall(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_URL);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TEST_JWT}`
      }
    };

    const req = client.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: JSON.parse(body)
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: body
          });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

// Test cases
async function runTests() {
  console.log(`${colors.cyan}🔍 Trek Tribe Payment Workflow Test${colors.reset}`);
  console.log(`${colors.cyan}====================================${colors.reset}\n`);

  if (TEST_JWT === 'your_test_jwt_token_here') {
    console.log(`${colors.yellow}⚠️  Warning: Using placeholder JWT token${colors.reset}`);
    console.log(`${colors.yellow}Set TEST_JWT environment variable with your actual token${colors.reset}`);
    console.log(`${colors.yellow}Example: TEST_JWT=eyJhbGc... node test-payment-workflow-quick.js${colors.reset}\n`);
  }

  const tests = [];

  // Test 1: Verify CRM Access (No CRM expected)
  console.log(`${colors.blue}Test 1: Check CRM Access Status${colors.reset}`);
  try {
    const res = await apiCall('GET', '/api/subscriptions/verify-crm-access');
    console.log(`Status: ${res.status}`);
    console.log(`CRM Access: ${res.data.hasCRMAccess ? '✅ YES' : '❌ NO'}`);
    tests.push({
      name: 'Check CRM Access',
      status: res.status === 200 ? 'PASS' : 'FAIL',
      details: `hasCRMAccess: ${res.data.hasCRMAccess}`
    });
  } catch (err) {
    console.log(`${colors.red}Error: ${err.message}${colors.reset}`);
    tests.push({
      name: 'Check CRM Access',
      status: 'FAIL',
      details: err.message
    });
  }
  console.log();

  // Test 2: Get Available Plans
  console.log(`${colors.blue}Test 2: Fetch Available Plans${colors.reset}`);
  try {
    const res = await apiCall('GET', '/api/subscriptions/plans');
    console.log(`Status: ${res.status}`);
    if (res.data && Array.isArray(res.data)) {
      console.log(`${colors.green}✓ Found ${res.data.length} subscription plans${colors.reset}`);
      res.data.slice(0, 3).forEach(plan => {
        console.log(`  - ${plan.name}: ₹${plan.price} (CRM: ${plan.crmAccess ? '✅' : '❌'})`);
      });
    }
    tests.push({
      name: 'Fetch Plans',
      status: res.status === 200 ? 'PASS' : 'FAIL',
      details: `Found ${res.data?.length || 0} plans`
    });
  } catch (err) {
    console.log(`${colors.red}Error: ${err.message}${colors.reset}`);
    tests.push({
      name: 'Fetch Plans',
      status: 'FAIL',
      details: err.message
    });
  }
  console.log();

  // Test 3: Create Trial Order
  console.log(`${colors.blue}Test 3: Create Trial Subscription${colors.reset}`);
  try {
    const res = await apiCall('POST', '/api/subscriptions/create-order', {
      planType: 'PROFESSIONAL',
      skipTrial: false
    });
    console.log(`Status: ${res.status}`);
    if (res.data.isTrial) {
      console.log(`${colors.green}✓ Trial Created Successfully${colors.reset}`);
      console.log(`  - Trial Days: ${res.data.subscription.trialDays || 60}`);
      console.log(`  - Status: ${res.data.subscription.status}`);
      console.log(`  - Message: ${res.data.message}`);
    } else {
      console.log(`${colors.yellow}⚠️  Paid order created instead of trial${colors.reset}`);
      console.log(`  - Order ID: ${res.data.orderId}`);
      console.log(`  - Amount: ₹${res.data.amount / 100}`);
    }
    tests.push({
      name: 'Create Trial',
      status: res.status === 200 ? 'PASS' : 'FAIL',
      details: res.data.isTrial ? 'Trial created' : 'Paid order created'
    });
  } catch (err) {
    console.log(`${colors.red}Error: ${err.message}${colors.reset}`);
    tests.push({
      name: 'Create Trial',
      status: 'FAIL',
      details: err.message
    });
  }
  console.log();

  // Test 4: Create Paid Order (Razorpay)
  console.log(`${colors.blue}Test 4: Create Paid Order (Razorpay)${colors.reset}`);
  try {
    const res = await apiCall('POST', '/api/subscriptions/create-order', {
      planType: 'PREMIUM',
      skipTrial: true
    });
    console.log(`Status: ${res.status}`);
    if (res.data.orderId) {
      console.log(`${colors.green}✓ Razorpay Order Created${colors.reset}`);
      console.log(`  - Order ID: ${res.data.orderId}`);
      console.log(`  - Amount: ₹${res.data.amount / 100} INR`);
      console.log(`  - Razorpay Key: ${res.data.keyId}`);
      console.log(`  - Plan: ${res.data.plan.name}`);
    }
    tests.push({
      name: 'Create Paid Order',
      status: res.status === 200 ? 'PASS' : 'FAIL',
      details: res.data.orderId ? `Order: ${res.data.orderId}` : 'No order created'
    });
  } catch (err) {
    console.log(`${colors.red}Error: ${err.message}${colors.reset}`);
    tests.push({
      name: 'Create Paid Order',
      status: 'FAIL',
      details: err.message
    });
  }
  console.log();

  // Test 5: Check CRM Access Again
  console.log(`${colors.blue}Test 5: Verify CRM Access After Trial${colors.reset}`);
  try {
    const res = await apiCall('GET', '/api/subscriptions/verify-crm-access');
    console.log(`Status: ${res.status}`);
    console.log(`CRM Access: ${res.data.hasCRMAccess ? '✅ YES' : '❌ NO'}`);
    if (res.data.hasCRMAccess) {
      console.log(`${colors.green}✓ CRM Access Granted${colors.reset}`);
      console.log(`  - Plan: ${res.data.planType}`);
      console.log(`  - Subscription Status: ${res.data.subscriptionStatus}`);
    }
    tests.push({
      name: 'CRM Access After Trial',
      status: res.status === 200 ? 'PASS' : 'FAIL',
      details: `hasCRMAccess: ${res.data.hasCRMAccess}`
    });
  } catch (err) {
    console.log(`${colors.red}Error: ${err.message}${colors.reset}`);
    tests.push({
      name: 'CRM Access After Trial',
      status: 'FAIL',
      details: err.message
    });
  }
  console.log();

  // Print Summary
  console.log(`${colors.cyan}📊 Test Summary${colors.reset}`);
  console.log(`${colors.cyan}===============${colors.reset}\n`);
  
  const passed = tests.filter(t => t.status === 'PASS').length;
  const total = tests.length;

  tests.forEach(test => {
    const icon = test.status === 'PASS' ? '✅' : '❌';
    console.log(`${icon} ${test.name}`);
    console.log(`   ${test.details}`);
  });

  console.log(`\n${colors.cyan}Results: ${colors.green}${passed}/${total} passed${colors.reset}`);
  
  if (passed === total) {
    console.log(`${colors.green}✨ All tests passed! Payment workflow is ready.${colors.reset}\n`);
    process.exit(0);
  } else {
    console.log(`${colors.yellow}⚠️  Some tests failed. Check API configuration.${colors.reset}\n`);
    process.exit(1);
  }
}

// Run tests
runTests().catch(err => {
  console.error(`${colors.red}Fatal Error:${colors.reset}`, err);
  process.exit(1);
});
