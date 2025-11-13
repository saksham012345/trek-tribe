import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { authenticateJwt, requireRole } from '../middleware/auth';
import { emailService } from '../services/emailService';
import { logger } from '../utils/logger';
import crypto from 'crypto';
import axios from 'axios';
import { OAuth2Client } from 'google-auth-library';
import { smsService } from '../services/smsService';

const router = Router();

// Google OAuth client setup
const googleClientIds = (process.env.GOOGLE_CLIENT_IDS || process.env.GOOGLE_CLIENT_ID || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const googleClient = new OAuth2Client();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  phone: z.string().regex(/^[+]?[1-9]\d{1,14}$/), // Phone is now MANDATORY
  role: z.enum(['traveler', 'organizer']).optional(),
});

router.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { email, password, name, phone, role } = parsed.data;

  const existing = await User.findOne({ email });
  if (existing) return res.status(409).json({ error: 'Email already in use' });

  // Check if phone already in use (only if phone is provided)
  if (phone) {
    const existingPhone = await User.findOne({ phone });
    if (existingPhone) return res.status(409).json({ error: 'Phone number already in use' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ email, passwordHash, name, phone, role: role ?? 'traveler' });

  // Generate and store 10-minute OTP for email verification
  const otp = String(crypto.randomInt(100000, 999999));
  const otpHash = await bcrypt.hash(otp, 10);
  user.emailVerificationOtpHash = otpHash;
  user.emailVerificationExpires = new Date(Date.now() + 10 * 60 * 1000);
  user.emailVerificationAttempts = 0;
  user.emailVerificationLastSentAt = new Date();
  await user.save();

  // Send verification code via Email
  try {
    await emailService.sendEmailVerificationOTP({
      userName: user.name,
      userEmail: user.email,
      otp,
      expiresMinutes: 10
    });
    
    logger.info('Registration email OTP sent', { email, userId: user._id });

    // Do not issue login token until email verified
    return res.status(201).json({ 
      message: 'Registered successfully. Verification code sent to your email.',
      requiresVerification: true,
      userId: user._id,
      email: user.email,
      // In dev mode, return OTP for testing
      ...(process.env.NODE_ENV === 'development' && { otp })
    });
  } catch (error: any) {
    logger.error('Failed to send registration OTP', { email, error: error.message });
    // Still return success but inform about email failure
    return res.status(201).json({ 
      message: 'Registered successfully, but failed to send verification code. Please request a new code.',
      requiresVerification: true,
      userId: user._id,
      email: user.email,
      // In dev mode, return OTP
      ...(process.env.NODE_ENV === 'development' && { otp })
    });
  }
});

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(6) });

router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { email, password } = parsed.data;
  const user = await User.findOne({ email });
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  // Admin and agent users don't require email verification
  if (!user.emailVerified && user.role !== 'admin' && user.role !== 'agent') {
    return res.status(403).json({ error: 'Email not verified. Please verify your email address with the code sent to your email.' });
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  const token = jwt.sign({ userId: String(user._id), role: user.role }, jwtSecret, { expiresIn: '7d' });
  
  // Update last active timestamp
  user.lastActive = new Date();
  
  // Track first login for organizers and initialize auto-pay setup
  if (user.role === 'organizer' && !user.firstOrganizerLogin) {
    user.firstOrganizerLogin = new Date();
    
    // Initialize auto-pay setup for organizer
    if (!user.organizerProfile) {
      user.organizerProfile = {};
    }
    
    const scheduledPaymentDate = new Date();
    scheduledPaymentDate.setDate(scheduledPaymentDate.getDate() + 60); // 60 days from first login
    
    user.organizerProfile.autoPay = {
      isSetupRequired: true,
      isSetupCompleted: false,
      firstLoginDate: new Date(),
      scheduledPaymentDate: scheduledPaymentDate,
      paymentAmount: 149900, // Default: ₹1499 in paise
      autoPayEnabled: false
    };
    
    logger.info('First organizer login tracked, auto-pay scheduled', { 
      userId: user._id, 
      scheduledDate: scheduledPaymentDate 
    });
  }
  
  await user.save();
  
  return res.json({ 
    token,
    user: {
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt
    }
  });
});

// Google OAuth login schema
const googleLoginSchema = z.object({
  credential: z.string(), // Google ID token
});

