import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

let Sentry: any = null;
if (process.env.SENTRY_DSN) {
  try {
    // require dynamically so Sentry is optional
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    Sentry = require('@sentry/node');
  } catch (e) {
    // ignore if not installed
    Sentry = null;
  }
}

// Centralized error handler
export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  // Default to 500
  let status = 500;
  let message = 'Internal server error';

  // Mongoose validation error
  if (err && (err.name === 'ValidationError' || err.code === 11000)) {
    status = 400;
    // Build readable message
    if (err.name === 'ValidationError' && err.errors) {
      const parts = Object.keys(err.errors).map(k => err.errors[k].message);
      message = parts.join('; ');
    } else if (err.code === 11000) {
      message = 'Duplicate key error';
    } else {
      message = err.message || 'Validation error';
    }
  }

  // Mongoose CastError (invalid ObjectId)
  if (err && err.name === 'CastError') {
    status = 400;
    message = 'Invalid identifier';
  }

  // JWT errors
  if (err && (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError')) {
    status = 401;
    message = err.message || 'Invalid or expired token';
  }

  // express-validator style error (we throw with statusCode earlier)
  if (err && err.statusCode && typeof err.statusCode === 'number') {
    status = err.statusCode;
    message = err.message || message;
  }

  // Log with structured logger
  try {
    logger.error('Unhandled error', {
      message: err?.message,
      stack: err?.stack,
      path: req.path,
      method: req.method,
      status
    });
  } catch (logErr) {
    // fallback
    console.error('Failed to write structured log', logErr);
  }

  // Also send to Sentry if configured
  try {
    if (Sentry) {
      Sentry.captureException(err);
    }
  } catch (sentryErr) {
    console.warn('Failed to send error to Sentry', sentryErr);
  }

  if (res.headersSent) return next(err);

  res.status(status).json({ error: message });
}

export default errorHandler;
