import request from 'supertest';
import { app } from '../index';
import { User } from '../models/User';
import { emailService } from '../services/emailService';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

describe('Email and OTP Integration Tests', () => {
  const testEmail = 'tanejs404@gmail.com';
  let testUserId: string;
  let testOtp: string;
  let resetToken: string;

  beforeAll(async () => {
    // Ensure email service is initialized
    await emailService.initialize();
  });

  afterEach(async () => {
    // Clean up test user after each test
    if (testUserId) {
      await User.findByIdAndDelete(testUserId);
      testUserId = '';
    }
  });

  describe('User Registration with Email OTP', () => {
    it('should register a new user and send OTP email', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          email: testEmail,
          password: 'TestPassword123!',
          name: 'Test User',
          phone: '+919876543210',
          role: 'traveler'
        });

      console.log('\n📧 Registration Response:', JSON.stringify(response.body, null, 2));

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.requiresVerification).toBe(true);
      expect(response.body.email).toBe(testEmail);

      testUserId = response.body.userId;

      // In development mode, OTP is returned in response
      if (process.env.NODE_ENV === 'development' && response.body.otp) {
        testOtp = response.body.otp;
        console.log('✅ OTP received in response:', testOtp);
      }

      console.log('\n⏳ Please check your email at:', testEmail);
      console.log('📬 You should receive an OTP verification email');
      console.log('🔢 OTP Code:', testOtp || 'Check your email');
    });
  });

  describe('Email OTP Verification', () => {
    beforeEach(async () => {
      // Register a user first
      const response = await request(app)
        .post('/auth/register')
        .send({
          email: testEmail,
          password: 'TestPassword123!',
          name: 'Test User',
          phone: '+919876543210',
          role: 'traveler'
        });

      testUserId = response.body.userId;
      testOtp = response.body.otp; // Available in dev mode
    });

    it('should verify email with correct OTP', async () => {
      if (!testOtp) {
        console.log('\n⚠️  OTP not available in response. Please enter OTP manually:');
        // In production, you would need to manually enter the OTP
        return;
      }

      const response = await request(app)
        .post('/auth/verify-registration-email')
        .send({
          userId: testUserId,
          email: testEmail,
          otp: testOtp
        });

      console.log('\n✅ Verification Response:', JSON.stringify(response.body, null, 2));

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('verified successfully');

      // Verify user is marked as verified in database
      const user = await User.findById(testUserId);
      expect(user?.emailVerified).toBe(true);
    });

    it('should reject invalid OTP', async () => {
      const response = await request(app)
        .post('/auth/verify-registration-email')
        .send({
          userId: testUserId,
          email: testEmail,
          otp: '000000' // Invalid OTP
        });

      console.log('\n❌ Invalid OTP Response:', JSON.stringify(response.body, null, 2));

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid code');
    });

    it('should reject expired OTP', async () => {
      // Manually expire the OTP
      const user = await User.findById(testUserId);
      if (user) {
        user.emailVerificationExpires = new Date(Date.now() - 1000); // Expired 1 second ago
        await user.save();
      }

      const response = await request(app)
        .post('/auth/verify-registration-email')
        .send({
          userId: testUserId,
          email: testEmail,
          otp: testOtp
        });

      console.log('\n⏰ Expired OTP Response:', JSON.stringify(response.body, null, 2));

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('expired');
    });
  });

  describe('Resend OTP', () => {
    beforeEach(async () => {
      // Register a user first
      const response = await request(app)
        .post('/auth/register')
        .send({
          email: testEmail,
          password: 'TestPassword123!',
          name: 'Test User',
          phone: '+919876543210',
          role: 'traveler'
        });

      testUserId = response.body.userId;
    });

    it('should resend OTP successfully', async () => {
      // Wait 1 second to avoid throttling
      await new Promise(resolve => setTimeout(resolve, 1100));

      const response = await request(app)
        .post('/auth/resend-registration-otp')
        .send({
          userId: testUserId,
          email: testEmail
        });

      console.log('\n📨 Resend OTP Response:', JSON.stringify(response.body, null, 2));

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('sent');

      if (response.body.otp) {
        testOtp = response.body.otp;
        console.log('🔢 New OTP:', testOtp);
      }

      console.log('\n⏳ Please check your email again at:', testEmail);
    });

    it('should throttle rapid resend requests', async () => {
      const response = await request(app)
        .post('/auth/resend-registration-otp')
        .send({
          userId: testUserId,
          email: testEmail
        });

      console.log('\n⏱️  Throttle Response:', JSON.stringify(response.body, null, 2));

      expect(response.status).toBe(429);
      expect(response.body.error).toContain('wait');
    });
  });

  describe('Password Reset Flow', () => {
    beforeEach(async () => {
      // Create a verified user
      const passwordHash = await bcrypt.hash('TestPassword123!', 12);
      const user = await User.create({
        email: testEmail,
        passwordHash,
        name: 'Test User',
        phone: '+919876543210',
        role: 'traveler',
        emailVerified: true,
        phoneVerified: true
      });
      testUserId = user._id.toString();
    });

    it('should send password reset email', async () => {
      const response = await request(app)
        .post('/auth/forgot-password')
        .send({
          email: testEmail
        });

      console.log('\n🔐 Password Reset Request Response:', JSON.stringify(response.body, null, 2));

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('reset link');

      console.log('\n⏳ Please check your email at:', testEmail);
      console.log('📬 You should receive a password reset email');

      // Get the reset token from database for testing
      const user = await User.findById(testUserId);
      if (user?.resetPasswordToken) {
        console.log('✅ Reset token stored in database');
      }
    });

    it('should reset password with valid token', async () => {
      // First, request password reset
      await request(app)
        .post('/auth/forgot-password')
        .send({
          email: testEmail
        });

      // Generate a test reset token
      resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenHash = await bcrypt.hash(resetToken, 12);
      const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Update user with reset token
      await User.findByIdAndUpdate(testUserId, {
        resetPasswordToken: resetTokenHash,
        resetPasswordExpires: resetTokenExpires
      });

      // Now reset the password
      const response = await request(app)
        .post('/auth/reset-password')
        .send({
          email: testEmail,
          token: resetToken,
          newPassword: 'NewPassword123!'
        });

      console.log('\n✅ Password Reset Response:', JSON.stringify(response.body, null, 2));

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('successful');

      // Verify user can login with new password
      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          email: testEmail,
          password: 'NewPassword123!'
        });

      expect(loginResponse.status).toBe(200);
      console.log('✅ Login successful with new password');
    });

    it('should reject invalid reset token', async () => {
      const response = await request(app)
        .post('/auth/reset-password')
        .send({
          email: testEmail,
          token: 'invalid-token',
          newPassword: 'NewPassword123!'
        });

      console.log('\n❌ Invalid Token Response:', JSON.stringify(response.body, null, 2));

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid or expired');
    });
  });

  describe('Email Service Status', () => {
    it('should check email service status', async () => {
      const status = await emailService.getServiceStatus();

      console.log('\n📊 Email Service Status:', JSON.stringify(status, null, 2));

      expect(status.isReady).toBeDefined();
      expect(status.config).toBeDefined();
    });

    it('should test email connection', async () => {
      const isConnected = await emailService.testConnection();

      console.log('\n🔌 Email Connection Test:', isConnected ? '✅ Connected' : '❌ Failed');

      expect(typeof isConnected).toBe('boolean');
    });
  });

  describe('Login with Email Verification Check', () => {
    it('should allow login for verified user', async () => {
      // Create a verified user
      const passwordHash = await bcrypt.hash('TestPassword123!', 12);
      const user = await User.create({
        email: testEmail,
        passwordHash,
        name: 'Test User',
        phone: '+919876543210',
        role: 'traveler',
        emailVerified: true,
        phoneVerified: true
      });
      testUserId = user._id.toString();

      const response = await request(app)
        .post('/auth/login')
        .send({
          email: testEmail,
          password: 'TestPassword123!'
        });

      console.log('\n✅ Login Response:', JSON.stringify(response.body, null, 2));

      expect(response.status).toBe(200);
      expect(response.body.user).toBeDefined();
      expect(response.body.token).toBeDefined();
      expect(response.body.requiresVerification).toBe(false);
    });

    it('should allow login but flag unverified user', async () => {
      // Create an unverified user
      const passwordHash = await bcrypt.hash('TestPassword123!', 12);
      const user = await User.create({
        email: testEmail,
        passwordHash,
        name: 'Test User',
        phone: '+919876543210',
        role: 'traveler',
        emailVerified: false,
        phoneVerified: true
      });
      testUserId = user._id.toString();

      const response = await request(app)
        .post('/auth/login')
        .send({
          email: testEmail,
          password: 'TestPassword123!'
        });

      console.log('\n⚠️  Unverified User Login Response:', JSON.stringify(response.body, null, 2));

      expect(response.status).toBe(200);
      expect(response.body.requiresVerification).toBe(true);
    });
  });
});
