import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { authenticateJwt } from '../middleware/auth';

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  phone: z.string().optional(),
  role: z.enum(['traveler', 'organizer']).optional(),
});

router.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { email, password, name, phone, role } = parsed.data;
  
  // Check if email already exists
  const existing = await User.findOne({ email }).lean();
  if (existing) return res.status(409).json({ error: 'Email already in use' });
  
  // Check if phone already exists (if provided)
  if (phone) {
    const existingPhone = await User.findOne({ phone }).lean();
    if (existingPhone) return res.status(409).json({ error: 'Phone number already in use' });
  }
  
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ 
    email, 
    passwordHash, 
    name, 
    phone, 
    role: role ?? 'traveler'
  });
  
  const token = jwt.sign({ userId: String(user._id), role: user.role }, process.env.JWT_SECRET || 'devsecret', { expiresIn: '7d' });
  return res.status(201).json({ 
    token, 
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified
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
  const ok = await bcrypt.compare(password, user.passwordHash!);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ userId: String(user._id), role: user.role }, process.env.JWT_SECRET || 'devsecret', { expiresIn: '7d' });
  return res.json({ token });
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

// Update user profile schema
const updateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  emergencyContacts: z.array(z.object({
    name: z.string().min(1),
    relationship: z.string().min(1),
    phone: z.string().min(1),
    email: z.string().email().optional(),
    isPrimary: z.boolean().optional()
  })).optional(),
  trackingPreferences: z.object({
    shareLocationWithEmergencyContacts: z.boolean().optional(),
    allowLocationTracking: z.boolean().optional(),
    notificationFrequency: z.enum(['hourly', 'every4hours', 'daily']).optional()
  }).optional(),
  preferences: z.object({
    categories: z.array(z.string()).optional(),
    budgetRange: z.tuple([z.number(), z.number()]).optional(),
    locations: z.array(z.string()).optional()
  }).optional()
});

router.put('/profile', authenticateJwt, async (req, res) => {
  try {
    const userId = (req as any).auth.userId;
    const parsed = updateProfileSchema.safeParse(req.body);
    
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    // Validate that only one emergency contact is marked as primary
    if (parsed.data.emergencyContacts) {
      const primaryContacts = parsed.data.emergencyContacts.filter(contact => contact.isPrimary);
      if (primaryContacts.length > 1) {
        return res.status(400).json({ error: 'Only one emergency contact can be marked as primary' });
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId, 
      parsed.data, 
      { new: true, runValidators: true }
    ).select('-passwordHash');

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: { ...updatedUser.toObject(), id: updatedUser._id } });
  } catch (error: any) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Get emergency contacts
router.get('/emergency-contacts', authenticateJwt, async (req, res) => {
  try {
    const userId = (req as any).auth.userId;
    const user = await User.findById(userId).select('emergencyContacts').lean();
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ emergencyContacts: user.emergencyContacts || [] });
  } catch (error) {
    console.error('Error fetching emergency contacts:', error);
    res.status(500).json({ error: 'Failed to fetch emergency contacts' });
  }
});

// Update emergency contacts
router.put('/emergency-contacts', authenticateJwt, async (req, res) => {
  try {
    const userId = (req as any).auth.userId;
    const emergencyContactsSchema = z.array(z.object({
      name: z.string().min(1),
      relationship: z.string().min(1),
      phone: z.string().min(1),
      email: z.string().email().optional(),
      isPrimary: z.boolean().optional()
    }));

    const parsed = emergencyContactsSchema.safeParse(req.body.emergencyContacts);
    
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    // Validate that only one emergency contact is marked as primary
    const primaryContacts = parsed.data.filter(contact => contact.isPrimary);
    if (primaryContacts.length > 1) {
      return res.status(400).json({ error: 'Only one emergency contact can be marked as primary' });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { emergencyContacts: parsed.data },
      { new: true, runValidators: true }
    ).select('emergencyContacts');

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ emergencyContacts: updatedUser.emergencyContacts });
  } catch (error: any) {
    console.error('Error updating emergency contacts:', error);
    res.status(500).json({ error: 'Failed to update emergency contacts' });
  }
});

