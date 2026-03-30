/**
 * Subscriptions Controller
 *
 * Thin HTTP layer — extracts params, calls service, returns response.
 * No business logic lives here.
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import * as subscriptionsService from './subscriptions.service';

const createOrderSchema = z.object({
  planType: z.enum(['STARTER', 'BASIC', 'PROFESSIONAL', 'PREMIUM', 'ENTERPRISE']),
  skipTrial: z.boolean().optional().default(false),
});

const verifyPaymentSchema = z.object({
  razorpay_order_id: z.string(),
  razorpay_payment_id: z.string(),
  razorpay_signature: z.string(),
  planType: z.enum(['STARTER', 'BASIC', 'PROFESSIONAL', 'PREMIUM', 'ENTERPRISE']),
});

export async function getPlans(_req: Request, res: Response) {
  try {
    const plans = subscriptionsService.getPlans();
    return res.json({ success: true, plans, message: 'Subscription plans fetched successfully' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Failed to fetch plans', message: error.message });
  }
}

export async function getMySubscription(req: Request, res: Response) {
  try {
    const userId = (req as any).auth?.userId || (req as any).user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const result = await subscriptionsService.getMySubscription(userId);
    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to fetch subscription' });
  }
}

export async function createOrder(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const parsed = createOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten().fieldErrors });
    }

    const { planType, skipTrial } = parsed.data;
    const result = await subscriptionsService.createOrder(userId, planType, skipTrial, req);
    return res.json(result);
  } catch (error: any) {
    console.error('❌ Error creating order:', error);
    if (error.status === 503) {
      return res.status(503).json({ error: error.errorKey || 'Payment service unavailable', message: error.message });
    }
    return res.status(error.status || 500).json({ error: 'Failed to create order', message: error.message });
  }
}

export async function verifyPayment(req: Request, res: Response) {
  try {
    const userId = (req as any).auth?.userId || (req as any).user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const parsed = verifyPaymentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten().fieldErrors });
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, planType } = parsed.data;
    const result = await subscriptionsService.verifyPayment(
      userId, razorpay_order_id, razorpay_payment_id, razorpay_signature, planType, req
    );
    return res.json(result);
  } catch (error: any) {
    console.error('❌ Error verifying payment:', error);
    if (error.status === 503) {
      return res.status(503).json({ error: error.errorKey || 'Payment service unavailable', message: error.message });
    }
    return res.status(error.status || 500).json({ error: 'Failed to verify payment', message: error.message });
  }
}

export async function cancelSubscription(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const result = await subscriptionsService.cancelSubscription(userId, req);
    return res.json(result);
  } catch (error: any) {
    return res.status(error.status || 500).json({ error: 'Failed to cancel subscription' });
  }
}

export async function getPaymentHistory(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const result = await subscriptionsService.getPaymentHistory(userId);
    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to fetch payment history' });
  }
}

export async function incrementTrip(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const result = await subscriptionsService.incrementTrip(userId);
    return res.json(result);
  } catch (error: any) {
    if (error.status === 403) {
      return res.status(403).json({ error: error.errorKey || error.message, message: error.message });
    }
    return res.status(500).json({ error: 'Failed to update trip count' });
  }
}

export async function checkEligibility(req: Request, res: Response) {
  try {
    const userId = (req as any).auth?.userId || (req as any).user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const result = await subscriptionsService.checkEligibility(userId);
    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to check eligibility' });
  }
}

export async function handleWebhook(req: Request, res: Response) {
  try {
    const razorpaySignature = req.headers['x-razorpay-signature'] as string;
    const body = JSON.stringify(req.body);
    const event = req.body.event;
    const eventData = req.body.payload;

    console.log(`📩 Received webhook event: ${event}`);
    await subscriptionsService.processWebhook(razorpaySignature, body, event, eventData);
    return res.status(200).json({ status: 'ok' });
  } catch (error: any) {
    if (error.status === 401) {
      return res.status(401).json({ error: error.message });
    }
    console.error('❌ Webhook processing error:', error);
    return res.status(200).json({ status: 'error', message: error.message });
  }
}

export async function verifyCrmAccess(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.userId || (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const result = await subscriptionsService.verifyCrmAccess(userId);
    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to verify CRM access' });
  }
}

export async function checkFeatureAccess(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.userId;
    const { features } = req.body;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!Array.isArray(features)) return res.status(400).json({ error: 'Features must be an array' });
    const result = await subscriptionsService.checkFeatureAccess(userId, features);
    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to check feature access' });
  }
}

export async function verifyOrganizerInfo(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const result = await subscriptionsService.verifyOrganizerInfo(userId);
    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to verify organizer information', message: error.message });
  }
}

export async function adminUpdateSubscription(req: Request, res: Response) {
  try {
    const { organizerId } = req.params;
    const adminUserId = (req as any).user.userId;
    const result = await subscriptionsService.adminUpdateSubscription(organizerId, req.body, adminUserId, req);
    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to update subscription' });
  }
}

export async function getSubscriptionByOrganizerId(req: Request, res: Response) {
  try {
    const { organizerId } = req.params;
    const requesterId = (req as any).user.userId;
    const role = (req as any).user.role;

    if (role !== 'admin' && requesterId !== organizerId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const subscription = await subscriptionsService.getSubscriptionByOrganizerId(organizerId);
    if (!subscription) {
      return res.json({ success: false, message: 'No subscription found' });
    }
    return res.json({ success: true, data: subscription });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to fetch subscription' });
  }
}
