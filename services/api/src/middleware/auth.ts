import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthPayload {
  id: string;
  userId: string;
  role: 'traveler' | 'organizer' | 'admin' | 'agent';
}

// Extend Request type to include user property
declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
      auth?: AuthPayload;
    }
  }
}

export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = authHeader.slice(7);
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is required');
    }
    const payload = jwt.verify(token, secret) as any;
    const authPayload: AuthPayload = {
      id: payload.id || payload.userId,
      userId: payload.id || payload.userId,
      role: payload.role
    };
    req.user = authPayload;
    req.auth = authPayload;
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Alias for backward compatibility
export const authenticateJwt = authenticateToken;
export const auth = authenticateToken;

export function requireRole(roles: AuthPayload['role'][]){
  return (req: Request, res: Response, next: NextFunction) => {
    const payload = req.user || req.auth;
    if (!payload || !roles.includes(payload.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}


