# Payment Configuration Environment Variables

# Add these to your .env file in services/api/

## Razorpay Routing Configuration
# Enable/disable Razorpay routing (submerchant accounts)
# When false: All payments go through main Razorpay account
# When true: Eligible organizers get dedicated routes
ENABLE_RAZORPAY_ROUTING=false

# Minimum trust score required for routing enablement (0-100)
# Organizers below this score will use main account
MIN_TRUST_SCORE_FOR_ROUTING=70

# Fallback to main account if routing fails
USE_MAIN_ACCOUNT_FALLBACK=true

# Platform commission rate (percentage)
PLATFORM_COMMISSION_RATE=5

# Auto-approve threshold - organizers below this score use main account
AUTO_APPROVE_THRESHOLD=50

## Existing Razorpay Variables (Already Configured)
# RAZORPAY_KEY_ID=rzp_test_RprUwM1vPIM49e
# RAZORPAY_KEY_SECRET=J0qz50Bw0jzv6LK9G0jdN3cF
# RAZORPAY_WEBHOOK_SECRET=whsec_TrekTribe2025SecureWebhookSecret4Razorpay

## How to Use:

### 1. Start with Routing DISABLED (Recommended for Initial Setup)
```env
ENABLE_RAZORPAY_ROUTING=false
```
- All payments go through your main Razorpay account
- You manually track and payout organizers
- Simple setup, full control

### 2. Enable Routing for High-Trust Organizers
```env
ENABLE_RAZORPAY_ROUTING=true
MIN_TRUST_SCORE_FOR_ROUTING=70
```
- Only organizers with trust score ≥ 70 get dedicated routes
- Payments automatically split (95% organizer, 5% platform)
- Lower-trust organizers still use main account

### 3. Test Mode vs Production
```env
# Test Mode (Current)
RAZORPAY_KEY_ID=rzp_test_RprUwM1vPIM49e
RAZORPAY_KEY_SECRET=J0qz50Bw0jzv6LK9G0jdN3cF

# Production (When ready)
RAZORPAY_KEY_ID=rzp_live_XXXXXXXXXX
RAZORPAY_KEY_SECRET=your_live_secret
```

## Decision Flow:

```
Trip Creation
├─ Is ENABLE_RAZORPAY_ROUTING = true?
│  ├─ YES
│  │  ├─ Trust Score ≥ MIN_TRUST_SCORE_FOR_ROUTING?
│  │  │  ├─ YES → Create Razorpay Route + QR Code
│  │  │  └─ NO  → Use Main Account
│  │  └─ Admin manually enabled routing for this organizer?
│  │     └─ YES → Create Route (override trust score)
│  └─ NO → Always Use Main Account
└─ Payment collected → 
   ├─ Routing enabled → Auto split
   └─ Main account → Manual payout tracking
```

## Quick Start:

1. **Copy to .env:**
   ```bash
   cd services/api
   echo "ENABLE_RAZORPAY_ROUTING=false" >> .env
   echo "MIN_TRUST_SCORE_FOR_ROUTING=70" >> .env
   echo "PLATFORM_COMMISSION_RATE=5" >> .env
   ```

2. **Restart Server:**
   ```bash
   npm run dev
   ```

3. **Test:**
   - Create trip as organizer
   - Check logs for routing decision
   - Verify correct payment mode

## Security Notes:

- Never commit `.env` to git (already in .gitignore)
- Use test credentials for development
- Switch to live credentials only in production
- Keep webhook secret secure
