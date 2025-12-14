import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { logger } from '../utils/logger';

const router = Router();

// Same preset users as clean-and-seed, but non-destructive upsert
const PRESET_USERS = [
  {
    name: 'Admin User',
    email: 'admin@trektribe.com',
    phone: '+91-9876543210',
    role: 'admin' as const,
    password: 'Admin@2025',
    bio: '🛡️ Platform Administrator - Managing TrekTribe operations',
    location: 'Mumbai, India',
  },
  {
    name: 'Support Agent',
    email: 'agent@trektribe.com',
    phone: '+91-9876543211',
    role: 'agent' as const,
    password: 'Agent@2025',
    bio: '🎯 Customer Support Agent - Here to help travelers',
    location: 'Bangalore, India',
  },
  {
    name: 'Demo Organizer',
    email: 'organizer@trektribe.com',
    phone: '+91-9876543212',
    role: 'organizer' as const,
    password: 'Organizer@2025',
    bio: '🗺️ Professional Trek Organizer - Creating amazing mountain experiences',
    location: 'Manali, India',
  },
  {
    name: 'Demo Traveler',
    email: 'traveler@trektribe.com',
    phone: '+91-9876543213',
    role: 'traveler' as const,
    password: 'Traveler@2025',
    bio: '⛰️ Adventure Enthusiast - Always ready for the next trek',
    location: 'Delhi, India',
  },
];

// Minimal protection via header token; avoids public exposure
const requireSeedToken = (req: Request, res: Response, next: Function) => {
  const token = req.header('x-seed-token');
  if (!process.env.SEED_TOKEN) {
    return res.status(500).json({ error: 'SEED_TOKEN not configured' });
  }
  if (token !== process.env.SEED_TOKEN) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
};

router.post('/preset-users', requireSeedToken, async (_req: Request, res: Response) => {
  try {
    const results: Array<{ email: string; created: boolean }> = [];

    for (const userData of PRESET_USERS) {
      const existing = await User.findOne({ email: userData.email });
      if (existing) {
        results.push({ email: userData.email, created: false });
        continue;
      }

      const passwordHash = await bcrypt.hash(userData.password, 10);
      await User.create({
        name: userData.name,
        email: userData.email,
        phone: userData.phone,
        role: userData.role,
        passwordHash,
        bio: userData.bio,
        location: userData.location,
        emailVerified: true,
        phoneVerified: true,
        isVerified: true,
        socialStats: { followersCount: 0, followingCount: 0, postsCount: 0 },
      });

      results.push({ email: userData.email, created: true });
    }

    return res.json({ success: true, results });
  } catch (error: any) {
    logger.error('Error seeding preset users', { error: error.message });
    return res.status(500).json({ error: 'Failed to seed preset users' });
  }
});

export default router;
