/**
 * Create sample support tickets for "Buy Premium Organizer" for presentation
 * This script directly seeds the database with sample tickets
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

const TRAVELER_USERS = [
  { name: 'Alice Johnson', email: 'alice.johnson@demo.com', phone: '9876543210' },
  { name: 'Bob Smith', email: 'bob.smith@demo.com', phone: '9876543211' },
  { name: 'Carol White', email: 'carol.white@demo.com', phone: '9876543212' },
  { name: 'David Brown', email: 'david.brown@demo.com', phone: '9876543213' },
  { name: 'Eva Martinez', email: 'eva.martinez@demo.com', phone: '9876543214' },
];

const PREMIUM_TICKET_TEMPLATES = [
  {
    subject: 'How to buy premium organizer subscription',
    description: 'I want to upgrade to premium organizer status. Can you guide me through the process? What are the benefits of premium organizer plan?',
    category: 'payment',
    priority: 'medium',
    resolution: 'Thank you for your interest in upgrading to Premium Organizer! I\'ve reviewed your inquiry and I\'m happy to help. Premium Organizer plans offer advanced analytics, priority customer support, and exclusive marketing tools. You can upgrade immediately in your account settings under "Subscription". Please let me know if you need any further assistance!',
  },
  {
    subject: 'Premium organizer pricing and features',
    description: 'I\'m interested in becoming a premium organizer. Can you send me details about pricing, payment options, and what features I get with premium?',
    category: 'payment',
    priority: 'medium',
    resolution: 'Great question! Our Premium Organizer subscription includes: 1) Advanced trip analytics, 2) Unlimited group bookings, 3) Priority 24/7 support, 4) Custom branding options, 5) Commission discounts. You can subscribe monthly or annually. Annual plans come with 20% savings. Would you like me to send you a link to upgrade?',
  },
  {
    subject: 'Buy premium organizer - payment issue',
    description: 'I tried to purchase the premium organizer plan but got an error during payment. I was charged but didn\'t receive confirmation. Can you help?',
    category: 'payment',
    priority: 'high',
    resolution: 'I sincerely apologize for the payment issue. I can see the transaction in our system. Let me process a refund immediately and create a complimentary Premium upgrade for you for 3 months as compensation. You should see the refund within 2-3 business days. Thank you for your patience!',
  },
  {
    subject: 'Upgrade to premium - need clarification',
    description: 'What\'s the difference between regular and premium organizer? Is it worth upgrading? Can I cancel anytime?',
    category: 'general',
    priority: 'low',
    resolution: 'Excellent question! Premium Organizer includes priority support, advanced booking management, real-time analytics dashboard, and the ability to manage multiple trips simultaneously. Most organizers see a 40% increase in bookings after upgrading. Yes, you can cancel anytime with no penalties. Would you like to try it for a month?',
  },
  {
    subject: 'Premium organizer annual subscription inquiry',
    description: 'Do you offer annual premium organizer plans? Are there discounts for longer commitments?',
    category: 'general',
    priority: 'low',
    resolution: 'Perfect timing for this question! We do offer annual Premium Organizer subscriptions with 20% discount compared to monthly payments. That\'s a savings of ₹2,000+ per year. You also get bonus features like API access and white-label options. Would you like me to set up an annual subscription for you?',
  },
];

async function seedDemoTickets() {
  try {
    console.log('🎬 DEMO TICKET CREATION - DATABASE SEEDING\n');
    console.log('================================================\n');

    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log(`✅ Connected to ${MONGODB_URI}\n`);

    // Step 1: Create or fetch agent
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
      console.log(`✅ Agent exists: ${AGENT_USER.email}`);
    }
    console.log();

    // Step 2: Create or fetch travelers
    console.log('👥 Step 2: Setting up Travelers...');
    const travelers: any[] = [];
    
    for (const travelerData of TRAVELER_USERS) {
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

    // Step 3: Create tickets
    console.log('🎫 Step 3: Creating Sample Tickets...');
    let createdCount = 0;

    for (let i = 0; i < PREMIUM_TICKET_TEMPLATES.length && i < travelers.length; i++) {
      const template = PREMIUM_TICKET_TEMPLATES[i];
      const traveler = travelers[i];

      // Create the ticket
      const ticket = new SupportTicket({
        userId: traveler._id,
        customerName: traveler.name,
        customerEmail: traveler.email,
        customerPhone: traveler.phone,
        subject: template.subject,
        description: template.description,
        category: template.category,
        priority: template.priority,
        status: 'resolved', // Already resolved for presentation
        assignedAgentId: agent._id,
        messages: [
          {
            sender: 'customer',
            senderName: traveler.name,
            senderId: traveler._id,
            message: template.description,
            timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
          },
          {
            sender: 'agent',
            senderName: agent.name,
            senderId: agent._id,
            message: template.resolution,
            timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
          },
        ],
        internalNotes: ['Premium Organizer inquiry resolved - customer educated and offered upgrade'],
        resolvedAt: new Date(Date.now() - 30 * 60 * 1000), // Resolved 30 mins ago
      });

      await ticket.save();
      createdCount++;

      console.log(`✅ Ticket created & resolved`);
      console.log(`   ID: ${ticket.ticketId}`);
      console.log(`   From: ${traveler.name}`);
      console.log(`   Subject: "${template.subject}"`);
      console.log(`   Priority: ${template.priority}\n`);
    }

    console.log('================================================\n');
    console.log('✨ DEMO COMPLETE!\n');
    console.log('📊 Summary:');
    console.log(`   • Tickets Created: ${createdCount}`);
    console.log(`   • Status: All resolved with helpful Premium Organizer information`);
    console.log(`   • Agent: ${agent.name}`);
    console.log(`   • Categories: payment, general\n`);
    console.log('🎬 Ready for presentation!\n');

    // Display login credentials for demo
    console.log('📋 DEMO CREDENTIALS:\n');
    console.log('Agent:');
    console.log(`   Email: ${AGENT_USER.email}`);
    console.log(`   Password: ${AGENT_USER.password}\n`);
    console.log('Sample Travelers:');
    TRAVELER_USERS.forEach(t => {
      console.log(`   • ${t.name} (${t.email})`);
    });
    console.log(`   Password: Traveler@123\n`);

    await mongoose.disconnect();
    console.log('✅ Database connection closed\n');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

seedDemoTickets();
