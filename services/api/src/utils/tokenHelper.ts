import jwt from 'jsonwebtoken';
import { IncomingHttpHeaders } from 'http';

export function extractTokenFromHeaders(headers: IncomingHttpHeaders): string | undefined {
  const auth = (headers.authorization as string) || (headers['x-access-token'] as any) || '';
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
    return auth.slice(7).trim();
  }
  if (typeof auth === 'string' && auth.length > 0) {
    return auth.trim();
  }

  // Check cookies for token (e.g., 'token=...')
  const cookieHeader = headers.cookie as string | undefined;
  if (cookieHeader) {
    const cookies = cookieHeader.split(';').map(c => c.trim());
    for (const c of cookies) {
      const [k, v] = c.split('=');
      if (k === 'token' && v) return decodeURIComponent(v);
      if (k === 'auth-token' && v) return decodeURIComponent(v);
    }
  }

  return undefined;
}

export function verifyJwtToken(token: string) {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be set and at least 32 characters long');
  }

  const payload = jwt.verify(token, secret) as any;
  return payload;
}

export function extractAndVerifyFromHeaders(headers: IncomingHttpHeaders) {
  const token = extractTokenFromHeaders(headers);
  if (!token) return null;
  try {
    return verifyJwtToken(token);
  } catch (err) {
    throw err;
  }
}

export default {
  extractTokenFromHeaders,
  verifyJwtToken,
  extractAndVerifyFromHeaders
};
