# TrekTribe Razorpay Route Marketplace Implementation Guide

**Last Updated:** December 13, 2025  
**Status:** Implementation Plan  
**Target:** Full marketplace payment system with commission splits

---

## Executive Summary

This document provides a complete implementation plan for transforming TrekTribe into a marketplace platform using **Razorpay Route**. The system will:

- Collect payments on platform (TrekTribe receives all payments)
- Automatically split settlements (platform commission + organizer payout)
- Manage refunds, disputes, and compliance centrally
- Handle escrow/hold periods for trip completion

**Key Difference from Current System:**
- **Current:** Organizers receive payments directly via subscriptions
- **New:** Platform receives all payments, takes commission, then transfers to organizers

---

## 1. Prerequisites & Account Setup

### 1.1 Razorpay Route Access
```bash
# Steps:
1. Contact Razorpay sales/support
2. Request "Route" / "Marketplace" feature enablement
3. Provide business details and use case
4. Wait for approval (can take 1-2 weeks)
5. Receive Route API access confirmation
```

### 1.2 Required Credentials
```bash
# Platform Keys (already have)
RAZORPAY_KEY_ID=rzp_live_...
RAZORPAY_KEY_SECRET=<secret>
RAZORPAY_WEBHOOK_SECRET=<webhook secret>

# New Route-specific
RAZORPAY_ROUTE_ENABLED=true
PLATFORM_COMMISSION_RATE=5  # 5% commission
```

---

## 2. Architecture Overview

### 2.1 Payment Flow
```
User → Platform Checkout → Razorpay Order (Platform) 
  → Payment Captured 
    → Auto-Split via Route:
      - Platform Commission (5%)
      - Razorpay Fee (1.8%)
      - Organizer Payout (remaining)
    → Settlement to respective accounts
```

### 2.2 Component Diagram
```
┌─────────────┐      ┌──────────────┐      ┌─────────────────┐
│  Frontend   │─────→│   Backend    │─────→│   Razorpay      │
│  (Next.js)  │      │  (Express)   │      │   Route API     │
└─────────────┘      └──────────────┘      └─────────────────┘
                            │                        │
                            ↓                        ↓
                     ┌──────────────┐      ┌─────────────────┐
                     │   MongoDB    │      │  Organizer Bank │
                     │   Database   │      │   Settlements   │
                     └──────────────┘      └─────────────────┘
```

---

## 3. Database Schema Extensions

### 3.1 Organizer Model (Enhanced)
```typescript
// Add to existing Organizer schema
{
  // Existing fields...
  razorpay_account_id: string;  // Route sub-merchant ID
  razorpay_onboarding_status: 'pending' | 'connected' | 'activated' | 'rejected';
  
  // Bank details for payouts
  bank_account: {
    account_number: string;  // Encrypted
    ifsc_code: string;
    account_holder_name: string;
    bank_name: string;
  };
  
  // Payout preferences
  payout_settings: {
    frequency: 'instant' | 'daily' | 'weekly' | 'trip_completion';
    hold_period_days: number;  // e.g., 7 days after trip end
    minimum_payout_amount: number;  // e.g., 1000 INR
  };
  
  // Commission agreement
  commission_rate: number;  // Default 5%, can be customized per organizer
  
  // KYC for Route
  route_kyc: {
    business_name: string;
    business_type: 'proprietorship' | 'partnership' | 'llp' | 'pvt_ltd';
    pan: string;  // Encrypted
    gstin?: string;
    documents: [{
      type: string;
      url: string;
      verified: boolean;
    }];
  };
}
```

### 3.2 New Transfer Model
```typescript
// services/api/src/models/Transfer.ts
interface Transfer {
  _id: ObjectId;
  order_id: ObjectId;  // Reference to GroupBooking
  organizer_id: ObjectId;
  
  // Razorpay details
  razorpay_transfer_id: string;
  razorpay_payment_id: string;
  
  // Amount breakdown
  booking_amount: number;  // Total booking amount
  platform_commission: number;  // e.g., 5% of amount
  razorpay_fee: number;  // e.g., 1.8% of amount
  organizer_payout: number;  // Remaining after deductions
  
  // Status tracking
  status: 'pending' | 'initiated' | 'processed' | 'failed' | 'reversed';
  transfer_mode: 'instant' | 'scheduled';
  
  // Timing
  initiated_at: Date;
  processed_at?: Date;
  scheduled_for?: Date;  // For hold periods
  
  // Hold logic
  hold_until?: Date;  // Trip end date + buffer
  hold_reason?: string;  // e.g., "Waiting for trip completion"
  
  // Metadata
  notes: string;
  error_reason?: string;
  webhook_received: boolean;
}
```

