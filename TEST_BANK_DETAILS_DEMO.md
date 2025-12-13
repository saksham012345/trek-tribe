# Test Bank Details for Route Onboarding - Demo

## ⚠️ IMPORTANT: These are TEST CREDENTIALS for demonstration only

### Valid Test Bank Details (For Razorpay Route Testing)

#### Test Account 1 (Individual - Proprietorship)
```
Legal Business Name: Trek Explorer Services
Business Type: Proprietorship
Account Number: 123456789012
IFSC Code: HDFC0001234
Account Holder Name: Saksham Kumar
Bank Name: HDFC Bank
```

#### Test Account 2 (Organization - Private Limited)
```
Legal Business Name: Adventure Tours India Pvt Ltd
Business Type: Pvt_Ltd
Account Number: 987654321098
IFSC Code: ICIC0000001
Account Holder Name: Rajesh Sharma
Bank Name: ICICI Bank
```

#### Test Account 3 (Partnership)
```
Legal Business Name: Mountain Expeditions Partners
Business Type: Partnership
Account Number: 555555555555
IFSC Code: SBIN0001234
Account Holder Name: Priya Patel
Bank Name: State Bank of India
```

#### Test Account 4 (LLP - Limited Liability Partnership)
```
Legal Business Name: Himalayan Ventures LLP
Business Type: LLP
Account Number: 666666666666
IFSC Code: AXIS0001234
Account Holder Name: Vikram Singh
Bank Name: AXIS Bank
```

---

## 📋 IFSC Code Format (for Razorpay validation)

**Format:** `[BANK CODE][0][BRANCH CODE]`
- **BANK CODE:** 4 uppercase letters (e.g., HDFC, ICIC, SBIN, AXIS)
- **Digit:** Always "0"
- **BRANCH CODE:** 6 alphanumeric characters

### Common Test IFSC Codes
```
HDFC0001234 - HDFC Bank
ICIC0000001 - ICICI Bank
SBIN0001234 - State Bank of India
AXIS0001234 - AXIS Bank
BKID0001234 - Bank of India
UBIN0001234 - Union Bank of India
PNAB0001234 - PNB (Punjab National Bank)
```

---

## 💳 Test Card Details (For Payment Testing)

### Razorpay Test Mode - Success Scenarios

#### 1. Standard Success Payment
```
Card Number: 4111 1111 1111 1111
Expiry: Any future date (e.g., 12/25)
CVV: Any 3 digits (e.g., 123)
Result: Payment succeeds ✅
```

#### 2. International Card (with 3D Secure)
```
Card Number: 5555 5555 5555 4444
Expiry: 12/25
CVV: 123
Result: Payment succeeds ✅
```

#### 3. Recurring Payment Success
```
Card Number: 6011 1111 1111 1117
Expiry: 12/25
CVV: 123
Result: Succeeds for recurring payments ✅
```

### Test Mode - Failure Scenarios

#### Payment Declined
```
Card Number: 4000 0000 0000 0002
Expiry: 12/25
CVV: 123
Result: Payment fails ❌
```

#### Insufficient Funds
```
Card Number: 4000 0000 0000 0069
Expiry: 12/25
CVV: 123
Result: Insufficient funds error ❌
```

---

## 🏦 Bank Account Validation Rules

**Account Number:**
- Minimum 6 digits
- Maximum 20 digits
- Can contain alphanumeric characters
- Used in test: 10-12 digits (standard Indian bank format)

**IFSC Code:**
- Exactly 11 characters
- Format: `XXXX0XXXXXX`
- First 4: Bank code (letters)
- 5th: Always "0"
- Last 6: Branch code (alphanumeric)
- Case-insensitive in validation but stored as uppercase

**Account Holder Name:**
- Minimum 2 characters
- Maximum 120 characters
- Cannot be empty
- Should match bank account name

**Business Type:**
- `proprietorship` - Self-employed individual
- `partnership` - Partnership firm
- `llp` - Limited Liability Partnership
- `pvt_ltd` - Private Limited Company

---

## 🧪 Step-by-Step Test Onboarding Flow

### 1. Pre-Onboarding Checks
```
✓ User must be logged in as organizer
✓ User must have active subscription (trial or paid)
✓ User must not be already onboarded
✓ User must fill all required fields
```

### 2. Fill Form with Test Details
```
1. Legal Business Name: [Use test name from above]
2. Business Type: [Select from dropdown]
3. Account Number: [Use test account number]
4. IFSC Code: [Use test IFSC code]
5. Account Holder Name: [Use test holder name]
6. Bank Name: [Optional] Use test bank name
```

