# How to Add Webhook Secret to Your Razorpay Webhook

## ⚠️ Current Status
Your webhook is created but **missing a secret** for signature verification.

```
Webhook URL: https://trekktribe.onrender.com/api/webhooks/razorpay ✅
Status: Enabled ✅
Secret: Not provided ❌ (NEEDS TO BE ADDED)
```

---

## 🔐 Why You Need a Secret

The webhook secret is used to verify that webhook requests actually come from Razorpay (not someone else). Without it, your backend can't verify webhook signatures.

---

## 📋 How to Add a Secret

### Option 1: Generate a New Secret (Recommended)

**Step 1:** Click "Edit" button in the Webhook Details panel

**Step 2:** In the Secret field, click "Show Secret"

**Step 3:** Razorpay will generate a secret for you. It looks like:
```
whsec_1a2b3c4d5e6f7g8h9i0j
```

**Step 4:** Click "Copy" or manually copy the entire secret

**Step 5:** Save the secret to your .env file:
```bash
RAZORPAY_WEBHOOK_SECRET=whsec_1a2b3c4d5e6f7g8h9i0j
```

---

## 🚀 Complete Setup Steps

### 1. Edit Your Webhook in Razorpay

```
Dashboard → Webhooks → [Your Webhook] → Edit
```

### 2. Generate/Copy Secret

```
In the Secret field:
☑ Click "Learn more about Webhook secrets" (if needed)
☑ Click "Show Secret" 
☑ Copy the generated secret (whsec_xxxxx)
```

### 3. Add to Render Environment Variables

**Go to:**
```
https://dashboard.render.com → trek-tribe-api → Environment
```

**Add new variable:**
```
Key: RAZORPAY_WEBHOOK_SECRET
Value: whsec_1a2b3c4d5e6f7g8h9i0j (paste your secret)
```

**Click:** "Save"

### 4. Restart Render Service

```
Render Dashboard → trek-tribe-api → [Three dots menu] → Restart
```

---

## ✅ Verify Secret is Working

### Method 1: Check Render Logs

```
Render Dashboard → trek-tribe-api → Logs

Should show:
✅ Webhook verified and processed
or
❌ Invalid signature (if secret is wrong)
```

### Method 2: Test with Razorpay

```
1. Click "Edit" on your webhook
2. Scroll down and click "Test Webhook" or "Send Test Event"
3. Select event: payment.authorized
4. Click "Send Test Event"
5. Check webhook logs - should show:
   ✅ Delivered (200 OK)
```

---

## 📝 Complete .env Configuration for Your Backend

```bash
# Razorpay Payment Gateway
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
RAZORPAY_WEBHOOK_SECRET=whsec_1a2b3c4d5e6f7g8h9i0j  # ← ADD THIS
```

---

## 🔍 Current vs. Complete Setup

### ❌ Current (Missing Secret)
```
Webhook URL: https://trekktribe.onrender.com/api/webhooks/razorpay ✅
Status: Enabled ✅
Secret: Not provided ❌
Active Events: 31 ✅
Alert Email: tanejasaksham44@gmail.com ✅
```

### ✅ Complete (With Secret)
```
Webhook URL: https://trekktribe.onrender.com/api/webhooks/razorpay ✅
Status: Enabled ✅
Secret: whsec_1a2b3c4d5e6f7g8h9i0j ✅
Active Events: 31 ✅
Alert Email: tanejasaksham44@gmail.com ✅
```

---

## 🎯 Quick Steps (TL;DR)

1. **In Razorpay Dashboard:**
   - Click "Edit" on your webhook
   - Click "Show Secret" in Secret field
   - Copy the secret (whsec_xxxxx)

2. **In Render Dashboard:**
   - Add environment variable: `RAZORPAY_WEBHOOK_SECRET=whsec_xxxxx`
   - Restart service

3. **Test:**
   - Make a test payment or send test webhook
   - Check logs show "✅ Webhook verified"

---

## ⚠️ Important Notes

- **Don't share your secret** - it's like a password
- Secret is unique per webhook
- Keep it private in environment variables only
- Never commit to Git

---

## 🚨 If You Still See "Not provided"

After editing, the display might not update immediately:

```
1. Refresh the page (F5)
2. Go back to Webhooks list
3. Click on your webhook again
4. Secret should now show as configured
```

---

## ✅ Status After Adding Secret

Your webhook flow will work like this:

```
Razorpay sends webhook request:
  ↓
POST https://trekktribe.onrender.com/api/webhooks/razorpay
Headers: {
  'x-razorpay-signature': 'abc123def456...',
  'content-type': 'application/json'
}
Body: { event: 'payment.authorized', ... }
  ↓
Your backend (Render) receives it:
  ↓
Verifies signature using RAZORPAY_WEBHOOK_SECRET
  ↓
If valid: ✅ Processes payment, updates booking
If invalid: ❌ Rejects request (401 Unauthorized)
  ↓
Returns 200 OK to Razorpay
  ↓
Razorpay marks webhook as "Delivered"
```

---

**Next Action:** Add the secret to your Render environment variables and restart the service. Then you're all set!
