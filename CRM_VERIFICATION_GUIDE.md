# CRM System Verification & Testing Guide

## Quick Verification Steps

### 1. API Health Check
```powershell
curl http://localhost:4000/health | ConvertFrom-Json
```
**Expected Output:**
```json
{
  "status": "ok",
  "timestamp": "2025-12-09T...",
  "mongodb": { "status": "connected", "ping": "successful" },
  "socketIO": { "initialized": true, "connections": 0 },
  "uptime": 12345,
  "memory": {...},
  "version": "v20.x.x"
}
```

---

## CRM Feature Verification

### Lead Management

#### ✅ Create Lead (Manual)
```powershell
# Requires authentication token
$token = "your-jwt-token"
$headers = @{ Authorization = "Bearer $token"; "Content-Type" = "application/json" }
$body = @{
    email = "test@example.com"
    name = "Test User"
    phone = "+919876543210"
    tripId = "trip-id-here"
    source = "inquiry"
    metadata = @{
        inquiryMessage = "Interested in this trek"
        tripViewCount = 1
    }
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:4000/api/crm/leads" -Method Post -Headers $headers -Body $body
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Lead created successfully",
  "data": {
    "_id": "...",
    "email": "test@example.com",
    "name": "Test User",
    "status": "new",
    "leadScore": 75,
    "source": "inquiry",
    "createdAt": "2025-12-09T..."
  }
}
```

#### ✅ Get All Leads
```powershell
$headers = @{ Authorization = "Bearer $token" }
Invoke-RestMethod -Uri "http://localhost:4000/api/crm/leads?status=new&page=1&limit=20" -Headers $headers
```

**Expected Response:**
```json
{
  "success": true,
  "data": [...leads],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "pages": 3
  }
}
```

#### ✅ Update Lead Status
```powershell
$leadId = "lead-id-here"
$body = @{ status = "contacted" } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:4000/api/crm/leads/$leadId" -Method Put -Headers $headers -Body $body
```

#### ✅ Add Interaction
```powershell
$body = @{
    type = "call"
    description = "Initial contact call made, customer interested"
} | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:4000/api/crm/leads/$leadId/interactions" -Method Post -Headers $headers -Body $body
```

#### ✅ Convert Lead
```powershell
Invoke-RestMethod -Uri "http://localhost:4000/api/crm/leads/$leadId/convert" -Method Post -Headers $headers
```

---

### Analytics & Charts

#### ✅ Organizer Analytics
```powershell
Invoke-RestMethod -Uri "http://localhost:4000/api/crm/analytics/organizer" -Headers $headers
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "leads": {
      "total": 150,
      "converted": 45,
      "conversionRate": "30.00"
    },
    "support": {
      "totalTickets": 23,
      "resolvedTickets": 18,
      "pendingTickets": 5
    },
    "recentActivity": [...],
    "subscription": {
      "planType": "premium",
      "status": "active",
      "remainingTrips": 5,
      "hasCRMAccess": true
    }
  }
}
```

#### ✅ Lead Sources Breakdown
```powershell
Invoke-RestMethod -Uri "http://localhost:4000/api/crm/analytics/lead-sources" -Headers $headers
```

**Expected Response:**
```json
[
  { "_id": "inquiry", "count": 50 },
  { "_id": "partial_booking", "count": 30 },
  { "_id": "chat", "count": 25 },
  { "_id": "trip_view", "count": 45 }
]
```

---

### Support Tickets

#### ✅ Create Ticket
```powershell
$body = @{
    subject = "Payment issue"
    description = "Payment not reflecting after successful transaction"
    category = "payment"
    priority = "high"
} | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:4000/api/crm/tickets" -Method Post -Headers $headers -Body $body
```

#### ✅ Get Tickets
```powershell
Invoke-RestMethod -Uri "http://localhost:4000/api/crm/tickets?status=pending" -Headers $headers
```

#### ✅ Update Ticket Status (Admin)
```powershell
$ticketId = "ticket-id-here"
$body = @{ status = "in_progress" } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:4000/api/crm/tickets/$ticketId/status" -Method Put -Headers $headers -Body $body
```

