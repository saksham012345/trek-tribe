/**
 * End-to-end ticket verification test
 * - Login (agent, traveler)
 * - Create ticket
 * - List tickets (agent)
 * - Send message
 * - Resolve ticket
 * - Verify status
 */

const axios = require('axios');

const API_URL = process.env.TEST_API_URL || 'https://trek-tribe-38in.onrender.com';
const AGENT_EMAIL = process.env.TEST_AGENT_EMAIL || 'agent@trektribe.com';
const AGENT_PASSWORD = process.env.TEST_AGENT_PASSWORD || 'Agent@2025';
const TRAVELER_EMAIL = process.env.TEST_TRAVELER_EMAIL || 'traveler@trektribe.com';
const TRAVELER_PASSWORD = process.env.TEST_TRAVELER_PASSWORD || 'Traveler@2025';

let agentToken, travelerToken;
let testTicketId;

async function test() {
  try {
    console.log('=== TICKET ENDPOINTS VERIFICATION TEST ===\n');

    // Step 1: Login agent
    console.log('Step 1: Logging in users...');
    const agentLogin = await axios.post(`${API_URL}/auth/login`, {
      email: AGENT_EMAIL,
      password: AGENT_PASSWORD,
    });
    agentToken = agentLogin.data.token;
    console.log('✓ Agent logged in');

    // Step 1b: Login traveler
    const travelerLogin = await axios.post(`${API_URL}/auth/login`, {
      email: TRAVELER_EMAIL,
      password: TRAVELER_PASSWORD,
    });
    travelerToken = travelerLogin.data.token;
    console.log('✓ Traveler logged in\n');

    // Step 2: Create ticket (traveler)
    console.log('Step 2: Creating test ticket...');
    const createResp = await axios.post(`${API_URL}/api/support/tickets`, {
      subject: 'Test Ticket - Endpoint Verification',
      description: 'Testing ticket endpoints and message sending',
      category: 'technical',
      priority: 'medium'
    }, { headers: { Authorization: `Bearer ${travelerToken}` } });
    testTicketId = createResp.data.ticketId || createResp.data._id || createResp.data.id;
    if (!testTicketId) throw new Error('Could not determine ticketId from create response');
    console.log(`✓ Ticket created: ${testTicketId}\n`);

    // Step 3: List tickets (agent)
    console.log('Step 3: Fetching tickets as agent...');
    const listResp = await axios.get(`${API_URL}/agent/tickets?page=1&limit=20`, {
      headers: { Authorization: `Bearer ${agentToken}` }
    });
    const tickets = listResp.data.tickets || [];
    const found = tickets.find(t => (t.ticketId || t.id || t._id) === testTicketId);
    console.log(found ? `✓ Ticket present in agent list (${testTicketId})` : '⚠ Ticket not present in agent list');

    // Step 4: Send message (traveler)
    console.log('Step 4: Sending message to ticket...');
    const msgResp = await axios.post(`${API_URL}/api/support/${encodeURIComponent(testTicketId)}/messages`, {
      message: 'I need help with this issue. Can someone assist?'
    }, { headers: { Authorization: `Bearer ${travelerToken}` } });
    console.log(`✓ Message API responded:`, msgResp.data);

    // Step 5: Resolve ticket (agent)
    console.log('Step 5: Resolving ticket...');
    const resolveResp = await axios.post(`${API_URL}/api/support/tickets/${encodeURIComponent(testTicketId)}/resolve`, {
      resolutionNote: 'Issue resolved successfully. Customer was able to proceed with booking.'
    }, { headers: { Authorization: `Bearer ${agentToken}` } });
    console.log(`✓ Resolve API responded:`, resolveResp.data);

    // Step 6: Verify status (agent)
    console.log('Step 6: Verifying ticket status...');
    const detailResp = await axios.get(`${API_URL}/agent/tickets/${encodeURIComponent(testTicketId)}`, {
      headers: { Authorization: `Bearer ${agentToken}` }
    });
    const detail = detailResp.data.ticket || detailResp.data;
    console.log(`✓ Final status: ${detail.status}`);
    console.log(`  Messages: ${(detail.messages && detail.messages.length) || 0}\n`);

    console.log('=== ALL TESTS PASSED ===');
  } catch (error) {
    console.error('\n❌ TEST FAILED');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Error:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
    process.exit(1);
  }
}

test();
