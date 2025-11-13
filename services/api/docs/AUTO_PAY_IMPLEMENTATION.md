# Auto-Pay Implementation for Organizers

## Overview
This document describes the auto-pay system implemented for TrekTribe organizers. When an organizer logs in for the first time, they are required to set up auto-pay, which will automatically charge them after exactly 60 days from their first login.

## Architecture

### Components

1. **User Model Extensions** (`src/models/User.ts`)
   - Added `AutoPayInfo` interface to track auto-pay configuration
   - Added `firstOrganizerLogin` field to track when organizer first logged in
   - Added `autoPay` nested object in `organizerProfile`

2. **Auto-Pay Service** (`src/services/autoPayService.ts`)
   - Handles auto-pay setup
   - Processes scheduled payments
   - Sends payment reminders and notifications
   - Manages payment confirmations and failures

3. **Auto-Pay Routes** (`src/routes/autoPay.ts`)
   - `POST /api/auto-pay/setup` - Setup auto-pay
   - `GET /api/auto-pay/status` - Get auto-pay status
   - `POST /api/auto-pay/cancel` - Cancel auto-pay
   - `POST /api/auto-pay/process-scheduled` (Admin) - Manually trigger payment processing
   - `POST /api/auto-pay/send-reminders` (Admin) - Manually send payment reminders

4. **Cron Scheduler** (`src/services/cronScheduler.ts`)
   - Runs daily at 2 AM IST to process scheduled payments
   - Runs daily at 10 AM IST to send payment reminders (3 days before due date)
   - Runs daily at 9 AM IST to check trial notifications

## Flow

### 1. First Login Flow

When an organizer logs in for the first time:

```javascript
// In src/routes/auth.ts - login endpoint

if (user.role === 'organizer' && !user.firstOrganizerLogin) {
  user.firstOrganizerLogin = new Date();
  
  // Calculate payment date: exactly 60 days from first login
  const scheduledPaymentDate = new Date();
  scheduledPaymentDate.setDate(scheduledPaymentDate.getDate() + 60);
  
  user.organizerProfile.autoPay = {
    isSetupRequired: true,
    isSetupCompleted: false,
    firstLoginDate: new Date(),
    scheduledPaymentDate: scheduledPaymentDate,
    paymentAmount: 149900, // ₹1499 in paise
    autoPayEnabled: false
  };
}
```

**Key Points:**
- First login date is recorded in `user.firstOrganizerLogin`
- Auto-pay is initialized with `isSetupRequired: true`
- Payment is scheduled for exactly 60 days from first login
- Default payment amount is ₹1,499 (149900 paise) for 5 trip listings

### 2. Auto-Pay Setup Flow

After first login, the organizer must complete auto-pay setup:

```bash
POST /api/auto-pay/setup
Authorization: Bearer <jwt_token>

Body:
{
  "razorpayCustomerId": "cust_xxxxx",
  "paymentMethodId": "pm_xxxxx",
  "paymentAmount": 149900
}
```

**What happens:**
1. Validates organizer authentication
2. Updates user profile with payment details
3. Sets `isSetupCompleted: true` and `autoPayEnabled: true`
4. Sends confirmation email to organizer
5. Payment remains scheduled for original 60-day date

### 3. Scheduled Payment Processing

The cron job runs daily at 2 AM IST:

```javascript
// Finds organizers with:
// - autoPayEnabled: true
// - isSetupCompleted: true
// - scheduledPaymentDate <= now

// For each organizer:
1. Creates Razorpay order
2. Processes payment (in production, charges saved payment method)
3. Creates/updates CRM subscription with 5 trip credits
4. Updates auto-pay info:
   - lastPaymentDate: now
   - nextPaymentDate: now + 60 days
   - scheduledPaymentDate: now + 60 days
5. Sends payment confirmation email
```

