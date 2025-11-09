# Trek Tribe™ - Feature Testing Checklist
## Complete User Experience Testing Guide

---

## 🎯 How to Use This Checklist

1. **Test in Order**: Follow the user journey from registration to completion
2. **Check All Boxes**: Mark ✅ for working features, ❌ for broken, ⚠️ for partial
3. **Document Issues**: Note any bugs or UX problems
4. **Test Data**: Use realistic data for authentic testing
5. **Cross-Browser**: Test on Chrome, Firefox, Safari, Edge
6. **Mobile Testing**: Test responsive design on mobile devices

---

## 👤 PUBLIC USER (Not Logged In)

### Homepage & Discovery

- [ ] **Landing Page Loads**
  - Test: Visit homepage
  - Expected: Page loads without errors, hero section visible
  - Check: Images load, CTA buttons work

- [ ] **Browse Trips (Public)**
  - Test: View trip listings without login
  - Expected: See available trips with basic info
  - Check: Trip cards display correctly, images load

- [ ] **Search Functionality**
  - Test: Search by destination (e.g., "Manali", "Goa")
  - Expected: Filtered results appear
  - Check: Search is responsive, results are relevant

- [ ] **Filter Trips**
  - Test: Filter by category, price range, dates
  - Expected: Results update dynamically
  - Check: Filters work individually and combined

- [ ] **View Trip Details (Public)**
  - Test: Click on a trip card
  - Expected: Trip detail page opens
  - Check: All trip info visible (description, images, price, dates)
  - Note: Should prompt to login for booking

- [ ] **View Organizer Profile (Public)**
  - Test: Click on organizer name
  - Expected: Public profile page opens
  - Check: See organizer's trips, ratings, bio
  - Note: KYC verification badge should be visible if verified

---

## 🔐 AUTHENTICATION

### Registration

- [ ] **Register as Traveler**
  - Test: Sign up with email/password
  - Expected: Account created, confirmation email sent
  - Check: Form validation works, password requirements met
  - Test Data: `traveler@test.com` / `Test@123`

- [ ] **Register as Organizer**
  - Test: Sign up selecting "Organizer" role
  - Expected: Account created with organizer permissions
  - Check: Subscription auto-created with 2-month trial
  - Test Data: `organizer@test.com` / `Test@123`

- [ ] **Email Verification**
  - Test: Click verification link in email
  - Expected: Account verified, can now login
  - Check: Verification status updates

- [ ] **Google OAuth (if implemented)**
  - Test: "Sign in with Google" button
  - Expected: Redirect to Google, return with account created
  - Check: User data populated from Google profile

### Login

- [ ] **Login with Email/Password**
  - Test: Enter credentials and submit
  - Expected: Redirect to dashboard based on role
  - Check: Remember me option works

- [ ] **Login Validation**
  - Test: Wrong password, non-existent email
  - Expected: Clear error messages
  - Check: No sensitive info leaked in errors

- [ ] **Forgot Password**
  - Test: Click "Forgot Password", enter email
  - Expected: Reset link sent to email
  - Check: Link expires after use/time

- [ ] **Reset Password**
  - Test: Click reset link, enter new password
  - Expected: Password updated, can login with new password
  - Check: Old password no longer works

---

## 🧳 TRAVELER/ADVENTURER FEATURES

### Dashboard

- [ ] **Traveler Dashboard Loads**
  - Test: Login as traveler, view dashboard
  - Expected: See overview of bookings, upcoming trips
  - Check: Statistics display correctly

- [ ] **Navigation Menu**
  - Test: Click through all menu items
  - Expected: All pages load without errors
  - Check: Active page highlighted in menu

### Profile Management

- [ ] **View Profile**
  - Test: Go to profile page
  - Expected: See all profile information
  - Check: Profile photo, bio, stats display

- [ ] **Edit Profile**
  - Test: Update name, bio, location
  - Expected: Changes saved successfully
  - Check: Form validation, success message

- [ ] **Upload Profile Picture**
  - Test: Upload JPG/PNG image
  - Expected: Image uploaded and displayed
  - Check: Image size validation, preview before save
  - Try: Large file (should reject), invalid format

- [ ] **Update Emergency Contact**
  - Test: Add/edit emergency contact info
  - Expected: Information saved
  - Check: Phone validation, required fields

- [ ] **Update Preferences**
  - Test: Set trip preferences (categories, budget)
  - Expected: Preferences saved
  - Check: Used for recommendations

- [ ] **Privacy Settings**
  - Test: Toggle profile visibility, email/phone display
  - Expected: Settings applied to public profile
  - Check: Hidden info not visible in public view

### Trip Discovery & Booking

- [ ] **Browse Trips (Logged In)**
  - Test: View all available trips
  - Expected: See verified trips only
  - Check: Unverified trips hidden from listing

- [ ] **Advanced Search**
  - Test: Search with multiple filters
  - Expected: Accurate filtered results
  - Check: Price range, dates, categories, destination

- [ ] **View Trip Details**
  - Test: Open trip detail page
  - Expected: See full trip information
  - Check:
    - Title, description, images
    - Live trip photos (if trip has started)
    - Itinerary schedule
    - Pickup/drop points
    - Pricing and packages
    - Safety disclaimer
    - Organizer info with verification badge
    - Reviews and ratings
    - Available spots

- [ ] **Download Trip Itinerary PDF**
  - Test: Click download PDF button
  - Expected: PDF downloads with trip details
  - Check: PDF formatted correctly, all info included

- [ ] **View Safety Information**
  - Test: Check safety disclaimer and info
  - Expected: See insurance, emergency contacts, safety equipment
  - Check: Mandatory disclaimer displayed

