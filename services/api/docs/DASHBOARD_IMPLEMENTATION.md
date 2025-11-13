# Role-Specific Dashboard Implementation

## Overview
Comprehensive dashboards tailored for each user role: Organizers, Agents, Admins, and Travelers.

## Fixed Issues

### ✅ Profile Access Issue
**Problem:** Organizers couldn't access their profiles due to route ordering conflict.

**Solution:** Moved `/profile/search` route before `/profile/:userId` to prevent the search endpoint from being treated as a userId parameter.

**Changes Made:**
```typescript
// BEFORE (Wrong order)
router.get('/:userId', ...)  // This would match '/search' as userId
router.get('/search', ...)   // This would never be reached

// AFTER (Correct order)
router.get('/search', ...)   // Search route first
router.get('/me', ...)       // Authenticated user profile
router.get('/:userId', ...)  // Public profile by ID last
```

## Dashboard Endpoints

### 1. Organizer Dashboard
**Endpoint:** `GET /api/dashboard/organizer`  
**Auth:** Required (organizer role)

**Response Structure:**
```json
{
  "user": {
    "id": "user_id",
    "name": "John Doe",
    "email": "organizer@example.com",
    "phone": "+919876543210",
    "phoneVerified": true,
    "profilePhoto": "photo_url",
    "role": "organizer",
    "profileCompleteness": 80
  },
  "summary": {
    "trips": {
      "total": 15,
      "active": 8,
      "draft": 2,
      "completed": 5,
      "upcoming": 6
    },
    "bookings": {
      "total": 42,
      "pendingVerifications": 3,
      "confirmed": 35,
      "cancelled": 4,
      "today": 2
    },
    "participants": {
      "total": 180
    },
    "revenue": {
      "total": 450000,
      "monthly": 85000
    }
  },
  "recentTrips": [...],
  "recentBookings": [...],
  "subscription": {
    "planType": "trip_package_5",
    "status": "active",
    "tripPackage": {
      "remainingTrips": 3
    }
  },
  "autoPay": {
    "isSetupCompleted": true,
    "autoPayEnabled": true,
    "scheduledPaymentDate": "2025-03-15T00:00:00Z",
    "nextPaymentDate": "2025-03-15T00:00:00Z",
    "paymentAmount": 149900
  },
  "alerts": [
    {
      "type": "warning",
      "message": "3 bookings awaiting payment verification",
      "action": "/organizer/pending-verifications",
      "priority": "high"
    }
  ],
  "quickActions": [
    {
      "label": "Create New Trip",
      "icon": "plus",
      "action": "/trips/create",
      "color": "primary"
    },
    {
      "label": "View Pending Verifications",
      "icon": "clock",
      "action": "/organizer/pending-verifications",
      "badge": 3,
      "color": "warning"
    }
  ]
}
```

**Key Features:**
- Real-time statistics (trips, bookings, revenue, participants)
- Auto-pay status and next payment date
- Subscription info with remaining trip credits
- Contextual alerts (pending verifications, low credits, etc.)
- Quick action buttons with badges
- Profile completeness percentage
- Recent trips and bookings

---

### 2. Agent Dashboard
**Endpoint:** `GET /api/dashboard/agent`  
**Auth:** Required (agent or admin role)

**Response Structure:**
```json
{
  "user": {
    "id": "agent_id",
    "name": "Agent Name",
    "email": "agent@example.com",
    "role": "agent"
  },
  "summary": {
    "users": {
      "total": 1250,
      "organizers": 150,
      "travelers": 1095,
      "newToday": 12,
      "verifiedOrganizers": 120,
      "unverifiedOrganizers": 30
    },
    "trips": {
      "total": 450,
      "active": 180,
      "pending": 15,
      "completed": 255,
      "today": 5
    },
    "bookings": {
      "total": 2100,
      "pending": 45,
      "confirmed": 1850,
      "today": 18
    }
  },
  "recentUsers": [...],
  "recentTrips": [...],
  "pendingVerifications": [...],
  "subscriptionsAlert": [...],
  "alerts": [
    {
      "type": "info",
      "message": "30 organizers awaiting verification",
      "action": "/agent/verify-organizers",
      "priority": "medium"
    }
  ],
  "quickActions": [...]
}
```

**Key Features:**
- Platform-wide user statistics
- Verification queues (organizers, payments)
- Recent user registrations
- Pending trip approvals
- Subscription alerts (expired, low credits)
- Moderation tools access

---

### 3. Admin Dashboard
**Endpoint:** `GET /api/dashboard/admin`  
**Auth:** Required (admin role)

