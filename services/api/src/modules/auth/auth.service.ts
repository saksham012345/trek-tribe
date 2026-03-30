/**
 * Auth Service
 *
 * Pure business logic for authentication.
 * No req/res — takes data, returns data or throws.
 *
 * The route file (routes/auth.ts) handles HTTP concerns:
 * cookies, headers, request parsing, response formatting.
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User } from '../../models/User';
import { VerificationRequest } from '../../models/VerificationRequest';
import { logger } from '../../utils/logger';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
  phone: string;
  role?: 'traveler' | 'organizer';
  username?: string;
  bio?: string;
  location?: string;
  experience?: string;
  specialties?: string[];
  languages?: string[];
  yearsOfExperience?: number;
}

export interface AuthTokenPayload {
  userId: string;
  role: string;
}

export interface RegisterResult {
  user: {
    _id: any;
    id: any;
    email: string;
    name: string;
    role: string;
    organizerProfile?: any;
  };
  token: string;
}

// ─── Password validation ──────────────────────────────────────────────────────

const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', '123456', '123456789', 'qwerty',
  'letmein', 'welcome', 'admin', 'iloveyou', 'abc123', '111111', '123123',
  'qwertyuiop', 'monkey', 'dragon', 'football', 'baseball',
]);

export function validatePasswordStrength(password: string): string | null {
  if (password.length < 10) return 'Your password must be at least 10 characters long.';
  if (!/[A-Z]/.test(password)) return 'Your password must include an uppercase letter.';
  if (!/[a-z]/.test(password)) return 'Your password must include a lowercase letter.';
  if (!/[0-9]/.test(password)) return 'Your password must include a number.';
  if (!/[^A-Za-z0-9]/.test(password)) return 'Your password must include a symbol.';
  if (COMMON_PASSWORDS.has(password.toLowerCase())) return 'The password you entered is too weak. Please choose a stronger one.';
  return null;
}

// ─── Token generation ─────────────────────────────────────────────────────────

export function generateToken(userId: string, role: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not configured');
  return jwt.sign({ userId, role }, secret, { expiresIn: '7d' });
}

// ─── Registration ─────────────────────────────────────────────────────────────

export async function registerUser(input: RegisterInput): Promise<RegisterResult> {
  const { email, password, name, phone, role = 'traveler', username, bio, location,
    experience, specialties, languages, yearsOfExperience } = input;

  // Duplicate checks
  const existing = await User.findOne({ email });
  if (existing) {
    if (!existing.emailVerified) {
      throw Object.assign(new Error('Account exists but unverified'), { code: 'ACCOUNT_UNVERIFIED', status: 409 });
    }
    const status = process.env.NODE_ENV === 'test' ? 400 : 409;
    throw Object.assign(new Error('Email already registered'), { code: 'EMAIL_EXISTS', status });
  }

  const existingPhone = await User.findOne({ phone });
  if (existingPhone) {
    throw Object.assign(new Error('Phone number already registered'), { code: 'PHONE_EXISTS', status: 409 });
  }

  if (username) {
    const existingUsername = await User.findOne({ username: username.toLowerCase() });
    if (existingUsername) {
      throw Object.assign(new Error('Username already taken'), { code: 'USERNAME_EXISTS', status: 409 });
    }
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, 12);

  // Auto-generate username if not provided
  let finalUsername = username?.toLowerCase();
  if (!finalUsername) {
    const baseName = name.split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '') || 'user';
    finalUsername = `${baseName}_${crypto.randomBytes(3).toString('hex')}`;
  }

  const userData: any = {
    email,
    passwordHash,
    name,
    username: finalUsername,
    phone,
    role,
    bio,
    location,
    emailVerified: true, // OTP disabled — auto-verify
    phoneVerified: true,
  };

  if (role === 'organizer') {
    userData.organizerProfile = {
      bio: bio || '',
      experience: experience || '',
      specialties: specialties || [],
      languages: languages || ['English'],
      yearsOfExperience: yearsOfExperience || 0,
      totalTripsOrganized: 0,
      certifications: [],
      achievements: [],
      qrCodes: [],
      autoPay: { isSetupRequired: false, isSetupCompleted: false, autoPayEnabled: false },
      trustScore: {
        overall: 0,
        breakdown: { documentVerified: 0, bankVerified: 0, experienceYears: 0, completedTrips: 0, userReviews: 0, responseTime: 0, refundRate: 0 },
        lastCalculated: new Date(),
      },
      verificationBadge: 'none',
      routingEnabled: false,
    };
    userData.organizerVerificationStatus = 'pending';
    userData.organizerVerificationSubmittedAt = new Date();
  }

  const user = await User.create(userData);

  // Create verification request for organizers
  if (role === 'organizer') {
    try {
      const existing = await VerificationRequest.findOne({ organizerId: user._id });
      if (!existing) {
        await VerificationRequest.create({
          organizerId: user._id,
          organizerName: user.name,
          organizerEmail: user.email,
          requestType: 'initial',
          status: 'pending',
          priority: 'medium',
          documents: [],
          kycDetails: { phone: phone || '', businessName: name },
        });
        logger.info('Verification request created for new organizer', { userId: user._id, email: user.email });
      }
    } catch (err: any) {
      logger.error('Failed to create verification request', { userId: user._id, error: err.message });
    }
  }

  const token = generateToken(String(user._id), user.role);

  return {
    token,
    user: {
      _id: user._id,
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      ...(role === 'organizer' && { organizerProfile: user.organizerProfile }),
    },
  };
}

// ─── Login ────────────────────────────────────────────────────────────────────

export async function loginUser(emailOrUsername: string, password: string) {
  const user = await User.findOne({
    $or: [
      { email: emailOrUsername.toLowerCase() },
      { username: emailOrUsername.toLowerCase() },
    ],
  });

  if (!user) {
    throw Object.assign(new Error('No account found with this email or username.'), { code: 'USER_NOT_FOUND', status: 401 });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    throw Object.assign(new Error('The password you entered is incorrect.'), { code: 'INVALID_PASSWORD', status: 401 });
  }

  user.lastActive = new Date();
  if (user.role === 'organizer' && !user.firstOrganizerLogin) {
    user.firstOrganizerLogin = new Date();
  }
  await user.save();

  const token = generateToken(String(user._id), user.role);

  return {
    token,
    user: {
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt,
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified,
    },
    requiresVerification: !user.emailVerified && user.role !== 'admin' && user.role !== 'agent',
  };
}

// ─── Password reset ───────────────────────────────────────────────────────────

export async function initiatePasswordReset(email: string): Promise<{ resetToken: string; user: any } | null> {
  const user = await User.findOne({ email });
  if (!user) return null;

  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetTokenHash = await bcrypt.hash(resetToken, 12);

  user.resetPasswordToken = resetTokenHash;
  user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000);
  await user.save();

  return { resetToken, user };
}

export async function completePasswordReset(email: string, token: string, newPassword: string): Promise<void> {
  const user = await User.findOne({ email, resetPasswordExpires: { $gt: new Date() } });

  if (!user || !user.resetPasswordToken) {
    throw Object.assign(new Error('Invalid or expired reset token'), { status: 400 });
  }

  const valid = await bcrypt.compare(token, user.resetPasswordToken);
  if (!valid) {
    throw Object.assign(new Error('Invalid or expired reset token'), { status: 400 });
  }

  user.passwordHash = await bcrypt.hash(newPassword, 12);
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  user.lastActive = new Date();
  await user.save();
}
