/**
 * Manual Email Testing Script
 * 
 * This script allows you to manually test email functionality
 * Run with: npm run ts-node test-email-manual.ts
 */

import dotenv from 'dotenv';
import { emailService } from './src/services/emailService';
import { User } from './src/models/User';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import readline from 'readline';

dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query: string): Promise<string> => {
  return new Promise(resolve => rl.question(query, resolve));
};

async function connectDB() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/trek-tribe-test';
  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB');
}

async function testEmailVerificationOTP(email: string) {
  console.log('\n📧 Testing Email Verification OTP...');
  
  const otp = String(crypto.randomInt(100000, 999999));
  
  const result = await emailService.sendEmailVerificationOTP({
    userName: 'Test User',
    userEmail: email,
    otp,
    expiresMinutes: 10
  });

  if (result) {
    console.log('✅ Email sent successfully!');
    console.log('🔢 OTP Code:', otp);
    console.log('📬 Check your email at:', email);
    return otp;
  } else {
    console.log('❌ Failed to send email');
    return null;
  }
}

async function testPasswordReset(email: string) {
  console.log('\n🔐 Testing Password Reset Email...');
  
  const resetToken = crypto.randomBytes(32).toString('hex');
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const resetUrl = `${baseUrl}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;
  
  const result = await emailService.sendPasswordResetEmail({
    userName: 'Test User',
    userEmail: email,
    resetToken,
    resetUrl
  });

  if (result) {
    console.log('✅ Password reset email sent successfully!');
    console.log('🔗 Reset URL:', resetUrl);
    console.log('📬 Check your email at:', email);
    return resetToken;
  } else {
    console.log('❌ Failed to send password reset email');
    return null;
  }
}

async function testBookingConfirmation(email: string) {
  console.log('\n🎫 Testing Booking Confirmation Email...');
  
  const result = await emailService.sendBookingConfirmation({
    userName: 'Test User',
    userEmail: email,
    tripName: 'Himalayan Adventure Trek',
    tripDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    bookingId: 'TEST-' + Date.now(),
    amount: 15000,
    organizerName: 'Adventure Tours',
    organizerEmail: 'organizer@example.com',
    organizerPhone: '+919876543210'
  });

  if (result) {
    console.log('✅ Booking confirmation email sent successfully!');
    console.log('📬 Check your email at:', email);
  } else {
    console.log('❌ Failed to send booking confirmation email');
  }
}

async function testEmailConnection() {
  console.log('\n🔌 Testing Email Service Connection...');
  
  const isConnected = await emailService.testConnection();
  
  if (isConnected) {
    console.log('✅ Email service is connected and ready');
  } else {
    console.log('❌ Email service connection failed');
  }
  
  return isConnected;
}

async function getEmailServiceStatus() {
  console.log('\n📊 Email Service Status:');
  
  const status = await emailService.getServiceStatus();
  
  console.log(JSON.stringify(status, null, 2));
}

async function fullRegistrationFlow(email: string) {
  console.log('\n🚀 Testing Full Registration Flow...');
  
  // Step 1: Create user
  console.log('\n1️⃣ Creating user account...');
  const passwordHash = await bcrypt.hash('TestPassword123!', 12);
  
  // Check if user already exists
  let user = await User.findOne({ email });
  if (user) {
    console.log('⚠️  User already exists, deleting...');
    await User.findByIdAndDelete(user._id);
  }
  
  user = await User.create({
    email,
    passwordHash,
    name: 'Test User',
    phone: '+919876543210',
    role: 'traveler',
    emailVerified: false,
    phoneVerified: true
  });
  
  console.log('✅ User created:', user._id);
  
  // Step 2: Generate and send OTP
  console.log('\n2️⃣ Generating and sending OTP...');
  const otp = String(crypto.randomInt(100000, 999999));
  const otpHash = await bcrypt.hash(otp, 12);
  
  user.emailVerificationOtpHash = otpHash;
  user.emailVerificationExpires = new Date(Date.now() + 10 * 60 * 1000);
  user.emailVerificationAttempts = 0;
  user.emailVerificationLastSentAt = new Date();
  await user.save();
  
  const emailSent = await emailService.sendEmailVerificationOTP({
    userName: user.name,
    userEmail: user.email,
    otp,
    expiresMinutes: 10
  });
  
  if (emailSent) {
    console.log('✅ OTP email sent successfully!');
    console.log('🔢 OTP Code:', otp);
    console.log('📬 Check your email at:', email);
    
    // Step 3: Wait for user to verify
    const enteredOtp = await question('\n3️⃣ Enter the OTP you received (or press Enter to use auto-OTP): ');
    const otpToVerify = enteredOtp.trim() || otp;
    
    // Step 4: Verify OTP
    console.log('\n4️⃣ Verifying OTP...');
    const isValid = await bcrypt.compare(otpToVerify, user.emailVerificationOtpHash!);
    
    if (isValid) {
      user.emailVerified = true;
      user.emailVerificationOtpHash = undefined;
      user.emailVerificationExpires = undefined;
      user.emailVerificationAttempts = 0;
      await user.save();
      
      console.log('✅ Email verified successfully!');
      console.log('✅ Registration flow completed!');
    } else {
      console.log('❌ Invalid OTP');
    }
  } else {
    console.log('❌ Failed to send OTP email');
  }
  
  // Cleanup
  console.log('\n🧹 Cleaning up test user...');
  await User.findByIdAndDelete(user._id);
  console.log('✅ Test user deleted');
}

async function fullPasswordResetFlow(email: string) {
  console.log('\n🔐 Testing Full Password Reset Flow...');
  
  // Step 1: Create or find user
  console.log('\n1️⃣ Setting up user account...');
  const passwordHash = await bcrypt.hash('OldPassword123!', 12);
  
  let user = await User.findOne({ email });
  if (user) {
    console.log('⚠️  User already exists, updating...');
    user.passwordHash = passwordHash;
    user.emailVerified = true;
    await user.save();
  } else {
    user = await User.create({
      email,
      passwordHash,
      name: 'Test User',
      phone: '+919876543210',
      role: 'traveler',
      emailVerified: true,
      phoneVerified: true
    });
  }
  
  console.log('✅ User ready:', user._id);
  
  // Step 2: Generate and send reset token
  console.log('\n2️⃣ Generating and sending password reset email...');
  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetTokenHash = await bcrypt.hash(resetToken, 12);
  const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  
  user.resetPasswordToken = resetTokenHash;
  user.resetPasswordExpires = resetTokenExpires;
  await user.save();
  
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const resetUrl = `${baseUrl}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;
  
  const emailSent = await emailService.sendPasswordResetEmail({
    userName: user.name,
    userEmail: user.email,
    resetToken,
    resetUrl
  });
  
  if (emailSent) {
    console.log('✅ Password reset email sent successfully!');
    console.log('🔗 Reset URL:', resetUrl);
    console.log('📬 Check your email at:', email);
    
    // Step 3: Simulate password reset
    const proceed = await question('\n3️⃣ Press Enter to simulate password reset...');
    
    // Step 4: Reset password
    console.log('\n4️⃣ Resetting password...');
    const newPasswordHash = await bcrypt.hash('NewPassword123!', 12);
    
    user.passwordHash = newPasswordHash;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();
    
    console.log('✅ Password reset successfully!');
    console.log('✅ Password reset flow completed!');
    
    // Step 5: Verify new password works
    console.log('\n5️⃣ Verifying new password...');
    const isValid = await bcrypt.compare('NewPassword123!', user.passwordHash);
    
    if (isValid) {
      console.log('✅ New password verified!');
    } else {
      console.log('❌ Password verification failed');
    }
  } else {
    console.log('❌ Failed to send password reset email');
  }
  
  // Cleanup
  console.log('\n🧹 Cleaning up test user...');
  await User.findByIdAndDelete(user._id);
  console.log('✅ Test user deleted');
}