**Response Structure:**
```json
{
  "user": {
    "id": "admin_id",
    "name": "Admin Name",
    "email": "admin@example.com",
    "role": "admin"
  },
  "summary": {
    "users": {
      "total": 1250,
      "organizers": 150,
      "travelers": 1095,
      "agents": 5,
      "thisMonth": 85,
      "growth": 15.5
    },
    "trips": {
      "total": 450,
      "active": 180,
      "completed": 255,
      "thisMonth": 32
    },
    "bookings": {
      "total": 2100,
      "confirmed": 1850,
      "thisMonth": 145
    },
    "revenue": {
      "total": 5250000,
      "thisMonth": 485000,
      "lastMonth": 425000,
      "growth": 14.1
    },
    "subscriptions": {
      "total": 145,
      "active": 130,
      "expired": 15
    }
  },
  "topOrganizers": [
    {
      "name": "Top Organizer",
      "email": "top@example.com",
      "tripCount": 25,
      "participants": 450
    }
  ],
  "recentUsers": [...],
  "recentTrips": [...],
  "systemHealth": {
    "database": "healthy",
    "api": "healthy",
    "cronJobs": "running",
    "emailService": "operational"
  },
  "alerts": [...],
  "quickActions": [...]
}
```

**Key Features:**
- Comprehensive platform statistics
- Month-over-month growth metrics
- Revenue tracking and trends
- Top performers leaderboard
- System health monitoring
- Subscription overview
- Administrative tools access

---

### 4. Traveler Dashboard
**Endpoint:** `GET /api/dashboard/traveler`  
**Auth:** Required (any authenticated user)

**Response Structure:**
```json
{
  "user": {
    "id": "traveler_id",
    "name": "Traveler Name",
    "email": "traveler@example.com",
    "phone": "+919876543210",
    "phoneVerified": true,
    "profilePhoto": "photo_url",
    "role": "traveler",
    "profileCompleteness": 60
  },
  "stats": {
    "tripsJoined": 8,
    "upcomingTrips": 2,
    "completedTrips": 6,
    "totalBookings": 10,
    "pendingBookings": 1,
    "confirmedBookings": 8
  },
  "upcomingTrips": [
    {
      "id": "trip_id",
      "title": "Himalayan Adventure",
      "destination": "Manali",
      "startDate": "2025-02-15T00:00:00Z",
      "endDate": "2025-02-20T00:00:00Z",
      "organizerName": "John Organizer",
      "organizerPhoto": "photo_url",
      "image": "trip_image_url"
    }
  ],
  "recentBookings": [...],
  "alerts": [
    {
      "type": "warning",
      "message": "Please verify your phone number to complete bookings",
      "action": "/verify-phone",
      "priority": "high"
    }
  ],
  "quickActions": [
    {
      "label": "Explore Trips",
      "icon": "compass",
      "action": "/trips/explore",
      "color": "primary"
    }
  ]
}
```

**Key Features:**
- Personal trip statistics
- Upcoming and past trips timeline
- Booking history and status
- Profile completion nudges
- Personalized recommendations
- Quick access to explore trips

---

## Testing Guide

### Manual Testing

#### 1. Test Organizer Dashboard
```bash
# Login as organizer
POST /auth/login
{
  "email": "organizer@test.com",
  "password": "password123"
}

# Get organizer dashboard
GET /api/dashboard/organizer
Authorization: Bearer <token>

# Verify response includes:
✓ User info with profile completeness
✓ Trip statistics
✓ Booking statistics
✓ Revenue data
✓ Auto-pay status
✓ Subscription info
✓ Alerts array
✓ Quick actions
```

#### 2. Test Agent Dashboard
```bash
# Login as agent
POST /auth/login
{
  "email": "agent@test.com",
  "password": "password123"
}

# Get agent dashboard
GET /api/dashboard/agent
Authorization: Bearer <token>

# Verify response includes:
✓ Platform-wide user statistics
✓ Trip and booking stats
✓ Recent users list
✓ Pending verifications
✓ Subscription alerts
```

#### 3. Test Admin Dashboard
```bash
# Login as admin
POST /auth/login
{
  "email": "admin@test.com",
  "password": "password123"
}

# Get admin dashboard
GET /api/dashboard/admin
Authorization: Bearer <token>

# Verify response includes:
✓ Comprehensive statistics
✓ Growth metrics
✓ Revenue data
✓ Top organizers
✓ System health
```

#### 4. Test Traveler Dashboard
```bash
# Login as traveler
POST /auth/login
{
  "email": "traveler@test.com",
  "password": "password123"
}

# Get traveler dashboard
GET /api/dashboard/traveler
Authorization: Bearer <token>

# Verify response includes:
✓ Personal trip stats
✓ Upcoming trips
✓ Recent bookings
✓ Alerts
```

#### 5. Test Profile Access
```bash
# Get own profile (should work now)
GET /profile/me
Authorization: Bearer <token>

# Search profiles (should not conflict)
GET /profile/search?q=john&role=organizer

# Get public profile by ID
GET /profile/<user_id>
```

### Automated Testing Script

