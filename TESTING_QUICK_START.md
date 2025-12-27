# TrekTribe Testing Quick Start Guide

## 🚀 Quick Start - Run All Tests

### Step 1: Start All Services

Open 3 separate PowerShell terminals and run:

**Terminal 1 - API Server (Already Running ✅)**
```powershell
cd services/api
npm start
```

**Terminal 2 - Frontend Server**
```powershell
cd web
npm run dev
```

**Terminal 3 - AI Service**
```powershell
cd ai-service
python -m uvicorn app.main:app --port 5000 --reload
```

### Step 2: Run Backend API Tests

```powershell
cd C:\Users\VICTUS\Desktop\trek-tribe
.\comprehensive-system-test.ps1
```

### Step 3: Run Frontend Tests (Cypress)

**Option A: Interactive Mode (Recommended for First Time)**
```powershell
cd web
npx cypress open
```
- Click "E2E Testing"
- Select a browser
- Click on any test file to run it

**Option B: Headless Mode (Full Suite)**
```powershell
cd web
npx cypress run
```

**Option C: Specific Test Suite**
```powershell
# Authentication tests
npx cypress run --spec "cypress/e2e/01-auth.cy.js"

# AI Chat Widget tests
npx cypress run --spec "cypress/e2e/03-ai-chat.cy.js"

# Admin Dashboard tests
npx cypress run --spec "cypress/e2e/04-admin.cy.js"
```

---

## 📋 Test Checklist

### Backend API Tests
- [ ] Health check (API & AI service)
- [ ] User registration
- [ ] Login (Admin, Organizer, Traveler)
- [ ] Trip management (CRUD)
- [ ] Booking system
- [ ] Admin endpoints
- [ ] AI generation
- [ ] Payment configuration
- [ ] Analytics
- [ ] Support tickets

### Frontend Cypress Tests (67 Test Cases)
- [ ] Authentication Flow (9 tests)
- [ ] Trip Management (13 tests)
- [ ] AI Chat Widget (12 tests)
- [ ] Admin Dashboard (11 tests)
- [ ] Payment System (7 tests)
- [ ] Additional Features (15 tests)

---

## 🎯 Test Credentials

### Admin Account
```
Email: admin@trektribe.com
Password: Admin@123
```

### Organizer Account (Premium)
```
Email: organizer.premium@trektribe.com
Password: Organizer@123
```

### Traveler Account
```
Email: traveler@trektribe.com
Password: Traveler@123
```

---

## 🔍 AI Chat Widget Test Questions

### General Knowledge
```
1. "What are the best trekking destinations in India?"
2. "Tell me about safety tips for mountain trekking"
3. "What should I pack for a 5-day trek?"
```

### Platform-Specific
```
1. "How do I book a trek on TrekTribe?"
2. "Tell me about payment options for trips"
3. "What is the refund policy?"
4. "How do I become an organizer?"
5. "What payment methods are accepted?"
```

### Recommendations
```
1. "Recommend a 5-day trek in Himalayas for beginners"
2. "Suggest an adventure trip for experienced trekkers"
3. "What are the best monsoon treks?"
```

---

## 📊 Expected Results

### Backend API Tests
```
✅ API Health: Should return status 200
✅ Organizer Login: Should return token
✅ Get All Trips: Should return array of trips
⚠️ AI Service: Requires service to be running
⚠️ Admin Login: Verify credentials in database
```

### Cypress Frontend Tests
```
✅ All pages load without errors
✅ Navigation works correctly
✅ Forms submit successfully
✅ Authentication flows complete
✅ Admin can approve/reject verifications
✅ AI chat widget responds within 15 seconds
```

---

## 🐛 Common Issues & Solutions

### Issue: AI Service connection failed
**Solution:**
```powershell
cd ai-service
pip install -r requirements.txt
python -m uvicorn app.main:app --port 5000 --reload
```

### Issue: Frontend not accessible
**Solution:**
```powershell
cd web
npm install
npm run dev
```

### Issue: Cypress cannot find elements
**Solution:**
- Wait for page to fully load
- Check if frontend is running
- Verify test data exists in database

### Issue: Payment routes return 404
**Solution:**
- Review actual route paths in services/api/src/routes/
- May need to implement missing endpoints

### Issue: Admin login fails (401)
**Solution:**
```powershell
# Run database seed script
cd services/api
npm run seed
```

---

## 📈 Test Coverage

### Backend
```
Total Endpoints: 50+
Routes Tested: 13
Authentication: ✅
Trips: ✅
Admin: ✅
AI: ⚠️ (Requires service)
Payments: ⚠️ (Some 404s)
Social: ✅
Support: ✅
```

### Frontend
```
Total Components: 100+
Test Suites: 6
Test Cases: 67
Coverage Areas:
  - Authentication: 9 tests
  - Trips: 13 tests
  - AI Chat: 12 tests
  - Admin: 11 tests
  - Payments: 7 tests
  - Features: 15 tests
```

---

## 🎬 Video Recording

Cypress automatically records videos of test runs. Find them at:
```
web/cypress/videos/
```

Screenshots of failures saved to:
```
web/cypress/screenshots/
```

---

## 📝 Test Reports

### Backend Test Results
```
File: test-results-[timestamp].json
Location: C:\Users\VICTUS\Desktop\trek-tribe\
```

### Cypress Test Results
```
Terminal output: Real-time results
Videos: web/cypress/videos/
Screenshots: web/cypress/screenshots/
```

### Comprehensive Report
```
File: COMPREHENSIVE_TEST_REPORT.md
Location: C:\Users\VICTUS\Desktop\trek-tribe\
```

---

## ⚡ Performance Testing

### Load Testing (K6)
```powershell
cd k6
k6 run socket_handshake.js
k6 run ticket_creation.js
k6 run webhook_burst.js
```

---

## 🔐 Security Testing

### Checklist
- [ ] SQL Injection protection
- [ ] XSS prevention
- [ ] CSRF tokens
- [ ] Rate limiting
- [ ] JWT expiration
- [ ] Password hashing
- [ ] HTTPS in production
- [ ] Environment variables secured

---

## 📞 Support

### Issues Found?
1. Check COMPREHENSIVE_TEST_REPORT.md for known issues
2. Review test output for specific errors
3. Verify all services are running
4. Check demo credentials

### Test Results Interpretation
```
✅ Green = Passed
⚠️ Yellow = Needs attention
❌ Red = Failed
```

---

## 🎯 CI/CD Integration (Future)

### GitHub Actions Workflow
```yaml
name: E2E Tests
on: [push, pull_request]
jobs:
  test:
    - Start services
    - Run backend tests
    - Run Cypress tests
    - Upload results
```

---

**Happy Testing! 🚀**

For detailed analysis, see: COMPREHENSIVE_TEST_REPORT.md