// Google OAuth login route
router.post('/google', async (req, res) => {
  try {
    const parsed = googleLoginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const { credential } = parsed.data;

    if (!googleClientIds.length) {
      logger.error('GOOGLE_CLIENT_ID(S) not configured on server');
      return res.status(500).json({ error: 'Google login is not configured' });
    }

    // Verify Google ID token using Google's public keys
    let payload: any;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: googleClientIds,
      });
      payload = ticket.getPayload();
      if (!payload) throw new Error('Empty token payload');
    } catch (error: any) {
      logger.error('Google ID token verification failed', { error: error.message });
      return res.status(401).json({ error: 'Invalid Google token' });
    }

    // Additional claim checks (defense-in-depth)
    const iss = payload.iss as string;
    const emailVerified = !!payload.email_verified;
    if (!(iss === 'accounts.google.com' || iss === 'https://accounts.google.com')) {
      return res.status(401).json({ error: 'Invalid token issuer' });
    }
    if (!emailVerified) {
      return res.status(400).json({ error: 'Google email not verified' });
    }

    // Extract user information
    const email = payload.email as string | undefined;
    const name = (payload.name as string | undefined) || (email ? email.split('@')[0] : undefined);
    const picture = payload.picture as string | undefined;
    const googleId = payload.sub as string | undefined;
    
    if (!email) {
      return res.status(400).json({ error: 'Email not provided by Google' });
    }

    if (!email) {
      return res.status(400).json({ error: 'Email not provided by Google' });
    }

    // Check if user exists
    let user = await User.findOne({ email });

    if (user) {
      // Update user's Google info if needed
      if (!user.profilePhoto && picture) {
        user.profilePhoto = picture;
        await user.save();
      }
      user.lastActive = new Date();
      user.emailVerified = true; // treat Google accounts as verified
      await user.save();
    } else {
      // Create new user with Google information
      // Generate a random password hash (won't be used but required by schema)
      const dummyPasswordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
      
      user = await User.create({
        email,
        name: name || email.split('@')[0],
        passwordHash: dummyPasswordHash,
        role: 'traveler',
        profilePhoto: picture,
        isVerified: true, // Google accounts are pre-verified
        emailVerified: true,
        lastActive: new Date()
      });

      logger.info('New user created via Google OAuth', { email, name });
    }

    // Generate JWT token
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET environment variable is required');
    }

    const token = jwt.sign(
      { userId: String(user._id), role: user.role },
      jwtSecret,
      { expiresIn: '7d' }
    );

    // Check if profile is incomplete
    const isNewUser = !user.phone;
    const needsRoleSelection = user.role === 'traveler' && !user.phone; // New Google users need role selection
    
    // For organizers via Google auth, they MUST complete profile with phone and payment verification
    const isOrganizerNeedsSetup = user.role === 'organizer' && (!user.phone || !user.phoneVerified);

    res.json({ 
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        profilePhoto: user.profilePhoto,
        phone: user.phone,
        phoneVerified: user.phoneVerified
      },
      requiresProfileCompletion: isNewUser || needsRoleSelection || isOrganizerNeedsSetup,
      requiresPhoneVerification: !user.phone || !user.phoneVerified,
      requiresAutoPaySetup: user.role === 'organizer' && user.organizerProfile?.autoPay?.isSetupRequired && !user.organizerProfile?.autoPay?.isSetupCompleted
    });

  } catch (error: any) {
    logger.error('Google OAuth error', { error: error.message });
    res.status(500).json({ error: 'Authentication failed' });
  }
});