- [ ] **Join Trip (Individual)**
  - Test: Click "Join Trip" button
  - Expected: Booking form opens
  - Check:
    - Capacity check (can't exceed limit)
    - Date validation (can't book past trips)
    - Price displayed correctly

- [ ] **Group Booking**
  - Test: Create booking for multiple people
  - Expected: Group booking form appears
  - Check:
    - Add multiple participants (up to 20)
    - Each participant has full details
    - Group discount applied automatically
    - Pricing calculated correctly
  - Test Discounts:
    - 4-5 people: 5% off
    - 6-9 people: 10% off
    - 10-14 people: 15% off
    - 15+ people: 20% off

- [ ] **Select Package Option**
  - Test: Choose from available packages (if any)
  - Expected: Price updates based on selection
  - Check: Package inclusions/exclusions listed

- [ ] **Fill Participant Details**
  - Test: Enter required info for all participants
  - Expected: Form validates each field
  - Check:
    - Name, email, phone
    - Date of birth, gender
    - Emergency contact
    - Medical conditions (optional)
    - Dietary restrictions (optional)
    - Experience level
    - Special requests

- [ ] **Payment - Full vs Advance**
  - Test: Choose payment type
  - Expected: Correct amount displayed
  - Check:
    - Full payment option
    - Advance payment option (if available)
    - Due date shown for advance payment
    - Payment methods listed

- [ ] **Upload Payment Screenshot**
  - Test: Upload screenshot of payment
  - Expected: File uploaded successfully
  - Check:
    - File size limit (10MB)
    - Format validation (JPG, PNG)
    - Add transaction ID and notes
    - Status shows "Pending Verification"

- [ ] **Receive Booking QR Code**
  - Test: After booking confirmation
  - Expected: QR code generated
  - Check:
    - QR code displayed on booking page
    - Can download QR code image
    - Can share QR code
    - QR contains booking ID

- [ ] **Apply Promo Code**
  - Test: Enter promo code during checkout
  - Expected: Discount applied if valid
  - Check:
    - Validation messages (invalid, expired, used)
    - Discount amount shown
    - Final price recalculated
    - Code usage limit enforced
  - Test Codes: Try multiple applications, expired codes

### Booking Management

- [ ] **View My Bookings**
  - Test: Go to bookings page
  - Expected: See all bookings (upcoming, past, cancelled)
  - Check:
    - Booking status badges
    - Trip details
    - Payment status
    - Participant count

- [ ] **View Booking Details**
  - Test: Click on a booking
  - Expected: Full booking information displayed
  - Check:
    - All participant details
    - Payment information
    - QR code
    - Trip organizer contact
    - Pickup/drop point assignment

- [ ] **Download Booking Confirmation**
  - Test: Download booking confirmation PDF
  - Expected: PDF with all booking details
  - Check: QR code included, properly formatted

- [ ] **Cancel Booking**
  - Test: Cancel an upcoming booking
  - Expected: Cancellation confirmation dialog
  - Check:
    - Refund policy displayed
    - Reason for cancellation required
    - Status updates to "Cancelled"
    - Notification sent to organizer

- [ ] **Modify Booking (if allowed)**
  - Test: Request to change dates or participants
  - Expected: Modification request sent
  - Check: Organizer notified, status shows "Modification Requested"

### Reviews & Ratings

- [ ] **Write Trip Review**
  - Test: After trip completion, write review
  - Expected: Review form opens
  - Check:
    - 5-star rating selector
    - Review text (max length)
    - Photo upload option
    - Submit review

- [ ] **Review Moderation Notice**
  - Test: Submit review
  - Expected: "Under review" status shown
  - Check: Review not visible until admin approves

- [ ] **View My Reviews**
  - Test: See all reviews I've written
  - Expected: List of reviews with status
  - Check: Can edit pending reviews, can't edit approved reviews

- [ ] **Rate Organizer**
  - Test: Separate organizer rating
  - Expected: Rating saved
  - Check: Contributes to organizer's overall rating

### Social Features

- [ ] **Follow Organizer**
  - Test: Click follow button on organizer profile
  - Expected: Following status updates
  - Check: Follower count increases

- [ ] **Unfollow Organizer**
  - Test: Unfollow a followed organizer
  - Expected: Unfollowed
  - Check: Follower count decreases

- [ ] **Add Trip to Wishlist**
  - Test: Click wishlist/heart icon on trip
  - Expected: Trip added to wishlist
  - Check: Icon changes state

- [ ] **View Wishlist**
  - Test: Go to wishlist page
  - Expected: See all wishlisted trips
  - Check: Can remove trips, can book from wishlist

- [ ] **View Posts/Feed (if implemented)**
  - Test: Social feed of organizers I follow
  - Expected: See updates and posts
  - Check: Can like, comment on posts

### Notifications

- [ ] **Booking Confirmation Notification**
  - Test: After booking
  - Expected: Email and/or in-app notification
  - Check: Contains booking details, QR code

- [ ] **Payment Verification Notification**
  - Test: After admin verifies payment
  - Expected: Notification received
  - Check: Status update shown

- [ ] **Trip Reminder**
  - Test: Few days before trip
  - Expected: Reminder notification sent
  - Check: Contains pickup details, checklist

- [ ] **Review Request**
  - Test: After trip completion
  - Expected: Prompted to write review
  - Check: Link to review form included

---

## 🎫 ORGANIZER FEATURES

### Organizer Dashboard

- [ ] **Organizer Dashboard Loads**
  - Test: Login as organizer
  - Expected: See organizer-specific dashboard
  - Check:
    - Subscription status widget
    - Trips remaining counter
    - Upcoming trips
    - Recent bookings
    - Revenue stats

- [ ] **Subscription Status Widget**
  - Test: View subscription info on dashboard
  - Expected: See trial status or active subscription
  - Check:
    - Trips used / remaining
    - Expiry date
    - Renewal prompt if needed

### Subscription Management

- [ ] **View Subscription Details**
  - Test: Go to subscription page
  - Expected: Full subscription information
  - Check:
    - Trial status (if within 2 months)
    - "2 months free trial active" message
    - Trial end date
    - Trips remaining: X / 5
    - Payment history table

- [ ] **Trial Limitations**
  - Test: Create 5 trips during trial
  - Expected: After 5th trip, prompted to upgrade
  - Check:
    - Can't create 6th trip without payment
    - Clear error message with upgrade CTA

- [ ] **Payment for Subscription**
  - Test: Pay ₹1499 to renew/activate subscription
  - Expected: Payment recorded
  - Check:
    - Upload payment screenshot
    - Enter transaction details
    - Status changes to "Payment Pending"
    - After admin approval: Trips reset to 5

- [ ] **View Payment History**
  - Test: See all subscription payments
  - Expected: Table with payment records
  - Check:
    - Date, amount, status
    - Receipt/proof available
    - Transaction IDs

- [ ] **Subscription Expiry Warning**
  - Test: When trial/subscription about to expire
  - Expected: Warning banner/notification
  - Check: Shows days remaining, renewal CTA

### KYC Verification

- [ ] **KYC Status Badge**
  - Test: View on profile/dashboard
  - Expected: Badge shows KYC status
  - Check: None / Basic / Verified / Premium badge

- [ ] **Submit KYC Application**
  - Test: Fill KYC form
  - Expected: Multi-step form
  - Check:
    - Personal information (name, DOB, gender)
    - Contact details (email, phone, alternate phone)
    - Address (full address with pincode)
    - Document upload section

- [ ] **Upload KYC Documents**
  - Test: Upload required documents
  - Expected: Files uploaded successfully
  - Check:
    - Aadhaar card (front/back)
    - PAN card
    - Business license (if applicable)
    - GST certificate (if applicable)
    - Bank statement / cancelled cheque
    - Address proof
  - Verify: File size limits, format validation

- [ ] **Business Information (Organizers)**
  - Test: Enter business details
  - Expected: Optional for individual, required for company
  - Check:
    - Company name, type
    - GST number, PAN
    - Registration number
    - Business address
    - Website

- [ ] **Bank Details**
  - Test: Enter bank account info
  - Expected: Securely saved
  - Check:
    - Account holder name
    - Account number, IFSC code
    - Bank name, branch
    - Account type (savings/current)

- [ ] **KYC Submission**
  - Test: Submit complete KYC form
  - Expected: "Submitted for review" status
  - Check:
    - Confirmation message
    - Status shows "Pending"
    - Email notification sent

- [ ] **View KYC Status**
  - Test: Check KYC verification status
  - Expected: Status and completion percentage shown
  - Check:
    - Pending / Under Review / Approved / Rejected
    - Completion: X%
    - Trust score: X/100

- [ ] **KYC Rejection Handling**
  - Test: If admin rejects KYC
  - Expected: Clear rejection reason shown
  - Check:
    - Can resubmit with corrections
    - Reason for rejection visible

- [ ] **Trust Score Display**
  - Test: After KYC approval
  - Expected: Trust score calculated (0-100)
  - Check:
    - Score increases with verification
    - Breakdown of score factors
    - Badge updates based on score

### Profile Management (Organizer)

- [ ] **Organizer Profile Setup**
  - Test: Complete organizer profile
  - Expected: All fields saveable
  - Check:
    - Bio (max 1000 chars)
    - Experience description
    - Specialties (multiple selection)
    - Certifications (list)
    - Languages spoken
    - Years of experience
    - Achievements

- [ ] **Upload Payment QR Codes**
  - Test: Upload QR for payments
  - Expected: Multiple QR codes can be added
  - Check:
    - UPI QR code
    - Payment method label
    - Description field
    - Active/inactive toggle
    - Can set default QR

- [ ] **Public Profile Preview**
  - Test: View how profile appears to travelers
  - Expected: See public-facing profile
  - Check:
    - Verification badge displayed
    - Trust score visible
    - KYC verified indicator
    - Trips organized count
    - Average rating
    - Reviews from travelers

### Trip Creation

- [ ] **Create New Trip - Basic Info**
  - Test: Start creating a trip
  - Expected: Subscription check passes (if within limit)
  - Check:
    - Title (required)
    - Destination (required)
    - Description (required)
    - Categories (multiple select)
    - Minimum age requirement

- [ ] **Subscription Check on Trip Creation**
  - Test: Try creating trip when limit reached
  - Expected: Blocked with upgrade prompt
  - Check: Clear message about subscription limit

- [ ] **Duplicate Trip Detection**
  - Test: Create trip similar to existing one
  - Expected: Warning about potential duplicate
  - Check:
    - Shows similar trips
    - Similarity score displayed
    - Can proceed or cancel

- [ ] **Trip Dates & Duration**
  - Test: Set start and end dates
  - Expected: Date picker with validation
  - Check:
    - Can't select past dates
    - End date after start date
    - Duration calculated automatically

- [ ] **Pricing & Capacity**
  - Test: Set trip price and capacity
  - Expected: Numbers validated
  - Check:
    - Base price (required)
    - Capacity (min 1, max reasonable number)
    - Currency displayed (₹)

- [ ] **Package Options (Multiple Packages)**
  - Test: Create multiple packages (e.g., 2-bed, 3-bed)
  - Expected: Can add multiple packages
  - Check:
    - Package name
    - Description
    - Price per package
    - Capacity per package
    - Inclusions list
    - Exclusions list
    - Active/inactive toggle

- [ ] **Payment Configuration**
  - Test: Set payment options
  - Expected: Payment settings saved
  - Check:
    - Payment type: Full or Advance
    - Advance amount (if selected)
    - Payment due date (if advance)
    - Refund policy text
    - Accepted payment methods (UPI, card, etc.)
    - Payment instructions

- [ ] **Itinerary Schedule**
  - Test: Add day-by-day itinerary
  - Expected: Can add multiple days
  - Check:
    - Day number
    - Day title
    - Activities list (multiple per day)
    - Add/remove days

- [ ] **Upload Trip Images**
  - Test: Upload multiple trip images
  - Expected: Images uploaded and previewed
  - Check:
    - Multiple image upload
    - Image order (drag-drop)
    - Set cover image
    - Image size validation
    - Format validation (JPG, PNG)

- [ ] **Upload Itinerary PDF**
  - Test: Upload detailed itinerary PDF
  - Expected: PDF uploaded successfully
  - Check:
    - File format validation (PDF only)
    - File size limit (10MB)
    - Filename stored
    - Upload date recorded

- [ ] **Pickup & Drop Points**
  - Test: Add multiple pickup/drop locations
  - Expected: Can add multiple points
  - Check:
    - Location name, address
    - Coordinates (optional)
    - Time
    - Contact person, phone
    - Landmarks, instructions

- [ ] **Safety Information**
  - Test: Enter safety details
  - Expected: Safety info saved
  - Check:
    - Insurance status (yes/no)
    - Insurance details
    - Emergency contact name, phone
    - Medical facilities nearby
    - Safety equipment list
    - COVID protocol (if applicable)

- [ ] **Safety Disclaimer**
  - Test: Review and accept disclaimer
  - Expected: Mandatory disclaimer shown
  - Check:
    - Default disclaimer text editable
    - Must be accepted to publish
    - Displayed to travelers on booking

- [ ] **Save as Draft**
  - Test: Save incomplete trip
  - Expected: Saved as draft
  - Check: Can edit and publish later

- [ ] **Submit for Verification**
  - Test: Submit completed trip
  - Expected: Trip sent for admin approval
  - Check:
    - Status: "Pending Verification"
    - Not visible in public listings
    - Notification sent to admin
    - Organizer sees submission confirmation

### Trip Management

- [ ] **View My Trips**
  - Test: See all created trips
  - Expected: List of trips with statuses
  - Check:
    - Pending, Approved, Rejected
    - Active, Completed, Cancelled
    - Trip details preview

- [ ] **Edit Trip (Before Approval)**
  - Test: Edit pending trip
  - Expected: Can modify all details
  - Check: Resubmitted for verification

- [ ] **Edit Trip (After Approval)**
  - Test: Edit approved trip
  - Expected: Limited edits allowed
  - Check:
    - Can update description, add images
    - Can't change dates/price significantly
    - Major changes require re-verification

- [ ] **Upload Live Trip Photos**
  - Test: During/after trip, upload photos
  - Expected: Photos uploaded successfully
  - Check:
    - **First photo becomes thumbnail** (mandatory)
    - Minimum 1 photo required after trip starts
    - Add caption, location
    - Multiple photos uploadable
    - Photos visible to travelers

- [ ] **Cancel Trip**
  - Test: Cancel an upcoming trip
  - Expected: Cancellation confirmation
  - Check:
    - Reason required
    - All bookings notified
    - Refund process initiated
    - Status: "Cancelled"

- [ ] **View Trip Participants**
  - Test: See who booked the trip
  - Expected: List of all participants
  - Check:
    - Participant details
    - Booking IDs
    - Payment status
    - Can contact participants

- [ ] **Download Participant List**
  - Test: Export participant list
  - Expected: CSV/Excel download
  - Check: All participant details included

- [ ] **Communication with Travelers**
  - Test: Send messages to participants
  - Expected: Messages sent via email/WhatsApp
  - Check:
    - Bulk message option
    - Individual message option
    - Message history

### Booking Management (Organizer)

- [ ] **View Bookings for My Trips**
  - Test: See all bookings
  - Expected: Bookings list with filters
  - Check:
    - Filter by trip, status, date
    - Payment verification pending
    - Confirmed bookings
    - Cancelled bookings

- [ ] **Verify Payment Screenshot**
  - Test: Review uploaded payment screenshot
  - Expected: Can approve or reject
  - Check:
    - View screenshot
    - See transaction details
    - Approve button → booking confirmed
    - Reject button → request resubmission
    - Add notes

- [ ] **Confirm Booking**
  - Test: After payment verification
  - Expected: Booking confirmed
  - Check:
    - Status: "Confirmed"
    - Confirmation email sent to traveler
    - Capacity updated
    - QR code generated

- [ ] **Cancel Booking (Organizer Side)**
  - Test: Cancel a traveler's booking
  - Expected: Booking cancelled with reason
  - Check:
    - Reason required
    - Refund calculated
    - Traveler notified

### Analytics & Reports

- [ ] **View Trip Statistics**
  - Test: Analytics for each trip
  - Expected: Stats dashboard
  - Check:
    - Total bookings
    - Revenue generated
    - Capacity filled %
    - Reviews/ratings
    - Cancellation rate

- [ ] **Revenue Report**
  - Test: Financial summary
  - Expected: Revenue breakdown
  - Check:
    - Total revenue
    - Pending payments
    - Completed payments
    - Refunds issued
    - By trip, by month

- [ ] **Export Reports**
  - Test: Download reports
  - Expected: PDF/CSV export
  - Check: Booking details, financial data

---

## 👨‍💼 ADMIN FEATURES

### Admin Dashboard

- [ ] **Admin Dashboard Loads**
  - Test: Login as admin
  - Expected: Admin dashboard with overview
  - Check:
    - Platform statistics
    - Pending verifications count
    - Recent activities
    - Alert notifications

- [ ] **Platform Statistics**
  - Test: View overall stats
  - Expected: Key metrics displayed
  - Check:
    - Total users (travelers, organizers)
    - Total trips (active, completed)
    - Total bookings
    - Revenue (if tracked)
    - Growth trends

### User Management

- [ ] **View All Users**
  - Test: List all users
  - Expected: Paginated user list
  - Check:
    - Search users
    - Filter by role
    - User details preview

- [ ] **View User Details**
  - Test: Click on a user
  - Expected: Full user profile
  - Check:
    - Personal info
    - Account status
    - Activity history
    - Bookings/trips created

- [ ] **Verify User**
  - Test: Manually verify a user
  - Expected: Verification badge added
  - Check: Badge visible on profile

- [ ] **Suspend User**
  - Test: Suspend problematic user
  - Expected: User can't login
  - Check:
    - Reason required
    - User notified
    - Can reactivate later

- [ ] **Delete User**
  - Test: Delete user account
  - Expected: Confirmation dialog, GDPR compliance
  - Check:
    - Associated data handling
    - Can't be undone warning

### Trip Verification

- [ ] **View Pending Trips**
  - Test: See all trips awaiting approval
  - Expected: List of pending trips
  - Check:
    - Trip details
    - Organizer info
    - Submission date
    - Priority/urgency indicator

- [ ] **Review Trip Details**
  - Test: Open trip for verification
  - Expected: Full trip information displayed
  - Check:
    - All fields filled correctly
    - Images appropriate
    - Itinerary makes sense
    - Safety info present
    - Pricing reasonable
    - Duplicate check results

- [ ] **Approve Trip**
  - Test: Approve a quality trip
  - Expected: Trip published
  - Check:
    - Status: "Approved"
    - Trip visible in public listings
    - Organizer notified
    - Verification timestamp recorded
    - Admin notes added

- [ ] **Reject Trip**
  - Test: Reject unsuitable trip
  - Expected: Trip rejected with reason
  - Check:
    - Status: "Rejected"
    - Rejection reason (dropdown + text)
    - Organizer notified with reason
    - Can resubmit with changes

- [ ] **Request Changes**
  - Test: Request modifications before approval
  - Expected: Status: "Resubmission Required"
  - Check:
    - Specific changes requested
    - Organizer can edit and resubmit
    - Back to pending after resubmission

- [ ] **View Duplicate Trips**
  - Test: Check duplicate detection dashboard
  - Expected: List of potential duplicates
  - Check:
    - Similarity scores
    - Side-by-side comparison
    - Mark as duplicate action
    - Link to original trip

- [ ] **Mark Trip as Duplicate**
  - Test: Flag a duplicate trip
  - Expected: Trip status updated
  - Check:
    - Status: "Duplicate"
    - Auto-cancelled
    - Organizer notified
    - Link to original trip shown

### KYC Verification

- [ ] **View Pending KYC Applications**
  - Test: List all pending KYCs
  - Expected: KYC applications to review
  - Check:
    - User details
    - Submission date
    - Risk level indicator
    - Priority sorting

- [ ] **Review KYC Application**
  - Test: Open KYC for verification
  - Expected: All documents and info displayed
  - Check:
    - Personal information
    - All uploaded documents viewable
    - Document zoom/download
    - Address verification
    - Business info (if organizer)
    - Bank details

- [ ] **Verify Documents**
  - Test: Check each document
  - Expected: Can mark each as verified/rejected
  - Check:
    - Document quality
    - Information matches across docs
    - Expiry dates valid
    - Mark individual docs as verified

- [ ] **Update Verification Checklist**
  - Test: Check off verification items
  - Expected: Checklist updates
  - Check:
    - Identity verified
    - Address verified
    - Business verified (if applicable)
    - Bank verified
    - Police clearance (if required)
    - Background check (if enabled)

- [ ] **Calculate Trust Score**
  - Test: Score updates automatically
  - Expected: Trust score (0-100) calculated
  - Check:
    - Score based on checklist completion
    - Approved documents add points
    - Score displayed prominently

- [ ] **Assign Verification Badge**
  - Test: Badge auto-assigned based on score
  - Expected: Badge updates
  - Check:
    - None: 0-49
    - Basic: 50-69
    - Verified: 70-89
    - Premium: 90-100 (fully verified)

- [ ] **Approve KYC**
  - Test: Approve complete KYC
  - Expected: KYC status: "Approved"
  - Check:
    - User notified
    - Badge visible on profile
    - Trust score finalized
    - Timestamp recorded

- [ ] **Reject KYC**
  - Test: Reject invalid KYC
  - Expected: KYC rejected with reason
  - Check:
    - Clear rejection reason
    - User can resubmit
    - Documents flagged with issues

- [ ] **Request Resubmission**
  - Test: Request specific documents again
  - Expected: Status: "Resubmission Required"
  - Check:
    - Specific items requested
    - User can upload new docs
    - Previous docs retained

- [ ] **View KYC Statistics**
  - Test: KYC analytics dashboard
  - Expected: Stats displayed
  - Check:
    - Pending count
    - Approved/rejected ratio
    - Average processing time
    - By role (organizer/agent)

### Review Moderation

- [ ] **View Pending Reviews**
  - Test: List all submitted reviews
  - Expected: Reviews awaiting moderation
  - Check:
    - Review text
    - Rating
    - Reviewer name
    - Trip name
    - Submission date

- [ ] **Read Review Content**
  - Test: Open review for moderation
  - Expected: Full review displayed
  - Check:
    - Review text
    - Star rating
    - Photos (if uploaded)
    - Trip context
    - Reviewer history

- [ ] **Approve Review**
  - Test: Approve appropriate review
  - Expected: Review published
  - Check:
    - Visible on trip page
    - Trip rating updated
    - Reviewer notified

- [ ] **Reject Review**
  - Test: Reject inappropriate review
  - Expected: Review hidden
  - Check:
    - Reason required
    - Not visible publicly
    - Reviewer notified with reason

- [ ] **Flag Review**
  - Test: Flag suspicious review
  - Expected: Review marked for further investigation
  - Check:
    - Flag reason (spam, fake, offensive)
    - Marked but not removed
    - Admin notes added

- [ ] **Bulk Review Actions**
  - Test: Approve/reject multiple reviews
  - Expected: Batch operation works
  - Check:
    - Select multiple reviews
    - Apply action to all
    - Confirmation before bulk action

### Promo Code Management

- [ ] **View All Promo Codes**
  - Test: List all codes
  - Expected: All codes displayed
  - Check:
    - Code, name, type
    - Status (active, expired, exhausted)
    - Usage count
    - Filters by status

- [ ] **Create Promo Code**
  - Test: Create new promo code
  - Expected: Code created successfully
  - Check:
    - Code name (auto-uppercase)
    - Code validation (alphanumeric, 4-20 chars)
    - Type: percentage, fixed, free shipping
    - Discount value
    - Max discount (for percentage)
    - Min purchase amount
    - Start date, end date
    - Usage limits (total, per user)
    - Applicable for (trip/booking/subscription)
    - Specific trips or categories
    - Restrictions (first-time, verified users)
    - Public or private

- [ ] **Edit Promo Code**
  - Test: Update existing code
  - Expected: Changes saved
  - Check:
    - Can extend dates
    - Can increase usage limit
    - Can't change code name if used

- [ ] **Deactivate Promo Code**
  - Test: Disable active code
  - Expected: Status: "Inactive"
  - Check:
    - Code no longer works
    - Users get "code inactive" error

- [ ] **Delete Promo Code**
  - Test: Delete unused code
  - Expected: Code removed
  - Check:
    - Can't delete if used
    - Confirmation required

- [ ] **View Promo Code Statistics**
  - Test: Analytics for codes
  - Expected: Usage stats
  - Check:
    - Total usage
    - Revenue impact
    - Top performing codes
    - User redemption rate

- [ ] **Test Promo Code**
  - Test: Validate code without using
  - Expected: Validation result shown
  - Check:
    - Valid/invalid status
    - Reason if invalid
    - Discount calculation preview

### Platform Settings

- [ ] **Update Platform Settings**
  - Test: Modify global settings
  - Expected: Settings saved
  - Check:
    - Commission rates
    - Payment methods
    - Feature flags
    - Email templates
    - Notification settings

- [ ] **Manage Categories**
  - Test: Add/edit trip categories
  - Expected: Categories updated
  - Check:
    - Add new category
    - Edit category name
    - Set category icon
    - Delete unused category

- [ ] **System Health Check**
  - Test: View system status
  - Expected: All services status shown
  - Check:
    - Database connected
    - Redis cache (if implemented)
    - Email service
    - WhatsApp service
    - File storage
    - API response time

### Reports & Analytics

- [ ] **Generate Platform Report**
  - Test: Create comprehensive report
  - Expected: Report generated
  - Check:
    - Date range selection
    - Report type (bookings, revenue, users)
    - Export as PDF/Excel

- [ ] **View Activity Logs**
  - Test: Audit trail of actions
  - Expected: Log of all important actions
  - Check:
    - User activities
    - Admin actions
    - Timestamp, IP address
    - Searchable/filterable

---

## 🎧 AGENT SUPPORT FEATURES (If Implemented)

### Agent Dashboard

- [ ] **Agent Dashboard Loads**
  - Test: Login as support agent
  - Expected: Agent dashboard
  - Check:
    - Assigned tickets queue
    - Pending tickets
    - Resolved tickets count
    - Performance metrics

### Support Ticket Management

- [ ] **View Ticket Queue**
  - Test: See all assigned tickets
  - Expected: Ticket list
  - Check:
    - Ticket ID, subject, status
    - User name, priority
    - Created date, last update
    - Filters (status, priority, category)

- [ ] **Open Ticket**
  - Test: View ticket details
  - Expected: Full ticket information
  - Check:
    - User details
    - Issue description
    - Category, priority
    - Related trip/booking (if any)
    - Message history
    - Attachments

- [ ] **Reply to Ticket**
  - Test: Send message to user
  - Expected: Message sent
  - Check:
    - Text message
    - Attach files
    - Canned responses
    - Message appears in history

- [ ] **View Related Data (Read-Only)**
  - Test: Check user's trips/bookings
  - Expected: Can view but not edit
  - Check:
    - User booking history
    - Trip details
    - Payment info
    - Can't modify anything

- [ ] **Change Ticket Status**
  - Test: Update ticket status
  - Expected: Status updated
  - Check:
    - Open → In Progress
    - In Progress → Waiting for Customer
    - Waiting for Customer → In Progress
    - In Progress → Resolved
    - Resolved → Closed

- [ ] **Escalate Ticket**
  - Test: Escalate to senior agent/admin
  - Expected: Ticket escalated
  - Check:
    - Escalation reason required
    - Priority increased
    - Assigned to senior agent
    - User notified of escalation

- [ ] **Resolve Ticket**
  - Test: Mark ticket as resolved
  - Expected: Ticket resolved
  - Check:
    - Resolution notes required
    - User satisfaction survey sent
    - Ticket closed after confirmation

- [ ] **Reopen Ticket**
  - Test: Reopen resolved ticket
  - Expected: Ticket reopened
  - Check:
    - Reason required
    - Status: "Open"
    - Assigned back to agent

### Real-Time Chat (If Implemented)

- [ ] **Live Chat Interface**
  - Test: Real-time chat with user
  - Expected: Chat window opens
  - Check:
    - Messages update in real-time
    - Typing indicators
    - Online/offline status
    - File sharing

- [ ] **Chat Notifications**
  - Test: New message alert
  - Expected: Notification received
  - Check:
    - Sound alert
    - Browser notification
    - Unread count badge

- [ ] **Chat History**
  - Test: View past conversations
  - Expected: All messages saved
  - Check:
    - Searchable history
    - Linked to ticket
    - Timestamps visible

---

## 🔔 NOTIFICATIONS & COMMUNICATIONS

### Email Notifications

- [ ] **Registration Confirmation Email**
  - Test: After signup
  - Expected: Welcome email received
  - Check: Verification link, next steps

- [ ] **Email Verification**
  - Test: Click verification link
  - Expected: Account verified
  - Check: Link expires after use

- [ ] **Booking Confirmation Email**
  - Test: After booking trip
  - Expected: Confirmation email with details
  - Check:
    - Booking ID, trip details
    - Payment info
    - QR code attached
    - Organizer contact

- [ ] **Payment Verification Email**
  - Test: After admin verifies payment
  - Expected: Confirmation sent
  - Check: Booking confirmed message

- [ ] **Trip Approval Email (Organizer)**
  - Test: After admin approves trip
  - Expected: Organizer notified
  - Check: Trip now live message

- [ ] **Trip Rejection Email (Organizer)**
  - Test: After admin rejects trip
  - Expected: Rejection with reason
  - Check: Clear explanation, resubmit option

- [ ] **KYC Approval Email**
  - Test: After KYC approval
  - Expected: Congratulations email
  - Check: Badge level, trust score

- [ ] **Subscription Expiry Warning**
  - Test: 7 days before expiry
  - Expected: Reminder email
  - Check: Renewal link, pricing

- [ ] **Review Request Email**
  - Test: After trip completion
  - Expected: Request to write review
  - Check: Direct link to review form

### WhatsApp Notifications (If Enabled)

- [ ] **Booking Confirmation (WhatsApp)**
  - Test: After booking
  - Expected: WhatsApp message sent
  - Check: Booking details, QR code

- [ ] **Trip Reminder (WhatsApp)**
  - Test: Day before trip
  - Expected: Reminder message
  - Check: Pickup details, organizer contact

- [ ] **Payment Reminder (WhatsApp)**
  - Test: For advance payment bookings
  - Expected: Due date reminder
  - Check: Amount due, payment link

### In-App Notifications

- [ ] **Notification Bell Icon**
  - Test: Click notification icon
  - Expected: Dropdown with notifications
  - Check:
    - Unread count badge
    - Recent notifications
    - Mark as read
    - Clear all option

- [ ] **Notification Types**
  - Test: Various notification scenarios
  - Expected: All types appear
  - Check:
    - Booking updates
    - Payment status
    - Trip approvals
    - Reviews
    - Messages
    - System announcements

- [ ] **Notification Settings**
  - Test: Manage notification preferences
  - Expected: Toggle notifications on/off
  - Check:
    - Email notifications
    - SMS notifications
    - Push notifications
    - By category (bookings, messages, etc.)

---

## 🔍 SEARCH & DISCOVERY

### Search Functionality

- [ ] **Basic Search**
  - Test: Search by keyword
  - Expected: Relevant results
  - Check: Search bar responsive, results accurate

- [ ] **Search by Destination**
  - Test: "Manali", "Goa", "Ladakh"
  - Expected: Trips to that destination
  - Check: Autocomplete suggestions

- [ ] **Search by Category**
  - Test: "Trekking", "Beach", "Adventure"
  - Expected: Filtered results
  - Check: Multiple categories selectable

- [ ] **Date Range Search**
  - Test: Select start/end dates
  - Expected: Trips in that range
  - Check: Date picker, calendar view

- [ ] **Price Range Filter**
  - Test: Set min/max price
  - Expected: Trips within budget
  - Check: Slider or input fields

- [ ] **Sort Results**
  - Test: Sort by various criteria
  - Expected: Results reorder
  - Check:
    - Price (low to high, high to low)
    - Date (earliest first, latest first)
    - Rating (highest first)
    - Popularity (most booked)

- [ ] **No Results Handling**
  - Test: Search for non-existent destination
  - Expected: "No results" message
  - Check: Suggestions for alternative searches

### Recommendations

- [ ] **Personalized Recommendations**
  - Test: Based on preferences and history
  - Expected: Relevant trip suggestions
  - Check: "Recommended for You" section

- [ ] **Trending Trips**
  - Test: Most popular trips
  - Expected: "Trending Now" section
  - Check: Based on bookings, views, ratings

- [ ] **Similar Trips**
  - Test: On trip detail page
  - Expected: "Similar Trips" suggestions
  - Check: Same destination/category

---

## 📱 MOBILE RESPONSIVENESS

### Mobile Layout

- [ ] **Homepage (Mobile)**
  - Test: View on mobile device
  - Expected: Responsive design
  - Check: Images scale, text readable

- [ ] **Navigation Menu (Mobile)**
  - Test: Hamburger menu
  - Expected: Menu slides in/out
  - Check: All links accessible

- [ ] **Trip Listings (Mobile)**
  - Test: Browse trips on mobile
  - Expected: Cards stack vertically
  - Check: Touch-friendly tap targets

- [ ] **Booking Form (Mobile)**
  - Test: Complete booking on mobile
  - Expected: Form fully functional
  - Check: Input fields accessible, keyboard-friendly

- [ ] **Image Gallery (Mobile)**
  - Test: View trip images
  - Expected: Swipeable gallery
  - Check: Pinch to zoom works

- [ ] **Dashboard (Mobile)**
  - Test: View dashboard on mobile
  - Expected: Responsive layout
  - Check: All features accessible

### Touch Interactions

- [ ] **Swipe Gestures**
  - Test: Swipe through images, lists
  - Expected: Smooth swipe actions
  - Check: No lag, proper feedback

- [ ] **Tap Targets**
  - Test: Button sizes on mobile
  - Expected: Easy to tap
  - Check: Minimum 44x44px touch targets

- [ ] **Form Inputs**
  - Test: Fill forms on mobile
  - Expected: Keyboard appears, inputs work
  - Check: Date pickers, dropdowns mobile-friendly

---

## 🌐 BROWSER COMPATIBILITY

### Desktop Browsers

- [ ] **Chrome (Latest)**
  - Test: All features
  - Expected: Full functionality
  - Check: No console errors

- [ ] **Firefox (Latest)**
  - Test: All features
  - Expected: Full functionality
  - Check: Layout consistent

- [ ] **Safari (Latest)**
  - Test: All features
  - Expected: Full functionality
  - Check: Date pickers work

- [ ] **Edge (Latest)**
  - Test: All features
  - Expected: Full functionality
  - Check: No compatibility issues

### Mobile Browsers

- [ ] **Chrome Mobile**
  - Test: Core features
  - Expected: Mobile-optimized
  - Check: Touch interactions smooth

- [ ] **Safari iOS**
  - Test: Core features
  - Expected: iOS-compatible
  - Check: No rendering issues

- [ ] **Samsung Internet**
  - Test: Core features
  - Expected: Android-compatible
  - Check: All features work

---

## ⚡ PERFORMANCE

### Page Load Speed

- [ ] **Homepage Load Time**
  - Test: Measure load time
  - Expected: < 3 seconds
  - Tool: Browser DevTools, Lighthouse

- [ ] **Trip Listing Load**
  - Test: Browse trips page
  - Expected: < 2 seconds
  - Check: Lazy loading of images

- [ ] **Dashboard Load**
  - Test: User dashboard
  - Expected: < 2 seconds
  - Check: Data loads progressively

### Image Optimization

- [ ] **Image Loading**
  - Test: Scroll through image-heavy pages
  - Expected: Images load as needed
  - Check: Lazy loading active, placeholders show

- [ ] **Image Quality**
  - Test: View uploaded images
  - Expected: Good quality, reasonable size
  - Check: Compression applied, format optimized

---

## 🔒 SECURITY

### Authentication Security

- [ ] **Password Strength**
  - Test: Try weak passwords
  - Expected: Rejected with message
  - Check: Minimum length, special chars required

- [ ] **Session Management**
  - Test: Login, idle for time
  - Expected: Session expires, re-login required
  - Check: No sensitive data in URL

- [ ] **CSRF Protection**
  - Test: Submit forms
  - Expected: CSRF token validated
  - Check: Forms can't be submitted from external sites

### Data Protection

- [ ] **Payment Info Security**
  - Test: View payment details
  - Expected: Sensitive data masked/encrypted
  - Check: No plain-text card numbers, etc.

- [ ] **KYC Document Access**
  - Test: Try accessing KYC docs as non-admin
  - Expected: Access denied
  - Check: Only admin/agent can view

- [ ] **API Endpoint Protection**
  - Test: Call API without auth token
  - Expected: 401 Unauthorized
  - Check: Protected routes require valid JWT

---

## 🐛 ERROR HANDLING

### User-Friendly Errors

- [ ] **Form Validation Errors**
  - Test: Submit invalid form
  - Expected: Clear error messages
  - Check: Highlight problem fields, explain issue

- [ ] **404 Not Found**
  - Test: Visit non-existent page
  - Expected: Custom 404 page
  - Check: Navigation options provided

- [ ] **500 Server Error**
  - Test: Trigger server error (if possible)
  - Expected: Generic error page
  - Check: No sensitive info leaked, retry option

- [ ] **Network Error**
  - Test: Disconnect internet, try action
  - Expected: "No connection" message
  - Check: Retry mechanism

- [ ] **Payment Failure**
  - Test: Payment fails
  - Expected: Clear failure message
  - Check: Retry option, support contact

---

## ✅ FINAL CHECKLIST

### Pre-Launch Essentials

- [ ] All user flows tested end-to-end
- [ ] All forms validated and working
- [ ] All file uploads tested (images, PDFs)
- [ ] All email notifications received
- [ ] All payment flows tested
- [ ] All admin approvals tested
- [ ] All error scenarios handled
- [ ] Mobile responsiveness verified
- [ ] Cross-browser compatibility checked
- [ ] Performance benchmarks met
- [ ] Security vulnerabilities assessed
- [ ] Data privacy compliance verified
- [ ] Terms of service and privacy policy in place
- [ ] Help/FAQ section complete
- [ ] Contact/support channels functional

### Testing Sign-Off

**Tested By**: ___________________  
**Date**: ___________________  
**Environment**: Production / Staging / Development  
**Browser(s)**: ___________________  
**Mobile Device(s)**: ___________________  
**Overall Status**: Pass / Fail / Needs Work  
**Critical Issues Found**: ___________________  
**Notes**: ___________________

---

## 📝 Bug Report Template

When you find issues, document them:

**Bug ID**: #___  
**Feature**: ___  
**Severity**: Critical / High / Medium / Low  
**Description**: ___  
**Steps to Reproduce**:
1. 
2. 
3. 

**Expected Behavior**: ___  
**Actual Behavior**: ___  
**Screenshots**: ___  
**Browser/Device**: ___  
**User Role**: Traveler / Organizer / Admin / Agent  

---

**Happy Testing! 🎉**  
**Version**: 1.0  
**Last Updated**: 2025
