/**
 * Create unsolved support tickets for live demonstration during presentation
 * These tickets will be open and waiting for agent resolution
 */

import mongoose from 'mongoose';
import { SupportTicket } from './src/models/SupportTicket';
import { User } from './src/models/User';
import dotenv from 'dotenv';
import bcryptjs from 'bcryptjs';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/trek-tribe';

const AGENT_USER = {
  name: 'Support Agent',
  email: 'agent@trektribe.com',
  password: 'Agent@123456',
};

const LIVE_DEMO_TRAVELERS = [
  { name: 'Priya Sharma', email: 'priya.sharma@demo.com', phone: '9876543220' },
  { name: 'Vikram Kumar', email: 'vikram.kumar@demo.com', phone: '9876543221' },
  { name: 'Neha Patel', email: 'neha.patel@demo.com', phone: '9876543222' },
];

const UNSOLVED_TICKET_TEMPLATES = [
  {
    subject: 'Issue with Premium Organizer billing - urgent help needed!',
    description: 'I upgraded to premium organizer last week but I\'m seeing duplicate charges on my account. I was billed twice for the same month. Please help me resolve this ASAP as I\'m worried about my account security.',
    category: 'payment',
    priority: 'high',
    hint: '⚠️ HIGH PRIORITY - Customer billed twice, needs immediate attention and refund'
  },
  {
    subject: 'Can\'t access premium features after upgrade',
    description: 'I successfully paid for premium organizer upgrade yesterday but I still don\'t see the premium features enabled in my account. I can\'t access analytics or advanced booking tools. What\'s going on?',
    category: 'technical',
    priority: 'high',
    hint: '⚠️ HIGH PRIORITY - Features not activated despite payment, technical issue'
  },
  {
    subject: 'How do I cancel my Premium subscription?',
    description: 'I bought the premium organizer plan but I\'m not sure if it\'s the right fit for me right now. I want to know how to cancel it and if I can get a refund since I purchased it just 2 days ago. What\'s your cancellation policy?',
    category: 'payment',
    priority: 'medium',
    hint: '📋 MEDIUM PRIORITY - Customer wants cancellation info and refund eligibility'
  },
];

async function seedUnsolvedTicketsForLiveDemo() {
  try {
    console.log('🎬 LIVE DEMO UNSOLVED TICKETS CREATION\n');
    console.log('================================================\n');

    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log(`✅ Connected to MongoDB\n`);

    // Step 1: Get or create agent
    console.log('👤 Step 1: Setting up Agent...');
    let agent = await User.findOne({ email: AGENT_USER.email });
    
    if (!agent) {
      const hashedPassword = await bcryptjs.hash(AGENT_USER.password, 10);
      agent = new User({
        name: AGENT_USER.name,
        email: AGENT_USER.email,
        passwordHash: hashedPassword,
        phone: '9876543200',
        role: 'agent',
        verified: true,
      });
      await agent.save();
      console.log(`✅ Agent created: ${AGENT_USER.email}`);
    } else {
      console.log(`✅ Agent found: ${AGENT_USER.email}`);
    }
    console.log();

    // Step 2: Create demo travelers
    console.log('👥 Step 2: Setting up Live Demo Travelers...');
    const travelers: any[] = [];
    
    for (const travelerData of LIVE_DEMO_TRAVELERS) {
      let traveler = await User.findOne({ email: travelerData.email });
      
      if (!traveler) {
        const hashedPassword = await bcryptjs.hash('Traveler@123', 10);
        traveler = new User({
          name: travelerData.name,
          email: travelerData.email,
          passwordHash: hashedPassword,
          phone: travelerData.phone,
          role: 'traveler',
          verified: true,
        });
        await traveler.save();
        console.log(`✅ Traveler created: ${travelerData.name}`);
      } else {
        console.log(`✅ Traveler exists: ${travelerData.name}`);
      }
      
      travelers.push(traveler);
    }
    console.log();

    // Step 3: Create UNSOLVED tickets
    console.log('🎫 Step 3: Creating UNSOLVED Tickets (Ready for Live Demo)...');
    let createdCount = 0;

    for (let i = 0; i < UNSOLVED_TICKET_TEMPLATES.length && i < travelers.length; i++) {
      const template = UNSOLVED_TICKET_TEMPLATES[i];
      const traveler = travelers[i];

      // Create the UNSOLVED ticket
      const ticket = new SupportTicket({
        userId: traveler._id,
        customerName: traveler.name,
        customerEmail: traveler.email,
        customerPhone: traveler.phone,
        subject: template.subject,
        description: template.description,
        category: template.category,
        priority: template.priority,
        status: 'open', // OPEN - NOT RESOLVED!
        assignedAgentId: null, // Not assigned yet
        messages: [
          {
            sender: 'customer',
            senderName: traveler.name,
            senderId: traveler._id,
            message: template.description,
            timestamp: new Date(Date.now() - 30 * 60 * 1000), // 30 mins ago
          },
        ],
        tags: ['premium-organizer', 'needs-attention'],
      });

      await ticket.save();
      createdCount++;

      console.log(`✅ Unsolved ticket created`);
      console.log(`   🎫 ID: ${ticket.ticketId}`);
      console.log(`   👤 From: ${traveler.name}`);
      console.log(`   📌 Subject: "${template.subject}"`);
      console.log(`   🚨 Priority: ${template.priority.toUpperCase()}`);
      console.log(`   💡 Hint: ${template.hint}\n`);
    }

    console.log('================================================\n');
    console.log('✨ LIVE DEMO SETUP COMPLETE!\n');
    console.log('📊 Unsolved Tickets Summary:');
    console.log(`   • Tickets Created: ${createdCount}`);
    console.log(`   • Status: All OPEN (ready to be solved live!)`);
    console.log(`   • Assignment: Unassigned (you assign during demo)`);
    console.log(`   • Priorities: 2 High, 1 Medium\n`);

    console.log('🎯 LIVE DEMO WORKFLOW:');
    console.log('   1. Log in as agent');
    console.log('   2. View unassigned tickets in dashboard');
    console.log('   3. Click first ticket (HIGH PRIORITY - billing issue)');
    console.log('   4. Assign it to yourself');
    console.log('   5. Add a helpful message addressing the issue');
    console.log('   6. Resolve the ticket');
    console.log('   7. Repeat for other tickets\n');

    console.log('📋 DEMO CREDENTIALS:\n');
    console.log('Agent Account:');
    console.log(`   Email: ${AGENT_USER.email}`);
    console.log(`   Password: ${AGENT_USER.password}\n`);
    console.log('Live Demo Travelers:');
    LIVE_DEMO_TRAVELERS.forEach(t => {
      console.log(`   • ${t.name} (${t.email})`);
    });
    console.log(`   Password: Traveler@123 (all travelers)\n`);

    console.log('================================================');
    console.log('🎬 Ready for live presentation!\n');

    await mongoose.disconnect();
    console.log('✅ Database connection closed\n');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

seedUnsolvedTicketsForLiveDemo();
