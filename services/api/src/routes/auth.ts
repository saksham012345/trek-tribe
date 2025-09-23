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
  role: z.enum(['traveler', 'organizer']).optional(),
});

router.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { email, password, name, role } = parsed.data;
  const existing = await User.findOne({ email }).lean();
  if (existing) return res.status(409).json({ error: 'Email already in use' });
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ email, passwordHash, name, role: role ?? 'traveler' });
  const token = jwt.sign({ userId: String(user._id), role: user.role }, process.env.JWT_SECRET || 'devsecret', { expiresIn: '7d' });
  return res.status(201).json({ token });
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

export default router;


