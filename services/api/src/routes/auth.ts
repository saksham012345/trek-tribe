import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { authenticateJwt } from '../middleware/auth';
import { emailService } from '../services/emailService';
import { logger } from '../utils/logger';
import crypto from 'crypto';
import axios from 'axios';

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  phone: z.string().regex(/^[+]?[1-9]\d{1,14}$/).optional(),
  role: z.enum(['traveler', 'organizer']).optional(),
});

router.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { email, password, name, phone, role } = parsed.data;
  const existing = await User.findOne({ email }).lean();
  if (existing) return res.status(409).json({ error: 'Email already in use' });
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ email, passwordHash, name, phone, role: role ?? 'traveler' });
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  const token = jwt.sign({ userId: String(user._id), role: user.role }, jwtSecret, { expiresIn: '7d' });
  return res.status(201).json({ 
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

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(6) });

router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { email, password } = parsed.data;
  const user = await User.findOne({ email });
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  const token = jwt.sign({ userId: String(user._id), role: user.role }, jwtSecret, { expiresIn: '7d' });
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

    // Verify Google ID token
    let googleUser;
    try {
      const response = await axios.get(
        `https://www.googleapis.com/oauth2/v1/tokeninfo?id_token=${credential}`
      );
      googleUser = response.data;
    } catch (error) {
      logger.error('Google token verification failed', { error });
      return res.status(401).json({ error: 'Invalid Google token' });
    }

    // Extract user information
    const {
      email,
      name,
      picture,
      sub: googleId
    } = googleUser;

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

    res.json({ 
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        profilePhoto: user.profilePhoto
      }
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

export default router;