### 3.3 Enhanced GroupBooking Model
```typescript
// Add to existing GroupBooking schema
{
  // Existing fields...
  
  // Split details
  payment_split: {
    total_amount: number;
    platform_commission: number;
    platform_commission_rate: number;  // % at time of booking
    razorpay_fee: number;
    organizer_payout: number;
    split_calculated_at: Date;
  };
  
  // Transfer tracking
  transfer_id?: ObjectId;  // Reference to Transfer model
  transfer_status: 'not_initiated' | 'pending' | 'completed' | 'failed';
  
  // Refund tracking (enhanced)
  refund_details?: {
    amount: number;
    reason: string;
    initiated_by: ObjectId;  // admin user
    initiated_at: Date;
    razorpay_refund_id: string;
    reversed_transfer: boolean;  // Did we reverse organizer transfer?
    status: 'pending' | 'processed' | 'failed';
  };
}
```

---

## 4. Backend Implementation

### 4.1 New Route Service
```typescript
// services/api/src/services/razorpayRouteService.ts

import Razorpay from 'razorpay';
import { Organizer } from '../models/Organizer';
import { Transfer } from '../models/Transfer';
import { logger } from '../utils/logger';
import crypto from 'crypto';

class RazorpayRouteService {
  private razorpay: Razorpay;

  constructor() {
    this.razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    });
  }

  /**
   * Create a Route sub-merchant account for organizer
   */
  async createSubMerchantAccount(organizerId: string, data: {
    email: string;
    phone: string;
    legal_business_name: string;
    business_type: string;
    bank_account: {
      account_number: string;
      ifsc_code: string;
      beneficiary_name: string;
    };
  }): Promise<{ account_id: string; success: boolean; error?: string }> {
    try {
      // Note: Use actual Razorpay Route API endpoint
      // This is pseudo-code - check Razorpay docs for exact endpoint
      const response = await this.razorpay.accounts.create({
        email: data.email,
        phone: data.phone,
        type: 'route',
        legal_business_name: data.legal_business_name,
        business_type: data.business_type,
        contact_name: data.legal_business_name,
        profile: {
          category: 'travel_and_tourism',
          subcategory: 'tour_operators',
        },
        legal_info: {
          pan: data.bank_account.beneficiary_name,  // Requires actual PAN
        },
        // Bank account for settlements
        bank_account: {
          ifsc: data.bank_account.ifsc_code,
          account_number: data.bank_account.account_number,
          beneficiary_name: data.bank_account.beneficiary_name,
        },
      });

      // Update organizer with account_id
      await Organizer.findByIdAndUpdate(organizerId, {
        razorpay_account_id: response.id,
        razorpay_onboarding_status: 'connected',
      });

      logger.info('Route sub-merchant created', { organizerId, accountId: response.id });

      return {
        account_id: response.id,
        success: true,
      };
    } catch (error: any) {
      logger.error('Error creating sub-merchant', { error: error.message, organizerId });
      return {
        account_id: '',
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Create transfer after payment capture
   */
  async createTransfer(params: {
    payment_id: string;
    order_id: string;
    organizer_id: string;
    booking_amount: number;
    commission_rate: number;
  }): Promise<{ transfer_id: string; success: boolean; error?: string }> {
    try {
      const { payment_id, order_id, organizer_id, booking_amount, commission_rate } = params;

      // Get organizer's Route account
      const organizer = await Organizer.findById(organizer_id);
      if (!organizer || !organizer.razorpay_account_id) {
        throw new Error('Organizer Route account not found');
      }

      // Calculate split
      const platformCommission = Math.floor(booking_amount * (commission_rate / 100));
      const razorpayFee = Math.floor(booking_amount * 0.018);  // 1.8%
      const organizerPayout = booking_amount - platformCommission - razorpayFee;

      // Create transfer via Razorpay Route API
      const transferResponse = await this.razorpay.transfers.create({
        account: organizer.razorpay_account_id,
        amount: organizerPayout,
        currency: 'INR',
        source: payment_id,
        notes: {
          order_id: order_id,
          organizer_id: organizer_id,
          type: 'trip_booking_payout',
        },
        on_hold: false,  // Set true if you want escrow/hold
        on_hold_until: null,  // Unix timestamp if holding
      });

      // Save transfer record
      const transfer = new Transfer({
        order_id,
        organizer_id,
        razorpay_transfer_id: transferResponse.id,
        razorpay_payment_id: payment_id,
        booking_amount,
        platform_commission: platformCommission,
        razorpay_fee: razorpayFee,
        organizer_payout: organizerPayout,
        status: 'initiated',
        transfer_mode: 'instant',
        initiated_at: new Date(),
      });
      await transfer.save();

      logger.info('Transfer created', { 
        transferId: transferResponse.id, 
        orderId: order_id,
        amount: organizerPayout 
      });

      return {
        transfer_id: transferResponse.id,
        success: true,
      };
    } catch (error: any) {
      logger.error('Error creating transfer', { error: error.message, params });
      return {
        transfer_id: '',
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Reverse transfer for refunds
   */
  async reverseTransfer(transferId: string, amount?: number): Promise<boolean> {
    try {
      await this.razorpay.transfers.reverse(transferId, {
        amount: amount,  // Partial reverse if specified
      });

      await Transfer.findOneAndUpdate(
        { razorpay_transfer_id: transferId },
        { status: 'reversed' }
      );

      logger.info('Transfer reversed', { transferId, amount });
      return true;
    } catch (error: any) {
      logger.error('Error reversing transfer', { error: error.message, transferId });
      return false;
    }
  }
}

export const razorpayRouteService = new RazorpayRouteService();
```

