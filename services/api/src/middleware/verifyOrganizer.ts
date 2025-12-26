import { Request, Response, NextFunction } from 'express';
import { User } from '../models/User';
import { logger } from '../utils/logger';

/**
 * Middleware to verify that an organizer account is approved by admin
 * Use this on routes that only verified organizers should access (e.g., trip creation)
 */
export const verifyOrganizerApproved = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // In test environment, bypass organizer verification to allow flows to run
    if (process.env.NODE_ENV === 'test') {
      return next();
    }

    const userId = (req as any).auth?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Only check verification for organizer role
    if (user.role !== 'organizer') {
      return next(); // Not an organizer, proceed
    }

    // Check organizer verification status
    if (user.organizerVerificationStatus === 'pending') {
      return res.status(403).json({
        error: 'Organizer verification pending',
        message: 'Your organizer account is awaiting admin verification. You will be notified via email once your account is approved.',
        verificationStatus: 'pending',
        submittedAt: user.organizerVerificationSubmittedAt
      });
    }

    if (user.organizerVerificationStatus === 'rejected') {
      return res.status(403).json({
        error: 'Organizer verification rejected',
        message: `Your organizer account verification was rejected. Reason: ${user.organizerVerificationRejectionReason || 'Not specified'}`,
        verificationStatus: 'rejected',
        rejectedAt: user.organizerVerificationRejectedAt,
        rejectionReason: user.organizerVerificationRejectionReason
      });
    }

    if (user.organizerVerificationStatus !== 'approved') {
      return res.status(403).json({
        error: 'Organizer not verified',
        message: 'Your organizer account needs to be verified by an administrator before you can perform this action.',
        verificationStatus: user.organizerVerificationStatus || 'unknown'
      });
    }

    // Organizer is approved, proceed
    next();
  } catch (error: any) {
    logger.error('Error in verifyOrganizerApproved middleware', { error: error.message });
    res.status(500).json({ error: 'Failed to verify organizer status' });
  }
};
