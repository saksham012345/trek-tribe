# QUICK REFERENCE: Testing & Launch Guide

## 🎯 One-Page Launch Checklist

### Pre-Launch Testing (30 minutes each)

**1. SUBSCRIPTION TIERS TEST**
```bash
# Verify all 5 plans display correctly
1. Open home page → scroll to "Choose Your Plan"
2. Expected prices:
   ✅ STARTER: ₹599 (2 trips, no CRM)
   ✅ BASIC: ₹1299 (4 trips, no CRM)
   ✅ PROFESSIONAL: ₹2199 (6 trips, CRM ✓)
   ✅ PREMIUM: ₹3999 (15 trips, CRM ✓)
   ✅ ENTERPRISE: ₹9999 (100 trips, CRM ✓)
```

**2. PAYMENT FLOW TEST**
```bash
# Test PROFESSIONAL plan payment
1. Click "Subscribe" on PROFESSIONAL
2. Enter card: 4111 1111 1111 1111 (test card)
3. Expiry: 12/25, CVV: 123
4. Verify: Payment successful + redirect to dashboard
5. Check DB: 
   db.organizersubscriptions.findOne({ planType: "PROFESSIONAL" })
   → Should show: { trips: 6, crmAccess: true, status: "active" }
```

**3. CRM ACCESS TEST**
```bash
# Verify CRM access control
1. Log in as BASIC plan user (₹1299)
2. Navigate to /organizer/crm
3. Expected: "Upgrade to Professional" message
4. Log in as PROFESSIONAL user
5. Navigate to /organizer/crm
6. Expected: Full CRM dashboard with leads table
```

**4. LEAD MANAGEMENT TEST**
```bash
# Test lead workflow
1. Create trip as PROFESSIONAL user
2. Receive inquiry (auto-creates lead)
3. In CRM, verify lead appears
4. Change status: new → contacted → interested → qualified
5. Verify stats update (conversion rate changes)
6. Click "Verify" button on a lead
7. Verify status shows checkmark
```

**5. TRIP LIMITS TEST**
```bash
# Verify trip slot management
1. PROFESSIONAL user (6 trips): Create 6 trips, verify "6/6" shown
2. Try to create 7th trip: Button should be disabled
3. ENTERPRISE user (100 trips): Create 20 trips, verify "20/100" shown
```

---

## 🔧 Quick Seed Database

### Generate Test Data (5 minutes)

```bash
# Seed realistic test data
npm install @faker-js/faker

# Full database setup:
node seed.ts --type=all --count=10

# This creates:
# - 50 subscriptions (all 5 plan types)
# - 100 leads (varied statuses, multiple trips)
# - 50 payments (success/failure mix)
# - 200 activities
```

---

## 📊 Performance Verification

### Quick Performance Check (10 minutes)

```bash
# 1. Check page load time
# Open DevTools → Performance tab
# Navigate to /organizer/crm
# Expected: < 2.5 seconds full load

# 2. API Response Time
curl -w "Time: %{time_total}s\n" \
  -H "Authorization: Bearer TOKEN" \
  http://localhost:3000/api/crm/leads

# Expected: < 500ms

# 3. Database Query Speed
db.setProfilingLevel(1, { slowms: 100 })
db.leads.find({ organizerId: "test" }).count()

# Expected: < 100ms
```

---

## 🚨 Critical Security Checks

### Before Production (15 minutes)

```bash
# 1. Check CRM Access Control
GET /api/crm/leads (BASIC user token)
→ Expected: 403 Forbidden

GET /api/crm/leads (PROFESSIONAL user token)
→ Expected: 200 OK with leads

# 2. Verify Webhook Signature
# Razorpay sends: webhook with HMAC-SHA256 signature
# System verifies signature before processing
# If invalid signature: REJECT webhook

# 3. Check JWT Expiry
# Valid token: API returns 200
# Expired token: API returns 401
# Invalid token: API returns 401
```

---

## 📱 Mobile Responsiveness (5 minutes)

```bash
# 1. Open DevTools → Device Mode
# 2. Set to iPhone 12 (390x844)
# 3. Test pages:
   ✅ /organizer/crm (leads table scrolls, buttons touchable)
   ✅ Payment form (inputs accessible, no horizontal scroll)
   ✅ Plan comparison (readable, no cutoff)
```

---

## 🎯 Testing Execution Order

### Recommended Sequence (3 hours total)

```
0. Seed test data (5 mins)
   → node seed.ts --type=all --count=20

1. Subscription tiers (15 mins)
   → Verify 5 plans display with correct pricing

2. Payment flow (30 mins)
   → Test payment for PROFESSIONAL and ENTERPRISE

3. CRM access control (20 mins)
   → BASIC blocked, PROFESSIONAL+ allowed

4. Lead management (20 mins)
   → Create, update status, verify leads

5. Trip limits (10 mins)
   → Verify slot enforcement

6. Performance (15 mins)
   → Lighthouse audit, API timing

7. Security (10 mins)
   → JWT validation, CRM access control, webhooks

8. Mobile responsive (5 mins)
   → Test on 390px and 768px widths

TOTAL TIME: ~2 hours 45 minutes
```

---

## 📝 Sign-Off Template

After all tests pass, use this template:

