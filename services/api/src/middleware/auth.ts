import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthPayload {
  userId: string;
  role: 'traveler' | 'organizer' | 'admin';
}

export function authenticateJwt(req: Request, res: Response, next: NextFunction) {
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
    const payload = jwt.verify(token, secret) as AuthPayload;
    (req as any).auth = payload;
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export function requireRole(roles: AuthPayload['role'][]){
  return (req: Request, res: Response, next: NextFunction) => {
    const payload = (req as any).auth as AuthPayload | undefined;
    if (!payload || !roles.includes(payload.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}


