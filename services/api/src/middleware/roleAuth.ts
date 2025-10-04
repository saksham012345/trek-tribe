import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../models/User';

interface AuthenticatedRequest extends Request {
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
 * Middleware to check if user has required role or higher
 * @param requiredRole Minimum role required to access the route
 * @returns Express middleware function
 */
export const requireRole = (requiredRole: UserRole) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.auth) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userRoleLevel = roleHierarchy[req.auth.role];
    const requiredRoleLevel = roleHierarchy[requiredRole];

    if (userRoleLevel < requiredRoleLevel) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required: requiredRole,
        current: req.auth.role
      });
    }

    next();
  };
};

/**
 * Middleware to check if user has any of the specified roles
 * @param allowedRoles Array of roles that are allowed to access the route
 * @returns Express middleware function
 */
export const requireAnyRole = (allowedRoles: UserRole[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.auth) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!allowedRoles.includes(req.auth.role)) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        allowed: allowedRoles,
        current: req.auth.role
      });
    }

    next();
  };
};

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
 * Middleware to check if user can access resource based on ownership or role
 * @param resourceUserIdField Field name in request that contains the resource owner's user ID
 * @returns Express middleware function
 */
export const requireOwnershipOrRole = (resourceUserIdField: string, minimumRole: UserRole = 'agent') => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.auth) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const resourceUserId = req.params[resourceUserIdField] || req.body[resourceUserIdField];
    const isOwner = req.auth.userId === resourceUserId;
    const hasRequiredRole = roleHierarchy[req.auth.role] >= roleHierarchy[minimumRole];

    if (!isOwner && !hasRequiredRole) {
      return res.status(403).json({ 
        error: 'Access denied. You can only access your own resources or need higher permissions.',
        required: minimumRole,
        current: req.auth.role
      });
    }

    next();
  };
};

/**
 * Utility function to check if a role has permission to perform an action
 * @param userRole Current user's role
 * @param requiredRole Minimum role required
 * @returns boolean indicating if user has permission
 */
export const hasPermission = (userRole: UserRole, requiredRole: UserRole): boolean => {
  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
};

/**
 * Get all roles that have equal or higher permissions than the specified role
 * @param role Role to compare against
 * @returns Array of roles with equal or higher permissions
 */
export const getRolesWithPermission = (role: UserRole): UserRole[] => {
  const requiredLevel = roleHierarchy[role];
  return Object.entries(roleHierarchy)
    .filter(([_, level]) => level >= requiredLevel)
    .map(([roleName]) => roleName as UserRole);
};