**Payment Success:**
- 5 trip listing credits added to organizer's subscription
- Next payment automatically scheduled for 60 days later
- Email confirmation sent with order details

**Payment Failure:**
- Error logged
- Failure notification email sent to organizer
- Organizer must update payment method or retry

### 4. Payment Reminders

The cron job runs daily at 10 AM IST to send reminders:

```javascript
// Finds organizers with:
// - autoPayEnabled: true
// - scheduledPaymentDate is 3 days away

// Sends reminder email with:
- Scheduled payment date
- Payment amount
- Package details
- Instructions to update payment method if needed
```

## API Endpoints

### 1. Setup Auto-Pay
```bash
POST /api/auto-pay/setup
Authorization: Bearer <organizer_jwt>

Request:
{
  "razorpayCustomerId": "cust_xxxxx",
  "paymentMethodId": "pm_xxxxx",
  "paymentAmount": 149900
}

Response:
{
  "success": true,
  "message": "Auto-pay setup completed successfully"
}
```

### 2. Get Auto-Pay Status
```bash
GET /api/auto-pay/status
Authorization: Bearer <organizer_jwt>

Response:
{
  "success": true,
  "data": {
    "isSetupRequired": true,
    "isSetupCompleted": true,
    "autoPayEnabled": true,
    "firstLoginDate": "2025-01-01T00:00:00Z",
    "scheduledPaymentDate": "2025-03-02T00:00:00Z",
    "lastPaymentDate": null,
    "nextPaymentDate": null,
    "paymentAmount": 149900
  }
}
```

### 3. Cancel Auto-Pay
```bash
POST /api/auto-pay/cancel
Authorization: Bearer <organizer_jwt>

Response:
{
  "success": true,
  "message": "Auto-pay cancelled successfully"
}
```

### 4. Process Scheduled Payments (Admin Only)
```bash
POST /api/auto-pay/process-scheduled
Authorization: Bearer <admin_jwt>

Response:
{
  "success": true,
  "message": "Scheduled payments processed successfully"
}
```

### 5. Send Payment Reminders (Admin Only)
```bash
POST /api/auto-pay/send-reminders
Authorization: Bearer <admin_jwt>

Response:
{
  "success": true,
  "message": "Payment reminders sent successfully"
}
```

## Email Notifications

### 1. Auto-Pay Setup Confirmation
Sent when organizer completes auto-pay setup:
- Confirms auto-pay activation
- Shows first payment date (60 days from first login)
- Lists payment amount and package details
- Explains recurring payment schedule

### 2. Payment Confirmation
Sent after successful payment:
- Confirms payment processed
- Shows order ID and amount
- Lists trip credits added
- Shows next payment date

### 3. Payment Failure
Sent when payment fails:
- Alerts organizer of failure
- Provides steps to resolve
- Includes link to update payment method

### 4. Payment Reminder
Sent 3 days before payment due:
- Reminds of upcoming payment
- Shows scheduled date and amount
- Provides option to update payment method

## Database Schema

### User Model Changes

```typescript
interface AutoPayInfo {
  isSetupRequired: boolean;      // Always true for organizers
  isSetupCompleted: boolean;     // Set when setup completed
  firstLoginDate?: Date;         // First login date
  setupCompletedDate?: Date;     // When setup was completed
  scheduledPaymentDate?: Date;   // Next payment date (first login + 60 days)
  paymentAmount?: number;        // Amount in paise
  razorpayCustomerId?: string;   // Razorpay customer ID
  paymentMethodId?: string;      // Saved payment method
  lastPaymentDate?: Date;        // Last successful payment
  nextPaymentDate?: Date;        // Next scheduled payment
  autoPayEnabled: boolean;       // Active status
}

interface OrganizerProfile {
  // ... existing fields ...
  autoPay?: AutoPayInfo;
}

interface UserDocument {
  // ... existing fields ...
  firstOrganizerLogin?: Date;    // Track first login
}
```

## Cron Job Schedule

