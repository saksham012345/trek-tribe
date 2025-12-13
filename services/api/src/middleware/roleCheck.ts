import { Request, Response, NextFunction } from 'express';
import { authenticateToken } from './auth';
import { AuthRequest } from '../types/express';

export { AuthRequest };

/**
 * Middleware to check if user has required role(s)
 */
export const requireRole = (allowedRoles: ('user' | 'organizer' | 'admin' | 'traveler' | 'agent')[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    // First ensure authentication
    if (!req.user && !req.auth) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Use either req.user or req.auth (compatibility with existing system)
    const userData = req.user || req.auth;
    if (!userData) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Map traveler role to user for CRM compatibility
    const userRole = userData.role === 'traveler' ? 'user' : userData.role;
    
    // Check if role is allowed (with mapping for traveler/user)
    const isAllowed = allowedRoles.includes(userRole as any) || 
                     (allowedRoles.includes('user' as any) && userData.role === 'traveler') ||
                     (allowedRoles.includes('traveler' as any) && userRole === 'user');
    
    if (!isAllowed) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions.',
        requiredRole: allowedRoles,
        currentRole: userData.role,
      });
    }

    // Ensure req.user is populated for CRM controllers
    if (!req.user && req.auth) {
      req.user = {
        id: req.auth.id || req.auth.userId,
        userId: req.auth.userId || req.auth.id,
        role: userRole as any,
      };
    } else if (req.user && !req.user.userId) {
      req.user.userId = req.user.id;
    }

    next();
  };
};

/**
 * Middleware to check if user is admin
 */
export const requireAdmin = requireRole(['admin']);

/**
 * Middleware to check if user is organizer or admin
 */
export const requireOrganizerOrAdmin = requireRole(['organizer', 'admin']);

/**
 * Middleware to check if user is accessing their own resources
 */
export const requireSelfOrAdmin = (userIdParam: string = 'userId') => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const targetUserId = req.params[userIdParam] || req.body[userIdParam] || req.query[userIdParam];

    // Allow if user is admin or accessing their own resource
    if (req.user.role === 'admin' || req.user.id === targetUserId) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: 'Access denied. You can only access your own resources.',
    });
  };
};

/**
 * Middleware to check if organizer is accessing their own trips/resources
 */
export const requireOrganizerOwnership = (organizerIdParam: string = 'organizerId') => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const targetOrganizerId = req.params[organizerIdParam] || req.body[organizerIdParam] || req.query[organizerIdParam];

    // Allow if user is admin or the organizer themselves
    if (req.user.role === 'admin' || req.user.id === targetOrganizerId) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: 'Access denied. You can only manage your own resources.',
    });
  };
};