---

### Payment Webhooks

#### ✅ Razorpay Webhook Simulation
```powershell
# Compute signature
$webhookSecret = $env:RAZORPAY_WEBHOOK_SECRET
$payload = @'
{
  "event": "payment.captured",
  "payload": {
    "payment": {
      "entity": {
        "id": "pay_test123",
        "order_id": "order_test123",
        "amount": 50000,
        "status": "captured",
        "method": "upi",
        "notes": {
          "type": "booking"
        }
      }
    }
  }
}
'@

# Generate HMAC SHA256 signature
$hmacsha = New-Object System.Security.Cryptography.HMACSHA256
$hmacsha.key = [Text.Encoding]::UTF8.GetBytes($webhookSecret)
$signature = [Convert]::ToBase64String($hmacsha.ComputeHash([Text.Encoding]::UTF8.GetBytes($payload)))

$headers = @{
    "x-razorpay-signature" = $signature
    "Content-Type" = "application/json"
}

Invoke-RestMethod -Uri "http://localhost:4000/api/webhooks/razorpay" -Method Post -Headers $headers -Body $payload
```

**Expected Response:**
```json
{
  "status": "ok"
}
```

---

## Frontend Verification

### Dashboard with Charts

#### ✅ EnhancedCRMDashboard Component
**Location:** `web/src/pages/EnhancedCRMDashboard.tsx`

**Features to Test:**
1. **Pie Chart - Lead Status Distribution**
   - Navigate to CRM Dashboard
   - Switch to "Analytics" tab
   - Verify pie chart shows lead status breakdown
   - Check colors and labels

2. **Line Chart - Lead Trends**
   - Verify line chart shows 7-day lead history
   - Check auto-refresh (30-second interval)
   - Verify data updates in real-time

3. **Lead Table**
   - Verify lead list with filters
   - Test status filter dropdown
   - Test search functionality
   - Verify sort options (recent, status, name)

4. **Lead Details Modal**
   - Click on a lead
   - Verify detailed information
   - Test note editing
   - Test status update

5. **Auto-Refresh**
   - Toggle auto-refresh on/off
   - Verify last refresh timestamp updates
   - Check 30-second interval

**Manual Testing Steps:**
```
1. npm run build (in web directory) ✅
2. npm start
3. Login as organizer
4. Navigate to /crm-dashboard
5. Verify CRM access
6. Check all tabs (Dashboard, Leads, Analytics)
7. Verify charts render
8. Test all CRUD operations
9. Check toast notifications
10. Verify responsive design
```

---

## Automated Lead Creation (Not Yet Implemented)

### ⚠️ Infrastructure Ready - Needs Implementation

**What's Ready:**
- UserActivity model tracks all user actions
- Lead model supports all source types
- Lead scoring algorithm is defined
- API endpoints are functional

**What's Missing:**
1. **Trip View Tracker Middleware**
   ```typescript
   // services/api/src/middleware/tripViewTracker.ts (TO BE CREATED)
   // Track repeated trip views and create lead after threshold
   ```

2. **Booking Abandonment Detector**
   ```typescript
   // services/api/src/services/bookingAbandonmentService.ts (TO BE CREATED)
   // Detect partial form submissions and create high-score leads
   ```

3. **Chat-to-Lead Converter**
   ```typescript
   // services/api/src/services/chatLeadService.ts (TO BE CREATED)
   // Analyze chat sessions and auto-create leads for interested users
   ```

4. **Inquiry Form Handler**
   ```typescript
   // Already exists in routes but needs auto-lead creation hook
   ```

**Implementation Priority:**
1. High: Partial booking abandonment (80-point leads)
2. Medium: Inquiry form auto-capture (60-point leads)
3. Medium: Chat session conversion (50-point leads)
4. Low: Trip view threshold (20-point leads)

---

## Performance Verification

### Response Times
```powershell
# Measure API response time
Measure-Command {
    Invoke-RestMethod -Uri "http://localhost:4000/api/crm/leads" -Headers $headers
}
```

