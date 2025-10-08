import { Request, Response, NextFunction } from 'express';
import { User } from '../models/User';
import { logger } from '../utils/logger';
import { AuthPayload } from './auth';

export const isAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Check if user is authenticated (should be handled by auth middleware first)
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Get user from database to check role
    const user = await User.findById(req.user.id).select('role');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user has admin role
    if (user.role !== 'admin') {
      logger.warn('Non-admin user attempted to access admin route', {
        userId: req.user.id,
        userRole: user.role,
        path: req.path,
        method: req.method
      });

      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    // User is admin, proceed to next middleware
    next();

  } catch (error: any) {
    logger.error('Error in admin middleware', {
      error: error.message,
      userId: req.user?.id,
      path: req.path
    });

    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};