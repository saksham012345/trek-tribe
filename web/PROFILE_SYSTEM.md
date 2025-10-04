# Professional Profile System

Trek Tribe now features role-specific professional profiles that provide tailored experiences for different user types.

## Profile Types Overview

### 🏔️ **Organizer & Traveler Profiles** (`Profile.tsx`)
**For regular users who create or join trips**

**Features:**
- Beautiful nature-themed gradient header
- Trip management (created trips for organizers, joined trips for travelers)
- Personal account information with avatar
- Emergency contacts management
- Call-to-action buttons for trip creation/exploration
- Enhanced trip cards with progress bars
- Privacy settings integration

**Visual Design:**
- Green nature gradient (nature-600 to forest-600)
- Adventure-themed icons (🏔️ for organizers, 🎒 for travelers)
- Clean, user-friendly interface
- Focus on trip discovery and management

---

### 👑 **Admin Profile** (`AdminProfile.tsx`)
**For system administrators with full platform control**

**Features:**
- **System Overview Dashboard**
  - Key metrics (Total Users, Active Trips, Revenue, Active Agents)
  - Monthly growth tracking
  - Real-time statistics

- **Management Tools**
  - Quick access to admin panel
  - User management
  - Report reviews
  - System settings

- **System Monitoring**
  - System health indicators
  - Active alerts and notifications
  - Recent platform activity feed

- **Professional Interface**
  - Dark gradient header (forest-800 to nature-800)
  - Administrative metrics and KPIs
  - System status monitoring
  - Direct links to management tools

**Visual Design:**
- Professional dark gradient with crown icon 👑
- Enterprise-level metrics display
- Red color scheme for admin role badges
- Focus on system oversight and control

---

### 🛡️ **Agent Profile** (`AgentProfile.tsx`)
**For customer support agents handling user inquiries**

**Features:**
- **Support Dashboard**
  - Live chat session management
  - Performance metrics (response time, satisfaction ratings)
  - Active chat monitoring

- **Agent Tools**
  - Status management (Online, Busy, Away, Offline)
  - Priority-based chat queuing
  - Notification center
  - Knowledge base access

- **Performance Tracking**
  - Customer satisfaction ratings
  - Response time analytics
  - Resolution quality metrics
  - Work hour tracking

- **Professional Support Interface**
  - Blue gradient header (blue-700 to indigo-700)
  - Real-time chat status
  - Performance dashboards
  - Support tool shortcuts

**Visual Design:**
- Blue professional gradient with shield icon 🛡️
- Support-focused color scheme
- Real-time status indicators
- Emphasis on customer service metrics

---

## Implementation Details

### Conditional Rendering Logic

```typescript
// In Profile.tsx
const Profile: React.FC<ProfileProps> = ({ user }) => {
  // ... hooks must come first
  
  // Conditional rendering after all hooks
  if (user.role === 'admin') {
    return <AdminProfile user={user} />;
  }
  
  if (user.role === 'agent') {
    return <AgentProfile user={user} />;
  }
  
  // Default organizer/traveler profile
  return (/* Standard profile JSX */);
};
```

### Key Design Differences

| Feature | Organizer/Traveler | Admin | Agent |
|---------|-------------------|-------|--------|
| **Header Color** | Nature Green | Dark Forest | Professional Blue |
| **Primary Icon** | 🏔️/🎒 | 👑 | 🛡️ |
| **Focus Area** | Trip Management | System Control | Customer Support |
| **Data Displayed** | Personal Trips | Platform Metrics | Chat Performance |
| **Quick Actions** | Create/Join Trips | System Management | Live Chat Tools |

### API Integration

Each profile type expects different data endpoints:

- **Admin Profile**: 
  - `/admin/statistics` - Platform metrics
  - `/admin/alerts` - System alerts
  - `/admin/recent-activity` - Activity feed

- **Agent Profile**:
  - `/agent/statistics` - Support metrics
  - `/agent/active-chats` - Current sessions
  - `/agent/notifications` - Agent notifications

- **Regular Profile**:
  - `/trips` - User's trips (filtered by role)

### Privacy & Legal Compliance

All profile types include:
- Links to Privacy Settings (`/data-management`)
- Cookie Settings (`/cookie-settings`)
- GDPR compliance features

## Benefits

1. **Role-Appropriate Interface**: Each user sees information relevant to their responsibilities
2. **Professional Presentation**: Admin and agent profiles have business-focused designs
3. **Enhanced User Experience**: Tailored workflows for different user types
4. **Scalable Architecture**: Easy to add new role types in the future
5. **Consistent Branding**: All profiles maintain Trek Tribe's nature theme while being professional

This professional profile system ensures that Trek Tribe provides appropriate interfaces for all user types, from adventure-seeking travelers to platform administrators and support staff.