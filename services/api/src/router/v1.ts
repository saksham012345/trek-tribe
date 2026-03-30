/**
 * API v1 Router
 *
 * Mounts all existing route handlers under /api/v1/...
 * This is a pure alias layer — no handler logic lives here.
 * All routes delegate to the same handlers as the legacy paths.
 */

import { Router } from 'express';

// ─── Route imports (same handlers as legacy) ──────────────────────────────────
import authRoutes from '../routes/auth';
import tripRoutes from '../routes/trips';
import reviewRoutes from '../routes/reviews';
import wishlistRoutes from '../routes/wishlist';
import bookingRoutes from '../routes/bookings';
import groupBookingRoutes from '../routes/groupBookings';
import adminRoutes from '../routes/admin';
import profileRoutes from '../routes/profile';
import enhancedProfileRoutes from '../routes/enhancedProfile';
import publicProfileRoutes from '../routes/publicProfile';
import uploadRoutes from '../routes/upload';
import agentRoutes from '../routes/agent';
import chatSupportRoutes from '../routes/chatSupportRoutes';
import followRoutes from '../routes/follow';
import postsRoutes from '../routes/posts';
import groupsRoutes from '../routes/groups';
import eventsRoutes from '../routes/events';
import searchRoutes from '../routes/search';
import supportRoutes from '../routes/support';
import crmRoutes from '../routes/crm';
import emailVerificationRoutes from '../routes/emailVerification';
import verificationRoutes from '../routes/verification';
import recommendationsRoutes from '../routes/recommendations';
import notificationRoutes from '../routes/notifications';
import subscriptionRoutes from '../routes/subscriptions';
import analyticsRoutes from '../routes/analytics';
import receiptRoutes from '../routes/receipts';
import webhookRoutes from '../routes/webhooks';
import autoPayRoutes from '../routes/autoPay';
import usersRoutes from '../routes/users';
import dashboardRoutes from '../routes/dashboard';
import organizerRoutes from '../routes/organizer';
import paymentVerificationRoutes from '../routes/paymentVerification';
import paymentRoutes from '../routes/payments';
import marketplaceRoutes from '../routes/marketplace';
import customTripRoutes from '../routes/customTrips';
import bankDetailsRoutes from '../routes/bankDetails';
import financeRoutes from '../routes/finance';
import databaseImportRoutes from '../routes/databaseImport';
import reviewVerificationRoutes from '../routes/reviewVerification';
import { authLimiter } from '../middleware/rateLimiter';

const v1 = Router();

// Auth
v1.use('/auth', authLimiter, authRoutes);

// Core content
v1.use('/trips', tripRoutes);
v1.use('/reviews', reviewRoutes);
v1.use('/wishlist', wishlistRoutes);

// Bookings
v1.use('/group-bookings', groupBookingRoutes);
v1.use('/bookings', bookingRoutes);

// Users & profiles
v1.use('/profile', profileRoutes);
v1.use('/profile', enhancedProfileRoutes);
v1.use('/public', publicProfileRoutes);
v1.use('/users', usersRoutes);

// Uploads
v1.use('/uploads', uploadRoutes);

// Roles
v1.use('/admin', adminRoutes);
v1.use('/agent', agentRoutes);
v1.use('/organizer', organizerRoutes);

// Social
v1.use('/follow', followRoutes);
v1.use('/posts', postsRoutes);
v1.use('/groups', groupsRoutes);
v1.use('/events', eventsRoutes);
v1.use('/search', searchRoutes);

// Support & chat
v1.use('/support', supportRoutes);
v1.use('/chat', chatSupportRoutes);
v1.use('/review-verification', reviewVerificationRoutes);

// CRM
v1.use('/crm', crmRoutes);
v1.use('/database-import', databaseImportRoutes);

// Verification
v1.use('/verify-email', emailVerificationRoutes);
v1.use('/verification', verificationRoutes);

// Subscriptions & payments
v1.use('/subscriptions', subscriptionRoutes);
v1.use('/payments', paymentRoutes);
v1.use('/payment-verification', paymentVerificationRoutes);
v1.use('/auto-pay', autoPayRoutes);
v1.use('/marketplace', marketplaceRoutes);
v1.use('/bank-details', bankDetailsRoutes);
v1.use('/finance', financeRoutes);
v1.use('/webhooks', webhookRoutes);
v1.use('/receipts', receiptRoutes);

// Analytics & dashboard
v1.use('/analytics', analyticsRoutes);
v1.use('/dashboard', dashboardRoutes);
v1.use('/recommendations', recommendationsRoutes);
v1.use('/notifications', notificationRoutes);

// Custom trips
v1.use('/custom-trips', customTripRoutes);

export default v1;
