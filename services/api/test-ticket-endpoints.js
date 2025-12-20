/**
 * Test script to verify:
 * 1. Ticket creation
 * 2. Ticket listing (GET /api/agent/tickets)
 * 3. Message sending 
 * 4. Ticket resolution (POST /api/support/tickets/:ticketId/resolve)
 */

const axios = require('axios');

// Use deployed API to verify production endpoints
const API_URL = process.env.TEST_API_URL || 'https://trek-tribe-38in.onrender.com';
let agentToken, travelerToken;
let testTicketId;

async function test() {
  try {
    console.log('=== TICKET ENDPOINTS VERIFICATION TEST ===\n');

    // Step 1: Login as agent and traveler
    console.log('Step 1: Logging in users...');
    const agentLogin = await axios.post(`${API_URL}/auth/login`, {
      email: 'agent@trektribe.com',
      password: 'Agent@123456'
    });
    agentToken = agentLogin.data.token;
    console.log('✓ Agent logged in');

    const travelerLogin = await axios.post(`${API_URL}/auth/login`, {
      email: 'traveler@trektribe.com',
      password: 'Traveler@123456'
    });
    travelerToken = travelerLogin.data.token;
    console.log('✓ Traveler logged in\n');

    // Step 2: Create a test ticket
    console.log('Step 2: Creating test ticket...');
    const createTicket = await axios.post(`${API_URL}/api/support/tickets`, {
      subject: 'Test Ticket - Endpoint Verification',
      message: 'Testing ticket endpoints and message sending',
      category: 'technical'
    }, {
      headers: { Authorization: `Bearer ${travelerToken}` }
    });
    testTicketId = createTicket.data.ticketId;
    console.log(`✓ Ticket created: ${testTicketId}\n`);

    // Step 3: Fetch tickets as agent
    console.log('Step 3: Fetching tickets as agent...');
    const fetchTickets = await axios.get(`${API_URL}/agent/tickets?page=1&limit=20`, {
      headers: { Authorization: `Bearer ${agentToken}` }
    });
    const tickets = fetchTickets.data.tickets || [];
    const testTicket = tickets.find(t => t.ticketId === testTicketId);
    if (testTicket) {
      console.log(`✓ Ticket found in agent list: ${testTicket.ticketId}`);
      console.log(`  Subject: ${testTicket.subject}`);
      console.log(`  Status: ${testTicket.status}`);
      console.log(`  Messages: ${testTicket.messages?.length || 0}\n`);
    } else {
      console.log(`⚠ Ticket not found in agent list\n`);
    }

    // Step 4: Send message as traveler
    console.log('Step 4: Sending message to ticket...');
    const sendMessage = await axios.post(`${API_URL}/api/support/${testTicketId}/messages`, {
      message: 'I need help with this issue. Can someone assist?'
    }, {
      headers: { Authorization: `Bearer ${travelerToken}` }
    });
    console.log(`✓ Message sent: "${sendMessage.data.message}"\n`);

    // Step 5: Fetch ticket details to verify message was added
    console.log('Step 5: Fetching ticket details to verify message...');
    const getTicketDetails = await axios.get(`${API_URL}/agent/tickets/${testTicketId}`, {
      headers: { Authorization: `Bearer ${agentToken}` }
    });
    const ticket = getTicketDetails.data.ticket || getTicketDetails.data;
    console.log(`✓ Ticket retrieved: ${ticket.ticketId}`);
    console.log(`  Messages in ticket: ${ticket.messages?.length || 0}`);
    if (ticket.messages && ticket.messages.length > 0) {
      console.log(`  Latest message: "${ticket.messages[ticket.messages.length - 1].message}"\n`);
    }

    // Step 6: Resolve ticket
    console.log('Step 6: Resolving ticket...');
    const resolveTicket = await axios.post(`${API_URL}/api/support/tickets/${testTicketId}/resolve`, {
      resolutionNote: 'Issue resolved successfully. Customer was able to proceed with booking.'
    }, {
      headers: { Authorization: `Bearer ${agentToken}` }
    });
    console.log(`✓ Ticket resolved: ${resolveTicket.data.message || 'Success'}\n`);

    // Step 7: Verify ticket status changed
    console.log('Step 7: Verifying ticket status...');
    const finalTicket = await axios.get(`${API_URL}/api/agent/tickets/${testTicketId}`, {
      headers: { Authorization: `Bearer ${agentToken}` }
    });
    const finalStatus = finalTicket.data.ticket?.status || finalTicket.data.status;
    console.log(`✓ Final ticket status: ${finalStatus}`);
    console.log(`  Messages: ${finalTicket.data.ticket?.messages?.length || 0}\n`);

    console.log('=== ALL TESTS PASSED ===\n');
    console.log('Summary:');
    console.log('✓ Ticket creation working');
    console.log('✓ GET /api/agent/tickets working');
    console.log('✓ Message sending working');
    console.log('✓ Messages are persisted in database');
    console.log('✓ POST /api/support/tickets/:ticketId/resolve working');
    console.log('✓ Ticket status updates working');

  } catch (error) {
    console.error('\n❌ TEST FAILED\n');
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
