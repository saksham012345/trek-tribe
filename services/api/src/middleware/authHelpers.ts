/**
 * Unified authentication middleware layer.
 *
 * Provides a single, consistent API for all route-level auth checks.
 * All existing middleware (authenticateToken, authenticateJwt, requireRole,
 * requireOrganizerOrAdmin, etc.) are preserved as-is — this file simply
 * re-exports them under canonical names so new code uses one import path.
 *
 * Usage:
 *   import { auth, role, orgOrAdmin, adminOnly } from '../middleware/authHelpers';
 *
 *   router.get('/protected', auth, role('organizer'), handler);
 */

import {
  authenticateToken,
  requireRole as _requireRole,
} from './auth';

import {
  requireAdmin,
  requireOrganizerOrAdmin,
  requireRole as _roleCheck,
} from './roleCheck';

// ─── Canonical names ──────────────────────────────────────────────────────────

/** Verify JWT and populate req.user / req.auth. Replaces authenticateToken / authenticateJwt. */
export const auth = authenticateToken;

/** Require a specific role (or array of roles). */
export const role = _roleCheck;

/** Require organizer OR admin role. */
export const orgOrAdmin = requireOrganizerOrAdmin;

/** Require admin role. */
export const adminOnly = requireAdmin;

// ─── Re-export originals for backward compatibility ───────────────────────────
export { authenticateToken, requireOrganizerOrAdmin, requireAdmin };
export { authenticateToken as authenticateJwt } from './auth';
