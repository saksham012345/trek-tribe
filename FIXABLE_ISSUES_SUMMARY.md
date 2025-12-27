# Fixable Issues - What I Can Help With

**Date:** December 26, 2025  
**Analysis:** Comprehensive codebase review

---

## ✅ WHAT I CAN FIX (Code Changes Only)

### 1. 🔴 Security: JWT in localStorage → httpOnly Cookies
**Status:** Can fix completely  
**Impact:** Critical security vulnerability  
**Files to modify:**
- Backend: `services/api/src/routes/auth.ts` (login, register endpoints)
- Backend: `services/api/src/middleware/auth.ts` (cookie parsing)
- Frontend: `web/src/contexts/AuthContext.tsx` (remove localStorage)
- Frontend: `web/src/config/api.ts` (remove localStorage, use cookies)
- Frontend: All components using `localStorage.getItem('token')` (26 locations)

**Changes needed:**
- Backend sets httpOnly cookies instead of returning JWT in response body
- Frontend removes all localStorage token access
- Frontend axios automatically sends cookies with requests
- Update logout to clear cookies

**Estimated effort:** 2-3 hours  
**Risk:** Medium (requires testing to ensure cookies work with CORS)

---

### 2. ✅ Security: Password Validation
**Status:** Already strong! ✅  
**Current state:**
- Backend: Strong validation (10+ chars, uppercase, lowercase, number, symbol, common passwords blocked)
- Frontend: Matching validation with password strength hints

**Action needed:** None - already secure! ✅

---

### 3. ⚠️ Security: CSP Headers Enhancement
**Status:** Can enhance  
**Current state:** CSP configured but only enabled in production  
**Files to modify:**
- `services/api/src/index.ts` (helmet configuration)

**Changes needed:**
- Enable CSP in all environments (not just production)
- Review and tighten CSP directives if needed
- Add report-uri for CSP violations

**Estimated effort:** 30 minutes  
**Risk:** Low

---

### 4. 🔴 Security: RBAC Leakage - Create ProtectedRoute Component
**Status:** Can fix completely  
**Impact:** Security + UX improvement  
**Current issue:** Routes protected inline in `App.tsx`, no centralized protection

**Files to create:**
- `web/src/components/ProtectedRoute.tsx` (new component)

**Files to modify:**
- `web/src/App.tsx` (use ProtectedRoute component)
- `web/src/components/Header.tsx` (hide unauthorized navigation links)

**Changes needed:**
- Create ProtectedRoute component with role checking
- Replace inline route protection with ProtectedRoute
- Hide navigation links based on user roles (not just disable)
- Add proper 403 redirect handling

**Estimated effort:** 1-2 hours  
**Risk:** Low

---

### 5. ⚠️ Payment Routes: Add Missing Config Endpoint
**Status:** Can fix  
**Issue:** `/config/razorpay` endpoint returns 404  
**Files to modify:**
- `services/api/src/routes/marketplace.ts` (add config endpoint)

**Changes needed:**
- Add `GET /api/marketplace/config` endpoint
- Return Razorpay configuration (public key, status, etc.)
- Ensure proper authentication

**Estimated effort:** 30 minutes  
**Risk:** Low

---

### 6. ✅ Frontend Environment Configuration
**Status:** Can verify/update  
**Files to check/modify:**
- `web/.env.example` (verify completeness)

**Action:** Review and update if needed

**Estimated effort:** 30 minutes  
**Risk:** Very low

---

### 7. 🔧 Code Quality: Frontend Token Access Cleanup
**Status:** Can fix (related to #1)  
**Issue:** 26 locations access `localStorage.getItem('token')`  
**Action:** Remove all localStorage token access when implementing httpOnly cookies

**Estimated effort:** Included in #1  
**Risk:** Low

---

## ❌ WHAT I CANNOT FIX (Requires User Action)

### 1. ❌ Starting Services
- **AI Service:** Must be started manually (`cd ai-service && uvicorn app.main:app`)
- **Frontend Dev Server:** Must be started manually (`cd web && npm start`)
- **Backend API:** Already running (good!)

### 2. ❌ Database/Seeding
- **Admin Login Failure:** May need to run seed scripts or verify credentials
- **Demo Users:** Requires database seeding

### 3. ❌ External Service Configuration
- **Firebase Credentials:** Need to be added to `.env` files (not in code)
- **Razorpay Credentials:** Need to be configured in environment
- **AI Service Key:** Need to be set in backend `.env`

### 4. ❌ Testing Execution
- **Cypress Tests:** Can review tests but cannot run them without services running
- **End-to-end Testing:** Requires all services to be running

### 5. ❌ Infrastructure/Deployment
- **Service Deployment:** Requires deployment platform access
- **Environment Variables:** Must be set in deployment platform
- **DNS/SSL Configuration:** Requires hosting platform access

---

## 📋 RECOMMENDED PRIORITY ORDER

### Priority 1: Critical Security Fixes (Do First)
1. **JWT → httpOnly Cookies** (2-3 hours) 🔴
   - Highest security impact
   - Eliminates XSS token theft risk
   - Requires testing but straightforward

2. **RBAC ProtectedRoute Component** (1-2 hours) 🔴
   - Improves security + code quality
   - Centralizes route protection
   - Better user experience

### Priority 2: Security Enhancements
3. **CSP Headers Enhancement** (30 min) ⚠️
   - Quick win
   - Low risk
   - Better security posture

### Priority 3: Bug Fixes
4. **Payment Config Endpoint** (30 min) ⚠️
   - Quick fix
   - Resolves 404 errors
   - Improves payment flow

5. **Environment Configuration Review** (30 min) ✅
   - Verification task
   - Documentation improvement

---

## 🎯 RECOMMENDED ACTION PLAN

### Phase 1: Critical Security (Today - 3-5 hours)
✅ Fix JWT localStorage → httpOnly cookies  
✅ Create ProtectedRoute component  
✅ Update CSP headers

### Phase 2: Quick Fixes (30 minutes)
✅ Add payment config endpoint  
✅ Review environment files

### Phase 3: User Actions (You need to do)
❌ Start AI service  
❌ Start frontend dev server (for testing)  
❌ Verify admin credentials / run seed scripts  
❌ Configure environment variables (Firebase, Razorpay, AI key)

---

## 💡 SUGGESTION

**I recommend starting with the JWT → httpOnly cookies fix** because:
1. It's the most critical security issue
2. It's a complete fix I can implement
3. It eliminates the XSS vulnerability
4. Other fixes can wait, but this one shouldn't

**Would you like me to:**
1. ✅ Start with JWT → httpOnly cookies fix?
2. ✅ Do all fixable issues?
3. ✅ Create a specific fix first?
4. ✅ Just document the fixes for you to implement?

Let me know what you prefer!

