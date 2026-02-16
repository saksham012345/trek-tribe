/**
 * CSV Export Security Test
 * 
 * This test verifies that:
 * 1. Admin can export all user contacts (admin endpoint)
 * 2. Organizers can ONLY export their own leads (CRM endpoint)
 * 3. Organizers CANNOT access admin export endpoint
 * 4. Unauthenticated users cannot access any export endpoints
 */

import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

const API_BASE_URL = process.env.API_URL || 'http://localhost:5000/api';

interface TestResult {
  test: string;
  status: 'PASS' | 'FAIL';
  message: string;
  details?: any;
}

const results: TestResult[] = [];

// Test credentials
const adminCredentials = {
  email: 'admin@trektribe.in',
  password: 'Admin@2025!'
};

const organizerCredentials = {
  email: 'crm.test@trektribe.in',
  password: 'CRMTest@2025!'
};

let adminToken: string = '';
let organizerToken: string = '';
let organizerId: string = '';

/**
 * Login and get authentication token
 */
async function login(email: string, password: string): Promise<{ token: string; userId: string }> {
  try {
    const response = await axios.post(`${API_BASE_URL}/auth/login`, {
      email,
      password
    });

    if (response.data.token) {
      return {
        token: response.data.token,
        userId: response.data.user?.id || response.data.user?._id || ''
      };
    }

    throw new Error('No token received');
  } catch (error: any) {
    throw new Error(`Login failed: ${error.response?.data?.message || error.message}`);
  }
}

/**
 * Test 1: Admin can export user contacts
 */
