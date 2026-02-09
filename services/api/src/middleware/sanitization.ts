import { Request, Response, NextFunction } from 'express';
import validator from 'validator';

/**
 * Input sanitization middleware to prevent XSS, SQL/NoSQL injection
 * Sanitizes common attack vectors in request body, query params, and params
 */

// Dangerous patterns that should be stripped or escaped
const DANGEROUS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, // Script tags
  /javascript:/gi, // javascript: protocol
  /on\w+\s*=/gi, // Event handlers (onclick, onerror, etc)
  /data:text\/html/gi, // Data URIs with HTML
];

// MongoDB operator injection patterns
const MONGO_OPERATORS = /^\$|\..*\$/;

/**
 * Sanitize a string value
 */
function sanitizeString(value: string): string {
  if (typeof value !== 'string') return value;

  // If it's a valid URL, skip HTML escaping to preserve the URL structure
  // This is safe because URLs don't execute as scripts in JSON/database context
  if (validator.isURL(value, { require_protocol: true, protocols: ['http', 'https'] })) {
    // Still check for dangerous patterns in URLs
    let sanitized = value;
    DANGEROUS_PATTERNS.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '');
    });
    return sanitized;
  }

  // Strip dangerous HTML patterns
  let sanitized = value;
  DANGEROUS_PATTERNS.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '');
  });

  // Escape HTML entities to prevent XSS
  sanitized = validator.escape(sanitized);

  return sanitized;
}

/**
 * Check if object key looks like MongoDB operator injection
 */
function isSuspiciousKey(key: string): boolean {
  return MONGO_OPERATORS.test(key);
}

/**
 * Recursively sanitize an object
 */
function sanitizeObject(obj: any, depth = 0): any {
  if (depth > 10) return obj; // Prevent deep recursion attacks

  if (obj === null || obj === undefined) return obj;

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, depth + 1));
  }

  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const key in obj) {
      // Skip suspicious keys (potential NoSQL injection)
      if (isSuspiciousKey(key)) {
        console.warn(`Blocked suspicious key in request: ${key}`);
        continue;
      }
      sanitized[key] = sanitizeObject(obj[key], depth + 1);
    }
    return sanitized;
  }

  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }

  return obj;
}

/**
 * Middleware to sanitize request inputs
 * Should be applied early in the middleware chain, after body parsing
 */
export function sanitizeInputs(req: Request, res: Response, next: NextFunction) {
  try {
    // Sanitize body
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body);
    }

    // Sanitize query params
    if (req.query && typeof req.query === 'object') {
      req.query = sanitizeObject(req.query);
    }

    // Sanitize URL params
    if (req.params && typeof req.params === 'object') {
      req.params = sanitizeObject(req.params);
    }

    next();
  } catch (error: any) {
    console.error('Sanitization error:', error);
    // Don't block request on sanitization error, but log it
    next();
  }
}

/**
 * Strict sanitization for file upload fields
 * Validates filenames and prevents directory traversal
 */
export function sanitizeFileUploads(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.file) {
      // Check for directory traversal in filename
      if (req.file.originalname.includes('..') || req.file.originalname.includes('/') || req.file.originalname.includes('\\')) {
        return res.status(400).json({
          error: 'Invalid filename. Filenames cannot contain path separators.',
          message: 'The uploaded file has an invalid name. Please rename it and try again.'
        });
      }
    }

    if (req.files && Array.isArray(req.files)) {
      for (const file of req.files) {
        if (file.originalname.includes('..') || file.originalname.includes('/') || file.originalname.includes('\\')) {
          return res.status(400).json({
            error: 'Invalid filename. Filenames cannot contain path separators.',
            message: 'One or more uploaded files have invalid names. Please rename them and try again.'
          });
        }
      }
    }

    next();
  } catch (error: any) {
    console.error('File sanitization error:', error);
    return res.status(500).json({
      error: 'File validation failed',
      message: 'We could not validate your file upload. Please try again.'
    });
  }
}
