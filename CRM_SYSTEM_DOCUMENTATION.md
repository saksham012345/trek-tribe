# Trek-Tribe CRM System Documentation

## Overview
The Trek-Tribe CRM (Customer Relationship Management) system is a comprehensive solution designed for trek organizers to manage leads, support tickets, trip verifications, subscriptions, and analytics.

---

## Table of Contents
1. [CRM Features](#crm-features)
2. [Lead Management](#lead-management)
3. [Automated Lead Creation](#automated-lead-creation)
4. [Analytics & Visualization](#analytics--visualization)
5. [Support Ticket System](#support-ticket-system)
6. [Trip Verification System](#trip-verification-system)
7. [Subscription Management](#subscription-management)
8. [API Endpoints](#api-endpoints)
9. [Frontend Components](#frontend-components)

---

## CRM Features

### Core Functionalities
1. **Lead Management System**
   - Create, view, update, and convert leads
   - Track lead interactions and history
   - Assign leads to organizers
   - Lead scoring and prioritization
   - Filter and search capabilities

2. **Support Ticket System**
   - Create and manage support tickets
   - Assign tickets to agents
   - Track ticket status and resolution
   - Add messages and notes
   - Automatic response time tracking

3. **Trip Verification System**
   - Submit trips for verification
   - Admin review and approval
   - Checklist-based verification process
   - Status tracking (pending, verified, rejected)

4. **Analytics Dashboard**
   - Lead conversion metrics
   - Ticket performance metrics
   - Revenue tracking
   - Activity monitoring
   - Visual data representation with charts

5. **Subscription & Payment Management**
   - Trial subscriptions
   - Trip package purchases
   - CRM bundle access
   - Payment tracking and verification

6. **User Activity Tracking**
   - Track user interactions
   - Monitor trip views
   - Log booking activities
   - Profile updates and document uploads

---

## Lead Management

### Lead Model Schema
```typescript
{
  userId: ObjectId,              // Reference to User
  tripId: ObjectId,              // Reference to Trip
  email: string (required),      // Lead's email
  phone: string,                 // Contact number
  name: string,                  // Lead's name
  source: enum,                  // Source of lead
  status: enum,                  // Current status
  leadScore: number,             // 0-100 score
  interactions: Array,           // Interaction history
  metadata: Object,              // Additional data
  assignedTo: ObjectId,          // Assigned organizer
  convertedAt: Date,             // Conversion timestamp
  createdAt: Date,
  updatedAt: Date
}
```

### Lead Sources
- **trip_view** - User viewed a trip page
- **inquiry** - User sent an inquiry
- **partial_booking** - User started but didn't complete booking
- **chat** - Lead from chat interaction
- **form** - Lead from contact form
- **other** - Other sources

### Lead Statuses
- **new** - Newly created lead
- **contacted** - Initial contact made
- **interested** - Showed interest
- **not_interested** - Not interested
- **converted** - Successfully converted to booking
- **lost** - Lost opportunity

### Lead Scoring Algorithm
Lead scores are calculated automatically based on:

```typescript
Base Scores by Source:
- partial_booking: 80 points
- inquiry: 60 points
- chat: 50 points
- form: 40 points
- trip_view: 20 points
- other: 10 points

Additional Points:
- Multiple trip views: +10 points
- Inquiry message present: +15 points
- Maximum score capped at 100
```

### Lead Operations
1. **Create Lead** - `POST /api/crm/leads`
2. **Get All Leads** - `GET /api/crm/leads` (with filtering)
3. **Get Lead by ID** - `GET /api/crm/leads/:id`
4. **Update Lead** - `PUT /api/crm/leads/:id`
5. **Add Interaction** - `POST /api/crm/leads/:id/interactions`
6. **Convert Lead** - `POST /api/crm/leads/:id/convert`

---

## Automated Lead Creation

### Automatic Lead Creation Triggers

Currently, the system supports **MANUAL lead creation only** through the API endpoint. However, the infrastructure is in place for automated lead creation based on:

#### Potential Automation Points (Implementation Required):

1. **Trip View Tracking** (NOT YET AUTOMATED)
   - When a user views a trip page multiple times
   - Trigger: User visits trip page > 3 times
   - Source: `trip_view`
   - Initial Score: 20-30 points

2. **Partial Booking Abandonment** (NOT YET AUTOMATED)
   - When a user starts booking but doesn't complete
   - Trigger: Form partially filled but not submitted
   - Source: `partial_booking`
   - Initial Score: 80 points

3. **Inquiry Form Submission** (NOT YET AUTOMATED)
   - When a user submits a contact/inquiry form
   - Trigger: Inquiry form submission
   - Source: `inquiry`
   - Initial Score: 60 points

4. **Chat Interaction** (NOT YET AUTOMATED)
   - When a user engages in support chat
   - Trigger: Chat session with intent detection
   - Source: `chat`
   - Initial Score: 50 points

### User Activity Tracking (Foundation for Automation)
The system tracks user activities through the `UserActivity` model:

```typescript
Activity Types:
- trip_view
- booking_made
- chat_initiated
- ticket_created
- payment_made
- profile_updated
- document_uploaded
- login/logout
```

**Note:** While activity tracking is in place, automatic lead creation from these activities is **NOT YET IMPLEMENTED** and requires:
1. Middleware to intercept trip views
2. Event listeners for form abandonments
3. Hooks in chat service for lead generation
4. Threshold-based triggers

---

## Analytics & Visualization

### Graph-Based Analytics

The system includes **comprehensive chart visualizations** in the `EnhancedCRMDashboard` component:

#### 1. **Pie Chart - Lead Status Distribution**
```typescript
Shows breakdown of leads by status:
- New leads
- Contacted
- Interested
- Qualified
- Lost
```
**Implementation:** Using Chart.js with react-chartjs-2
- Located in: `web/src/pages/EnhancedCRMDashboard.tsx`
- Chart Type: Pie Chart (Doughnut)

#### 2. **Line Chart - Leads Over Time**
```typescript
Tracks lead growth over the last 7 days:
- Daily lead count
- Trend visualization
- Auto-refresh every 30 seconds
```
**Implementation:** Using Chart.js Line component

#### 3. **Bar Chart - Conversion Metrics** (Placeholder)
```typescript
Planned visualizations:
- Conversion rates by source
- Monthly performance
- Lead quality metrics
```

### Analytics Data Available

1. **Organizer Analytics** (`GET /api/crm/analytics/organizer`)
   ```typescript
   {
     leads: {
       total: number,
       converted: number,
       conversionRate: string
     },
     support: {
       totalTickets: number,
       resolvedTickets: number,
       pendingTickets: number
     },
     recentActivity: Activity[],
     subscription: SubscriptionInfo
   }
   ```

2. **Admin Analytics** (`GET /api/crm/analytics/admin`)
   ```typescript
   {
     leads: { total, new },
     tickets: { total, pending, avgResponseTime },
     verifications: { pending, verified },
     subscriptions: { active, trial },
     revenue: { total, currency }
   }
   ```

3. **Lead Sources Breakdown**
   ```typescript
   Aggregates leads by source with counts
   ```

4. **Ticket Category Breakdown**
   ```typescript
   Groups tickets by category with counts
   ```

### Chart Libraries Used
- **Chart.js** v4+ (core charting library)
- **react-chartjs-2** (React wrapper)
- Components: Pie, Line, Bar, Doughnut
- Features: Tooltips, Legends, Animations, Responsive design

---

## Support Ticket System

### Features
- Create support tickets
- Assign to agents
- Track status (pending, in-progress, waiting-customer, resolved, closed)
- Add messages and attachments
- Priority levels (low, medium, high, urgent)
- Categories (booking, payment, technical, general, complaint, refund)
- Performance tracking (response time, resolution time)
- Customer satisfaction ratings

### Ticket Workflow
1. User/Organizer creates ticket
2. Admin assigns to agent
3. Agent responds and updates status
4. Messages exchanged
5. Ticket resolved or closed
6. Optional satisfaction rating

---

## Trip Verification System

### Verification Process
1. **Submission** - Organizer submits trip for verification
2. **Review** - Admin reviews trip details
3. **Checklist** - Admin checks verification items:
   - Basic trip details complete
   - Itinerary provided
   - Pricing information
   - Safety measures documented
   - Photos/media uploaded
4. **Decision** - Approve or reject with feedback
5. **Status Update** - Trip marked as verified or needs changes

### Verification Statuses
- **pending** - Awaiting review
- **verified** - Approved
- **rejected** - Needs changes
- **changes_requested** - Specific changes needed

---

## Subscription Management

### Plan Types
1. **Trial Plan**
   - Free trial period
   - Limited features
   - No payment required

2. **Trip Package**
   - Purchase trip slots
   - Pay per trip
   - Track remaining trips

3. **CRM Bundle**
   - Full CRM access
   - Lead management
   - Analytics dashboard
   - Priority support

### Subscription Features
- Auto-pay support
- Payment tracking
- Expiry management
- Usage monitoring
- Upgrade/downgrade options

---

## API Endpoints

### Lead Management
```
POST   /api/crm/leads                    - Create lead
GET    /api/crm/leads                    - Get all leads (with filters)
GET    /api/crm/leads/:id                - Get lead by ID
PUT    /api/crm/leads/:id                - Update lead
POST   /api/crm/leads/:id/interactions   - Add interaction
POST   /api/crm/leads/:id/convert        - Convert lead
```

### Support Tickets
```
POST   /api/crm/tickets                  - Create ticket
GET    /api/crm/tickets                  - Get all tickets
GET    /api/crm/tickets/:id              - Get ticket by ID
PUT    /api/crm/tickets/:id/status       - Update status
POST   /api/crm/tickets/:id/messages     - Add message
PUT    /api/crm/tickets/:id/assign       - Assign ticket
POST   /api/crm/tickets/:id/resolve      - Resolve ticket
```

### Trip Verification
```
POST   /api/crm/verifications                        - Submit for verification
GET    /api/crm/verifications                        - Get verifications
GET    /api/crm/verifications/trip/:tripId           - Get by trip ID
PUT    /api/crm/verifications/trip/:tripId/status    - Update status
PUT    /api/crm/verifications/trip/:tripId/checklist - Update checklist
```

### Subscriptions
```
POST   /api/crm/subscriptions/trial                    - Create trial
POST   /api/crm/subscriptions/purchase/trip-package    - Purchase trip package
POST   /api/crm/subscriptions/purchase/crm-bundle      - Purchase CRM bundle
GET    /api/crm/subscriptions/my                       - Get my subscription
GET    /api/crm/subscriptions/:organizerId             - Get by organizer
GET    /api/crm/subscriptions                          - Get all (admin)
POST   /api/crm/subscriptions/use-trip-slot            - Use trip slot
```

### Analytics
```
GET    /api/crm/analytics/organizer   - Organizer analytics
GET    /api/crm/analytics/user        - User analytics
GET    /api/crm/analytics/admin       - Admin analytics (date range supported)
```

---

## Frontend Components

### CRM Dashboard Variants

1. **EnhancedCRMDashboard.tsx**
   - Full-featured with Chart.js visualizations
   - Pie chart for status distribution
   - Line chart for lead trends
   - Auto-refresh capability
   - Real-time updates

2. **ProfessionalCRMDashboard.tsx**
   - Activity timeline
   - Lead tracking over time
   - Subscription information
   - Professional UI/UX

3. **OrganizerCRMDashboard.tsx**
   - Organizer-specific features
   - Trip management
   - Lead assignment
   - Revenue tracking placeholder

4. **AdminCRMDashboard.tsx**
   - Admin oversight
   - System-wide metrics
   - User management
   - Chart placeholders

### Key Features Across Dashboards
- Lead filtering by status
- Search functionality
- Lead notes management
- Status updates
- Real-time refresh (30-second intervals)
- Responsive design
- Toast notifications
- Modal dialogs for detailed views

---

## Access Control

### Role-Based Access
- **Admin** - Full access to all CRM features
- **Organizer** - Access to own leads and tickets
- **User** - Can create tickets, view own activities
- **Agent** - Can manage assigned tickets

### Middleware
- `requireOrganizerOrAdmin` - Restricts to organizer/admin roles
- `requireAdmin` - Admin-only access
- `requireCRMAccess` - Checks CRM subscription status
- `requireTripSlots` - Validates available trip slots

---

## Database Models

### Core Models
1. **Lead** - Lead information and tracking
2. **Ticket** - Support ticket management
3. **TripVerification** - Trip verification records
4. **CRMSubscription** - Subscription and payment data
5. **UserActivity** - User activity logging
6. **Notification** - System notifications

### Indexes
All models have optimized indexes for:
- Fast queries by status
- Efficient filtering
- Quick user/organizer lookups
- Time-based sorting

---

## Future Enhancements

### Planned Features
1. **Automated Lead Creation**
   - Trip view threshold triggers
   - Booking abandonment detection
   - Form submission auto-capture
   - Chat-to-lead conversion

2. **Advanced Analytics**
   - Funnel analysis
   - Cohort analysis
   - Predictive scoring
   - ROI calculations

3. **Enhanced Visualizations**
   - Bar charts for conversions
   - Heat maps for activity
   - Funnel charts
   - Real-time dashboards

4. **AI/ML Integration**
   - Lead scoring improvements
   - Churn prediction
   - Response time optimization
   - Sentiment analysis on tickets

5. **Marketing Automation**
   - Email campaigns
   - Follow-up reminders
   - Drip campaigns
   - A/B testing

---

## Testing & Verification

### Testing Checklist
- [ ] Lead creation and updates
- [ ] Lead scoring accuracy
- [ ] Ticket assignment workflow
- [ ] Analytics data accuracy
- [ ] Chart rendering performance
- [ ] Real-time refresh functionality
- [ ] Filter and search operations
- [ ] Role-based access control
- [ ] Subscription verification
- [ ] Payment tracking

### Manual Testing Steps
1. Create a lead manually via API
2. Verify lead appears in dashboard
3. Update lead status
4. Check analytics updates
5. Verify charts render correctly
6. Test auto-refresh (30-second interval)
7. Test filters and search
8. Create and assign tickets
9. Verify notifications

---

## Technical Stack

### Backend
- **Node.js** + **Express.js**
- **TypeScript**
- **MongoDB** with Mongoose
- **JWT** authentication
- RESTful API design

### Frontend
- **React 18** + **TypeScript**
- **React Router** for navigation
- **Chart.js** + **react-chartjs-2** for visualizations
- **Tailwind CSS** for styling
- **Axios** for API calls
- **Toast notifications**

### Key Dependencies
```json
{
  "chart.js": "^4.x",
  "react-chartjs-2": "^5.x",
  "mongoose": "^8.x",
  "express": "^4.x",
  "jsonwebtoken": "^9.x"
}
```

---

## Configuration

### Environment Variables
```env
# CRM-specific
ENABLE_AUTO_LEAD_CREATION=false
LEAD_SCORE_THRESHOLD=50
AUTO_REFRESH_INTERVAL=30000

# Analytics
ANALYTICS_RETENTION_DAYS=90
CHART_UPDATE_INTERVAL=30000

# Subscriptions
CRM_BUNDLE_PRICE=2999
TRIAL_DURATION_DAYS=14
```

---

## Conclusion

The Trek-Tribe CRM system provides a solid foundation for managing customer relationships, support tickets, and trip verifications. While manual lead creation is currently implemented, the infrastructure supports future automation. The analytics dashboard with Chart.js visualizations offers real-time insights into business performance.

**Current Status:**
- ✅ Lead Management - Fully functional
- ✅ Support Tickets - Fully functional
- ✅ Trip Verification - Fully functional
- ✅ Analytics Dashboard - Functional with charts
- ✅ Graph Visualizations - Pie and Line charts implemented
- ⚠️ Automated Lead Creation - Infrastructure ready, needs implementation
- ⚠️ Advanced Charts - Bar charts and others are placeholders

---

**Last Updated:** December 9, 2025
**Version:** 1.0.0
**Maintainer:** Trek-Tribe Development Team