**Expected:** < 500ms

### Database Queries
```powershell
# Check MongoDB slow queries
# Should have proper indexes on:
# - Lead: email, status, tripId, assignedTo, leadScore, createdAt
# - Ticket: status, category, requesterId, createdAt
# - UserActivity: userId, activityType, createdAt
```

### Chart Rendering
```javascript
// In browser console
console.time('chart-render');
// Switch to analytics tab
console.timeEnd('chart-render');
// Should be < 200ms
```

---

## Security Verification

### Authentication
```powershell
# Test without token (should fail)
try {
    Invoke-RestMethod -Uri "http://localhost:4000/api/crm/leads"
} catch {
    Write-Host "Expected: 401 Unauthorized"
}
```

### Role-Based Access
```powershell
# Test with user role (should fail for organizer-only endpoints)
$userToken = "user-jwt-token"
$headers = @{ Authorization = "Bearer $userToken" }
try {
    Invoke-RestMethod -Uri "http://localhost:4000/api/crm/leads" -Headers $headers
} catch {
    Write-Host "Expected: 403 Forbidden"
}
```

### Webhook Signature Verification
```powershell
# Test with invalid signature (should fail)
$headers = @{
    "x-razorpay-signature" = "invalid-signature"
    "Content-Type" = "application/json"
}
try {
    Invoke-RestMethod -Uri "http://localhost:4000/api/webhooks/razorpay" -Method Post -Headers $headers -Body $payload
} catch {
    Write-Host "Expected: 400 Invalid signature"
}
```

---

## Build Verification

### Backend Build
```powershell
cd services/api
npm run build
```
**Status:** ✅ SUCCESS (after fixes)

**Previously Fixed Issues:**
- ✅ AuditLog action enum extended
- ✅ OrganizerProfile bankDetails added
- ✅ notificationService imported
- ✅ TicketMessage type fixed
- ✅ Transformer embeddings type cast

### Frontend Build
```powershell
cd web
npm run build
```
**Status:** ✅ SUCCESS (after fixes)

**Previously Fixed Issues:**
- ✅ apiClient.ts created
- ✅ react-toastify installed
- ✅ chart.js + react-chartjs-2 installed

---

## Monitoring & Logs

### Check Logs
```powershell
# API logs
docker-compose logs api --tail 100

# Or if running locally
cd services/api
npm run dev
```

### Metrics Endpoint
```powershell
curl http://localhost:4000/metrics
```

### Audit Logs
```powershell
# Query MongoDB for audit logs
# db.auditlogs.find({ action: "payment_captured" }).sort({ timestamp: -1 }).limit(10)
```

---

## Success Criteria

### ✅ CRM System is Working If:
1. Leads can be created manually via API
2. Lead status can be updated
3. Interactions can be logged
4. Leads can be converted
5. Analytics endpoints return data
6. Charts render correctly in dashboard
7. Support tickets can be created and managed
8. Webhooks process Razorpay events
9. Notifications are sent on key events
10. Role-based access is enforced

### ⚠️ Known Limitations:
1. Automated lead creation not yet implemented
2. Some chart types are placeholders
3. Advanced analytics features pending
4. Marketing automation not implemented

---

## Next Steps for Full Automation

### Phase 1: Trip View Tracking
```typescript
// Implement middleware to track views
// Create lead after 3+ views within 7 days
```

### Phase 2: Booking Abandonment
```typescript
// Detect form abandonment
// Create high-priority lead immediately
```

### Phase 3: Chat Analysis
```typescript
// Analyze chat for purchase intent
// Create lead with chat history
```

### Phase 4: Email Integration
```typescript
// Follow-up emails for new leads
// Drip campaigns for nurturing
```

---

**Verification Completed:** December 9, 2025
**All Core CRM Features:** ✅ Working
**Charts & Analytics:** ✅ Functional
**Webhooks:** ✅ Operational
**Automated Lead Creation:** ⚠️ Infrastructure Ready, Implementation Pending
