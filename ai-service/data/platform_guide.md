# Trek Tribe Platform Guide - Common Questions & Answers

## Account & Registration

### How do I create an account?
1. Click "Join Community" on the homepage
2. Fill in your details (name, email, password)
3. Select your role: **Traveler** or **Organizer**
4. Verify your email
5. Complete your profile

**Route:** `/register`

### What's the difference between Traveler and Organizer?
- **Travelers**: Browse and join trips created by organizers
- **Organizers**: Create and manage trips, handle bookings, access CRM features

### How do I switch from Traveler to Organizer?
Contact support or register a new account as an organizer. Organizers get a 2-month free trial with full features.

## Finding & Booking Trips

### How do I search for trips?
1. Go to "Discover Adventures" in the header
2. Use the search bar to find trips by destination, name, or keywords
3. Filter by:
   - Categories (trekking, beach, mountains, wildlife, etc.)
   - Price range
   - Dates
   - Destination
   - Availability

**Route:** `/trips`

### How do I join a trip?
1. Browse available trips
2. Click on a trip to see full details
3. Review itinerary, pricing, and policies
4. Click "Join Trip" or "Book Now"
5. Complete payment via Razorpay
6. Receive confirmation via email and WhatsApp

### Can I cancel my booking?
Yes, cancellation policies vary by trip:
- **30+ days before**: Usually full refund
- **15-30 days**: Typically 50% refund
- **Less than 15 days**: Check individual trip policy

Check the specific trip's cancellation policy before booking.

### Where can I see my bookings?
- Click "My Bookings" in the header
- View all your upcoming, past, and cancelled trips
- Access booking details, payment receipts, and trip information

**Route:** `/my-bookings`

## Profile & Settings

### How do I update my profile?
1. Click your profile icon in the header
2. Select "My Profile" or your name (e.g., "sajal")
3. Click "Edit Profile"
4. Update your information:
   - Name, phone, bio
   - Location, date of birth
   - Profile picture
   - Social links (Instagram, Facebook, Twitter)
   - Emergency contact (for travelers)
   - Organizer details (for organizers)

**Route:** `/my-profile` or `/profile`

### How do I upload a profile picture?
1. Go to your profile
2. Click on the camera icon on your profile picture
3. Select an image (JPG, PNG, max 5MB)
4. Crop if needed
5. Save

## For Organizers

### How do I access the CRM Dashboard?
- **From Header**: Look for "CRM" link (visible only to organizers)
- **Route:** `/organizer/crm`
- **Features**: View bookings, manage participants, track revenue, analytics

The CRM is not your homepage - your home page shows the normal Trek Tribe experience. CRM is a separate professional dashboard.

### What subscription plans are available?
**Free Trial**: 2 months free for new organizers

**Paid Plans (after trial):**
1. **Starter**: ₹1,499/month - 5 trips
2. **Growth**: ₹3,499/month - 15 trips
3. **Professional**: ₹5,999/month - 30 trips
4. **Enterprise**: ₹9,999/month - 50 trips

**Route:** `/subscribe`

### How do I manage bookings?
1. Go to CRM Dashboard (`/organizer/crm`)
2. View all bookings with status:
   - Confirmed
   - Pending
   - Cancelled
3. See participant details
4. Track payments
5. Export reports

### How do I verify payments?
- **Route:** `/organizer/payment-verification`
- Upload payment screenshots
- System verifies via Razorpay
- Manual review by admins if needed

## Payments & Pricing

### How do payments work?
- Integrated with **Razorpay** payment gateway
- Supports:
  - Credit/Debit cards
  - UPI
  - Net Banking
  - Wallets
- Secure checkout process
- Instant confirmation

### What currency is used?
All prices are in **Indian Rupees (₹)**

### Are there any hidden charges?
No. The price shown includes all mentioned inclusions. Check each trip's "Exclusions" section for items not covered.

### How do I get a refund?
1. Go to "My Bookings"
2. Select the booking you want to cancel
3. Click "Request Cancellation"
4. Refund processed based on cancellation policy
5. Refund credited to original payment method in 5-7 business days

## Communication & Support

