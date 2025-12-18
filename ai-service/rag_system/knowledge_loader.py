"""
Knowledge Base Loaders - Load domain-specific and general knowledge
"""
import logging
import json
from pathlib import Path
from typing import List, Dict, Any

logger = logging.getLogger(__name__)


class KnowledgeBaseLoader:
    """Loads and prepares documents for RAG system"""
    
    @staticmethod
    def load_trek_tribe_knowledge() -> List[Dict[str, Any]]:
        """Load Trek Tribe website-specific knowledge"""
        
        documents = [
            # Trip Creation Knowledge
            {
                "id": "trip-creation-01",
                "title": "How to Create a Trip",
                "source": "Trek Tribe Documentation",
                "category": "organizer",
                "text": """To create a trip on Trek Tribe, follow these 7 steps:

Step 1: Basic Information
- Trip Title: A catchy, descriptive name for your adventure
- Destination: Where the trip will take place (e.g., Nepal, Himalayas)
- Description: Detailed information about what the trip offers
- Categories: Select tags like trekking, adventure, beach, mountain, wildlife

Step 2: Dates & Pricing
- Start Date: When the trip begins (must be in future)
- End Date: When the trip concludes
- Price: Cost per person in Indian Rupees (₹)
- Capacity: Maximum number of participants

Step 3: Itinerary/Schedule
- Create a day-by-day schedule with:
  - Day Number (Day 1, Day 2, etc.)
  - Title (e.g., "Arrival in Kathmandu")
  - Activities list for each day

Step 4: Images & Media
- Cover Image: Main trip representative image
- Gallery Images: 3-10 high-quality photos showing destination, activities, accommodations
- File Requirements: JPG, PNG, WEBP format, max 5MB per image

Step 5: Inclusions & Exclusions
- Inclusions: What's covered in price (accommodation, meals, guide, transportation, permits, equipment)
- Exclusions: What participants pay separately (travel insurance, personal gear, optional activities, tips)

Step 6: Terms & Policies
- Cancellation Policy: Refund structure (e.g., full if 30+ days, 50% if 15-30 days, none if <15 days)
- Important Notes: Safety guidelines, health requirements, emergency contacts
- Terms & Conditions: Rules and liability clauses

Step 7: Review & Publish
- Review all information for accuracy
- Preview how trip appears to users
- Verify pricing, dates, images
- Click "Publish Trip" to make it live

After publishing, your trip appears in the marketplace immediately and you can manage bookings from the CRM Dashboard."""
            },
            
            {
                "id": "trip-creation-02",
                "title": "Trip Creation Requirements",
                "source": "Trek Tribe Documentation",
                "category": "organizer",
                "text": """Requirements for creating trips on Trek Tribe:

1. Account & Role Requirements:
- Must be registered as an Organizer (not Traveler)
- Complete your organizer profile with verification documents
- Provide identification and proof of expertise

2. Subscription Plans (After 2-month free trial):
- Starter: ₹1,499/month for 5 trips
- Growth: ₹3,499/month for 15 trips
- Professional: ₹5,999/month for 30 trips
- Enterprise: ₹9,999/month for 50 trips

3. Content Requirements:
- High-quality images (minimum 3-5 photos)
- Detailed day-by-day itinerary
- Clear pricing with all inclusions/exclusions listed
- Valid cancellation and refund policy
- Safety and health guidelines

4. New Organizers:
- Get 2-month free trial with unlimited trip creation
- After trial, select a subscription tier
- Email reminders at 7 days and 1 day before trial expiry
- All payments via Razorpay secure gateway

5. Verification:
- Organizers must upload verification documents
- Admin review process for new organizers
- User reviews and ratings build trust
- Report system for issues"""
            },
            
            {
                "id": "booking-process",
                "title": "How to Book a Trip",
                "source": "Trek Tribe Documentation",
                "category": "booking",
                "text": """Complete booking process for travelers:

Step 1: Browse and Select
- Go to "Discover Adventures" in header
- Search by destination, category, price, or dates
- Click on a trip to view full details

Step 2: Review Trip Details
- Read description and itinerary
- Check pricing and what's included/excluded
- Review cancellation policy
- View organizer profile and ratings

Step 3: Add Traveler Information
- Your name (pre-filled if logged in)
- Age/Date of birth
- Phone number
- Emergency contact name and phone
- Any medical conditions or allergies

Step 4: Select Payment Method
- UPI (Google Pay, PhonePe, Paytm)
- Credit/Debit Card
- Net Banking

Step 5: Complete Payment
- For UPI: Scan organizer QR code, pay amount, upload screenshot with transaction ID
- For Card: Complete card payment through Razorpay
- Keep transaction ID and proof safe

Step 6: Wait for Verification
- Organizer verifies booking (usually 12-24 hours)
- For UPI: Payment verification happens
- You'll receive email confirmation

Step 7: Confirmation & Preparation
- Receive confirmation email with booking details
- Get trip instructions and organizer contact info
- Prepare for trip as per provided packing list
- Join WhatsApp group for trip communication

Cancellation: To cancel, go to "My Bookings", select the trip, click "Request Cancellation". Refund follows trip's stated cancellation policy."""
            },
            
            {
                "id": "payment-methods",
                "title": "Payment Methods & Process",
                "source": "Trek Tribe Documentation",
                "category": "payment",
                "text": """Payment options on Trek Tribe:

Accepted Methods:
1. UPI (Google Pay, PhonePe, Paytm, Bhim)
- Scan organizer's QR code
- Enter payment amount
- Complete payment
- Screenshot with transaction ID
- Upload screenshot on platform
- Verification usually 12-24 hours

2. Credit/Debit Cards
- Integrated with Razorpay payment gateway
- Supports Visa, Mastercard, Amex
- Instant confirmation
- PCI DSS compliant

3. Net Banking
- Available through Razorpay
- Supports all major Indian banks
- Secure encrypted connection
- Instant confirmation

Security & Safety:
- PCI DSS compliant payment gateway
- No credit card details stored on servers
- Encrypted transactions
- Secure authentication
- Buyer protection

For Payment Issues:
- Email: support@trektribe.com with booking ID and payment reference
- Contact: Support helpline
- Include: Transaction ID, booking ID, payment screenshot
- Response time: Within 2 hours"""
            },
            
            {
                "id": "crm-dashboard",
                "title": "Organizer CRM Dashboard",
                "source": "Trek Tribe Documentation",
                "category": "organizer",
                "text": """Organizer CRM Dashboard - Professional Management Tool

Access:
- Route: /organizer/crm
- NOT your homepage (home page shows normal Trek Tribe experience)
- Visible in header menu for organizers only

Main Features:
1. Trip Management
- View all your trips with statistics
- Edit trip details, dates, pricing
- Update availability
- View bookings per trip
- See participant lists

2. Booking Management
- View all booking requests
- Confirm or reject bookings
- See participant details
- Track payment status
- Export booking reports

3. Participant Management
- View participant names, contact info
- See emergency contacts
- Track medical information
- Communicate with participants
- Manage group bookings

4. Payment Tracking
- View revenue analytics
- See payment status
- Track verified vs pending payments
- Generate revenue reports
- Payment settlement schedule

5. Analytics & Insights
- Trip performance metrics
- Booking trends
- Seasonal insights
- Participant demographics
- Rating and review analytics

6. Communication
- Send mass messages to participants
- Schedule trip reminders
- Share trip documents
- WhatsApp integration for notifications

7. Payment Verification
- Separate dashboard: /organizer/payment-verification
- Upload payment screenshots
- Track verification status
- Resolve payment issues

Dashboard Components:
- Dashboard overview with key metrics
- Trip cards with quick actions
- Booking list with filters
- Participant management section
- Analytics and reports
- Payment tracking section
- Communication tools"""
            },
            
            {
                "id": "trip-search",
                "title": "Finding and Searching Trips",
                "source": "Trek Tribe Documentation",
                "category": "travel",
                "text": """How to find trips on Trek Tribe:

Search Access:
- Route: /trips
- "Discover Adventures" in header menu
- Search bar on homepage

Search Filters Available:
1. Text Search
- Search by trip name or description
- Search by destination or keywords
- Location-based search

2. Category Filter
- Trekking (mountain hiking)
- Adventure (extreme sports, adventure activities)
- Beach (coastal relaxation)
- Mountain (high altitude, scenic)
- Wildlife (nature, safari, wildlife viewing)
- Cultural (heritage sites, temples, cultural experiences)
- Water Sports (rafting, kayaking, diving)

3. Price Range Filter
- Budget: Under ₹5,000
- Mid-range: ₹5,000 - ₹15,000
- Luxury: Above ₹15,000
- Custom range selector

4. Date Filters
- Start date range
- End date range
- Trip duration

5. Other Filters
- Difficulty level (Easy, Moderate, Challenging)
- Organizer ratings
- Availability status
- Sorting: by rating, price, recency

Example Searches:
- "Himalayan trekking March 2024" - Gets Himalayan treks in March
- Category: Trekking, Price: Budget - Gets affordable treks
- "Kerala beach trip" - Beach trips in Kerala
- Duration: 3-5 days - Gets short trips

Tips for Better Results:
- Be specific with destination names
- Use category filters to narrow results
- Check organizer reviews and ratings
- Read full itinerary before booking
- View images and participant reviews
- Check cancellation policy
- Verify inclusions and exclusions"""
            },
            
            {
                "id": "organizer-subscription",
                "title": "Organizer Subscription Plans",
                "source": "Trek Tribe Documentation",
                "category": "subscription",
                "text": """Subscription Plans for Trip Organizers:

Free Trial (New Organizers):
- Duration: 2 months
- Features: Unlimited trip creation, all organizer tools
- Cost: Free
- Email Reminders: 7 days before expiry, 1 day before expiry
- Auto-renewal: Requires subscription selection after trial

Paid Subscription Tiers (After 2-month free trial):

1. Starter Plan
- Price: ₹1,499/month
- Max Trips: 5 active trips
- Participants: Unlimited per trip
- Features: Basic CRM, Booking management, Payment tracking
- Best For: New organizers testing the platform

2. Growth Plan
- Price: ₹3,499/month
- Max Trips: 15 active trips
- Participants: Unlimited per trip
- Features: Advanced CRM, Analytics, Priority support, Email campaigns
- Best For: Growing organizers with multiple trips

3. Professional Plan
- Price: ₹5,999/month
- Max Trips: 30 active trips
- Participants: Unlimited per trip
- Features: Full CRM, Advanced analytics, Custom branding, API access
- Best For: Established organizers with high volume

4. Enterprise Plan
- Price: ₹9,999/month
- Max Trips: 50 active trips
- Participants: Unlimited per trip
- Features: Dedicated support, Custom features, Priority payments, White-label options
- Best For: Large scale trip operators

Billing:
- Charged via Razorpay payment gateway
- Automatic monthly renewal
- Cancel anytime from subscription settings
- Pro-rated refunds for early cancellation
- Invoice emailed each month

Special Offers:
- Annual plans available (20% discount)
- Early bird discount for new organizers
- Group discounts for multiple organizers
- Corporate packages available

Cancel or Upgrade:
- Go to /subscribe route
- Select "Manage Subscription"
- Change plan or cancel anytime
- Changes effective from next billing cycle"""
            },
            
            {
                "id": "cancellation-refund",
                "title": "Cancellation and Refund Policy",
                "source": "Trek Tribe Documentation",
                "category": "policy",
                "text": """Trek Tribe Cancellation and Refund Policy:

Standard Policy (For Individual Trips):
- 30+ days before trip start: Full refund (100%)
- 15-30 days before trip start: 50% refund
- 7-15 days before trip start: 25% refund
- Less than 7 days: No refund (except organizer cancellation)

Special Circumstances (Full Refund Granted):
- Organizer cancels the trip
- Force majeure events (natural disasters, lockdowns, etc.)
- Trip postponed by organizer to different date
- Safety concerns preventing trip

Refund Process:
1. Initiating Cancellation:
- Log into Trek Tribe account
- Go to "My Bookings"
- Select the booking
- Click "Request Cancellation"
- Provide reason (optional)
- Submit cancellation request

2. Cancellation Confirmation:
- Receive confirmation email immediately
- Booking status changes to "Cancelled"
- Refund processing begins

3. Refund Timeline:
- UPI/Card Payments: 5-7 business days
- Net Banking: 7-10 business days
- Payment gateway processing may add 1-2 days
- Keep transaction ID for reference

4. Tracking Refund:
- Check "My Bookings" for refund status
- Email notification when refund is processed
- Money appears in original payment method
- Contact support if not received after 10 days

Custom Policies:
- Some trips may have different cancellation policies
- Check trip details for specific policy
- More flexible policies shown clearly on trip page
- Ask organizer if policy unclear

Payment Method Considerations:
- UPI refunds: Go to original UPI account within 7 days
- Card refunds: Credited to original card account
- Net Banking: May require bank verification
- Keep proof of cancellation request

Important Notes:
- Refund amount based on cancellation date, not processing date
- No additional charges or deductions from refund
- Transfer fees not refunded
- Email support@trektribe.com for refund issues
- Phone support available for disputes"""
            },
            
            {
                "id": "trip-features",
                "title": "Advanced Trip Features",
                "source": "Trek Tribe Documentation",
                "category": "features",
                "text": """Advanced Features on Trek Tribe:

Group Bookings:
- One person books for entire group
- Minimum 6 people for group discounts
- Discounts: 6-10 people (10% off), 11-15 people (15% off), 16+ (20% off)
- Groups of 20+ get free trip for group leader
- Corporate and college groups get additional 5% discount
- Custom group packages available

QR Code Features:
- Each trip has unique QR code
- Share QR code for quick access
- QR codes for bookings and payments
- Organizers generate custom QR for payments
- Simplifies sharing and booking process

Public Profiles:
- Organizers have public profile pages
- Shows all created trips
- Displays reviews and ratings
- Participants can view organizer portfolio
- Shareable profile links

Wishlist System:
- Save trips for later viewing
- "💗 Wishlist" in header menu
- Share wishlists with friends
- Get notifications for price changes on wishlist items

Review & Ratings System:
- Post reviews after trip completion
- Rate from 1-5 stars
- Detailed review moderation
- Admin approval process for reviews
- Help other travelers make decisions

Post Creation:
- Organizers can share trip updates as posts
- Share photos and experiences
- Followers get notifications
- Build community around trips

Following System:
- Follow organizers you like
- Get updates about new trips
- See follower counts on profiles
- Build organizer reputation

Real-time Chat:
- Socket.io powered messaging
- Communicate with organizers before booking
- Group chat during trip
- Support agent chat

Notifications System:
- Email notifications for bookings
- WhatsApp notifications for trip updates
- In-app notifications when logged in
- Customizable notification preferences"""
            },
            
            {
                "id": "safety-travel-tips",
                "title": "Safety Tips and Travel Preparation",
                "source": "Trek Tribe Documentation",
                "category": "safety",
                "text": """Safety Tips for Trek Tribe Adventures:

Before the Trip:
1. Health Preparation:
- Get medical checkup if trek difficulty is high
- Consult doctor about altitude sickness prevention if high altitude trek
- Carry prescription medications in original bottles
- Get recommended vaccinations for destination
- Consider travel insurance with medical coverage

2. Physical Preparation:
- Start fitness training 4-6 weeks before trek
- Do cardiovascular exercises (jogging, cycling, swimming)
- Practice hiking with a loaded backpack
- Strengthen legs with squats and lunges
- Practice breathing exercises for high altitude

3. Document Preparation:
- Carry valid photo ID (Aadhaar, Passport, License)
- Get permits if required (ILP for protected areas)
- Photocopy important documents
- Store digital copies in cloud
- Keep emergency contact list

During the Trip:
1. General Safety:
- Always follow guide's instructions
- Stay with the group, never trek alone
- Wear appropriate protective gear
- Use trekking poles on difficult terrain
- Mark your position and notify someone before starting

2. Health During Trek:
- Drink water regularly (not just when thirsty)
- Carry snacks and energy bars
- Rest frequently on long hikes
- Watch for signs of altitude sickness (headache, nausea)
- Acclimatize properly on high altitude treks

3. Equipment & Clothing:
- Wear proper trekking shoes with ankle support
- Carry warm layers even in summer
- Use waterproof jackets in monsoon
- Bring first aid kit with essentials
- Carry headlamp for night emergencies

4. Weather Safety:
- Check weather forecast before each day
- Turn back if weather deteriorates
- Avoid lightning-prone areas during storms
- Take shelter if sudden rain begins
- Start early to finish before dark

Emergency Contacts:
- Keep trek organizer contact saved
- National Emergency: 112
- Ambulance: 102
- Local police: 100
- Tourist Police: 1363
- Trek Tribe Support: (see support section)

After the Trip:
- Rest adequately
- Hydrate and eat nutritious food
- Watch for post-trek injuries or illnesses
- Share feedback and reviews
- Report any safety concerns
- Contact support if needed"""
            },
            
            {
                "id": "profile-management",
                "title": "Profile Management and Settings",
                "source": "Trek Tribe Documentation",
                "category": "account",
                "text": """Managing Your Trek Tribe Profile:

Access Profile:
- Route: /my-profile
- Click profile icon in header → "My Profile"
- Your name in header (e.g., "sajal")

Edit Profile:
1. Profile Information:
- Name (required)
- Email (verified email)
- Phone number
- Date of birth
- Gender (optional)
- Occupation (optional)

2. Location & Bio:
- Location/City
- Bio (tell about yourself)
- Profile picture (upload or remove)

3. Social Links (Optional):
- Instagram handle
- Facebook profile
- Twitter handle
- LinkedIn profile
- Personal website

4. For Travelers:
- Emergency contact name
- Emergency contact phone
- Medical conditions (if relevant)
- Years of trekking experience

5. For Organizers:
- Organization name
- Years of experience
- Expertise areas
- Verification documents
- Bank account details (for payments)

Privacy Settings:
- Control who can see your profile
- Hide email from public view
- Manage who can contact you
- Control message notifications
- Adjust notification preferences

Upload Profile Picture:
1. Click camera icon on profile picture
2. Select image (JPG, PNG, max 5MB)
3. Crop if needed
4. Save

Security:
- Change password from settings
- Enable two-factor authentication (2FA)
- View login activity
- Manage active sessions
- Logout from other devices

Account Management:
- View booking history
- Download invoices and receipts
- Manage payment methods
- View subscription status (for organizers)
- Request data export

Preferences:
- Email notification settings
- SMS notification settings
- In-app notification preferences
- Language preferences
- Theme (light/dark mode)

Account Deletion:
- Go to account settings
- Find "Delete Account" option
- Confirm deletion (irreversible)
- Data deleted within 30 days"""
            }
        ]
        
        return documents
    
    @staticmethod
    def load_general_knowledge() -> List[Dict[str, Any]]:
        """Load general trekking and travel knowledge"""
        
        documents = [
            {
                "id": "general-01",
                "title": "What is Trekking?",
                "source": "General Knowledge",
                "category": "education",
                "text": """Trekking is a form of outdoor adventure that involves walking through natural landscapes for extended periods. Unlike hiking (which is usually a day activity), trekking typically lasts multiple days and covers longer distances through challenging terrain.

Key Characteristics:
- Multi-day walking expeditions
- Traverse through mountains, forests, or wilderness areas
- Carry backpacks with personal belongings
- Stay in basic accommodations (campsites, guesthouses)
- Experience diverse landscapes and cultures
- Physical challenge combined with natural beauty
- Guided by experienced trek leaders

Types of Treks:
1. Mountain Treks: High altitude in Himalayan ranges
2. Jungle Treks: Through forests with wildlife
3. Valley Treks: Through river valleys and plains
4. Desert Treks: Through arid landscapes
5. Coastal Treks: Along coastlines and beaches

Benefits of Trekking:
- Excellent cardiovascular exercise
- Stress relief and mental health improvement
- Connection with nature
- Cultural exchange with local communities
- Personal achievement and confidence building
- Adventure and exploration experience
- Photography and nature appreciation opportunities"""
            },
            
            {
                "id": "general-02",
                "title": "Altitude Sickness Prevention",
                "source": "General Knowledge",
                "category": "health",
                "text": """Acute Mountain Sickness (AMS) is a condition caused by rapid ascent to high altitude. Proper acclimatization and awareness are essential.

Prevention Strategies:
1. Ascend Gradually:
- Gain maximum 300-500 meters per day above 3000m
- Include rest days for acclimatization
- Follow acclimatization schedule provided by trek operator

2. Stay Hydrated:
- Drink 3-4 liters of water daily
- Avoid alcohol for first 24-48 hours at altitude
- Drink water regularly throughout the day
- Monitor urine color (should be clear or pale yellow)

3. Healthy Eating:
- Eat iron-rich foods (boosts oxygen absorption)
- Consume carbohydrate-heavy meals
- Avoid heavy, spicy foods initially
- Eat nutritious snacks frequently

4. Physical Preparation:
- Train before trek (cardio and strength)
- Avoid strenuous activity first day at altitude
- Sleep well the night before ascent
- Start ascent early in the morning

5. Medical Prevention:
- Consult doctor about Diamox (acetazolamide) prescription
- Take as directed by doctor (if prescribed)
- Do not use as substitute for acclimatization

Symptoms of AMS (Mild):
- Headache
- Nausea
- Fatigue
- Shortness of breath with exertion
- Difficulty sleeping
- Loss of appetite

Symptoms of Severe AMS (HACE/HAPE - Medical Emergency):
- Severe headache not relieved by painkillers
- Difficulty walking (loss of coordination)
- Confusion or altered consciousness
- Severe shortness of breath at rest
- Fluid in lungs (gurgling sounds when breathing)

Treatment for Mild AMS:
- Rest at current altitude for 24 hours
- Hydrate well
- Take paracetamol for headache
- Eat light, nutritious meals
- Do not ascend until symptoms subside

Treatment for Severe AMS:
- DESCEND IMMEDIATELY - this is a medical emergency
- Descend at least 300-500 meters
- Seek medical help
- Use supplemental oxygen if available
- Evacuate if symptoms worsen"""
            },
            
            {
                "id": "general-03",
                "title": "Packing List for Treks",
                "source": "General Knowledge",
                "category": "preparation",
                "text": """Essential Packing List for Trekking:

Clothing (Layer System):
- Base layers: Moisture-wicking thermal undergarments
- Mid layers: Fleece jackets or wool sweaters
- Outer layers: Waterproof jacket and pants
- Trekking pants: Lightweight, quick-drying
- Trekking shirts: Quick-dry, breathable (multiple)
- Undergarments: Extra pairs (quick-dry preferred)
- Socks: Woolen or synthetic (3-4 pairs, moisture-wicking)
- Boots: Broken-in trekking boots with ankle support
- Hat or cap: Protection from sun or cold
- Gloves: For cold weather treks
- Scarf or bandana: Versatile for sun/dust/cold protection

Footwear:
- Primary: Waterproof trekking boots (tested before trek)
- Secondary: Comfortable trekking shoes or trainers
- Camp shoes: Light sandals or casual shoes
- Keep boots well broken-in before trek

Bag & Packing:
- Backpack: 40-60 liters for multi-day treks
- Day pack: 15-20 liters for daytime excursions
- Waterproof bags or dry bags for protection
- Packing cubes for organization

Sleep & Shelter:
- Sleeping bag: Rated appropriately for season/altitude
- Sleeping mat: Insulation and comfort
- Tent: If provided by organizer (check details)

Toiletries & Hygiene:
- Toothbrush and toothpaste
- Soap and shampoo (biodegradable preferred)
- Wet wipes or dry toilet paper
- Hand sanitizer
- Sunscreen (SPF 50+)
- Lip balm with SPF
- Toilet paper and trowel (if required)
- Female hygiene products (if needed)
- Deodorant (optional, minimal in wilderness)
- Moisturizer for dry skin

First Aid Kit:
- Pain relievers: Paracetamol, Ibuprofen
- Anti-diarrheal medication
- Antihistamine tablets
- Antacid
- Blister treatment: Blister pads, moleskin, taping
- Bandages and adhesive tape
- Antiseptic ointment and solution
- Gauze pads and elastic bandage
- Tweezers for splinters
- Safety pins
- Any personal medications in original packaging

Documents & Valuables:
- ID: Aadhaar, Passport, Driving License
- Important copies: Scanned/photographed
- Cash and credit cards (minimal)
- Travel insurance documents
- Trek booking confirmation
- Emergency contact list
- Medical history if relevant

Electronics:
- Mobile phone and charger
- Portable power bank (large capacity for multi-day)
- Camera (optional, for photography)
- Headlamp or flashlight with extra batteries
- Smartwatch (optional)
- Note: Limited charging opportunities on trek

Water & Hydration:
- Water bottles (2-3 liters capacity)
- Water purification tablets (backup)
- Sports drink powder or electrolyte packets
- Hydration bladder (optional)

Food & Snacks (If Required):
- Energy bars, nuts, dried fruit
- Chocolate or candy for quick energy
- Protein bars
- Note: Meals typically provided on organized treks

Miscellaneous:
- Maps (if available)
- Guidebook or trekking notes
- Binoculars (for wildlife observation)
- Knife or multi-tool
- Repair kit: Needle, thread, duct tape
- Lighter or matches (waterproof)
- Emergency whistle
- Notebook and pen
- Entertainment: Book or e-reader (minimal)

Seasonal Additions:

For Monsoon Treks:
- Extra waterproof bags
- Quick-dry microfiber towel
- Gaiters (to keep mud/water out of boots)
- Additional socks (stored in waterproof bags)

For Winter Treks:
- Down jacket (insulated, lightweight)
- Thermal inner wear (full length)
- Woolen socks (extra pairs)
- Insulated water bottles
- Hand warmers or chemical heat packs
- Balaclava or face mask

For High Altitude:
- Extra socks and gloves
- Sunglasses with UV protection
- Extra sunscreen
- Lip balm
- Ear protection (earplugs or ear warmer)
- Prescribed altitude sickness medication

Packing Tips:
- Keep weight under 8-10 kg (check trek requirements)
- Pack heavy items close to back, low in pack
- Distribute weight evenly
- Keep frequently used items accessible
- Roll clothes to save space
- Use packing cubes for organization
- Keep electronics and documents waterproofed
- Leave excess at hotel before trek (if day trek)"""
            },
            
            {
                "id": "general-04",
                "title": "Best Trekking Seasons in India",
                "source": "General Knowledge",
                "category": "planning",
                "text": """Optimal Trekking Seasons by Region:

Spring (March-May):
- Weather: Pleasant, warm days, cool nights
- Highlights: Blooming rhododendrons, clear mountain views
- Best Regions: Himachal Pradesh, Uttarakhand, Sikkim, Darjeeling
- Popular Treks: Tungnath, Chopta, Kedarkantha (lower altitude variants)
- Advantages: Clear visibility, comfortable temperatures, manageable snow
- Disadvantages: Can be crowded, some trails still have snow

Summer (June-August):
- Weather: Hot in plains, mild in mountains, monsoon in most areas
- Highlights: Green landscapes, lush valleys
- Best Regions: Ladakh, Spiti (rain shadow), Zanskar (high altitude)
- Popular Treks: Markha Valley Trek, Spiti Valley Trek
- Advantages: Highest altitude passes accessible, long daylight hours
- Disadvantages: Monsoon rainfall, landslide risk, trail closures (most regions)

Autumn/Fall (September-November):
- Weather: Sunny, clear skies, stable conditions, comfortable temperature
- Highlights: Post-monsoon fresh landscapes, clear visibility
- Best Regions: All regions across India, especially Himalayas
- Popular Treks: All major treks, Manali to Leh Highway
- Advantages: Best overall season, reliable weather, fewer crowds than spring
- Disadvantages: Higher prices, can get cold by late October/November

Winter (December-February):
- Weather: Snow at high altitude, freezing temperatures
- Highlights: Snow-covered landscapes, winter solitude
- Best Regions: Lower altitude treks, moderate altitude with proper equipment
- Popular Treks: Kedarkantha, Brahmatal, Kuari Pass (lower sections)
- Advantages: Fewer tourists, stunning snowy views, unique experience
- Disadvantages: Extremely cold, avalanche risk, limited accessibility

Regional Breakdown:

Himachal Pradesh:
- Best Season: September-November (autumn), March-May (spring)
- Summer: Some high altitude treks accessible
- Winter: Only low altitude treks
- Popular: Himalayan treks, valley treks

Uttarakhand:
- Best Season: September-November, March-May
- Peak: October-November (clear skies)
- Summer: Acceptable with caution (monsoon affects trails)
- Winter: Limited options, mostly lower altitude

Kashmir/Ladakh:
- Best Season: June-September (high altitude passes)
- July-August: Peak season (warm, all passes open)
- Shoulder: May-June, September-October
- Winter: Closed (extreme conditions, snow)

Kerala/South India:
- Best Season: October-February (post-monsoon to pre-summer)
- Summer (March-May): Hot and humid
- Monsoon (June-September): Avoid most treks
- Winter: Ideal conditions

Northeast India:
- Best Season: October-April (dry season)
- Monsoon (May-September): Some adventurous trekkers prefer
- Peak: November-February
- Spring: Beautiful but rainy

Festival Timing:
- Diwali (October-November): Very crowded on popular treks
- Christmas/New Year: Popular in adventure circuit, hotels booked
- Independence Day (August): Limited impact on treks
- Avoid peak holiday periods for better experience

Recommendations:
- Autumn (September-November): Best overall for most treks
- Spring (March-May): Second best, watch for crowds
- Winter: For experienced trekkers only
- Summer: Limited options, prepare for rain
- Book early for popular seasons (6-12 weeks ahead)"""
            },
            
            {
                "id": "general-05",
                "title": "Equipment for Different Trek Types",
                "source": "General Knowledge",
                "category": "preparation",
                "text": """Equipment Recommendations by Trek Type:

Mountain/High Altitude Treks (Above 3500m):
Essential:
- Strong waterproof trekking boots (tested, broken-in)
- Thermal inner layers (top and bottom)
- Multiple layers (base, mid, outer)
- Insulated jacket or down jacket
- Waterproof outer jacket and pants
- Hat/balaclava for cold
- Gloves (inner and outer)
- Sleeping bag rated for -10°C minimum
- Sunglasses and high SPF sunscreen
- Headlamp with extra batteries

Optional but Recommended:
- Crampons or microspikes (for icy terrain)
- Trekking poles (reduce knee strain)
- Gaiters (keep snow/dirt out of boots)
- Thermal socks (multiple pairs)
- Emergency oxygen (consult doctor)
- Altitude sickness medication (if prescribed)

Jungle/Forest Treks:
Essential:
- Sturdy trekking shoes with good grip
- Long pants (protection from insects, thorns)
- Long-sleeved shirt (lightweight, quick-dry)
- Hat with brim (sun and rain protection)
- Insect repellent (strong, DEET-based)
- Light rain jacket
- Waterproof bag for electronics
- First aid kit (enhanced with anti-diarrheal, antihistamine)
- Water bottles (3 liters minimum)

Optional:
- Leech repellent (for monsoon treks)
- Mosquito net (if provided accommodation lacks windows)
- Lightweight tarp or groundsheet
- Binoculars (wildlife observation)

Beach/Coastal Treks:
Essential:
- Lightweight, quick-dry clothing
- UV protection sunglasses
- High SPF waterproof sunscreen
- Hat or cap with UV protection
- Comfortable beach sandals or water shoes
- Light rain jacket (sudden showers)
- Reusable water bottle (stay hydrated)
- Moisture-wicking socks
- Quick-dry towel

Optional:
- Snorkel gear (if activities include snorkeling)
- Wetsuit (depending on water temperature)
- Waterproof bag for valuables
- Camera with waterproof case
- Flip-flops or beach sandals (camp shoes)

Desert Treks:
Essential:
- Light-colored, loose-fitting clothing (reflect heat)
- Wide-brimmed hat or headscarf
- Extreme SPF sunscreen (SPF 70+)
- Sunglasses with UV protection
- 2-3 liter water bottles minimum
- Lightweight rain jacket (desert storms possible)
- Closed-toe shoes (sand protection)
- Lip balm with SPF
- Moisturizer for dry skin

Optional:
- Face mask or bandana (dust protection)
- Cooling towel
- Electrolyte drink powder
- Sand gaiters

Valley Treks (Easy to Moderate):
Essential:
- Comfortable, lightweight trekking shoes
- Casual but sturdy clothing
- Light jacket or sweater
- Hat for sun protection
- Sunscreen
- Water bottle (1.5-2 liters)
- Small first aid kit
- Casual daypack (15-20 liters)

Optional:
- Trekking poles (optional, not essential)
- Camera
- Binoculars
- Walking umbrella (if rain expected)

Multi-Day Trek Cooking (If Self-Catering):
- Portable camping stove
- Lightweight cookware (pot, pan, utensils)
- Sleeping pad (insulation and comfort)
- Waterproof matches or lighter
- Water containers and purification method
- Biodegradable soap and dishcloth
- Trash bags (leave no trace)

Photography Equipment:
- Main camera (DSLR or mirrorless)
- Extra lenses (wide-angle, zoom)
- Tripod (lightweight)
- Memory cards (multiple)
- Batteries and chargers
- ND filters
- Cleaning kit (lens cloth, brush)
- Waterproof case/protection

General Equipment Principles:
1. Quality Over Quantity: Invest in good gear, not excessive gear
2. Durability: Choose equipment that lasts multiple treks
3. Weight Management: Every gram matters on multi-day treks
4. Waterproof Everything: Moisture is enemy of comfort
5. Layering System: More important than heavy single jacket
6. Test Equipment: Test all gear at home before trek
7. Break-in Period: New boots need 50+ km break-in before trek"""
            }
        ]
        
        return documents
    
    @staticmethod
    def load_from_json(json_path: str = "data/knowledge_base.json") -> List[Dict[str, Any]]:
        """Load knowledge from JSON file"""
        try:
            # Handle both absolute and relative paths
            if not Path(json_path).is_absolute():
                # Assume relative to ai-service directory
                json_path = Path(__file__).parent.parent / json_path
            
            with open(json_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            documents = []
            for doc in data.get('documents', []):
                documents.append({
                    'id': doc.get('id', ''),
                    'title': doc.get('title', ''),
                    'source': doc.get('url', 'knowledge_base.json'),
                    'category': doc.get('category', 'general'),
                    'text': doc.get('content', '')
                })
            
            logger.info(f"Loaded {len(documents)} documents from JSON")
            return documents
        except FileNotFoundError:
            logger.warning(f"JSON knowledge base not found at {json_path}")
            return []
        except Exception as e:
            logger.error(f"Error loading JSON knowledge base: {e}")
            return []
    
    @staticmethod
    def load_all_knowledge() -> List[Dict[str, Any]]:
        """Load all knowledge bases"""
        all_docs = []
        all_docs.extend(KnowledgeBaseLoader.load_trek_tribe_knowledge())
        all_docs.extend(KnowledgeBaseLoader.load_general_knowledge())
        all_docs.extend(KnowledgeBaseLoader.load_from_json())  # Add JSON knowledge
        
        logger.info(f"Loaded {len(all_docs)} total documents")
        return all_docs
