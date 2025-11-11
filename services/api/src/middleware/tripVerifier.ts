import { Response, NextFunction } from 'express';
import { AuthRequest } from './roleCheck';
import TripVerification from '../models/TripVerification';

/**
 * Middleware to ensure trip has verification record
 */
export const requireTripVerification = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const tripId = req.params.tripId || req.body.tripId;

    if (!tripId) {
      return res.status(400).json({
        success: false,
        message: 'Trip ID is required',
      });
    }

    const verification = await TripVerification.findOne({ tripId });

    if (!verification) {
      return res.status(404).json({
        success: false,
        message: 'Trip verification record not found',
      });
    }

    // Attach verification to request
    (req as any).tripVerification = verification;

    next();
  } catch (error) {
    console.error('Trip verification check error:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking trip verification',
    });
  }
};

/**
 * Middleware to ensure trip is verified before certain actions
 */
export const requireVerifiedTrip = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const tripId = req.params.tripId || req.body.tripId;

    if (!tripId) {
      return res.status(400).json({
        success: false,
        message: 'Trip ID is required',
      });
    }

    const verification = await TripVerification.findOne({ tripId });

    if (!verification) {
      return res.status(404).json({
        success: false,
        message: 'Trip verification record not found. Please submit for verification.',
      });
    }

    if (verification.status !== 'verified') {
      return res.status(403).json({
        success: false,
        message: 'Trip must be verified before this action',
        currentStatus: verification.status,
        verificationUrl: `/trips/${tripId}/verification`,
      });
    }

    // Attach verification to request
    (req as any).tripVerification = verification;

    next();
  } catch (error) {
    console.error('Verified trip check error:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking trip verification status',
    });
  }
};

/**
 * Middleware to check if user can modify verification
 */
export const canModifyVerification = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const tripId = req.params.tripId || req.body.tripId;

    if (!tripId) {
      return res.status(400).json({
        success: false,
        message: 'Trip ID is required',
      });
    }

    const verification = await TripVerification.findOne({ tripId });

    if (!verification) {
      return res.status(404).json({
        success: false,
        message: 'Trip verification record not found',
      });
    }

    // Admin can always modify
    if (req.user.role === 'admin') {
      (req as any).tripVerification = verification;
      return next();
    }

    // Organizer can only modify their own pending/rejected verifications
    if (req.user.role === 'organizer') {
      if (verification.organizerId.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'You can only modify your own trip verifications',
        });
      }

      if (verification.status === 'verified') {
        return res.status(403).json({
          success: false,
          message: 'Cannot modify verified trips',
        });
      }

      (req as any).tripVerification = verification;
      return next();
    }

    return res.status(403).json({
      success: false,
      message: 'Access denied',
    });
  } catch (error) {
    console.error('Verification modification check error:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking verification permissions',
    });
  }
};