async function main() {
  try {
    console.log('🚀 Trek Tribe Email Testing Tool\n');
    
    // Connect to database
    await connectDB();
    
    // Initialize email service
    console.log('📧 Initializing email service...');
    await emailService.initialize();
    console.log('✅ Email service initialized\n');
    
    // Get test email
    const defaultEmail = 'tanejs404@gmail.com';
    const email = await question(`Enter test email address (default: ${defaultEmail}): `);
    const testEmail = email.trim() || defaultEmail;
    
    console.log(`\n📬 Using email: ${testEmail}\n`);
    
    // Show menu
    while (true) {
      console.log('\n' + '='.repeat(50));
      console.log('📋 Test Menu:');
      console.log('='.repeat(50));
      console.log('1. Test Email Connection');
      console.log('2. Get Email Service Status');
      console.log('3. Send Email Verification OTP');
      console.log('4. Send Password Reset Email');
      console.log('5. Send Booking Confirmation Email');
      console.log('6. Full Registration Flow (with OTP verification)');
      console.log('7. Full Password Reset Flow');
      console.log('8. Run All Tests');
      console.log('0. Exit');
      console.log('='.repeat(50));
      
      const choice = await question('\nEnter your choice: ');
      
      switch (choice.trim()) {
        case '1':
          await testEmailConnection();
          break;
        case '2':
          await getEmailServiceStatus();
          break;
        case '3':
          await testEmailVerificationOTP(testEmail);
          break;
        case '4':
          await testPasswordReset(testEmail);
          break;
        case '5':
          await testBookingConfirmation(testEmail);
          break;
        case '6':
          await fullRegistrationFlow(testEmail);
          break;
        case '7':
          await fullPasswordResetFlow(testEmail);
          break;
        case '8':
          await testEmailConnection();
          await getEmailServiceStatus();
          await testEmailVerificationOTP(testEmail);
          await new Promise(resolve => setTimeout(resolve, 2000));
          await testPasswordReset(testEmail);
          await new Promise(resolve => setTimeout(resolve, 2000));
          await testBookingConfirmation(testEmail);
          break;
        case '0':
          console.log('\n👋 Goodbye!');
          rl.close();
          await mongoose.disconnect();
          process.exit(0);
        default:
          console.log('❌ Invalid choice');
      }
      
      await question('\nPress Enter to continue...');
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    rl.close();
    await mongoose.disconnect();
    process.exit(1);
  }
}

main();
