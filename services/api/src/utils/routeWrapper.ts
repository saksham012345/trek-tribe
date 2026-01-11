import { Request, Response, NextFunction, RequestHandler } from 'express';
import { AuthPayload } from '../middleware/auth';

import { AuthenticatedRequest } from '../types/app-types';
export { AuthenticatedRequest };

// Extended request interface
// export interface AuthenticatedRequest extends Request {
//   user: AuthPayload;
// }

// Type-safe wrapper for route handlers
export function wrapRoute(handler: (req: AuthenticatedRequest, res: Response, next?: NextFunction) => Promise<any> | any): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await handler(req as AuthenticatedRequest, res, next);
    } catch (error) {
      next(error);
    }
  };
}

// Type-safe wrapper for multer middleware with auth
export function wrapMulterRoute(
  handler: (req: AuthenticatedRequest, res: Response, next?: NextFunction) => Promise<any> | any
): any {
  return async (req: any, res: any, next?: any) => {
    try {
      await handler(req as AuthenticatedRequest, res, next);
    } catch (error) {
      next?.(error);
    }
  };
}

// Helper to bypass TypeScript errors for middleware chaining
export function bypassTS(...middleware: any[]): any[] {
  return middleware;
}