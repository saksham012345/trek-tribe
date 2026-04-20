import express from 'express';
import { z } from 'zod';
import { authenticateJwt, requireRole } from '../middleware/auth';
import {
  getPublicSiteSettings,
  getSiteSettings,
  resetSiteSettings,
  updateSiteSettings
} from '../services/siteSettingsService';
import { logger } from '../utils/logger';

const router = express.Router();

const settingsPatchSchema = z.object({
  home: z.object({
    heroImages: z.array(z.string().url()).max(10).optional(),
    overlayStyle: z.enum(['light', 'dark']).optional(),
    fontFamily: z.string().min(1).max(140).optional(),
    discoverColumnsDesktop: z.number().int().min(1).max(6).optional(),
    discoverColumnsMobile: z.number().int().min(1).max(4).optional()
  }).optional(),
  contact: z.object({
    supportEmail: z.string().email().optional(),
    otpFromEmail: z.string().email().optional(),
    bookingFromEmail: z.string().email().optional()
  }).optional(),
  notifications: z.object({
    emailEnabled: z.boolean().optional(),
    smsEnabled: z.boolean().optional(),
    sendFollowerTripAlerts: z.boolean().optional(),
    tripReminderHours: z.number().int().min(1).max(72).optional()
  }).optional(),
  integrations: z.object({
    paymentProvider: z.enum(['razorpay', 'manual', 'stripe']).optional(),
    emailProvider: z.enum(['sendgrid', 'disabled']).optional(),
    smsProvider: z.enum(['twilio', 'disabled']).optional(),
    twilioFromNumber: z.string().max(32).optional()
  }).optional()
});

router.get('/public', async (_req, res) => {
  try {
    const settings = await getSiteSettings();
    res.json({ data: getPublicSiteSettings(settings) });
  } catch (error: any) {
    logger.error('Failed to fetch public site settings', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch site settings' });
  }
});

router.get('/admin', authenticateJwt, requireRole(['admin']), async (_req, res) => {
  try {
    const settings = await getSiteSettings(true);
    res.json({ data: settings });
  } catch (error: any) {
    logger.error('Failed to fetch admin site settings', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch site settings' });
  }
});

router.put('/admin', authenticateJwt, requireRole(['admin']), async (req, res) => {
  try {
    const parsed = settingsPatchSchema.parse(req.body);
    const updated = await updateSiteSettings(parsed, (req as any).auth.userId);
    res.json({ data: updated });
  } catch (error: any) {
    logger.error('Failed to update site settings', { error: error.message });
    res.status(400).json({ error: 'Failed to update site settings', details: error.message });
  }
});

router.post('/admin/reset', authenticateJwt, requireRole(['admin']), async (req, res) => {
  try {
    const updated = await resetSiteSettings((req as any).auth.userId);
    res.json({ data: updated, message: 'Site settings reset to defaults' });
  } catch (error: any) {
    logger.error('Failed to reset site settings', { error: error.message });
    res.status(500).json({ error: 'Failed to reset site settings' });
  }
});

export default router;

