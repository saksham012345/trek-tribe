/**
 * Global Security Middleware
 *
 * Centralizes all security-related middleware so it's applied once
 * at the app level rather than scattered across route files.
 *
 * Applied in index.ts before any route registration.
 */

import { Application, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { sanitizeInputs } from './sanitization';

// ─── Helmet (HTTP security headers) ──────────────────────────────────────────

export function applyHelmet(app: Application) {
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          'default-src': ["'self'"],
          'script-src': [
            "'self'",
            'https://checkout.razorpay.com',
            ...(process.env.NODE_ENV === 'development'
              ? ["'unsafe-eval'", "'unsafe-inline'"]
              : []),
          ],
          'frame-src': ['https://checkout.razorpay.com'],
          'img-src': ["'self'", 'data:', 'https:'],
          'connect-src': [
            "'self'",
            'https:',
            process.env.NODE_ENV === 'development' ? 'http:' : '',
            process.env.FRONTEND_URL || '',
            process.env.BACKEND_URL || '',
            process.env.AI_SERVICE_URL || '',
            'https://api.razorpay.com',
          ].filter(Boolean),
          'object-src': ["'none'"],
          'style-src': ["'self'", "'unsafe-inline'"],
        },
        reportOnly: process.env.NODE_ENV === 'development',
      },
      crossOriginEmbedderPolicy: true,
      crossOriginOpenerPolicy: { policy: 'unsafe-none' },
    })
  );
}

// ─── Global rate limiter ──────────────────────────────────────────────────────

export const globalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { success: false, error: 'Too many requests, please try again later.' },
});

// ─── Input sanitization ───────────────────────────────────────────────────────

export { sanitizeInputs };

// ─── Request ID middleware ────────────────────────────────────────────────────

import { randomUUID } from 'crypto';

export function requestId(req: Request, res: Response, next: NextFunction) {
  const id = (req.headers['x-request-id'] as string) || randomUUID();
  req.headers['x-request-id'] = id;
  res.setHeader('x-request-id', id);
  next();
}

// ─── Apply all security middleware at once ────────────────────────────────────

export function applyGlobalSecurity(app: Application) {
  applyHelmet(app);
  app.use(requestId);
  app.use(sanitizeInputs);
  if (process.env.NODE_ENV !== 'test') {
    app.use(globalRateLimit);
  }
}