// Google OAuth - Initiate
router.get('/google', (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  
  if (!clientId || !redirectUri) {
    return res.status(500).json({ error: 'Google OAuth not configured' });
  }

  const scope = 'openid email profile';
  const responseType = 'code';
  const state = Math.random().toString(36).substring(7); // Simple state for CSRF protection
  
  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&response_type=${responseType}&state=${state}`;
  
  res.json({ 
    success: true,
    authUrl: googleAuthUrl,
    message: 'Redirect to this URL for Google authentication'
  });
});

// Google OAuth - Callback
router.get('/google/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    
    if (!code) {
      return res.status(400).json({ error: 'Authorization code not provided' });
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        code: code as string,
        grant_type: 'authorization_code',
        redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
      }),
    });

    const tokenData = await tokenResponse.json();
    
    if (!tokenData.access_token) {
      return res.status(400).json({ error: 'Failed to get access token from Google' });
    }

    // Get user info from Google
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    const googleUser = await userInfoResponse.json();
    
    if (!googleUser.email) {
      return res.status(400).json({ error: 'Failed to get user info from Google' });
    }

    // Find or create user
    let user = await User.findOne({ email: googleUser.email });
    
    if (user) {
      // Update Google info if user exists
      user.googleId = googleUser.id;
      user.emailVerified = googleUser.verified_email || true;
      user.profilePicture = user.profilePicture || googleUser.picture;
      user.lastLoginAt = new Date();
    } else {
      // Create new user
      user = new User({
        name: googleUser.name || googleUser.email.split('@')[0],
        email: googleUser.email,
        googleId: googleUser.id,
        isEmailVerified: googleUser.verified_email || true,
        isPhoneVerified: false,
        profilePicture: googleUser.picture,
        role: 'traveler',
        lastLogin: new Date()
        // Note: No passwordHash for Google OAuth users
      });
    }

    await user.save();

    // Generate JWT token
    const token = jwt.sign({ userId: String(user._id), role: user.role }, process.env.JWT_SECRET || 'devsecret', { expiresIn: '7d' });

    // Redirect to frontend with token
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/auth/callback?token=${token}&user=${encodeURIComponent(JSON.stringify({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isEmailVerified: user.emailVerified,
      isPhoneVerified: user.phoneVerified,
      profilePicture: user.profilePicture
    }))}`);
  } catch (error: any) {
    console.error('Google OAuth callback error:', error);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/auth/error?message=${encodeURIComponent('Google authentication failed')}`);
  }
});

// Google OAuth - Frontend Token Exchange (Alternative method)
router.post('/google/token', async (req, res) => {
  try {
    const { credential } = req.body; // Google ID Token from frontend
    
    if (!credential) {
      return res.status(400).json({ error: 'Google credential not provided' });
    }

    // Verify the Google ID token
    const response = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?id_token=${credential}`);
    const googleUser = await response.json();
    
    if (!googleUser.email || googleUser.aud !== process.env.GOOGLE_CLIENT_ID) {
      return res.status(400).json({ error: 'Invalid Google credential' });
    }

    // Find or create user
    let user = await User.findOne({ email: googleUser.email });
    
    if (user) {
      // Update Google info if user exists
      user.googleId = googleUser.sub;
      user.emailVerified = googleUser.email_verified === 'true';
      user.profilePicture = user.profilePicture || googleUser.picture;
      user.lastLoginAt = new Date();
    } else {
      // Create new user
      user = new User({
        name: googleUser.name || googleUser.email.split('@')[0],
        email: googleUser.email,
        googleId: googleUser.sub,
        isEmailVerified: googleUser.email_verified === 'true',
        isPhoneVerified: false,
        profilePicture: googleUser.picture,
        role: 'traveler',
        lastLogin: new Date()
      });
    }

    await user.save();

    // Generate JWT token
    const token = jwt.sign({ userId: String(user._id), role: user.role }, process.env.JWT_SECRET || 'devsecret', { expiresIn: '7d' });

    res.json({
      success: true,
      message: 'Google authentication successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isEmailVerified: user.emailVerified,
        isPhoneVerified: user.phoneVerified,
        profilePicture: user.profilePicture
      }
    });
  } catch (error: any) {
    console.error('Google token verification error:', error);
    res.status(500).json({ error: 'Server error during Google authentication' });
  }
});

export default router;

