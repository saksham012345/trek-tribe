#!/usr/bin/env node

/**
 * Comprehensive Local System Test Script
 * Tests all critical components including:
 * - Session persistence fix
 * - AI service availability and responses
 * - Lead management and CRM functionality
 */

const axios = require('axios');
const colors = require('colors/safe');

// Configuration
const API_URL = process.env.API_URL || 'http://localhost:4000';
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
const AI_SERVICE_KEY = process.env.AI_SERVICE_KEY || '5YDVAJioLzl0wq0u1r4X9na6ypPkZpiQeEUynHaDMo0=';

// Test user credentials (from database seeds)
const TEST_CREDENTIALS = {
  organizer: {
    email: 'demo.organizer@trektribe.in',
    password: 'DemoOrg@2025!'
  },
  admin: {
    email: 'admin@gmail.com',
    password: 'Admin@2025!'
  }
};

// Global state
let authToken = null;
let userId = null;
let testResults = {
  sessionPersistence: [],
  aiService: [],
  crmAndLeads: [],
  summary: {}
};

// Helper function to make API calls
async function apiCall(method, endpoint, data = null, useAuth = true) {
  try {
    const config = {
      method,
      url: `${API_URL}${endpoint}`,
      timeout: 10000
    };

    if (data) {
      config.data = data;
    }

    if (useAuth && authToken) {
      config.headers = {
        Authorization: `Bearer ${authToken}`
      };
    }

    const response = await axios(config);
    return { success: true, data: response.data, status: response.status };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data || error.message,
      status: error.response?.status
    };
  }
}

// Test session persistence
async function testSessionPersistence() {
  console.log('\n' + colors.cyan('=== TEST 1: Session Persistence ==='));

  // Test 1.1: Login
  console.log('\n1.1: Testing login and token storage...');
  const loginRes = await apiCall('POST', '/auth/login', TEST_CREDENTIALS.organizer, false);
  
  if (!loginRes.success) {
    console.log(colors.red('✗ Login failed:'), loginRes.error);
    testResults.sessionPersistence.push({ test: 'Login', status: 'failed', error: loginRes.error });
    return;
  }

  authToken = loginRes.data.token;
  userId = loginRes.data.user?.id || loginRes.data.user?._id;

  console.log(colors.green('✓ Login successful'));
  console.log('  - Token:', authToken.substring(0, 20) + '...');
  console.log('  - User ID:', userId);
  testResults.sessionPersistence.push({ test: 'Login', status: 'passed' });

  // Test 1.2: Verify /auth/me endpoint
  console.log('\n1.2: Testing /auth/me endpoint (session restoration)...');
  const meRes = await apiCall('GET', '/auth/me', null, true);

  if (!meRes.success) {
    console.log(colors.red('✗ /auth/me failed:'), meRes.error);
    testResults.sessionPersistence.push({ test: '/auth/me', status: 'failed', error: meRes.error });
    return;
  }

  const userFromMe = meRes.data.user || meRes.data;
  if (!userFromMe || !userFromMe._id) {
    console.log(colors.red('✗ Invalid user response format'), meRes.data);
    testResults.sessionPersistence.push({ test: '/auth/me response format', status: 'failed' });
    return;
  }

  console.log(colors.green('✓ /auth/me endpoint works correctly'));
  console.log('  - User email:', userFromMe.email);
  console.log('  - User role:', userFromMe.role);
  testResults.sessionPersistence.push({ test: '/auth/me', status: 'passed' });

  // Test 1.3: Test token persistence (simulating page reload)
  console.log('\n1.3: Simulating page reload with stored token...');
  const reloadRes = await apiCall('GET', '/auth/me', null, true);

  if (!reloadRes.success) {
    console.log(colors.red('✗ Token persistence failed:'), reloadRes.error);
    testResults.sessionPersistence.push({ test: 'Token persistence', status: 'failed', error: reloadRes.error });
    return;
  }

  console.log(colors.green('✓ Token persisted across reload'));
  testResults.sessionPersistence.push({ test: 'Token persistence', status: 'passed' });
}