### How do I contact support?
1. **AI Chat Widget**: Click the chat icon (bottom right) for instant help
2. **Human Agent**: Click "Talk to a Human Agent" in the chat
3. **Email**: Available in support section
4. **WhatsApp**: Automated notifications and support

### How do I talk to a human agent?
1. Open the AI chat widget (purple icon, bottom right)
2. Click "🧑‍💼 Talk to a Human Agent" button
3. A support ticket is created
4. An agent will respond shortly
5. You'll receive updates via email

### Do I get notifications?
Yes! You receive notifications via:
- **Email**: Booking confirmations, reminders, updates
- **WhatsApp**: Trip updates, confirmations (if enabled)
- **In-app**: Real-time notifications when logged in

## AI Features

### What can the AI chat help with?
- Find trips matching your preferences
- Answer questions about bookings
- Help create trips (for organizers)
- Provide recommendations
- Assist with platform navigation
- General travel advice

### How do I get AI recommendations?
- Use the AI chat to describe what you're looking for
- AI will suggest trips based on your preferences
- Click suggested trips to view details

**Button:** "🚀 Get Recommendations" in AI chat

### How do I check trip availability?
1. Ask the AI chat "Is [trip name] available?"
2. Or click "📅 Check Availability" button
3. AI will check current bookings and capacity

## Wishlist & Favorites

### How do I save trips for later?
1. Browse trips
2. Click the heart/wishlist icon on any trip
3. Access saved trips from "💗 Wishlist" in header

**Route:** `/wishlist`

### Can I share my wishlist?
Yes, your wishlist is part of your public profile and can be shared.

## Safety & Trust

### Are organizers verified?
- Organizers can upload verification documents
- Admin approval process for new organizers
- User reviews and ratings help build trust
- Report system for issues

### Is my payment information safe?
Yes:
- PCI DSS compliant payment gateway (Razorpay)
- No credit card details stored on our servers
- Encrypted transactions
- Secure authentication

### What if I have a problem with a trip?
1. Contact the organizer directly through the platform
2. Use AI chat support for immediate help
3. Create a support ticket
4. Escalate to admin if unresolved

## Mobile & Accessibility

### Is there a mobile app?
Currently, Trek Tribe is a responsive web application that works on:
- Desktop browsers
- Mobile browsers (optimized)
- Tablets

Access via any modern browser.

### Can I use it on my phone?
Yes! The website is fully responsive and optimized for mobile devices. Simply visit the website from your mobile browser.

## Reviews & Ratings

### How do I leave a review?
1. Complete a trip
2. Go to the trip page
3. Click "Write a Review"
4. Rate (1-5 stars) and write your experience
5. Submit for moderation

Reviews help other travelers make informed decisions.

## Advanced Features

### What are group bookings?
- Organizers can create special group bookings
- Manage multiple participants together
- Bulk operations for groups
- Special pricing for groups

### How do QR codes work?
- QR codes generated for trips and bookings
- Scan for quick access to trip details
- Use for check-in and verification

### What analytics are available?
**For Organizers:**
- Booking trends
- Revenue analytics
- Participant demographics
- Trip performance
- Seasonal insights

**Route:** `/organizer/crm` → Analytics section

## Troubleshooting

### I can't log in
1. Check email and password
2. Try "Forgot Password" link
3. Clear browser cache and cookies
4. Contact support if issue persists

### Trip not loading
1. Refresh the page
2. Check internet connection
3. Clear browser cache
4. Try a different browser

### Payment failed
1. Check payment method has sufficient balance
2. Verify card details
3. Try alternative payment method
4. Contact your bank
5. Reach out to support

### Images not uploading
1. Check file size (max 5MB)
2. Use supported formats (JPG, PNG, WEBP)
3. Check internet connection
4. Try compressing the image

## Contact Information

**Support Email**: support@trektribe.com
**Platform**: https://trekktribe.onrender.com
**AI Chat**: Available 24/7 (click chat icon)
**Human Agents**: Available during business hours

## Quick Links
- Home: `/home`
- Trips: `/trips`
- My Bookings: `/my-bookings`
- My Profile: `/my-profile`
- Wishlist: `/wishlist`
- Create Trip (Organizers): `/create-trip`
- CRM Dashboard (Organizers): `/organizer/crm`
- Subscribe: `/subscribe`
- AI Showcase: `/ai-showcase`
