import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../models/User';

// Extend Express Request to include auth property
export interface AuthenticatedRequest extends Request {
  auth: {
    userId: string;
    role: UserRole;
  };
}

// Role hierarchy - higher number = more permissions
const roleHierarchy: Record<UserRole, number> = {
  'traveler': 1,
  'organizer': 2,
  'agent': 3,
  'admin': 4
};

/**
 * Type-safe role requirement middleware that works with Express Router
 */
export function requireRole(requiredRole: UserRole) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthenticatedRequest;
    
    if (!authReq.auth) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userRoleLevel = roleHierarchy[authReq.auth.role];
    const requiredRoleLevel = roleHierarchy[requiredRole];

    if (userRoleLevel < requiredRoleLevel) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required: requiredRole,
        current: authReq.auth.role
      });
    }

    next();
  };
}

/**
 * Check if user has any of the specified roles
 */
export function requireAnyRole(allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthenticatedRequest;
    
    if (!authReq.auth) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!allowedRoles.includes(authReq.auth.role)) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        allowed: allowedRoles,
        current: authReq.auth.role
      });
    }

    next();
  };
}

/**
 * Middleware specifically for admin access
 */
export const requireAdmin = requireRole('admin');

/**
 * Middleware specifically for agent access (agents and admins)
 */
export const requireAgent = requireRole('agent');

/**
 * Middleware for organizer access (organizers, agents, and admins)
 */
export const requireOrganizer = requireRole('organizer');

/**
 * Utility function to check if a role has permission to perform an action
 */
export const hasPermission = (userRole: UserRole, requiredRole: UserRole): boolean => {
  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
};

/**
 * Get all roles that have equal or higher permissions than the specified role
 */
export const getRolesWithPermission = (role: UserRole): UserRole[] => {
  const requiredLevel = roleHierarchy[role];
  return Object.entries(roleHierarchy)
    .filter(([_, level]) => level >= requiredLevel)
    .map(([roleName]) => roleName as UserRole);
};