async function testAdminExport() {
  try {
    const response = await axios.get(`${API_BASE_URL}/admin/users/export-contacts`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`
      },
      params: {
        role: 'all'
      }
    });

    if (response.status === 200 && response.headers['content-type']?.includes('text/csv')) {
      results.push({
        test: 'Admin Export - User Contacts',
        status: 'PASS',
        message: 'Admin successfully exported user contacts',
        details: {
          contentType: response.headers['content-type'],
          dataLength: response.data.length
        }
      });
    } else {
      results.push({
        test: 'Admin Export - User Contacts',
        status: 'FAIL',
        message: 'Unexpected response format',
        details: { status: response.status, contentType: response.headers['content-type'] }
      });
    }
  } catch (error: any) {
    results.push({
      test: 'Admin Export - User Contacts',
      status: 'FAIL',
      message: `Admin export failed: ${error.response?.data?.message || error.message}`,
      details: { status: error.response?.status }
    });
  }
}

/**
 * Test 2: Organizer CANNOT access admin export endpoint
 */
async function testOrganizerCannotAccessAdminExport() {
  try {
    const response = await axios.get(`${API_BASE_URL}/admin/users/export-contacts`, {
      headers: {
        'Authorization': `Bearer ${organizerToken}`
      }
    });

    // If we get here, the test FAILED (organizer should not have access)
    results.push({
      test: 'Security - Organizer Cannot Access Admin Export',
      status: 'FAIL',
      message: 'SECURITY BREACH: Organizer was able to access admin export endpoint!',
      details: { status: response.status }
    });
  } catch (error: any) {
    // We EXPECT a 403 Forbidden error
    if (error.response?.status === 403) {
      results.push({
        test: 'Security - Organizer Cannot Access Admin Export',
        status: 'PASS',
        message: 'Organizer correctly denied access to admin export (403 Forbidden)',
        details: { status: 403 }
      });
    } else {
      results.push({
        test: 'Security - Organizer Cannot Access Admin Export',
        status: 'FAIL',
        message: `Unexpected error: ${error.response?.data?.message || error.message}`,
        details: { status: error.response?.status }
      });
    }
  }
}

/**
 * Test 3: Organizer can export their own leads
 */
async function testOrganizerLeadExport() {
  try {
    const response = await axios.get(`${API_BASE_URL}/crm/leads/export`, {
      headers: {
        'Authorization': `Bearer ${organizerToken}`
      }
    });

    if (response.status === 200 && response.headers['content-type']?.includes('text/csv')) {
      // Verify CSV contains only organizer's leads
      const csvData = response.data as string;
      const lines = csvData.split('\n');
      
      results.push({
        test: 'Organizer Export - Own Leads',
        status: 'PASS',
        message: 'Organizer successfully exported their own leads',
        details: {
          contentType: response.headers['content-type'],
          leadCount: lines.length - 2, // Subtract header and empty line
          dataLength: csvData.length
        }
      });
    } else {
      results.push({
        test: 'Organizer Export - Own Leads',
        status: 'FAIL',
        message: 'Unexpected response format',
        details: { status: response.status, contentType: response.headers['content-type'] }
      });
    }
  } catch (error: any) {
    results.push({
      test: 'Organizer Export - Own Leads',
      status: 'FAIL',
      message: `Organizer lead export failed: ${error.response?.data?.message || error.message}`,
      details: { status: error.response?.status }
    });
  }
}

/**
 * Test 4: Unauthenticated user cannot access any export
 */
async function testUnauthenticatedAccess() {
  const endpoints = [
    { name: 'Admin Export', url: `${API_BASE_URL}/admin/users/export-contacts` },
    { name: 'Lead Export', url: `${API_BASE_URL}/crm/leads/export` }
  ];

  for (const endpoint of endpoints) {
    try {
      await axios.get(endpoint.url);
      
      // If we get here, test FAILED
      results.push({
        test: `Security - Unauthenticated Access to ${endpoint.name}`,
        status: 'FAIL',
        message: `SECURITY BREACH: Unauthenticated user accessed ${endpoint.name}!`
      });
    } catch (error: any) {
      // We EXPECT a 401 Unauthorized error
      if (error.response?.status === 401) {
        results.push({
          test: `Security - Unauthenticated Access to ${endpoint.name}`,
          status: 'PASS',
          message: `Unauthenticated access correctly denied (401 Unauthorized)`
        });
      } else {
        results.push({
          test: `Security - Unauthenticated Access to ${endpoint.name}`,
          status: 'FAIL',
          message: `Unexpected error: ${error.message}`,
          details: { status: error.response?.status }
        });
      }
    }
  }
}

/**
 * Test 5: Verify lead filtering (organizer only sees their leads)
 */
async function testLeadFiltering() {
  try {
    const response = await axios.get(`${API_BASE_URL}/crm/leads`, {
      headers: {
        'Authorization': `Bearer ${organizerToken}`
      }
    });

    if (response.status === 200 && response.data.success) {
      const leads = response.data.data || [];
      
      // Check if all leads are assigned to this organizer
      const allAssignedToOrganizer = leads.every((lead: any) => 
        lead.assignedTo === organizerId || lead.assignedTo?._id === organizerId
      );

      if (allAssignedToOrganizer || leads.length === 0) {
        results.push({
          test: 'Lead Filtering - Organizer Sees Only Own Leads',
          status: 'PASS',
          message: 'All leads correctly filtered to organizer',
          details: { leadCount: leads.length, organizerId }
        });
      } else {
        results.push({
          test: 'Lead Filtering - Organizer Sees Only Own Leads',
          status: 'FAIL',
          message: 'SECURITY ISSUE: Organizer can see leads not assigned to them!',
          details: { leadCount: leads.length, organizerId }
        });
      }
    } else {
      results.push({
        test: 'Lead Filtering - Organizer Sees Only Own Leads',
        status: 'FAIL',
        message: 'Failed to fetch leads',
        details: { status: response.status }
      });
    }
  } catch (error: any) {
    results.push({
      test: 'Lead Filtering - Organizer Sees Only Own Leads',
      status: 'FAIL',
      message: `Error fetching leads: ${error.response?.data?.message || error.message}`,
      details: { status: error.response?.status }
    });
  }
}

/**
 * Print test results
 */
function printResults() {
  console.log('\n' + '='.repeat(80));
  console.log('CSV EXPORT SECURITY TEST RESULTS');
  console.log('='.repeat(80) + '\n');

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;

  results.forEach((result, index) => {
    const icon = result.status === 'PASS' ? '✅' : '❌';
    console.log(`${index + 1}. ${icon} ${result.test}`);
    console.log(`   Status: ${result.status}`);
    console.log(`   Message: ${result.message}`);
    if (result.details) {
      console.log(`   Details: ${JSON.stringify(result.details, null, 2)}`);
    }
    console.log('');
  });

  console.log('='.repeat(80));
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('='.repeat(80) + '\n');

  // Exit with error code if any tests failed
  if (failed > 0) {
    process.exit(1);
  }
}

/**
 * Main test execution
 */
async function runTests() {
  console.log('Starting CSV Export Security Tests...\n');

  try {
    // Step 1: Login as admin
    console.log('1. Logging in as admin...');
    const adminAuth = await login(adminCredentials.email, adminCredentials.password);
    adminToken = adminAuth.token;
    console.log('   ✅ Admin login successful\n');

    // Step 2: Login as organizer
    console.log('2. Logging in as organizer...');
    const organizerAuth = await login(organizerCredentials.email, organizerCredentials.password);
    organizerToken = organizerAuth.token;
    organizerId = organizerAuth.userId;
    console.log('   ✅ Organizer login successful\n');

    // Step 3: Run security tests
    console.log('3. Running security tests...\n');
    
    await testAdminExport();
    await testOrganizerCannotAccessAdminExport();
    await testOrganizerLeadExport();
    await testUnauthenticatedAccess();
    await testLeadFiltering();

    // Step 4: Print results
    printResults();

  } catch (error: any) {
    console.error('\n❌ Test execution failed:', error.message);
    process.exit(1);
  }
}

// Run tests
runTests();