// Test AI Service
async function testAIService() {
  console.log('\n' + colors.cyan('=== TEST 2: AI Service ==='));

  // Test 2.1: Check AI health
  console.log('\n2.1: Checking AI service health...');
  try {
    const healthRes = await axios.get(`${AI_SERVICE_URL}/health`, { timeout: 5000 });
    console.log(colors.green('✓ AI service is running'));
    console.log('  - Status:', healthRes.data.status);
    testResults.aiService.push({ test: 'AI Service Health', status: 'passed' });
  } catch (error) {
    console.log(colors.red('✗ AI service not reachable:'), error.message);
    testResults.aiService.push({ test: 'AI Service Health', status: 'failed', error: error.message });
    return;
  }

  // Test 2.2: Check AI readiness
  console.log('\n2.2: Checking AI service readiness...');
  try {
    const readyRes = await axios.get(`${AI_SERVICE_URL}/ready`, { timeout: 5000 });
    console.log(colors.green('✓ AI service is ready'));
    console.log('  - Ready:', readyRes.data.ready);
    console.log('  - Model loaded:', readyRes.data.model_loaded);
    testResults.aiService.push({ test: 'AI Service Ready', status: 'passed' });
  } catch (error) {
    console.log(colors.red('✗ AI service ready check failed:'), error.message);
    testResults.aiService.push({ test: 'AI Service Ready', status: 'failed', error: error.message });
  }

  // Test 2.3: Test AI generate endpoint
  console.log('\n2.3: Testing AI generation endpoint...');
  try {
    const genRes = await axios.post(
      `${AI_SERVICE_URL}/generate`,
      {
        prompt: 'What are the best treks for beginners in the Himalayas?',
        max_tokens: 100,
        top_k: 3
      },
      {
        headers: {
          'x-api-key': AI_SERVICE_KEY,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );

    console.log(colors.green('✓ AI generation works'));
    console.log('  - Response length:', genRes.data?.text?.length || 0);
    console.log('  - Response preview:', (genRes.data?.text || '').substring(0, 100) + '...');
    testResults.aiService.push({ test: 'AI Generate', status: 'passed' });
  } catch (error) {
    console.log(colors.red('✗ AI generation failed:'), error.message);
    testResults.aiService.push({ test: 'AI Generate', status: 'failed', error: error.message });
  }

  // Test 2.4: Test API proxy to AI service
  console.log('\n2.4: Testing backend proxy to AI service...');
  const proxyRes = await apiCall('POST', '/api/ai/generate', {
    prompt: 'How do I book a trek on TrekTribe?',
    max_tokens: 80
  }, true);

  if (!proxyRes.success) {
    console.log(colors.red('✗ API proxy to AI failed:'), proxyRes.error);
    testResults.aiService.push({ test: 'API Proxy to AI', status: 'failed', error: proxyRes.error });
  } else {
    console.log(colors.green('✓ API proxy to AI works'));
    testResults.aiService.push({ test: 'API Proxy to AI', status: 'passed' });
  }
}

// Test CRM and Lead Management
async function testCRMAndLeads() {
  console.log('\n' + colors.cyan('=== TEST 3: CRM and Lead Management ==='));

  if (!authToken) {
    console.log(colors.red('✗ Skipping CRM tests - no auth token'));
    return;
  }

  // Test 3.1: Create a lead
  console.log('\n3.1: Creating a test lead...');
  const leadData = {
    email: `test-lead-${Date.now()}@example.com`,
    phone: '+919876543210',
    name: 'Test Lead',
    source: 'trip_view',
    status: 'new',
    leadScore: 50
  };

  const createLeadRes = await apiCall('POST', '/api/crm/leads', leadData, true);

  if (!createLeadRes.success) {
    console.log(colors.red('✗ Create lead failed:'), createLeadRes.error);
    testResults.crmAndLeads.push({ test: 'Create Lead', status: 'failed', error: createLeadRes.error });
  } else {
    const lead = createLeadRes.data.data || createLeadRes.data;
    const leadId = lead._id || lead.id;
    console.log(colors.green('✓ Lead created successfully'));
    console.log('  - Lead ID:', leadId);
    console.log('  - Email:', lead.email);
    testResults.crmAndLeads.push({ test: 'Create Lead', status: 'passed' });

    // Test 3.2: Get lead
    console.log('\n3.2: Retrieving lead details...');
    const getLeadRes = await apiCall('GET', `/api/crm/leads/${leadId}`, null, true);

    if (!getLeadRes.success) {
      console.log(colors.red('✗ Get lead failed:'), getLeadRes.error);
      testResults.crmAndLeads.push({ test: 'Get Lead', status: 'failed', error: getLeadRes.error });
    } else {
      console.log(colors.green('✓ Lead retrieved successfully'));
      console.log('  - Email:', getLeadRes.data.email);
      console.log('  - Status:', getLeadRes.data.status);
      testResults.crmAndLeads.push({ test: 'Get Lead', status: 'passed' });
    }

    // Test 3.3: Update lead
    console.log('\n3.3: Updating lead status...');
    const updateLeadRes = await apiCall('PUT', `/api/crm/leads/${leadId}`, {
      status: 'interested',
      leadScore: 75
    }, true);

    if (!updateLeadRes.success) {
      console.log(colors.red('✗ Update lead failed:'), updateLeadRes.error);
      testResults.crmAndLeads.push({ test: 'Update Lead', status: 'failed', error: updateLeadRes.error });
    } else {
      console.log(colors.green('✓ Lead updated successfully'));
      console.log('  - New status:', updateLeadRes.data.status);
      testResults.crmAndLeads.push({ test: 'Update Lead', status: 'passed' });
    }
  }

  // Test 3.4: List leads
  console.log('\n3.4: Listing all leads...');
  const listLeadsRes = await apiCall('GET', '/api/crm/leads', null, true);

  if (!listLeadsRes.success) {
    console.log(colors.red('✗ List leads failed:'), listLeadsRes.error);
    testResults.crmAndLeads.push({ test: 'List Leads', status: 'failed', error: listLeadsRes.error });
  } else {
    const leads = Array.isArray(listLeadsRes.data) ? listLeadsRes.data : listLeadsRes.data.data || [];
    console.log(colors.green('✓ Leads retrieved successfully'));
    console.log('  - Total leads:', leads.length);
    testResults.crmAndLeads.push({ test: 'List Leads', status: 'passed' });
  }

  // Test 3.5: Check CRM subscription
  console.log('\n3.5: Checking CRM subscription status...');
  const subscriptionRes = await apiCall('GET', `/api/subscriptions/crm-status/${userId}`, null, true);

  if (!subscriptionRes.success) {
    console.log(colors.yellow('⚠ CRM subscription check failed (may not have subscription):'), subscriptionRes.error);
    testResults.crmAndLeads.push({ test: 'Check CRM Subscription', status: 'warning', error: subscriptionRes.error });
  } else {
    console.log(colors.green('✓ CRM subscription found'));
    console.log('  - Status:', subscriptionRes.data.status);
    testResults.crmAndLeads.push({ test: 'Check CRM Subscription', status: 'passed' });
  }
}

// Print summary
function printSummary() {
  console.log('\n' + colors.cyan('=== TEST SUMMARY ==='));

  console.log('\n' + colors.yellow('Session Persistence Tests:'));
  testResults.sessionPersistence.forEach(t => {
    const symbol = t.status === 'passed' ? colors.green('✓') : colors.red('✗');
    console.log(`  ${symbol} ${t.test}: ${t.status}`);
  });

  console.log('\n' + colors.yellow('AI Service Tests:'));
  testResults.aiService.forEach(t => {
    const symbol = t.status === 'passed' ? colors.green('✓') : colors.red('✗');
    console.log(`  ${symbol} ${t.test}: ${t.status}`);
  });

  console.log('\n' + colors.yellow('CRM & Lead Management Tests:'));
  testResults.crmAndLeads.forEach(t => {
    const symbol = t.status === 'passed' ? colors.green('✓') : t.status === 'warning' ? colors.yellow('⚠') : colors.red('✗');
    console.log(`  ${symbol} ${t.test}: ${t.status}`);
  });

  // Calculate pass rate
  const allTests = [
    ...testResults.sessionPersistence,
    ...testResults.aiService,
    ...testResults.crmAndLeads
  ];
  const passed = allTests.filter(t => t.status === 'passed').length;
  const total = allTests.length;
  const passRate = ((passed / total) * 100).toFixed(2);

  console.log('\n' + colors.cyan(`Overall Pass Rate: ${passRate}% (${passed}/${total} tests passed)`));

  if (passRate === '100.00') {
    console.log(colors.green('🎉 All tests passed! System is ready.'));
  } else if (passRate >= 80) {
    console.log(colors.yellow('⚠ Most tests passed, but some issues remain.'));
  } else {
    console.log(colors.red('❌ Critical issues found. Please review failures above.'));
  }
}

// Main test runner
async function main() {
  console.log(colors.cyan('🚀 Starting Local System Tests\n'));
  console.log(`API URL: ${API_URL}`);
  console.log(`AI Service URL: ${AI_SERVICE_URL}\n`);

  try {
    await testSessionPersistence();
    await testAIService();
    await testCRMAndLeads();
    printSummary();
  } catch (error) {
    console.error(colors.red('Fatal error during tests:'), error);
    process.exit(1);
  }
}

main();