| Job | Schedule | Purpose |
|-----|----------|---------|
| Auto-pay processing | Daily at 2 AM IST | Process payments due that day |
| Payment reminders | Daily at 10 AM IST | Send reminders 3 days before due date |
| Trial notifications | Daily at 9 AM IST | Check and send trial ending notifications |

## Testing

### Manual Testing

1. **Test First Login:**
```bash
# Login as organizer for the first time
POST /auth/login
{
  "email": "organizer@test.com",
  "password": "password123"
}

# Check auto-pay status
GET /api/auto-pay/status
# Should show isSetupRequired: true, scheduledPaymentDate: +60 days
```

2. **Test Auto-Pay Setup:**
```bash
POST /api/auto-pay/setup
{
  "razorpayCustomerId": "cust_test123",
  "paymentMethodId": "pm_test123",
  "paymentAmount": 149900
}

# Check status again
GET /api/auto-pay/status
# Should show isSetupCompleted: true, autoPayEnabled: true
```

3. **Test Manual Payment Processing (Admin):**
```bash
# As admin, manually trigger payment processing
POST /api/auto-pay/process-scheduled
```

4. **Test Payment Reminders (Admin):**
```bash
# As admin, manually send reminders
POST /api/auto-pay/send-reminders
```

### Automated Testing

Create test cases for:
- First login tracking
- Auto-pay setup validation
- Payment processing logic
- Email notifications
- Cron job execution

## Configuration

### Environment Variables

No new environment variables required. Uses existing:
- `RAZORPAY_KEY_ID` - Razorpay API key
- `RAZORPAY_KEY_SECRET` - Razorpay secret
- `FRONTEND_URL` - For email links
- `JWT_SECRET` - For authentication

### Cron Job Timezone

All cron jobs run in `Asia/Kolkata` (IST) timezone.

## Security Considerations

1. **Payment Method Storage:**
   - Payment methods are stored via Razorpay's secure tokenization
   - Only token IDs are stored in database, not actual card details

2. **Authentication:**
   - All endpoints require JWT authentication
   - Admin endpoints require admin role

3. **Payment Validation:**
   - All payments go through Razorpay's secure payment gateway
   - Signature verification for webhooks (if implemented)

4. **Data Protection:**
   - Sensitive payment data never stored in plain text
   - All communications encrypted via HTTPS

## Troubleshooting

### Payment Not Processing

1. Check cron job status:
```bash
GET /health
# Look for cron scheduler status
```

2. Manually trigger processing:
```bash
POST /api/auto-pay/process-scheduled
```

3. Check logs for errors:
```bash
# Look for auto-pay related logs
grep "auto-pay" logs/app.log
```

### Auto-Pay Not Initializing on First Login

1. Verify user role is 'organizer'
2. Check `firstOrganizerLogin` field is null before login
3. Verify login endpoint is updated

### Payment Reminders Not Sending

1. Check cron job is running
2. Verify email service is configured
3. Manually trigger reminders:
```bash
POST /api/auto-pay/send-reminders
```

## Future Enhancements

1. **Multiple Payment Plans:**
   - Allow organizers to choose different package sizes
   - 10 trips, 20 trips, 50 trips packages

2. **Payment History:**
   - Add endpoint to view payment history
   - Generate invoices for past payments

3. **Proration:**
   - Calculate prorated amounts for mid-cycle plan changes

4. **Grace Period:**
   - Allow 3-day grace period for failed payments
   - Automatic retry logic

5. **Webhooks:**
   - Implement Razorpay webhooks for real-time payment updates
   - Handle payment disputes and refunds

6. **Analytics:**
   - Track payment success rates
   - Monitor subscription churn
   - Revenue forecasting

## Support

For issues or questions:
1. Check logs: `/var/log/trek-tribe/api.log`
2. Review cron job status: `GET /health`
3. Contact development team with relevant logs and error messages