### 3. Submit Form
```
POST /api/marketplace/organizer/onboard
Body: {
  "legalBusinessName": "Trek Explorer Services",
  "businessType": "proprietorship",
  "bankAccount": {
    "accountNumber": "123456789012",
    "ifscCode": "HDFC0001234",
    "accountHolderName": "Saksham Kumar",
    "bankName": "HDFC Bank"
  }
}
```

### 4. Expected Response
```json
{
  "success": true,
  "accountId": "acc_1234567890abcdef",
  "status": "created"
}
```

### 5. Verify Onboarding
```
GET /api/marketplace/organizer/status

Response:
{
  "onboarded": true,
  "accountId": "acc_1234567890abcdef",
  "status": "created",
  "kycStatus": "pending_verification"
}
```

---

## 📱 Demo User Accounts (Pre-seeded)

### Organizer 1 (Ready for Onboarding)
```
Email: demo@organizer.com
Password: DemoOrganizer123!
Subscription: PROFESSIONAL (₹2,199)
Status: Can proceed to onboarding
```

### Organizer 2 (Premium)
```
Email: premium@organizer.com
Password: PremiumOrg123!
Subscription: PREMIUM (₹3,999) - Has CRM access
Status: Can proceed to onboarding
```

### Organizer 3 (Enterprise)
```
Email: admin@agent.com
Password: AdminAgent123!
Subscription: ENTERPRISE (₹7,999)
Status: Can proceed to onboarding
```

---

## ✅ Presentation Ready Checklist

### Before Demo
- [ ] Restart backend server
- [ ] Verify subscription is active for test organizer
- [ ] Prepare test bank details (use one from above)
- [ ] Have test card ready: 4111 1111 1111 1111
- [ ] Clear browser cache (Ctrl+Shift+R)
- [ ] Test login with demo@organizer.com
- [ ] Verify can access /subscribe page
- [ ] Verify subscription shows active
- [ ] Test navigation to Route Onboarding

### During Demo Flow
```
1. Show completed subscription ✅
2. Click "Go to Onboarding"
3. Fill Route Onboarding form with test details
4. Click "Submit Onboarding"
5. Show success message
6. Verify status shows "created" or "active"
7. Show organizer can now receive payouts
```

### Expected Success Markers
```
✅ Form submits without errors
✅ No 400 Bad Request errors
✅ "Onboarding submitted" success message appears
✅ Status changes from "pending" to "created"
✅ Account ID is assigned
```

---

## 🐛 Common Issues & Solutions

### Issue: "400 Bad Request" on Submit
**Solutions:**
1. Verify IFSC code format: `[BANK][0][BRANCH]`
2. Verify account number is 6-20 digits
3. Verify account holder name is 2-120 characters
4. Ensure business type is from dropdown

### Issue: "Subscription required before onboarding"
**Solutions:**
1. Go to /subscribe
2. Select a plan
3. Complete payment (use test card)
4. Wait for activation (should be instant)
5. Then proceed to onboarding

### Issue: "User already onboarded"
**Solutions:**
1. Use a different organizer account
2. Or check if user is already in Route system

### Issue: IFSC Code Invalid Format
**Solutions:**
1. Use format: 4 letters + 0 + 6 alphanumeric
2. Example: `HDFC0001234`
3. Don't use spaces or special characters

---

## 📊 Demo Presentation Talking Points

### Route Onboarding Benefits
1. **Automatic Payouts** - Money transferred directly to bank account
2. **No Manual Intervention** - Fully automated process
3. **Multiple Account Types** - Support for individuals and businesses
4. **Quick Settlement** - Money typically in account within 2-3 business days
5. **Full Transparency** - Dashboard shows all transactions

### Flow Explanation
```
User Creates Trip
       ↓
Traveller Books & Pays
       ↓
Payment collected via Razorpay
       ↓
Organizer Receives Commission
       ↓
Automatic Settlement to Bank Account
```

### Security Highlights
```
✓ Bank account details encrypted
✓ PCI-DSS compliance via Razorpay
✓ No sensitive data stored
✓ Secure signature verification
```

---

## 🔄 Test Data Refresh (if needed)

To reset test data:
```bash
# 1. Clear organizer payout configs
db.organizerpayoutconfigs.deleteMany({})

# 2. Create new test organizer
POST /api/auth/register
{
  "name": "Test Organizer",
  "email": "test@organizer.com",
  "password": "TestOrg123!",
  "role": "organizer"
}

# 3. Add subscription
POST /api/subscriptions/verify-payment
(simulate successful payment)

# 4. Now user can onboard
```

---

## ✨ Presentation Success Indicators

✅ Form fills quickly with test data
✅ Submission is instant
✅ Success message appears
✅ Status updates in real-time
✅ No errors in console
✅ Backend logs show successful processing
✅ Database shows new onboarding record

**All systems ready for presentation!**
