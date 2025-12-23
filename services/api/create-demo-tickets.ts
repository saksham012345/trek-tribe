/**
 * Create sample support tickets for "Buy Premium Organizer" for presentation
 * These tickets will be created and then an agent will solve them
 */

import axios from 'axios';

const API_URL = process.env.API_URL || 'http://localhost:5000/api';

interface TestUser {
  email: string;
  password: string;
  name: string;
}

const TRAVELER_USERS: TestUser[] = [
  { email: 'traveler1@demo.com', password: 'Traveler@123', name: 'Alice Johnson' },
  { email: 'traveler2@demo.com', password: 'Traveler@123', name: 'Bob Smith' },
  { email: 'traveler3@demo.com', password: 'Traveler@123', name: 'Carol White' },
];

const AGENT_USER: TestUser = {
  email: 'agent@trektribe.com',
  password: 'Agent@123456',
  name: 'Support Agent',
};

const PREMIUM_TICKET_TEMPLATES = [
  {
    subject: 'How to buy premium organizer subscription',
    description: 'I want to upgrade to premium organizer status. Can you guide me through the process? What are the benefits of premium organizer plan?',
    category: 'subscription',
    priority: 'medium',
  },
  {
    subject: 'Premium organizer pricing and features',
    description: 'I\'m interested in becoming a premium organizer. Can you send me details about pricing, payment options, and what features I get with premium?',
    category: 'subscription',
    priority: 'medium',
  },
  {
    subject: 'Buy premium organizer - payment issue',
    description: 'I tried to purchase the premium organizer plan but got an error during payment. I was charged but didn\'t receive confirmation. Can you help?',
    category: 'billing',
    priority: 'high',
  },
  {
    subject: 'Upgrade to premium - need clarification',
    description: 'What\'s the difference between regular and premium organizer? Is it worth upgrading? Can I cancel anytime?',
    category: 'subscription',
    priority: 'low',
  },
  {
    subject: 'Premium organizer annual subscription inquiry',
    description: 'Do you offer annual premium organizer plans? Are there discounts for longer commitments?',
    category: 'subscription',
    priority: 'low',
  },
];