### 4.2 New Routes

```typescript
// services/api/src/routes/marketplace.ts

import { Router } from 'express';
import { authenticateJwt, requireRole } from '../middleware/auth';
import { razorpayRouteService } from '../services/razorpayRouteService';
import { Organizer } from '../models/Organizer';
import { GroupBooking } from '../models/GroupBooking';
import { Transfer } from '../models/Transfer';
import { z } from 'zod';

const router = Router();

/**
 * POST /api/marketplace/organizer/onboard
 * Onboard organizer to Route
 */
router.post('/organizer/onboard', authenticateJwt, requireRole(['organizer']), async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const organizer = await Organizer.findOne({ userId });

    if (!organizer) {
      return res.status(404).json({ error: 'Organizer profile not found' });
    }

    if (organizer.razorpay_account_id) {
      return res.status(400).json({ error: 'Already onboarded to Route' });
    }

    const schema = z.object({
      legal_business_name: z.string(),
      business_type: z.enum(['proprietorship', 'partnership', 'llp', 'pvt_ltd']),
      bank_account: z.object({
        account_number: z.string(),
        ifsc_code: z.string(),
        beneficiary_name: z.string(),
      }),
    });

    const data = schema.parse(req.body);

    const result = await razorpayRouteService.createSubMerchantAccount(organizer._id.toString(), {
      email: organizer.email,
      phone: organizer.phone || '',
      ...data,
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({
      success: true,
      account_id: result.account_id,
      message: 'Successfully onboarded to Route marketplace',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/marketplace/organizer/status
 * Get Route onboarding status
 */
router.get('/organizer/status', authenticateJwt, requireRole(['organizer']), async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const organizer = await Organizer.findOne({ userId });

    if (!organizer) {
      return res.status(404).json({ error: 'Organizer not found' });
    }

    res.json({
      onboarded: !!organizer.razorpay_account_id,
      account_id: organizer.razorpay_account_id,
      status: organizer.razorpay_onboarding_status || 'pending',
      bank_account_linked: !!organizer.bank_account?.account_number,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/marketplace/organizer/transfers
 * Get transfer history for organizer
 */
router.get('/organizer/transfers', authenticateJwt, requireRole(['organizer']), async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const organizer = await Organizer.findOne({ userId });

    if (!organizer) {
      return res.status(404).json({ error: 'Organizer not found' });
    }

    const transfers = await Transfer.find({ organizer_id: organizer._id })
      .populate('order_id', 'tripId numberOfPeople totalAmount')
      .sort({ initiated_at: -1 })
      .limit(50);

    const summary = {
      total_transfers: transfers.length,
      total_payout: transfers.reduce((sum, t) => sum + t.organizer_payout, 0),
      pending_count: transfers.filter(t => t.status === 'pending').length,
      processed_count: transfers.filter(t => t.status === 'processed').length,
    };

    res.json({
      transfers,
      summary,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
```