```markdown
# Trek Tribe Testing Sign-Off

Date: [DATE]
Tested By: [NAME]
Environment: [dev/staging/production]

## Test Results

### Subscription System
- [ ] All 5 plans display correctly with correct prices
- [ ] STARTER (₹599): ✅
- [ ] BASIC (₹1299): ✅
- [ ] PROFESSIONAL (₹2199, 6 trips, CRM): ✅
- [ ] PREMIUM (₹3999, 15 trips, CRM): ✅
- [ ] ENTERPRISE (₹9999, 100 trips, CRM): ✅

### Payment Processing
- [ ] PROFESSIONAL (₹2199) payment successful
- [ ] ENTERPRISE (₹9999) payment successful
- [ ] Webhook processing confirmed
- [ ] Subscription created in database

### CRM Access
- [ ] BASIC user blocked from CRM
- [ ] PROFESSIONAL user has CRM access
- [ ] Leads table displays correctly
- [ ] Stats calculated accurately

### Lead Management
- [ ] Lead creation from inquiry
- [ ] Status transitions work (all 5 statuses)
- [ ] Lead verification works
- [ ] Search and filter function
- [ ] Notes can be added/edited

### Performance
- [ ] Page load time: < 2.5s
- [ ] API response: < 500ms
- [ ] Database queries: < 200ms
- [ ] Lighthouse score: > 85

### Security
- [ ] CRM access properly restricted
- [ ] JWT tokens validated
- [ ] Webhook signatures verified
- [ ] No unauthorized data access

### Mobile
- [ ] CRM dashboard responsive
- [ ] Payment form responsive
- [ ] All buttons touchable

## Sign-Off

✅ ALL TESTS PASSED
✅ READY FOR PRODUCTION

Approved By: [SIGNATURE]
Date: [DATE]
```

---

## 🚀 One-Command Deployment

### Pre-deployment checklist:

```bash
# 1. Build frontend
cd web && npm run build

# 2. Build backend  
cd ../services/api && npm run build

# 3. Run all tests
npm test

# 4. Check environment variables
echo "RAZORPAY_KEY_ID: $RAZORPAY_KEY_ID"
echo "RAZORPAY_KEY_SECRET: [hidden]"
echo "MONGODB_URI: $MONGODB_URI"

# 5. Backup database
mongodump --db trek-tribe --out ./backups/pre-launch

# 6. Create database indexes
db.organizersubscriptions.createIndex({ userId: 1, status: 1 })
db.leads.createIndex({ organizerId: 1, createdAt: -1 })

# 7. Deploy
npm run deploy
```

---

## 📊 Post-Launch Monitoring

### First 24 Hours After Launch

```bash
# Monitor key metrics
watch 'tail -f services/api/logs/webhook.log | grep -c "success"'
watch 'tail -f services/api/logs/error.log'

# Check subscription creation rate
watch 'mongo trek-tribe --eval "db.organizersubscriptions.find({createdAt: {\$gte: new Date(Date.now()-24*60*60*1000)}}).count()"'

# Monitor API health
curl http://your-domain.com/api/health

# Check payment success rate
watch 'mongo trek-tribe --eval "db.payments.aggregate([{\\$match: {createdAt: {\$gte: new Date(Date.now()-24*60*60*1000)}}}, {\\$group: {_id: \\\"\\$status\\\", count: {\\$sum: 1}}}])"'
```

### Alerts to Set Up

```
IF payment_error_rate > 1% → Page On-Call
IF api_response_time_p95 > 1000ms → Create Incident  
IF webhook_failure_rate > 5% → Check Razorpay status
IF database_query_time_p95 > 500ms → Review indexes
IF error_rate > 0.5% → Investigate logs
```

---

## 🎓 Key Metrics to Track

### Success Criteria

```
Subscription System:
  ✅ Payment success rate: > 98%
  ✅ Webhook processing success: 100%
  ✅ CRM access grant time: < 1 second

CRM Module:
  ✅ Lead load time: < 500ms
  ✅ Status update latency: < 200ms
  ✅ Search response: < 300ms

Performance:
  ✅ Page load: < 2.5 seconds
  ✅ API response: < 500ms (p95)
  ✅ Database queries: < 200ms (p95)

Reliability:
  ✅ Uptime: > 99.9%
  ✅ Error rate: < 0.1%
  ✅ Webhook delivery: 99.9%+
```

---

## 🆘 Troubleshooting Guide

### Common Issues & Fixes

**Payment not processing?**
```
1. Check Razorpay test key is set: echo $RAZORPAY_KEY_ID
2. Verify webhook URL in Razorpay dashboard
3. Check logs: tail -f services/api/logs/webhook.log
4. Test webhook signature verification
```

**CRM showing "Upgrade Required" for PROFESSIONAL user?**
```
1. Check subscription in DB:
   db.organizersubscriptions.findOne({userId: "user_id"})
2. Verify: planType exists AND crmAccess: true
3. Check token validity:
   curl -H "Authorization: Bearer TOKEN" /api/subscriptions/verify-crm-access
4. Clear browser cache and retry
```

**Leads not appearing in CRM?**
```
1. Check leads in database:
   db.leads.find({organizerId: "user_id"})
2. Verify trip inquiry creates lead (check logs)
3. Check API endpoint: GET /api/crm/leads
4. Verify user has CRM access (see above)
```

**Slow page load?**
```
1. Check DevTools Performance tab
2. Run Lighthouse audit
3. Check database indexes are created
4. Verify Redis caching is enabled
5. Check API response times (see monitoring)
```

---

## 📞 Support & Escalation

### Testing Issues:
Contact: QA Lead
Response Time: 15 minutes

### Payment/Razorpay Issues:
Contact: DevOps + Razorpay Support
Response Time: 5 minutes

### Database Performance:
Contact: Database Admin
Response Time: 10 minutes

### Deployment Issues:
Contact: Platform Engineer
Response Time: 5 minutes

---

**Document Created:** Current Session
**Last Updated:** [Current Date]
**Status:** ✅ Ready to Use for Launch