Create `test-dashboards.sh`:
```bash
#!/bin/bash

API_URL="http://localhost:4000"

echo "Testing Dashboard Endpoints..."

# Test Organizer Dashboard
echo "1. Testing Organizer Dashboard..."
ORGANIZER_TOKEN="<organizer_jwt>"
curl -X GET "$API_URL/api/dashboard/organizer" \
  -H "Authorization: Bearer $ORGANIZER_TOKEN" \
  | jq '.'

# Test Agent Dashboard
echo "2. Testing Agent Dashboard..."
AGENT_TOKEN="<agent_jwt>"
curl -X GET "$API_URL/api/dashboard/agent" \
  -H "Authorization: Bearer $AGENT_TOKEN" \
  | jq '.'

# Test Admin Dashboard
echo "3. Testing Admin Dashboard..."
ADMIN_TOKEN="<admin_jwt>"
curl -X GET "$API_URL/api/dashboard/admin" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  | jq '.'

# Test Traveler Dashboard
echo "4. Testing Traveler Dashboard..."
TRAVELER_TOKEN="<traveler_jwt>"
curl -X GET "$API_URL/api/dashboard/traveler" \
  -H "Authorization: Bearer $TRAVELER_TOKEN" \
  | jq '.'

# Test Profile Access
echo "5. Testing Profile Access..."
curl -X GET "$API_URL/profile/me" \
  -H "Authorization: Bearer $ORGANIZER_TOKEN" \
  | jq '.'

curl -X GET "$API_URL/profile/search?q=test&role=organizer" \
  | jq '.'

echo "All tests completed!"
```

---

## Frontend Integration

### Example React Implementation

```typescript
// hooks/useDashboard.ts
import { useEffect, useState } from 'react';
import axios from 'axios';

export const useDashboard = (role: string) => {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const response = await axios.get(`/api/dashboard/${role}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        });
        setDashboard(response.data);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, [role]);

  return { dashboard, loading, error };
};

// components/OrganizerDashboard.tsx
import { useDashboard } from '../hooks/useDashboard';

export const OrganizerDashboard = () => {
  const { dashboard, loading, error } = useDashboard('organizer');

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;

  return (
    <div className="dashboard">
      {/* Header */}
      <DashboardHeader user={dashboard.user} />

      {/* Alerts */}
      {dashboard.alerts.length > 0 && (
        <AlertsSection alerts={dashboard.alerts} />
      )}

      {/* Statistics Cards */}
      <StatsGrid summary={dashboard.summary} />

      {/* Auto-Pay Status */}
      <AutoPayCard autoPay={dashboard.autoPay} />

      {/* Recent Activity */}
      <div className="grid grid-cols-2 gap-4">
        <RecentTrips trips={dashboard.recentTrips} />
        <RecentBookings bookings={dashboard.recentBookings} />
      </div>

      {/* Quick Actions */}
      <QuickActions actions={dashboard.quickActions} />
    </div>
  );
};
```

---

## Alert Priority Levels

| Priority | Color | Use Case |
|----------|-------|----------|
| `critical` | Red | Auto-pay not setup, service disruption |
| `high` | Orange | Payment verifications pending, phone not verified |
| `medium` | Yellow | Low trip credits, expired subscriptions |
| `low` | Blue | Profile incomplete, recommendations available |

---

## Performance Considerations

### Optimization Strategies

1. **Caching:** Dashboard data should be cached for 5-10 minutes
2. **Parallel Queries:** All database queries use `Promise.all()`
3. **Indexing:** Ensure indexes on:
   - `User.role`
   - `Trip.organizerId`
   - `Trip.status`
   - `GroupBooking.tripId`
   - `GroupBooking.bookingStatus`
   - `CRMSubscription.organizerId`

4. **Pagination:** Recent items limited to 5-10 entries
5. **Lean Queries:** Use `.lean()` for read-only operations

---

## API Documentation

### Dashboard Endpoint Summary

| Endpoint | Method | Auth | Role Required | Description |
|----------|--------|------|---------------|-------------|
| `/api/dashboard/organizer` | GET | Yes | organizer | Comprehensive organizer dashboard |
| `/api/dashboard/agent` | GET | Yes | agent, admin | Agent moderation dashboard |
| `/api/dashboard/admin` | GET | Yes | admin | Admin control panel |
| `/api/dashboard/traveler` | GET | Yes | any | Traveler personal dashboard |

---

## Troubleshooting

### Common Issues

#### 1. "Access Denied" Error
**Problem:** User doesn't have required role
**Solution:** Verify JWT token contains correct role

#### 2. Slow Dashboard Loading
**Problem:** Too many database queries
**Solution:** Check database indexes, enable caching

#### 3. Missing Data
**Problem:** Related documents not populated
**Solution:** Verify populate() calls in queries

#### 4. Profile 404 Error
**Problem:** Route ordering conflict
**Solution:** Ensure `/search` is before `/:userId`

---

## Future Enhancements

1. **Real-time Updates:** WebSocket integration for live dashboard updates
2. **Customizable Widgets:** Allow users to customize dashboard layout
3. **Export Data:** CSV/PDF export for reports
4. **Analytics Charts:** Visual graphs for trends
5. **Notification Center:** Centralized notification management
6. **Dark Mode:** Theme support
7. **Mobile Optimization:** Responsive dashboard components

---

## Summary

✅ Fixed profile access issue by reordering routes  
✅ Created 4 role-specific dashboards  
✅ Implemented comprehensive statistics  
✅ Added contextual alerts system  
✅ Provided quick action buttons  
✅ Included auto-pay status  
✅ Optimized database queries  
✅ Ready for frontend integration  

All dashboards are production-ready and provide users with immediate, actionable insights tailored to their specific role.