### 4.3 Enhanced Webhook Handler

```typescript
// Add to services/api/src/routes/webhooks.ts

// New webhook events to handle
router.post('/razorpay', async (req: Request, res: Response) => {
  // ... existing signature verification ...

  const event = req.body.event;
  const payload = req.body.payload;

  try {
    switch (event) {
      // ... existing cases ...

      case 'transfer.processed':
        await handleTransferProcessed(payload);
        break;

      case 'transfer.failed':
        await handleTransferFailed(payload);
        break;

      case 'transfer.reversed':
        await handleTransferReversed(payload);
        break;

      // ... other cases ...
    }

    res.json({ status: 'ok' });
  } catch (error) {
    logger.error('Webhook processing error', { error, event });
    res.status(500).json({ error: 'Processing failed' });
  }
});

async function handleTransferProcessed(payload: any) {
  const transferId = payload.transfer.entity.id;
  
  await Transfer.findOneAndUpdate(
    { razorpay_transfer_id: transferId },
    {
      status: 'processed',
      processed_at: new Date(),
      webhook_received: true,
    }
  );

  // Update booking
  const transfer = await Transfer.findOne({ razorpay_transfer_id: transferId });
  if (transfer) {
    await GroupBooking.findByIdAndUpdate(transfer.order_id, {
      transfer_status: 'completed',
    });
  }

  logger.info('Transfer processed', { transferId });
}

async function handleTransferFailed(payload: any) {
  const transferId = payload.transfer.entity.id;
  const errorReason = payload.transfer.entity.error?.description;

  await Transfer.findOneAndUpdate(
    { razorpay_transfer_id: transferId },
    {
      status: 'failed',
      error_reason: errorReason,
      webhook_received: true,
    }
  );

  logger.error('Transfer failed', { transferId, errorReason });

  // TODO: Trigger admin alert for manual intervention
}
```

---

## 5. Frontend Implementation

### 5.1 Organizer Onboarding Page

```tsx
// web/src/pages/OrganizerRouteOnboarding.tsx

import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';

export default function OrganizerRouteOnboarding() {
  const { user } = useAuth();
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    legal_business_name: '',
    business_type: 'proprietorship',
    account_number: '',
    ifsc_code: '',
    beneficiary_name: '',
  });

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const response = await api.get('/api/marketplace/organizer/status');
      setStatus(response.data);
    } catch (error) {
      console.error('Error fetching status:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await api.post('/api/marketplace/organizer/onboard', {
        legal_business_name: formData.legal_business_name,
        business_type: formData.business_type,
        bank_account: {
          account_number: formData.account_number,
          ifsc_code: formData.ifsc_code,
          beneficiary_name: formData.beneficiary_name,
        },
      });

      alert('Successfully onboarded to Route! You can now receive payouts.');
      fetchStatus();
    } catch (error: any) {
      alert(`Error: ${error.response?.data?.error || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!status) {
    return <div className="p-8">Loading...</div>;
  }

  if (status.onboarded) {
    return (
      <div className="max-w-2xl mx-auto p-8">
        <div className="bg-green-50 border border-green-200 rounded-xl p-6">
          <h2 className="text-2xl font-bold text-green-800 mb-4">
            ✅ Route Onboarding Complete
          </h2>
          <div className="space-y-2 text-sm">
            <p><strong>Account ID:</strong> {status.account_id}</p>
            <p><strong>Status:</strong> {status.status}</p>
            <p><strong>Bank Linked:</strong> {status.bank_account_linked ? 'Yes' : 'No'}</p>
          </div>
        </div>

        <div className="mt-8">
          <h3 className="text-xl font-bold mb-4">How Payouts Work</h3>
          <ul className="space-y-2 text-sm text-gray-700">
            <li>✓ Platform automatically splits payments after each booking</li>
            <li>✓ Your payout = Booking Amount - 5% Platform Fee - 1.8% Payment Fee</li>
            <li>✓ Payouts are processed instantly after trip booking</li>
            <li>✓ Funds are settled to your bank within 24-48 hours</li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">Complete Route Onboarding</h1>
      <p className="text-gray-600 mb-8">
        Connect your bank account to receive automatic payouts when travelers book your trips.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-semibold mb-2">Legal Business Name</label>
          <input
            type="text"
            required
            value={formData.legal_business_name}
            onChange={(e) => setFormData({ ...formData, legal_business_name: e.target.value })}
            className="w-full px-4 py-2 border rounded-lg"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold mb-2">Business Type</label>
          <select
            value={formData.business_type}
            onChange={(e) => setFormData({ ...formData, business_type: e.target.value })}
            className="w-full px-4 py-2 border rounded-lg"
          >
            <option value="proprietorship">Proprietorship</option>
            <option value="partnership">Partnership</option>
            <option value="llp">LLP</option>
            <option value="pvt_ltd">Private Limited</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold mb-2">Bank Account Number</label>
          <input
            type="text"
            required
            value={formData.account_number}
            onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
            className="w-full px-4 py-2 border rounded-lg"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold mb-2">IFSC Code</label>
          <input
            type="text"
            required
            value={formData.ifsc_code}
            onChange={(e) => setFormData({ ...formData, ifsc_code: e.target.value })}
            className="w-full px-4 py-2 border rounded-lg"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold mb-2">Account Holder Name</label>
          <input
            type="text"
            required
            value={formData.beneficiary_name}
            onChange={(e) => setFormData({ ...formData, beneficiary_name: e.target.value })}
            className="w-full px-4 py-2 border rounded-lg"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Processing...' : 'Complete Onboarding'}
        </button>
      </form>
    </div>
  );
}
```

---

## 6. Migration Strategy

### 6.1 Phased Rollout

**Phase 1: Parallel Testing (2 weeks)**
- Keep existing subscription system running
- Onboard 5-10 test organizers to Route
- Process test bookings with Route splits
- Monitor transfers and settlements

**Phase 2: Selective Migration (4 weeks)**
- Onboard new organizers to Route by default
- Offer existing organizers option to migrate
- Run both systems in parallel
- Compare revenue and organizer satisfaction

**Phase 3: Full Migration (6-8 weeks)**
- Migrate all organizers to Route
- Deprecate old subscription system
- Update all documentation and help guides

### 6.2 Data Migration Script

```typescript
// scripts/migrate-to-route.ts

