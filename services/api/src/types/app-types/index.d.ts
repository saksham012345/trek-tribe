import type { JwtPayload } from 'jsonwebtoken';
import type { ParamsDictionary, Query } from 'express-serve-static-core';
import type { Request } from 'express';

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

// AuthRequest explicitly includes all Request properties
export interface AuthRequest<
  P = ParamsDictionary,
  ResBody = any,
  ReqBody = any,
  ReqQuery = Query,
  Locals extends Record<string, any> = Record<string, any>
> extends Request<P, ResBody, ReqBody, ReqQuery, Locals> {
  user: AuthPayload | any;
  auth?: JwtPayload | AuthPayload | any;
  body: ReqBody;
  query: ReqQuery;
  params: P;
  // Multer property
  file?: Express.Multer.File;
  files?: Express.Multer.File[] | { [fieldname: string]: Express.Multer.File[] };
  // Standard Request properties that seem to be missing in inference
  protocol: string;
  secure: boolean;
  get: (name: string) => string | undefined;
  originalUrl: string;
  baseUrl: string;
  headers: any;
}

// AuthenticatedRequest explicitly includes all Request properties
export interface AuthenticatedRequest<
  P = ParamsDictionary,
  ResBody = any,
  ReqBody = any,
  ReqQuery = Query,
  Locals extends Record<string, any> = Record<string, any>
> extends Request<P, ResBody, ReqBody, ReqQuery, Locals> {
  userId?: string;
  user: AuthPayload | any;
  body: ReqBody;
  query: ReqQuery;
  params: P;
  // Multer property
  file?: Express.Multer.File;
  files?: Express.Multer.File[] | { [fieldname: string]: Express.Multer.File[] };
  // Standard Request properties that seem to be missing in inference
  protocol: string;
  secure: boolean;
  get: (name: string) => string | undefined;
  originalUrl: string;
  baseUrl: string;
  headers: any;
}
