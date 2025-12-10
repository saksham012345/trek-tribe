# 🧪 Quick Testing Guide - Subscription Plans & Payment

## Test the New Plan Comparison UI

### 1. Manual Testing in Browser

#### Prerequisites:
- Frontend running locally (npm start)
- Backend running locally on port 5000
- Razorpay sandbox credentials configured
- Logged in as organizer

#### Test Steps:

**A. Plan Display Test**
```
1. Navigate to /auto-pay-setup
2. Observe:
   - ✅ All 5 plans display in a grid
   - ✅ PROFESSIONAL plan has "⭐ MOST POPULAR" badge
   - ✅ Prices show correctly: ₹999, ₹1499, ₹2199, ₹2999, ₹4999
   - ✅ Trip limits display: 5, 10, 15, 20, Unlimited
   - ✅ CRM badge visible for PROFESSIONAL, PREMIUM, ENTERPRISE
```

**B. Plan Selection Test**
```
1. Click on STARTER plan (₹999)
2. Verify:
   - ✅ STARTER plan has selection ring
   - ✅ Checkmark appears on plan card
   - ✅ Selected plan scales up slightly
   - ✅ Details panel updates with STARTER features
   - ✅ Payment button shows "Complete Payment - ₹999"

3. Click on PROFESSIONAL plan (₹2199)
4. Verify:
   - ✅ Selection moves to PROFESSIONAL
   - ✅ CRM Access badge shows in details
   - ✅ Features include: Lead Capture, Phone Numbers, CRM Access
   - ✅ Payment button shows "Complete Payment - ₹2199"
   - ✅ Plan summary shows "CRM Access: ✅ Included"

5. Click on ENTERPRISE plan (₹4999)
6. Verify:
   - ✅ Unlimited trips displayed
   - ✅ All premium features shown
   - ✅ Payment button shows "Complete Payment - ₹4999"
```

**C. Feature Matrix Test**
```
1. With STARTER selected:
   - ✅ NO CRM Access badge
   - ✅ NO Lead Capture feature
   - ✅ NO Phone Numbers feature

2. With PROFESSIONAL selected:
   - ✅ CRM Access badge visible
   - ✅ "Lead Capture" in features list
   - ✅ "Phone Numbers in Leads" in features list

3. With PREMIUM selected:
   - ✅ All premium features shown
   - ✅ 20 active trips

4. With ENTERPRISE selected:
   - ✅ Unlimited trips shown
   - ✅ All features included
```

**D. Responsive Design Test**
```
On Desktop (1024px+):
- ✅ 5-column grid showing all plans side-by-side
- ✅ Plan cards are compact but readable
- ✅ Details panel spans full width below

On Tablet (768px - 1023px):
- ✅ 2-column grid
- ✅ Plans stack nicely
- ✅ Details panel adjusts width

On Mobile (< 768px):
- ✅ Single column (plans stack vertically)
- ✅ All text readable without zooming
- ✅ Buttons full width
- ✅ Touch targets large enough (44px minimum)
```

### 2. Payment Flow Testing

#### Test STARTER Payment (₹999)
```
1. Select STARTER plan
2. Enter payment method (Razorpay test card)
3. Accept terms checkbox
4. Click "Complete Payment - ₹999"
5. Expected:
   - ✅ Razorpay modal opens
   - ✅ Amount shows ₹999 (99900 paise)
   - ✅ Order ID visible
   - ✅ After successful payment, redirect to dashboard
   - ✅ Success toast shows
```

#### Test PROFESSIONAL Payment (₹2199) ⭐ CRITICAL
```
1. Select PROFESSIONAL plan
2. Click "Complete Payment - ₹2199"
3. Complete Razorpay payment
4. Verify after redirect:
   - ✅ User subscription created with PROFESSIONAL plan
   - ✅ CRM access granted (can verify in DB)
   - ✅ Lead capture enabled
   - ✅ Phone numbers visible in leads

5. Test CRM Access Endpoint:
   curl -X GET 'http://localhost:5000/api/subscriptions/verify-crm-access' \
     -H 'Authorization: Bearer YOUR_TOKEN'
   
   Expected Response:
   {
     "hasCRMAccess": true,
     "hasLeadCapture": true,
     "canViewPhoneNumbers": true,
     "planType": "PROFESSIONAL"
   }
```

#### Test ENTERPRISE Payment (₹4999)
```
1. Select ENTERPRISE plan
2. Click "Complete Payment - ₹4999"
3. Complete Razorpay payment
4. Verify in database:
   - ✅ Subscription price is ₹4999
   - ✅ Trip limit is "unlimited"
   - ✅ All features enabled
```

### 3. Database Verification

#### Check Subscription Created
```sql
db.organizersubscriptions.findOne({ userId: "USER_ID" })

Expected:
{
  userId: ObjectId("..."),
  planType: "PROFESSIONAL",
  price: 2199,
  status: "active",
  crmAccess: true,
  leadCapture: true,
  phoneNumbers: true,
  createdAt: ISODate("2024-01-XX..."),
  renewalDate: ISODate("2024-02-XX...")
}
```

#### Verify Payment Record
```sql
db.payments.findOne({ userId: "USER_ID" })

Expected:
{
  userId: ObjectId("..."),
  razorpayOrderId: "order_XXX",
  razorpayPaymentId: "pay_XXX",
  planType: "PROFESSIONAL",
  amount: 2199,
  status: "success",
  createdAt: ISODate("...")
}
```

### 4. API Endpoint Testing