// Script to migrate existing organizers to Route
// Run after Route approval and testing

import { Organizer } from '../models/Organizer';
import { razorpayRouteService } from '../services/razorpayRouteService';

async function migrateOrganizers() {
  const organizers = await Organizer.find({
    razorpay_account_id: { $exists: false },
    // Only migrate active organizers with verified bank details
    kycStatus: 'approved',
    'bank_account.account_number': { $exists: true },
  });

  console.log(`Found ${organizers.length} organizers to migrate`);

  for (const organizer of organizers) {
    try {
      console.log(`Migrating: ${organizer.name} (${organizer.email})`);
      
      const result = await razorpayRouteService.createSubMerchantAccount(
        organizer._id.toString(),
        {
          email: organizer.email,
          phone: organizer.phone || '',
          legal_business_name: organizer.name,
          business_type: 'proprietorship',
          bank_account: {
            account_number: organizer.bank_account.account_number,
            ifsc_code: organizer.bank_account.ifsc_code,
            beneficiary_name: organizer.bank_account.account_holder_name,
          },
        }
      );

      if (result.success) {
        console.log(`✅ Success: ${result.account_id}`);
      } else {
        console.error(`❌ Failed: ${result.error}`);
      }

      // Rate limit: wait 2 seconds between API calls
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`Error migrating ${organizer.email}:`, error);
    }
  }
}

migrateOrganizers().then(() => console.log('Migration complete'));
```

---

## 7. Financial & Operational Considerations

### 7.1 Commission Structure
```
Example Booking: ₹10,000

Breakdown:
- Customer pays: ₹10,000
- Razorpay fee (1.8%): ₹180
- Platform commission (5%): ₹500
- Organizer receives: ₹9,320

Platform keeps: ₹500 - ₹180 (Razorpay fee) = ₹320 net
```

### 7.2 Hold Period Strategy

**Option A: Instant Transfer (Current Implementation)**
- Transfer to organizer immediately after booking
- Higher risk: refunds require reverse transfers
- Better for organizer cash flow

**Option B: Hold Until Trip Completion**
- Hold funds in platform account until trip ends
- Transfer after trip + 7 day buffer
- Lower risk: easier refunds
- Worse for organizer cash flow

**Recommendation:** Start with Option A (instant), implement Option B for high-value bookings (>₹50,000)

### 7.3 Refund Policy
```
Refund Timeline:
- 30+ days before trip: 100% refund (minus processing fee)
- 15-30 days: 75% refund
- 7-15 days: 50% refund
- <7 days: No refund