async function createDemoTickets() {
  try {
    console.log('🎬 DEMO TICKET GENERATION & RESOLUTION\n');
    console.log('================================================\n');

    let agentToken = '';
    const travelerTokens: { [key: string]: string } = {};
    const createdTickets: any[] = [];

    // Step 1: Login Agent
    console.log('📝 Step 1: Authenticating Agent...');
    try {
      const agentLogin = await axios.post(`${API_URL}/auth/login`, {
        email: AGENT_USER.email,
        password: AGENT_USER.password,
      });
      agentToken = (agentLogin.data as any).token;
      console.log(`✅ Agent authenticated: ${AGENT_USER.email}\n`);
    } catch (error: any) {
      console.log(`⚠️ Agent login failed: ${error.response?.data?.error || error.message}`);
      console.log('Attempting to create agent account...\n');

      // Try to register agent if login fails
      try {
        const signupRes = await axios.post(`${API_URL}/auth/signup`, {
          name: AGENT_USER.name,
          email: AGENT_USER.email,
          password: AGENT_USER.password,
          phone: '9876543210',
          role: 'agent',
        });
        agentToken = (signupRes.data as any).token;
        console.log(`✅ Agent account created and authenticated\n`);
      } catch (signupError: any) {
        console.error('❌ Failed to create agent:', signupError.response?.data?.error || signupError.message);
        return;
      }
    }

    // Step 2: Login/Create Travelers
    console.log('👥 Step 2: Authenticating Travelers...');
    for (const traveler of TRAVELER_USERS) {
      try {
        const loginRes = await axios.post(`${API_URL}/auth/login`, {
          email: traveler.email,
          password: traveler.password,
        });
        travelerTokens[traveler.email] = (loginRes.data as any).token;
        console.log(`✅ ${traveler.name} authenticated`);
      } catch (error: any) {
        // Try to create traveler
        try {
          const signupRes = await axios.post(`${API_URL}/auth/signup`, {
            name: traveler.name,
            email: traveler.email,
            password: traveler.password,
            phone: '9876543210',
          });
          travelerTokens[traveler.email] = (signupRes.data as any).token;
          console.log(`✅ ${traveler.name} account created`);
        } catch (signupError: any) {
          console.log(`⚠️ Could not create ${traveler.name}: ${signupError.response?.data?.error || signupError.message}`);
        }
      }
    }
    console.log();

    // Step 3: Create Tickets
    console.log('🎫 Step 3: Creating Sample Tickets...');
    const travelerEmails = Object.keys(travelerTokens);

    for (let i = 0; i < Math.min(PREMIUM_TICKET_TEMPLATES.length, travelerEmails.length); i++) {
      const template = PREMIUM_TICKET_TEMPLATES[i];
      const travelerEmail = travelerEmails[i];
      const token = travelerTokens[travelerEmail];

      try {
        const ticketRes = await axios.post(
          `${API_URL}/support/tickets`,
          {
            subject: template.subject,
            description: template.description,
            category: template.category,
            priority: template.priority,
          },
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        const ticket = (ticketRes.data as any).ticket;
        createdTickets.push({
          ...ticket,
          travelerEmail,
          travelerName: TRAVELER_USERS.find(t => t.email === travelerEmail)?.name,
        });

        console.log(`✅ Ticket created - "${template.subject}"`);
        console.log(`   Ticket ID: ${ticket.ticketId}`);
        console.log(`   Priority: ${ticket.priority} | Category: ${ticket.category}\n`);
      } catch (error: any) {
        console.log(`⚠️ Failed to create ticket: ${error.response?.data?.error || error.message}\n`);
      }
    }

    if (createdTickets.length === 0) {
      console.log('❌ No tickets were created. Exiting.\n');
      return;
    }

    console.log(`📊 Total Tickets Created: ${createdTickets.length}\n`);
    console.log('================================================\n');

    // Step 4: Assign tickets to agent
    console.log('🔗 Step 4: Assigning Tickets to Agent...');
    for (const ticket of createdTickets) {
      try {
        await axios.post(
          `${API_URL}/agent/tickets/${ticket.ticketId}/assign`,
          {}, // The agent will auto-assign to themselves
          {
            headers: { Authorization: `Bearer ${agentToken}` },
          }
        );
        console.log(`✅ Ticket ${ticket.ticketId} assigned to agent`);
      } catch (error: any) {
        console.log(`⚠️ Could not assign ticket: ${error.response?.data?.error || error.message}`);
      }
    }
    console.log();

    // Step 5: Agent adds message and resolves
    console.log('💬 Step 5: Agent Resolving Tickets...');
    const resolutionMessages = [
      'Thank you for your interest in upgrading to Premium Organizer! I\'ve reviewed your inquiry and I\'m happy to help. Premium Organizer plans offer advanced analytics, priority customer support, and exclusive marketing tools. You can upgrade immediately in your account settings under "Subscription". Please let me know if you need any further assistance!',
      'Great question! Our Premium Organizer subscription includes: 1) Advanced trip analytics, 2) Unlimited group bookings, 3) Priority 24/7 support, 4) Custom branding options, 5) Commission discounts. You can subscribe monthly or annually. Annual plans come with 20% savings. Would you like me to send you a link to upgrade?',
      'I sincerely apologize for the payment issue. I can see the transaction in our system. Let me process a refund immediately and create a complimentary Premium upgrade for you for 3 months as compensation. You should see the refund within 2-3 business days. Thank you for your patience!',
      'Excellent question! Premium Organizer includes priority support, advanced booking management, real-time analytics dashboard, and the ability to manage multiple trips simultaneously. Most organizers see a 40% increase in bookings after upgrading. Yes, you can cancel anytime with no penalties. Would you like to try it for a month?',
      'Perfect timing for this question! We do offer annual Premium Organizer subscriptions with 20% discount compared to monthly payments. That\'s a savings of ₹2,000+ per year. You also get bonus features like API access and white-label options. Would you like me to set up an annual subscription for you?',
    ];

    for (let i = 0; i < createdTickets.length; i++) {
      const ticket = createdTickets[i];

      try {
        // Add agent message
        const messageRes = await axios.post(
          `${API_URL}/agent/tickets/${ticket.ticketId}/messages`,
          {
            message: resolutionMessages[i] || resolutionMessages[0],
          },
          {
            headers: { Authorization: `Bearer ${agentToken}` },
          }
        );

        console.log(`💬 Agent added resolution message to ${ticket.ticketId}`);

        // Resolve ticket
        const resolveRes = await axios.post(
          `${API_URL}/agent/tickets/${ticket.ticketId}/resolve`,
          {
            resolutionNote: 'Premium Organizer inquiry resolved - customer educated and offered upgrade',
          },
          {
            headers: { Authorization: `Bearer ${agentToken}` },
          }
        );

        console.log(`✅ Ticket ${ticket.ticketId} RESOLVED`);
        console.log(`   From: ${ticket.travelerName}`);
        console.log(`   Subject: "${ticket.subject}"\n`);
      } catch (error: any) {
        console.log(`⚠️ Failed to resolve ticket: ${error.response?.data?.error || error.message}\n`);
      }
    }

    console.log('================================================\n');
    console.log('✨ DEMO COMPLETE!\n');
    console.log('📊 Summary:');
    console.log(`   • Tickets Created: ${createdTickets.length}`);
    console.log(`   • Status: All resolved with helpful Premium Organizer information`);
    console.log(`   • Agent: ${AGENT_USER.name}\n`);
    console.log('Ready for presentation! 🎬\n');

  } catch (error: any) {
    console.error('Fatal error:', error.message);
    process.exit(1);
  }
}

// Run the script
createDemoTickets().catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
