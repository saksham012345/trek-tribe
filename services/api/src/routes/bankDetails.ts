import { Router, Request, Response } from 'express';
import { authenticateJwt, requireRole } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { upsertRacingSafely } from '../lib/upsert';
import { User } from '../models/User';
import { logger } from '../utils/logger';
import crypto from 'crypto';

const router = Router();

/**
 * POST /api/bank-details/save
 * Save encrypted bank details for organizer (simplified, no Razorpay Route onboarding)
 */
router.post('/save', authenticateJwt, requireRole(['organizer', 'admin']), async (req: Request, res: Response) => {
  try {
    const organizerId = (req as any).user?.userId || (req as any).user?.id;
    const { accountNumber, ifscCode, accountHolderName, bankName, upiId } = req.body;

    if (!organizerId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Validate required fields
    if (!accountNumber || !ifscCode || !accountHolderName) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['accountNumber', 'ifscCode', 'accountHolderName']
      });
    }

    // Validate account number (6-20 digits)
    if (!/^\d{6,20}$/.test(accountNumber.replace(/\s/g, ''))) {
      return res.status(400).json({ error: 'Invalid account number (6-20 digits required)' });
    }

    // Validate IFSC code
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(ifscCode)) {
      return res.status(400).json({ error: 'Invalid IFSC code format (e.g., HDFC0001234)' });
    }

    // Encrypt account number
    if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.length !== 32) {
      logger.error('ENCRYPTION_KEY not configured or invalid length');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const encrypt = (value: string): string => {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(process.env.ENCRYPTION_KEY!), iv);
      let encrypted = cipher.update(value, 'utf8', 'base64');
      encrypted += cipher.final('base64');
      return `${iv.toString('base64')}:${encrypted}`;
    };

    const encryptedAccountNumber = encrypt(accountNumber.replace(/\s/g, ''));

    // Save or update bank details.
    //
    // onboardingStatus is set on create only. The findOneAndUpdate this replaces
    // wrote 'pending' on every save, so an organizer who was already 'connected'
    // or 'activated' and then corrected a typo in their bank name was pushed
    // back to the start of onboarding. Nothing about editing bank details
    // undoes onboarding, and the upsert now says which of the two cases it is.
    const bankFields = {
      accountNumberEncrypted: encryptedAccountNumber,
      ifscCode: ifscCode.toUpperCase(),
      accountHolderName: accountHolderName.trim(),
      bankName: bankName?.trim() || null,
    };

    let payoutConfig;
    try {
      payoutConfig = await upsertRacingSafely(() => prisma.organizerPayoutConfig.upsert({
        where: { organizerId },
        create: { organizerId, ...bankFields, onboardingStatus: 'pending' },
        update: bankFields,
      }));
    } catch (error: any) {
      // The IFSC format is a CHECK constraint: four letters, a zero, six
      // alphanumerics. A code that fails it cannot identify a branch, so the
      // payout would have failed at the bank instead of here.
      if (/organizer_payout_configs_ifsc_format/.test(error?.message || '')) {
        return res.status(400).json({ error: 'Invalid IFSC code' });
      }
      throw error;
    }

    // Also update user profile with bank details (if needed for display)
    await User.findByIdAndUpdate(organizerId, {
      $set: {
        'organizerProfile.bankDetails': {
          accountHolderName: accountHolderName.trim(),
          ifscCode: ifscCode.toUpperCase(),
          bankName: bankName?.trim() || '',
          upiId: upiId?.trim() || undefined,
        }
      }
    });

    logger.info('Bank details saved for organizer', { organizerId });

    res.json({
      success: true,
      message: 'Bank details saved successfully',
      bankDetails: {
        accountHolderName: accountHolderName.trim(),
        ifscCode: ifscCode.toUpperCase(),
        bankName: bankName?.trim() || '',
        // Don't return encrypted account number
      }
    });

  } catch (error: any) {
    logger.error('Failed to save bank details', { error: error.message });
    res.status(500).json({ error: 'Failed to save bank details', message: error.message });
  }
});

/**
 * GET /api/bank-details
 * Get organizer's bank details (non-sensitive info only)
 */
router.get('/', authenticateJwt, requireRole(['organizer', 'admin']), async (req: Request, res: Response) => {
  try {
    const organizerId = (req as any).user?.userId || (req as any).user?.id;

    if (!organizerId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const payoutConfig = await prisma.organizerPayoutConfig.findUnique({ where: { organizerId } });

    // bankDetails was a required sub-document that could still be absent on an
    // older row; the columns are NOT NULL, so a row existing is the whole test.
    if (!payoutConfig) {
      return res.json({
        success: false,
        hasBankDetails: false,
        message: 'Bank details not configured'
      });
    }

    res.json({
      success: true,
      hasBankDetails: true,
      bankDetails: {
        accountHolderName: payoutConfig.accountHolderName,
        ifscCode: payoutConfig.ifscCode,
        bankName: payoutConfig.bankName,
        // Never return encrypted account number
      },
      onboardingStatus: payoutConfig.onboardingStatus,
    });

  } catch (error: any) {
    logger.error('Failed to fetch bank details', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch bank details' });
  }
});

export default router;

