/**
 * Generate QR Code for Organizer using Razorpay
 * This script creates a route account and generates a QR code for an organizer
 */

import dotenv from 'dotenv';
import path from 'path';
import mongoose from 'mongoose';
import QRCode from 'qrcode';
import fs from 'fs';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/trekk-tribe';
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

async function generateOrganizerQR() {
  try {
    console.log('🚀 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      throw new Error('Razorpay credentials not found in .env file');
    }

    console.log('\n📋 Razorpay Configuration:');
    console.log(`Key ID: ${RAZORPAY_KEY_ID}`);
    console.log(`Key Secret: ${RAZORPAY_KEY_SECRET.substring(0, 10)}...`);

    // Import models after connection
    const { User } = await import('../models/User');
    const { OrganizerPayoutConfig } = await import('../models/OrganizerPayoutConfig');

    // Find premium organizer
    const organizer = await User.findOne({ 
      email: 'organizer.premium@trektribe.com',
      role: 'organizer'
    });

    if (!organizer) {
      console.error('❌ Premium organizer not found. Run setup-demo-database.ts first.');
      return;
    }

    console.log(`\n✅ Found organizer: ${organizer.name} (${organizer.email})`);

    // Check if route already exists
    let payoutConfig = await OrganizerPayoutConfig.findOne({ organizerId: organizer._id });

    if (payoutConfig && payoutConfig.razorpayAccountId) {
      console.log(`\n✅ Existing Route Account Found:`);
      console.log(`Account ID: ${payoutConfig.razorpayAccountId}`);
      console.log(`Status: ${payoutConfig.onboardingStatus}`);
    } else {
      console.log('\n⚠️  No route account exists yet.');
      console.log('To create a route account, the organizer needs to:');
      console.log('1. Login as: organizer.premium@trektribe.com');
      console.log('2. Navigate to: /organizer/route-onboarding');
      console.log('3. Complete the onboarding form with:');
      console.log('   - Legal Business Name');
      console.log('   - PAN Number');
      console.log('   - Bank Account Details');
      console.log('   - Address');
    }

    // Generate sample UPI QR code for testing
    console.log('\n📱 Generating Sample UPI QR Code...');
    
    const upiId = `razorpay.test@hdfcbank`; // Test UPI ID
    const merchantName = organizer.name || 'TrekTribe Organizer';
    const amount = ''; // Empty for flexible amount
    
    // UPI QR code format
    const upiString = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(merchantName)}&am=${amount}&cu=INR`;
    
    const qrCodePath = path.resolve(__dirname, '../../uploads/qr-codes');
    if (!fs.existsSync(qrCodePath)) {
      fs.mkdirSync(qrCodePath, { recursive: true });
    }
    
    const qrFileName = `organizer-${organizer._id}-test-qr.png`;
    const qrFilePath = path.join(qrCodePath, qrFileName);
    
    await QRCode.toFile(qrFilePath, upiString, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    console.log(`\n✅ Sample QR Code Generated:`);
    console.log(`Path: ${qrFilePath}`);
    console.log(`UPI ID: ${upiId}`);
    console.log(`Merchant: ${merchantName}`);

    // Save QR to organizer profile
    if (!organizer.organizerProfile) {
      organizer.organizerProfile = {};
    }
    if (!organizer.organizerProfile.qrCodes) {
      organizer.organizerProfile.qrCodes = [];
    }

    organizer.organizerProfile.qrCodes.push({
      filename: qrFileName,
      originalName: qrFileName,
      path: `uploads/qr-codes/${qrFileName}`,
      paymentMethod: 'upi',
      description: `UPI Payment QR - ${upiId}`,
      uploadedAt: new Date(),
      isActive: true
    });

    await organizer.save();
    console.log(`\n✅ QR Code saved to organizer profile`);

    console.log('\n' + '='.repeat(60));
    console.log('✅ QR CODE GENERATION COMPLETE');
    console.log('='.repeat(60));
    console.log('\n📋 How Razorpay Routes Work:');
    console.log('─'.repeat(60));
    console.log('1. CREATE ROUTE ACCOUNT');
    console.log('   ├─ POST /api/marketplace/organizer/onboard');
    console.log('   ├─ Razorpay creates submerchant account');
    console.log('   └─ Returns: accountId, kycStatus');
    console.log('');
    console.log('2. RAZORPAY GENERATES QR CODE');
    console.log('   ├─ Razorpay API: POST /v1/accounts/{accountId}/qr_codes');
    console.log('   ├─ QR code linked to route account');
    console.log('   └─ Returns: qrCodeId, qrCodeUrl');
    console.log('');
    console.log('3. CUSTOMER SCANS & PAYS');
    console.log('   ├─ Customer scans QR → UPI payment');
    console.log('   ├─ Money goes to route account');
    console.log('   └─ Webhook: payment.captured');
    console.log('');
    console.log('4. AUTOMATIC SETTLEMENT');
    console.log('   ├─ Platform commission (5%) → Your account');
    console.log('   ├─ Organizer payout (95%) → Organizer bank');
    console.log('   └─ Settlement cycle: Daily/Weekly');
    console.log('');
    console.log('📌 API Endpoints Involved:');
    console.log('─'.repeat(60));
    console.log('• Create Route: POST /v1/accounts (type: route)');
    console.log('• Generate QR: POST /v1/accounts/{id}/qr_codes');
    console.log('• Get Status: GET /v1/accounts/{id}');
    console.log('• Transfers: POST /v1/transfers');
    console.log('');
    console.log('🔐 Razorpay Dashboard:');
    console.log('https://dashboard.razorpay.com/app/routes');
    console.log('');

    await mongoose.connection.close();
    console.log('✅ Database connection closed');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Run the script
generateOrganizerQR().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