router.get('/me', authenticateJwt, async (req, res) => {
  try {
    const userId = (req as any).auth.userId;
    const user = await User.findById(userId).select('-passwordHash').lean();
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user: { ...user, id: (user as any)._id } });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Password reset request
const forgotPasswordSchema = z.object({
  email: z.string().email()
});

router.post('/forgot-password', async (req, res) => {
  try {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ 
        error: 'Invalid email format',
        details: parsed.error.flatten() 
      });
    }

    const { email } = parsed.data;
    const user = await User.findOne({ email });
    
    if (!user) {
      // For security, don't reveal if email exists or not
      return res.json({ 
        message: 'If an account with that email exists, a password reset link has been sent.' 
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = await bcrypt.hash(resetToken, 10);
    const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Save reset token to user
    user.resetPasswordToken = resetTokenHash;
    user.resetPasswordExpires = resetTokenExpires;
    await user.save();

    // Generate reset URL
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetUrl = `${baseUrl}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;

    // Send reset email
    const emailSent = await emailService.sendPasswordResetEmail({
      userName: user.name,
      userEmail: user.email,
      resetToken,
      resetUrl
    });

    if (emailSent) {
      logger.info('Password reset email sent', { email: user.email });
    } else {
      logger.warn('Failed to send password reset email', { email: user.email });
    }

    res.json({ 
      message: 'If an account with that email exists, a password reset link has been sent.' 
    });

  } catch (error: any) {
    logger.error('Error in forgot password', { error: error.message });
    res.status(500).json({ error: 'Server error' });
  }
});

// Password reset confirmation
const resetPasswordSchema = z.object({
  email: z.string().email(),
  token: z.string().min(1),
  newPassword: z.string().min(6)
});

router.post('/reset-password', async (req, res) => {
  try {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ 
        error: 'Invalid reset data',
        details: parsed.error.flatten() 
      });
    }

    const { email, token, newPassword } = parsed.data;
    
    const user = await User.findOne({ 
      email,
      resetPasswordExpires: { $gt: new Date() }
    });
    
    if (!user || !user.resetPasswordToken) {
      return res.status(400).json({ 
        error: 'Invalid or expired reset token' 
      });
    }

    // Verify reset token
    const isValidToken = await bcrypt.compare(token, user.resetPasswordToken);
    if (!isValidToken) {
      return res.status(400).json({ 
        error: 'Invalid or expired reset token' 
      });
    }

    // Update password
    const passwordHash = await bcrypt.hash(newPassword, 10);
    user.passwordHash = passwordHash;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.lastActive = new Date();
    await user.save();

    logger.info('Password reset successful', { email: user.email });

    res.json({ message: 'Password reset successful. You can now log in with your new password.' });

  } catch (error: any) {
    logger.error('Error in reset password', { error: error.message });
    res.status(500).json({ error: 'Server error' });
  }
});

// Create agent user (admin only)
const createAgentSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  phone: z.string().regex(/^[+]?[1-9]\d{1,14}$/).optional(),
});

router.post('/create-agent', authenticateJwt, requireRole(['admin']), async (req, res) => {
  try {
    const parsed = createAgentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid agent data', details: parsed.error.flatten() });
    }

    const { email, password, name, phone } = parsed.data;

    // Check if user already exists
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ error: 'Email already in use' });
    }

    // Create agent user
    const passwordHash = await bcrypt.hash(password, 10);
    const agent = await User.create({
      email,
      passwordHash,
      name,
      phone,
      role: 'agent'
    });

    logger.info('Agent user created', { agentId: agent._id, email: agent.email });

    res.status(201).json({
      message: 'Agent created successfully',
      agent: {
        id: agent._id,
        email: agent.email,
        name: agent.name,
        role: agent.role,
        createdAt: agent.createdAt
      }
    });

  } catch (error: any) {
    logger.error('Error creating agent', { error: error.message });
    res.status(500).json({ error: 'Failed to create agent' });
  }
});

// Email verification for registration (without authentication)
const verifyRegistrationEmailSchema = z.object({
  userId: z.string(),
  email: z.string().email(),
  otp: z.string().regex(/^\d{6}$/)
});

router.post('/verify-registration-email', async (req, res) => {
  try {
    const parsed = verifyRegistrationEmailSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
    }

    const { userId, email, otp } = parsed.data;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.emailVerified) {
      return res.json({ message: 'Email already verified.' });
    }

    if (!user.emailVerificationOtpHash || !user.emailVerificationExpires) {
      return res.status(400).json({ error: 'No active verification. Please request a new code.' });
    }

    if (user.emailVerificationExpires.getTime() < Date.now()) {
      user.emailVerificationOtpHash = undefined;
      user.emailVerificationExpires = undefined;
      await user.save();
      return res.status(400).json({ error: 'Code expired. Please request a new one.' });
    }

    // Limit attempts to 5
    const attempts = user.emailVerificationAttempts || 0;
    if (attempts >= 5) {
      user.emailVerificationOtpHash = undefined;
      user.emailVerificationExpires = undefined;
      user.emailVerificationAttempts = 0;
      await user.save();
      return res.status(429).json({ error: 'Too many attempts. Request a new code.' });
    }

    const ok = await bcrypt.compare(otp, user.emailVerificationOtpHash);
    if (!ok) {
      user.emailVerificationAttempts = attempts + 1;
      await user.save();
      return res.status(400).json({ error: 'Invalid code' });
    }

    // Success: mark verified and clear OTP fields
    user.emailVerified = true;
    user.emailVerificationOtpHash = undefined;
    user.emailVerificationExpires = undefined;
    user.emailVerificationAttempts = 0;
    await user.save();

    logger.info('Email verified for new registration', { userId, email });

    return res.json({ message: 'Email verified successfully. You can now log in.' });
  } catch (error: any) {
    logger.error('Error verifying registration email', { error: error.message });
    return res.status(500).json({ error: 'Verification failed' });
  }
});

// Resend OTP for registration
const resendRegistrationOtpSchema = z.object({
  userId: z.string(),
  email: z.string().email()
});

router.post('/resend-registration-otp', async (req, res) => {
  try {
    const parsed = resendRegistrationOtpSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid data', details: parsed.error.flatten() });
    }

    const { userId, email } = parsed.data;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.emailVerified) {
      return res.json({ message: 'Email already verified.' });
    }

    // Throttle resend: 60 seconds between sends
    const now = new Date();
    if (user.emailVerificationLastSentAt && now.getTime() - user.emailVerificationLastSentAt.getTime() < 60 * 1000) {
      return res.status(429).json({ error: 'Please wait before requesting another code.' });
    }

    // Generate new OTP
    const otp = String(crypto.randomInt(100000, 999999));
    const otpHash = await bcrypt.hash(otp, 10);

    user.emailVerificationOtpHash = otpHash;
    user.emailVerificationExpires = new Date(Date.now() + 10 * 60 * 1000);
    user.emailVerificationAttempts = 0;
    user.emailVerificationLastSentAt = now;
    await user.save();

    // Send OTP via Email
    try {
      await emailService.sendEmailVerificationOTP({
        userName: user.name,
        userEmail: user.email,
        otp,
        expiresMinutes: 10
      });

      return res.json({ 
        message: 'New verification code sent to your email',
        ...(process.env.NODE_ENV === 'development' && { otp })
      });
    } catch (error: any) {
      logger.error('Error sending registration OTP email', { error: error.message });
      return res.status(500).json({ error: 'Failed to send OTP' });
    }
  } catch (error: any) {
    logger.error('Error resending registration OTP', { error: error.message });
    return res.status(500).json({ error: 'Failed to resend code' });
  }
});

// Email verification via OTP
const sendOtpSchema = z.object({
  email: z.string().email()
});

router.post('/verify-email/send-otp', async (req, res) => {
  try {
    const parsed = sendOtpSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid email', details: parsed.error.flatten() });
    }

    const { email } = parsed.data;
    const user = await User.findOne({ email });

    // Always respond generically to prevent enumeration
    if (!user) {
      return res.json({ message: 'If that email exists, an OTP has been sent.' });
    }

    // Throttle resend: 60 seconds between sends
    const now = new Date();
    if (user.emailVerificationLastSentAt && now.getTime() - user.emailVerificationLastSentAt.getTime() < 60 * 1000) {
      return res.status(429).json({ error: 'Please wait before requesting another code.' });
    }

    // Generate 6-digit OTP
    const otp = String(crypto.randomInt(100000, 999999));
    const otpHash = await bcrypt.hash(otp, 10);

    user.emailVerificationOtpHash = otpHash;
    user.emailVerificationExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    user.emailVerificationAttempts = 0;
    user.emailVerificationLastSentAt = now;
    await user.save();

    // Send email via Gmail SMTP
    await emailService.sendEmailVerificationOTP({
      userName: user.name,
      userEmail: user.email,
      otp,
      expiresMinutes: 10
    });

    return res.json({ message: 'If that email exists, an OTP has been sent.' });
  } catch (error: any) {
    logger.error('Error sending email OTP', { error: error.message });
    return res.status(500).json({ error: 'Failed to send OTP' });
  }
});

const verifyOtpSchema = z.object({
  email: z.string().email(),
  otp: z.string().regex(/^\d{6}$/)
});

router.post('/verify-email/verify-otp', async (req, res) => {
  try {
    const parsed = verifyOtpSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
    }

    const { email, otp } = parsed.data;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'Invalid code or email' });
    }

    if (user.emailVerified) {
      return res.json({ message: 'Email already verified.' });
    }

    if (!user.emailVerificationOtpHash || !user.emailVerificationExpires) {
      return res.status(400).json({ error: 'No active verification. Please request a new code.' });
    }

    if (user.emailVerificationExpires.getTime() < Date.now()) {
      // Expired, clear fields
      user.emailVerificationOtpHash = undefined;
      user.emailVerificationExpires = undefined;
      await user.save();
      return res.status(400).json({ error: 'Code expired. Please request a new one.' });
    }

    // Limit attempts to 5
    const attempts = user.emailVerificationAttempts || 0;
    if (attempts >= 5) {
      user.emailVerificationOtpHash = undefined;
      user.emailVerificationExpires = undefined;
      user.emailVerificationAttempts = 0;
      await user.save();
      return res.status(429).json({ error: 'Too many attempts. Request a new code.' });
    }

    const ok = await bcrypt.compare(otp, user.emailVerificationOtpHash);
    if (!ok) {
      user.emailVerificationAttempts = attempts + 1;
      await user.save();
      return res.status(400).json({ error: 'Invalid code' });
    }

    // Success: mark verified and clear OTP fields
    user.emailVerified = true;
    user.emailVerificationOtpHash = undefined;
    user.emailVerificationExpires = undefined;
    user.emailVerificationAttempts = 0;
    await user.save();

    return res.json({ message: 'Email verified successfully.' });
  } catch (error: any) {
    logger.error('Error verifying email OTP', { error: error.message });
    return res.status(500).json({ error: 'Verification failed' });
  }
});

// Phone verification - Send OTP
const sendPhoneOtpSchema = z.object({
  phone: z.string().regex(/^[+]?[1-9]\d{1,14}$/)
});

router.post('/verify-phone/send-otp', authenticateJwt, async (req, res) => {
  try {
    const parsed = sendPhoneOtpSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid phone number', details: parsed.error.flatten() });
    }

    const { phone } = parsed.data;
    const userId = (req as any).auth.userId;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Throttle resend: 60 seconds between sends
    const now = new Date();
    if (user.phoneVerificationLastSentAt && now.getTime() - user.phoneVerificationLastSentAt.getTime() < 60 * 1000) {
      return res.status(429).json({ error: 'Please wait before requesting another code.' });
    }

    // Generate 6-digit OTP
    const otp = String(crypto.randomInt(100000, 999999));
    const otpHash = await bcrypt.hash(otp, 10);

    user.phoneVerificationOtpHash = otpHash;
    user.phoneVerificationExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    user.phoneVerificationAttempts = 0;
    user.phoneVerificationLastSentAt = now;
    await user.save();

    // Send OTP via Twilio SMS service
    const smsResult = await smsService.sendOTP({ phone, otp });
    
    if (!smsResult.success) {
      logger.error('Failed to send OTP SMS', { phone, error: smsResult.error });
      return res.status(500).json({ 
        error: smsResult.error || 'Failed to send OTP. Please try again.' 
      });
    }

    logger.info('OTP sent successfully', { phone, messageId: smsResult.messageId });

    return res.json({ 
      message: 'OTP sent to your phone number',
      // In dev mode, return OTP for testing
      ...(process.env.NODE_ENV === 'development' && { otp })
    });
  } catch (error: any) {
    logger.error('Error sending phone OTP', { error: error.message });
    return res.status(500).json({ error: 'Failed to send OTP' });
  }
});

// Phone verification - Verify OTP
const verifyPhoneOtpSchema = z.object({
  phone: z.string().regex(/^[+]?[1-9]\d{1,14}$/),
  otp: z.string().regex(/^\d{6}$/)
});

router.post('/verify-phone/verify-otp', authenticateJwt, async (req, res) => {
  try {
    const parsed = verifyPhoneOtpSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
    }

    const { phone, otp } = parsed.data;
    const userId = (req as any).auth.userId;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.phoneVerified) {
      return res.json({ message: 'Phone already verified.' });
    }

    if (!user.phoneVerificationOtpHash || !user.phoneVerificationExpires) {
      return res.status(400).json({ error: 'No active verification. Please request a new code.' });
    }

    if (user.phoneVerificationExpires.getTime() < Date.now()) {
      user.phoneVerificationOtpHash = undefined;
      user.phoneVerificationExpires = undefined;
      await user.save();
      return res.status(400).json({ error: 'Code expired. Please request a new one.' });
    }

    // Limit attempts to 5
    const attempts = user.phoneVerificationAttempts || 0;
    if (attempts >= 5) {
      user.phoneVerificationOtpHash = undefined;
      user.phoneVerificationExpires = undefined;
      user.phoneVerificationAttempts = 0;
      await user.save();
      return res.status(429).json({ error: 'Too many attempts. Request a new code.' });
    }

    const ok = await bcrypt.compare(otp, user.phoneVerificationOtpHash);
    if (!ok) {
      user.phoneVerificationAttempts = attempts + 1;
      await user.save();
      return res.status(400).json({ error: 'Invalid code' });
    }

    // Success: mark verified, set phone, and clear OTP fields
    user.phoneVerified = true;
    user.phone = phone;
    user.phoneVerificationOtpHash = undefined;
    user.phoneVerificationExpires = undefined;
    user.phoneVerificationAttempts = 0;
    await user.save();

    return res.json({ message: 'Phone verified successfully.' });
  } catch (error: any) {
    logger.error('Error verifying phone OTP', { error: error.message });
    return res.status(500).json({ error: 'Verification failed' });
  }
});

// Update user role and profile after Google signup
const completeProfileSchema = z.object({
  role: z.enum(['traveler', 'organizer']),
  phone: z.string().regex(/^[+]?[1-9]\d{1,14}$/), // Phone is now mandatory
  organizerProfile: z.object({
    experience: z.string().optional(),
    yearsOfExperience: z.number().optional(),
    specialties: z.array(z.string()).optional(),
    languages: z.array(z.string()).optional(),
    bio: z.string().optional()
  }).optional()
});

router.post('/complete-profile', authenticateJwt, async (req, res) => {
  try {
    const parsed = completeProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid profile data', details: parsed.error.flatten() });
    }

    const { role, phone, organizerProfile } = parsed.data;
    const userId = (req as any).auth.userId;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Phone verification is MANDATORY for all users, especially organizers
    if (!user.phoneVerified) {
      return res.status(400).json({ 
        error: 'Please verify your phone number first',
        requiresPhoneVerification: true
      });
    }

    user.role = role;
    user.phone = phone;

    // For organizers, initialize profile and auto-pay setup
    if (role === 'organizer') {
      if (!user.organizerProfile) {
        user.organizerProfile = {};
      }
      
      // Merge organizer profile details
      if (organizerProfile) {
        user.organizerProfile = {
          ...user.organizerProfile,
          ...organizerProfile
        };
      }
      
      // Initialize auto-pay if not already set (for Google auth organizers)
      if (!user.firstOrganizerLogin) {
        user.firstOrganizerLogin = new Date();
        
        const scheduledPaymentDate = new Date();
        scheduledPaymentDate.setDate(scheduledPaymentDate.getDate() + 60);
        
        user.organizerProfile.autoPay = {
          isSetupRequired: true,
          isSetupCompleted: false,
          firstLoginDate: new Date(),
          scheduledPaymentDate: scheduledPaymentDate,
          paymentAmount: 149900,
          autoPayEnabled: false
        };
        
        logger.info('Auto-pay initialized for Google auth organizer', { 
          userId, 
          scheduledDate: scheduledPaymentDate 
        });
      }
    }

    await user.save();

    logger.info('Profile completed', { userId, role, hasPhone: !!user.phone });

    return res.json({ 
      message: 'Profile completed successfully',
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        phone: user.phone,
        phoneVerified: user.phoneVerified
      },
      requiresAutoPaySetup: role === 'organizer' && user.organizerProfile?.autoPay?.isSetupRequired && !user.organizerProfile?.autoPay?.isSetupCompleted
    });
  } catch (error: any) {
    logger.error('Error completing profile', { error: error.message });
    return res.status(500).json({ error: 'Failed to complete profile' });
  }
});

export default router;

