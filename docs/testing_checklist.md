# Trek Tribe - Feature List & Testing Checklist

This document outlines all currently implemented features and provides a manual testing checklist to verify system integrity.

## 1. Authentication & User Management
**Features:**
*   **Multi-role Support**: Traveler, Organizer, Admin, Agent.
*   **JWT Authentication**: Secure session management.
*   **Profile Management**: Update contact info, emergency contacts.

### ✅ Testing Checklist
- [ ] **Register (traveler)**: Create a new account. Verify redirection to Home.
- [ ] **Register (organizer)**: Create account. Verify redirection to Organizer Onboarding/Dashboard.
- [ ] **Login**: Test with valid and invalid credentials.
- [ ] **Logout**: Verify session clearance and redirect to login.
- [ ] **Profile Update**: Change phone number/address and save. Verify persistence.

## 2. Trip Discovery & Booking
**Features:**
*   **Search & Filter**: Find trips by destination, price, or date.
*   **Trip Details**: Rich pages with itinerary, map, and pricing.
*   **Booking Flow**: Select dates, add participants, checkout.
*   **Payments**: Calculation of totals (implementation details depend on Razorpay config).

### ✅ Testing Checklist
- [ ] **Search**: Enter "Manali" in search bar. Verify results filtration.
- [ ] **Filters**: Apply price filter (e.g., < ₹5000). Verify list updates.
- [ ] **Trip Page**: Open a trip. Check title, price, and "Book Now" button.
- [ ] **Booking**: Click "Book Now". Enter participant details. Click "Proceed to Pay".
- [ ] **Booking Success**: Verify redirection to "Booking Confirmed" or "My Trips" page.

## 3. Organizer Dashboard (CRM)
**Features:**
*   **Subscription Management**: Tiered plans controlling access.
*   **Trip Management**: Create, Edit, Delete trips.
*   **Lead Management**: View inquiries, assign status (New/Contacted/Converted).
*   **Analytics**: View revenue, views, and booking stats.

### ✅ Testing Checklist
- [ ] **Create Trip**: Fill form (Title, Location, Price, Itinerary). Submit. Verify it appears in "My Trips".
- [ ] **View Leads**: Check "Leads" tab. Verify new user inquiries appear here.
- [ ] **Update Lead**: Change lead status from "New" to "Contacted".
- [ ] **Subscription**: Check "Subscription" tab. Verify current plan details (e.g., "Active", "Trial").

## 4. Admin Dashboard
**Features:**
*   **Platform Overview**: Global stats (Total Users, Total Revenue).
*   **User Management**: View all users, Edit details.
*   **Subscription Override**: Manual adjustment of organizer plans/validity.
*   **Advanced Analytics**: Retention cohorts, Activity heatmaps, Top Organizers.
*   **Trip Moderation**: Cancel/Verify trips.

### ✅ Testing Checklist
- [ ] **View Dashboard**: Login as Admin. Verify all stat cards load (no "0" or "NaN" unless empty).
- [ ] **Analytics Tab**: Check "Analytics" tab. Confirm Retention Table and Activity Charts are rendered.
- [ ] **User Edit**: Open "Users" tab. Click "Edit" on a user.
- [ ] **Override Subscription**: In User Edit modal, change Plan to "Pro" and save. Verify success message.
- [ ] **Trip Status**: Go to "Trips" tab. Change a trip status to "Cancelled". Verify update.

## 5. Real-Time Features
**Features:**
*   **Live Activity Ticker**: Global bottom-left popup showing "New Booking", "New Trip".
*   **AI Chat**: Floating widget for support and recommendations.
*   **Notifications**: System alerts for admin updates.

### ✅ Testing Checklist
- [ ] **Live Ticker**: Refresh page. Watch bottom-left corner. Verify "Live" activity bubbles appear.
- [ ] **AI Chat**: Open widget (bottom-right). Type "Suggest a trip to Goa". Verify "Typing..." indicator and response.
- [ ] **Chat Actions**: Click "Find Trips" quick action. Verify it navigates or suggests links.

## 6. Support System
**Features:**
*   **Ticket System**: Users can raise tickets; Admins/Agents can resolve them.
*   **Ticket Status**: Open -> In Progress -> Resolved.

### ✅ Testing Checklist
- [ ] **Raise Ticket**: As User, go to "Support" or use AI Chat to raise an issue.
- [ ] **View Ticket (Admin)**: Login as Admin. Check "Support" section. Verify new ticket exists.
- [ ] **Resolve Ticket**: Change status to "Resolved". Verify update.

## 7. System Health
**Features:**
*   **Database Connection**: MongoDB connectivity.
*   **Socket Connection**: Websocket status.

### ✅ Testing Checklist
- [ ] **Socket Status**: In Admin Dashboard header, verify "WhatsApp/Socket Connected" indicator is Green.
- [ ] **Error Handling**: Try to access a non-existent page (e.g., `/random`). Verify 404/Error boundary.
