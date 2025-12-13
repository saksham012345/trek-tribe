import { Request } from 'express';
import { JwtPayload } from 'jsonwebtoken';

// AuthPayload matches the one from middleware/auth.ts
export interface AuthPayload {
  id: string;
  userId: string;
  role: 'traveler' | 'organizer' | 'admin' | 'agent';
  email?: string;
  _id?: string;
}

declare global {
  namespace Express {
    export namespace Multer {
      export interface File {
        fieldname: string;
        originalname: string;
        encoding: string;
        mimetype: string;
        size: number;
        destination: string;
        filename: string;
        path: string;
        buffer: Buffer;
      }
    }

    interface Request {
      user?: AuthPayload | any;
      userId?: string;
      auth?: JwtPayload | AuthPayload | any;
    }
  }
}

// AuthRequest includes all Express Request properties
export interface AuthRequest extends Request {
  user: AuthPayload | any;
  auth?: JwtPayload | AuthPayload | any;
}

// AuthenticatedRequest includes all Express Request properties
export interface AuthenticatedRequest extends Request {
  userId?: string;
  user: AuthPayload | any;
}