Refund Processing:
1. Check if transfer already processed to organizer
2. If yes: Reverse transfer to organizer (they bear the refund)
3. If no: Cancel transfer, refund from platform balance
4. Razorpay fee (1.8%) is typically non-refundable
```

---

## 8. Testing Checklist

### 8.1 Route Onboarding
- [ ] Organizer can submit bank details
- [ ] Account ID is generated and stored
- [ ] Bank account verification succeeds
- [ ] KYC documents upload works
- [ ] Status page shows correct state

### 8.2 Payment Splits
- [ ] Payment capture triggers auto-split
- [ ] Commission calculated correctly
- [ ] Transfer created in Razorpay
- [ ] Transfer record saved in DB
- [ ] Webhook confirms transfer success
- [ ] Organizer sees payout in dashboard

### 8.3 Refunds
- [ ] Refund before transfer: works directly
- [ ] Refund after transfer: reverse transfer works
- [ ] Partial refunds calculated correctly
- [ ] Refund status updated in DB
- [ ] Both parties receive refund notifications

### 8.4 Edge Cases
- [ ] Failed transfer: retry logic works
- [ ] Organizer bank account invalid: error handled
- [ ] Webhook missed: reconciliation catches it
- [ ] Duplicate webhook: idempotency works
- [ ] Organizer not onboarded: booking fails gracefully

---

## 9. Environment Variables

```bash
# Add to .env

# Route Configuration
RAZORPAY_ROUTE_ENABLED=true
PLATFORM_COMMISSION_RATE=5  # Percentage

# Hold Period Settings
ENABLE_HOLD_PERIOD=false
DEFAULT_HOLD_DAYS=7

# Payout Settings
MIN_PAYOUT_AMOUNT=1000  # Minimum INR for payout
AUTO_PAYOUT_ENABLED=true

# Encryption (for sensitive bank details)
ENCRYPTION_KEY=<32-char-random-string>
ENCRYPTION_ALGORITHM=aes-256-cbc
```

---

## 10. Next Steps

### Immediate Actions
1. **Contact Razorpay** - Request Route enablement (can take 1-2 weeks)
2. **Legal Review** - Ensure terms cover marketplace model and commissions
3. **Update Contracts** - Organizer agreements must mention Route payouts
4. **Tax Consultation** - Understand GST/TDS implications of platform commission

### Development Timeline
- **Week 1-2:** Wait for Route approval, update contracts
- **Week 3:** Implement backend (service, routes, models)
- **Week 4:** Implement frontend (onboarding page, transfer history)
- **Week 5:** Testing with 5 pilot organizers
- **Week 6-8:** Fix issues, add monitoring, prepare migration
- **Week 9-12:** Gradual rollout to all organizers

### Success Metrics
- 95%+ transfer success rate
- <24 hour settlement time
- <5% refund rate
- Zero security incidents
- 90%+ organizer satisfaction

---

## 11. FAQs

**Q: Do we need to change our current payment flow immediately?**
A: No. Run both systems in parallel initially. Route is optional for now.

**Q: What if an organizer doesn't want to onboard to Route?**
A: Keep the old subscription system as fallback. They pay subscription, we don't take commission.

**Q: How do refunds work if organizer already received money?**
A: Use Razorpay's reverse transfer API to take back the funds before issuing customer refund.

**Q: Can we customize commission per organizer?**
A: Yes. Store `commission_rate` in Organizer model. Default 5%, but can be adjusted.

**Q: What about trip cancellations by organizer?**
A: Implement a penalty system. If organizer cancels, they forfeit their payout and we refund traveler.

---

## Conclusion

This implementation transforms TrekTribe into a true marketplace platform where:
- **Platform controls payments** - Better trust, easier refunds, faster dispute resolution
- **Automatic commission** - No manual tracking, instant revenue
- **Organizer convenience** - Auto-payouts, no subscription fees
- **Scalable model** - Add features like escrow, installments, multi-currency

**Estimated Development Time:** 6-8 weeks (including Route approval wait time)

**Recommendation:** Start with pilot program of 10 organizers before full rollout.

---

**Document Status:** Implementation Plan  
**Next Review:** After Route approval from Razorpay  
**Owner:** Backend Team  
**Last Updated:** December 13, 2025