#### Test /api/subscriptions/plans
```bash
curl -X GET 'http://localhost:5000/api/subscriptions/plans'

Expected Response:
{
  "success": true,
  "plans": [
    {
      "type": "STARTER",
      "name": "Starter Plan",
      "price": 999,
      "trips": 5,
      "crmAccess": false,
      "leadCapture": false,
      "phoneNumbers": false,
      "features": [...]
    },
    {
      "type": "PROFESSIONAL",
      "name": "Professional Plan",
      "price": 2199,
      "trips": 15,
      "crmAccess": true,
      "leadCapture": true,
      "phoneNumbers": true,
      "features": [...]
    },
    ...
  ]
}
```

#### Test /api/subscriptions/verify-crm-access
```bash
curl -X GET 'http://localhost:5000/api/subscriptions/verify-crm-access' \
  -H 'Authorization: Bearer TOKEN'

For PROFESSIONAL plan:
{
  "success": true,
  "hasCRMAccess": true,
  "hasLeadCapture": true,
  "canViewPhoneNumbers": true,
  "planType": "PROFESSIONAL"
}

For BASIC plan:
{
  "success": true,
  "hasCRMAccess": false,
  "hasLeadCapture": false,
  "canViewPhoneNumbers": false,
  "planType": "BASIC"
}
```

#### Test /api/subscriptions/check-feature-access
```bash
curl -X POST 'http://localhost:5000/api/subscriptions/check-feature-access' \
  -H 'Authorization: Bearer TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"features": ["crm", "lead_capture", "phone_numbers"]}'

Response for PROFESSIONAL:
{
  "success": true,
  "features": {
    "crm": true,
    "lead_capture": true,
    "phone_numbers": true
  }
}

Response for STARTER:
{
  "success": true,
  "features": {
    "crm": false,
    "lead_capture": false,
    "phone_numbers": false
  }
}
```

### 5. Error Handling Tests

#### Test Missing Terms Acceptance
```
1. Select any plan
2. Leave terms checkbox unchecked
3. Click "Complete Payment"
4. Verify:
   - ✅ Error toast: "Please accept the terms and conditions"
   - ✅ Form not submitted
```

#### Test Invalid Payment
```
1. Select any plan
2. Accept terms
3. In Razorpay modal, fail payment or close modal
4. Verify:
   - ✅ Error toast shows appropriate message
   - ✅ Page stays on same plan selection
   - ✅ Payment button clickable again
```

#### Test Network Error
```
1. Disconnect network after selecting plan
2. Click "Complete Payment"
3. Verify:
   - ✅ Error toast: "Failed to setup auto-pay. Please try again."
   - ✅ User can retry after reconnecting
```

### 6. Mobile Testing Checklist

- [ ] Plans display in single column
- [ ] Plan cards not cut off on any screen size
- [ ] Buttons are 44px+ height (touch-friendly)
- [ ] Text readable without zooming
- [ ] Plan comparison details fully visible when scrolled
- [ ] Payment modal works on mobile
- [ ] All interactive elements work on touch
- [ ] No horizontal scroll needed

### 7. Accessibility Testing

- [ ] Keyboard navigation through plans (Tab key)
- [ ] Screen reader announces plan names and prices
- [ ] Color contrast meets WCAG standards
- [ ] Form fields have labels
- [ ] Error messages are semantic
- [ ] Loading spinner announced to screen readers

## Expected Results Summary

| Test | Expected Result | Status |
|------|-----------------|--------|
| Plans Display | All 5 plans visible | ✅ |
| Plan Selection | Click to select works | ✅ |
| Feature Matrix | CRM shows for PROF+ | ✅ |
| Responsive | Works on mobile/desktop | ✅ |
| Payment STARTER | Order created for ₹999 | ⏳ |
| Payment PROFESSIONAL | CRM access granted | ⏳ |
| Payment ENTERPRISE | All features enabled | ⏳ |
| CRM Endpoint | Returns correct flags | ⏳ |
| Error Handling | Errors shown properly | ✅ |
| Mobile UX | Fully usable on mobile | ✅ |

## Troubleshooting

### Plans Not Showing
```
1. Check backend is running: curl http://localhost:5000/api/subscriptions/plans
2. Check network tab in DevTools for errors
3. Check browser console for JavaScript errors
4. Verify API response has correct data
```

### Payment Not Working
```
1. Verify Razorpay SDK loads: window.Razorpay in console
2. Check Razorpay credentials are set in .env
3. Verify order creation endpoint is working
4. Check payment handler console logs for errors
```

### CRM Access Not Granted
```
1. Check subscription created in database
2. Verify crmAccess flag is true for PROFESSIONAL
3. Check /verify-crm-access endpoint returns true
4. Look for errors in backend logs
```

## Performance Testing

### Load Testing (Optional)
```
1. Simulate 100 concurrent users selecting plans
2. Expected: Page load < 2 seconds
3. Check server CPU/memory usage
4. Verify no timeout errors
```

### Lighthouse Audit
```
1. Open DevTools → Lighthouse
2. Run audit on /auto-pay-setup page
3. Expected:
   - Performance: > 90
   - Accessibility: > 90
   - Best Practices: > 90
   - SEO: > 90
```

---

## Notes for QA Team

1. **Critical Test**: Payment works for PROFESSIONAL (₹2199) plan
2. **Priority**: CRM access is correctly granted after PROFESSIONAL+ payment
3. **Important**: Mobile responsive testing on real devices
4. **Security**: Verify Razorpay signatures are validated
5. **UX**: Plan selection is intuitive and clear

---

Generated: Latest Session
Status: Ready for Testing
Last Updated: AutoPaySetup Component UI Refactor Complete
