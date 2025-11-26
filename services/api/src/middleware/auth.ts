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
  // Support multiple header patterns and alternate token header
  const rawAuth = (req.headers.authorization as string) || (req.headers['x-access-token'] as string) || '';
  let token: string | undefined;

  if (rawAuth.startsWith('Bearer ')) {
    token = rawAuth.slice(7).trim();
  } else if (rawAuth) {
    token = rawAuth.trim();
  }

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) {
      throw new Error('JWT_SECRET must be set and at least 32 characters long');
    }

    const payload = jwt.verify(token, secret) as any;

    // Accept common JWT id fields: id, userId, sub, _id
    const resolvedId = payload?.id || payload?.userId || payload?.sub || payload?._id;
    const resolvedRole = payload?.role || payload?.roles || undefined;

    if (!resolvedId) {
      return res.status(401).json({ error: 'Invalid token payload: missing user id' });
    }

    const authPayload: AuthPayload = {
      id: String(resolvedId),
      userId: String(resolvedId),
      role: resolvedRole as any
    };

    req.user = authPayload;
    req.auth = authPayload;
    return next();
  } catch (err) {
    console.error('Authentication error:', err instanceof Error ? err.message : err);
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


