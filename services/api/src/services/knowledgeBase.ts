import { TransformerEmbeddingService } from './transformerEmbeddings';
import { dataFetcherService, DataFetcherService } from './dataFetcher';
import { EXTENDED_KNOWLEDGE } from './extendedKnowledge';

interface KnowledgeDocument {
  id: string;
  type: 'trip' | 'organizer' | 'faq' | 'policy' | 'general';
  title: string;
  content: string;
  metadata: Record<string, any>;
  embedding?: number[];
}

interface SearchResult {
  document: KnowledgeDocument;
  similarity: number;
}

export class KnowledgeBaseService {
  private documents: KnowledgeDocument[] = [];
  private embeddings: Array<{ id: string; embedding: number[] }> = [];
  private transformerService: TransformerEmbeddingService;
  private isInitialized = false;
  private refreshInterval: NodeJS.Timeout | null = null;

  // Base knowledge that should always be available
  private readonly BASE_KNOWLEDGE = [
    // Booking & Policies
    {
      id: 'base-booking-flow',
      type: 'policy' as const,
      title: 'How to Book a Trip',
      content: 'To book a trip on TrekTribe: 1) Browse trips and select your preferred destination, 2) Choose your dates and review the itinerary, 3) Add traveler details (name, age, phone, emergency contact), 4) Select payment method (UPI or Card), 5) Upload payment screenshot for UPI or complete card payment, 6) Wait for organizer verification (usually within 24 hours), 7) Receive confirmation email with booking details and trip instructions. For questions, contact support@trektribe.com or call our helpline.',
      metadata: { category: 'booking', priority: 'high' }
    },
    {
      id: 'base-payment-methods',
      type: 'policy' as const,
      title: 'Payment Methods & Process',
      content: 'TrekTribe accepts: UPI payments (Google Pay, PhonePe, Paytm), Credit/Debit Cards, Net Banking. For UPI: scan organizer QR code, pay the amount, upload screenshot with transaction ID. Payment verification takes 12-24 hours. Keep your transaction ID and screenshot safe. For payment issues, email support@trektribe.com with booking ID and payment reference.',
      metadata: { category: 'payment', priority: 'high' }
    },
    {
      id: 'base-cancellation-refund',
      type: 'policy' as const,
      title: 'Cancellation and Refund Policy',
      content: 'Standard cancellation policy: Full refund if cancelled 7+ days before trip start, 50% refund if 3-7 days before, No refund within 3 days of trip start (except in case of organizer cancellation or force majeure). Refunds processed within 5-7 business days to original payment method. Some trips have custom policies - check trip details. For emergencies, contact support@trektribe.com.',
      metadata: { category: 'refund', priority: 'high' }
    },
    // Trip Creation for Organizers
    {
      id: 'base-create-trip',
      type: 'organizer' as const,
      title: 'How to Create a Trip - 7 Step Process',
      content: 'To create a trip on TrekTribe, you must be registered as an Organizer. Access the trip creation form by clicking "+ Create Adventure" in the header or navigating to /create-trip. The process has 7 steps: Step 1 - Basic Information (title, destination, description, categories like trekking/adventure/beach). Step 2 - Dates & Pricing (start date, end date, price per person in ₹, maximum capacity). Step 3 - Itinerary/Schedule (day-by-day activities with titles and descriptions). Step 4 - Images & Media (upload cover image and gallery photos, max 5MB each, JPG/PNG/WEBP). Step 5 - Inclusions & Exclusions (what is included in price: accommodation, meals, guide; and what is excluded: travel insurance, personal expenses). Step 6 - Terms & Policies (cancellation policy, important notes, safety guidelines). Step 7 - Review & Publish (review all details and publish your trip). After publishing, your trip appears in the marketplace immediately and you can manage bookings from the CRM Dashboard at /organizer/crm.',
      metadata: { category: 'organizer', priority: 'critical' }
    },
    {
      id: 'base-trip-creation-requirements',
      type: 'organizer' as const,
      title: 'Requirements for Creating a Trip',
      content: 'Prerequisites for creating trips on TrekTribe: 1) Must be registered as an Organizer role (not Traveler). 2) Complete your organizer profile with verification documents. 3) Have an active subscription plan (2-month free trial for new organizers, then paid plans: Starter ₹1,499/month for 5 trips, Growth ₹3,499/month for 15 trips, Professional ₹5,999/month for 30 trips, Enterprise ₹9,999/month for 50 trips). 4) High-quality images (minimum 3-5 photos showing destination, activities, accommodation). 5) Detailed itinerary with day-wise breakdown. 6) Clear pricing with all inclusions/exclusions listed. 7) Valid cancellation and refund policy. Check your subscription status at /subscribe route.',
      metadata: { category: 'organizer', priority: 'high' }
    },
    {
      id: 'base-organizer-dashboard',
      type: 'organizer' as const,
      title: 'Organizer CRM Dashboard and Features',
      content: 'The Organizer CRM Dashboard is your professional control center for managing trips and bookings. Access it at /organizer/crm route (NOT your homepage - home page is the normal Trek Tribe experience for all users). CRM features include: View all your trips with booking statistics, Manage participant details and contact information, Track payments and revenue analytics, View booking requests and confirmations, Export reports for accounting, Communicate with participants, Update trip availability and dates, Payment verification dashboard at /organizer/payment-verification, Analytics and insights on trip performance. The CRM is a separate professional tool accessible from the header menu for organizers only.',
      metadata: { category: 'organizer', priority: 'high' }
    },
    {
      id: 'base-trip-editing',
      type: 'organizer' as const,
      title: 'Editing and Managing Your Trips',
      content: 'Edit existing trips by going to your trips list in the CRM Dashboard and clicking Edit on any trip. You can update: Trip details (title, description, categories), Dates and pricing (price changes notify existing bookings), Itinerary and schedule, Images (add/remove/reorder), Inclusions and exclusions, Policies and terms, Trip status (active, completed, cancelled). Changes to published trips are immediate. If you have existing bookings, price changes do not affect confirmed bookings. For major changes (like date modifications), notify participants via email/WhatsApp. To cancel a trip: change status to Cancelled and system notifies all participants. Refunds for cancelled trips follow your stated cancellation policy.',
      metadata: { category: 'organizer', priority: 'medium' }
    },
    {
      id: 'base-modification',
      type: 'policy' as const,
      title: 'How to Modify or Reschedule Booking',
      content: 'To modify your booking: 1) Log in to TrekTribe, 2) Go to My Bookings, 3) Select the booking to modify, 4) Click Modify (available up to 7 days before trip), 5) Update dates or traveler details, 6) Submit modification request. For date changes more than 7 days before trip: usually free. Within 7 days: may incur fees. For payment-related modifications (especially after UPI settlement): contact support@trektribe.com with booking ID and payment reference.',
      metadata: { category: 'booking', priority: 'high' }
    },
    {
      id: 'base-group-discount',
      type: 'policy' as const,
      title: 'Group Bookings and Discounts',
      content: 'Group discounts available for 6+ travelers booking together. Typical discounts: 6-10 people: 10% off per person, 11-15 people: 15% off, 16+ people: 20% off. One person can book for the entire group. Group leader gets free trip for groups of 20+. Corporate and college groups get additional 5% discount. Contact organizer directly for custom group packages. Payment can be split or made by one person. All group members must be added before booking confirmation.',
      metadata: { category: 'booking', priority: 'medium' }
    },

    // Accommodation & stay details
    {
      id: 'base-accommodation-overview',
      type: 'general' as const,
      title: 'Accommodation and Stay on Treks',
      content: 'Typical stays: campsite tents (double/triple sharing) or basic homestays/guesthouses on approach days. Inclusions: sleeping tents, common dining tent, sleeping bag and mat (unless mentioned otherwise), evening tea/snacks, and all meals on trek days. Washrooms: dry toilet tents or basic shared toilets; hot water usually not available at campsites. Power/charging: limited or unavailable at higher camps—carry a power bank. Room upgrades (private tent/room) are subject to availability and may have an extra charge payable to the organizer on-site. If you need a single-occupancy tent/room, request it during booking so the team can confirm availability and any surcharge.',
      metadata: { category: 'accommodation', priority: 'high' }
    },
    
    // Packing Lists
    {
      id: 'base-packing-monsoon',
      type: 'general' as const,
      title: 'Packing for Monsoon Treks',
      content: 'Essential packing list for monsoon treks: Waterproof trekking jacket with hood, Quick-dry breathable clothing (avoid cotton), Waterproof trekking shoes with good grip, Gaiters to keep mud/water out of shoes, Rain covers for backpack and electronics, Extra pairs of socks (keep in waterproof bags), Quick-dry towel, Compact first-aid kit with antiseptic and band-aids, Water purification tablets, Power bank (fully charged), Headlamp with extra batteries, Zip-lock bags for documents and valuables, Trekking poles for stability on slippery trails.',
      metadata: { category: 'packing', season: 'monsoon', priority: 'medium' }
    },
    {
      id: 'base-packing-winter',
      type: 'general' as const,
      title: 'Packing for Winter Treks',
      content: 'Winter trekking essentials: Insulated 3-layer jacket (base layer, fleece, windproof outer), Thermal innerwear (top and bottom), Down jacket for high altitude, Woolen socks (3-4 pairs), Insulated waterproof trekking boots, Gloves (woolen inner + waterproof outer), Balaclava or woolen cap covering ears, UV protection sunglasses, High SPF sunscreen and lip balm, Sleeping bag rated to -10°C minimum, Hot water bottles, High-calorie snacks (nuts, chocolate, energy bars), Insulated water bottles, Micro-spikes or crampons for icy trails.',
      metadata: { category: 'packing', season: 'winter', priority: 'medium' }
    },
    {
      id: 'base-packing-summer',
      type: 'general' as const,
      title: 'Packing for Summer Treks',
      content: 'Summer trekking packing list: Lightweight breathable t-shirts and pants, Light jacket or windcheater, Sun hat or cap, High SPF 50+ sunscreen, UV protection sunglasses, Lightweight trekking shoes with ankle support, Cotton socks (3 pairs), Hydration backpack or 2L water bottles, Electrolyte powder or ORS, Bandana or scarf for dust protection, Insect repellent, Light rain jacket (for sudden showers), Personal toiletries, Lightweight trekking poles, Power bank and charging cables.',
      metadata: { category: 'packing', season: 'summer', priority: 'medium' }
    },
    {
      id: 'base-packing-general',
      type: 'general' as const,
      title: 'General Trek Packing Essentials',
      content: 'Must-have items for any trek: Valid photo ID (Aadhaar/Passport/License), Medical insurance and emergency contact details, Prescription medications with extra doses, Basic first aid kit (band-aids, antiseptic, pain relievers, anti-diarrheal), Personal hygiene items (toothbrush, paste, wet wipes, hand sanitizer), Dry bags or plastic bags for electronics, Headlamp or flashlight with extra batteries, Reusable water bottle, Energy snacks (nuts, dried fruits, protein bars), Mobile phone with offline maps downloaded, Portable charger/power bank, Whistle for emergencies, Small towel, Toiletries in travel sizes.',
      metadata: { category: 'packing', priority: 'high' }
    },
    
    // Safety & Health
    {
      id: 'base-safety-solo-female',
      type: 'general' as const,
      title: 'Safety Tips for Solo Female Travelers',
      content: 'Safety recommendations for solo female travelers: Always prefer guided group treks over solo unguided hikes, especially in remote areas. Share your complete itinerary with family/friends and maintain regular check-ins (schedule WhatsApp/call times). Carry a fully charged power bank and emergency contact card. Research local customs and dress modestly where appropriate to respect local culture. Stay in verified accommodations with good reviews from other solo female travelers. Avoid isolated trails after sunset. Keep copies of ID, emergency contacts, and travel insurance. Note locations of nearest hospitals and police stations. For high-altitude treks: acclimatize properly, never rush ascent, and check weather conditions before departure. Join TrekTribe community groups for travel companions. If uncomfortable at any point, trust your instincts and seek help from local authorities or tourist police.',
      metadata: { category: 'safety', audience: 'solo-female', priority: 'high' }
    },
    {
      id: 'base-altitude-sickness',
      type: 'general' as const,
      title: 'Altitude Sickness Prevention & Management',
      content: 'Acute Mountain Sickness (AMS) prevention and treatment: Ascend gradually - do not gain more than 300-500m per day above 3000m. Acclimatize properly - spend an extra night at intermediate altitude if possible. Stay hydrated - drink 3-4 liters of water daily. Avoid alcohol and heavy meals in first 24-48 hours at altitude. Recognize symptoms: headache, nausea, dizziness, fatigue, loss of appetite, difficulty sleeping. Mild AMS: rest, hydrate, take paracetamol for headache, avoid further ascent until symptoms resolve. Severe AMS (difficulty breathing, confusion, inability to walk): DESCEND IMMEDIATELY - this is a medical emergency. Carry Diamox (acetazolamide) if prescribed by doctor. Never ignore symptoms. Better to descend and return another day than risk serious complications.',
      metadata: { category: 'safety', subcategory: 'altitude', priority: 'high' }
    },
    {
      id: 'base-first-aid',
      type: 'general' as const,
      title: 'First Aid and Medical Preparation',
      content: 'Essential first aid for treks: Carry personal medications plus: Paracetamol/Ibuprofen for pain and fever, Antihistamine for allergies, Diamox for altitude sickness (if prescribed), Anti-diarrheal medication, Oral rehydration salts (ORS), Bandages and adhesive tape, Antiseptic solution and cream, Blister care (moleskin, blister pads), Elastic bandage for sprains, Tweezers for splinters, Safety pins, Prescription medicines in original packaging with doctor note. Common trek injuries: Blisters (treat early with moleskin), Sprains (RICE - Rest, Ice, Compression, Elevation), Cuts (clean with antiseptic, bandage), Dehydration (drink ORS frequently). Serious issues: chest pain, severe breathing difficulty, altered consciousness - descend immediately and seek medical help.',
      metadata: { category: 'safety', subcategory: 'medical', priority: 'high' }
    },
    {
      id: 'base-wildlife-safety',
      type: 'general' as const,
      title: 'Wildlife Safety on Treks',
      content: 'Wildlife encounter safety: Never feed wild animals - it makes them dependent and aggressive. Keep food sealed in containers, never in open bags. If you see bears: make yourself appear large, speak loudly, back away slowly, never run. For leopards/big cats: maintain eye contact, back away slowly, never turn your back. Monkey encounters: avoid eye contact, secure food and belongings, do not show fear. Snake safety: wear high boots, use trekking stick to probe ahead, watch where you step, if bitten stay calm and seek immediate medical help. General rules: maintain distance from all wildlife (minimum 30 meters), never approach cubs or young animals, do not use flash photography, follow guide instructions, travel in groups in wildlife areas.',
      metadata: { category: 'safety', subcategory: 'wildlife', priority: 'medium' }
    },
    {
      id: 'base-weather-safety',
      type: 'general' as const,
      title: 'Weather Safety and Preparation',
      content: 'Weather safety for treks: Check 7-day forecast before departure. Monsoon safety: avoid river crossings during heavy rain, watch for landslide warnings, cancel if heavy rain predicted. Lightning safety: descend from peaks/ridges immediately, avoid tall trees and metal objects, crouch low if caught in open. Winter safety: watch for frostbite symptoms (numbness, white/gray skin), never trek in whiteout conditions, check avalanche forecasts for winter treks. Extreme heat: start early morning, take frequent shade breaks, drink water every 20 minutes even if not thirsty. Always have emergency shelter (lightweight tent or tarp), know location of nearest shelter points, carry emergency whistle, download offline weather app, inform someone of your plans, be prepared to turn back if conditions worsen.',
      metadata: { category: 'safety', subcategory: 'weather', priority: 'high' }
    },
    
    // Emergency & Support
    {
      id: 'base-emergency-contacts',
      type: 'policy' as const,
      title: 'Emergency Contacts and Support',
      content: 'TrekTribe emergency contacts: 24/7 Support Helpline: +91-XXXXX-XXXXX (call/WhatsApp), Email: support@trektribe.com (response within 2 hours), Emergency Email: emergency@trektribe.com (immediate response). For medical emergencies during trek: Contact your trek leader/guide immediately, National Emergency: 112, Ambulance: 102. For Himalayan regions: Contact nearest District Hospital or Primary Health Center. Tourist Police: 1363. Always inform your emergency contact person and TrekTribe support if you face any issues during the trip.',
      metadata: { category: 'support', priority: 'critical' }
    },
    {
      id: 'base-lost-separated',
      type: 'general' as const,
      title: 'What to Do If Lost or Separated',
      content: 'If separated from group: STAY CALM and STAY PUT - do not wander further. Blow emergency whistle in sets of 3 (international distress signal). Mark your location with bright clothing or reflective items. Call trek leader immediately if phone signal available. Conserve phone battery (use airplane mode, check periodically for signal). Find shelter if weather deteriorating. Stay warm and hydrated. Make yourself visible and audible. If must move: follow trail downhill/downstream, mark path with stones/sticks, leave notes at junctions. Never trek at night unless absolutely necessary. Search parties follow standard patterns - staying visible is crucial. Always carry: whistle, emergency contact card, basic first aid, energy food, water, warm layer.',
      metadata: { category: 'safety', subcategory: 'emergency', priority: 'high' }
    },
    
    // Documents & Requirements
    {
      id: 'base-documents-required',
      type: 'policy' as const,
      title: 'Required Documents for Trips',
      content: 'Documents required for TrekTribe trips: Government-issued photo ID (Aadhaar, Passport, Driving License, Voter ID), Medical fitness certificate for high-altitude treks (above 4000m), Travel insurance (recommended for all trips, mandatory for international), Permits (organized by trip organizer - inform them of ID details in advance), Emergency contact details, Blood group and allergy information. For international trips: Valid passport with 6 months validity, Appropriate visa, Travel insurance with medical evacuation coverage. Keep photocopies and digital copies in cloud storage.',
      metadata: { category: 'requirements', priority: 'high' }
    },
    {
      id: 'base-permits',
      type: 'policy' as const,
      title: 'Permits and Permissions',
      content: 'Trek permits and permissions: Protected areas (National Parks, Wildlife Sanctuaries) require permits obtained by organizer. Inner Line Permit (ILP) needed for: Arunachal Pradesh, Mizoram, Nagaland (Indians need ILP, foreigners need Protected Area Permit). Restricted Area Permit (RAP) for certain border areas. Provide clear photo ID copy to organizer 15 days before trek. Foreign nationals need special permits for many Himalayan regions - inform organizer at booking. Some areas have daily entry limits - book early. Permit costs usually included in trip price. Carry original ID and permit copy during trek. Violations can result in fines or trip cancellation with no refund.',
      metadata: { category: 'requirements', subcategory: 'permits', priority: 'medium' }
    },
    
    // Fitness & Preparation
    {
      id: 'base-fitness-requirements',
      type: 'general' as const,
      title: 'Fitness Requirements and Preparation',
      content: 'Fitness preparation for treks: Easy/Beginner treks: Basic fitness, ability to walk 4-6 km daily. Moderate treks: Regular walking/jogging, ability to walk 6-8 km with 5-7 kg backpack. Challenging treks: Good cardiovascular fitness, strength training, ability to walk 8-12 km with 8-10 kg backpack. Preparation timeline: Start 4-6 weeks before trek. Daily activities: 30-45 min cardio (running, cycling, swimming), Leg strengthening (squats, lunges, calf raises), Core exercises (planks, crunches), Practice hiking with loaded backpack on weekends. For high altitude: include breathing exercises. Age considerations: Most treks suitable for 12-60 years with good fitness. Consult doctor if you have heart conditions, respiratory issues, or chronic illnesses.',
      metadata: { category: 'preparation', priority: 'medium' }
    },
    {
      id: 'base-training-tips',
      type: 'general' as const,
      title: 'Trek Training and Conditioning',
      content: 'Training schedule for trekking: 6-8 weeks before: Start with 30-min walks, increase by 10% weekly, Add stair climbing. 4 weeks before: Extend to 60-min sessions with weighted backpack (5kg), Include hill climbing twice weekly, Cross-training (cycling, swimming). 2 weeks before: Peak training with 8-10km walks, Full trek weight in backpack, Practice on uneven terrain. Week before: Taper training, light walks only, Stretch and rest. Additional tips: Stay hydrated during training, Practice with actual trek boots, Mental preparation - visualize success, Yoga for flexibility and breathing, Good sleep crucial for recovery. Medical check: If over 50 or have health conditions, get medical clearance.',
      metadata: { category: 'preparation', subcategory: 'training', priority: 'medium' }
    },
    
    // Destinations & Seasons
    {
      id: 'base-best-seasons',
      type: 'general' as const,
      title: 'Best Seasons for Trekking',
      content: 'Best trekking seasons in India: Spring (March-May): Pleasant weather, blooming rhododendrons, clear mountain views, ideal for Himachal, Uttarakhand, Sikkim. Summer (June-August): Monsoon season - avoid most treks, good for Ladakh, Spiti, Zanskar (rain shadow areas). Autumn (September-November): Best season overall, post-monsoon clear skies, stable weather, perfect for all regions. Winter (December-February): Snow treks, extreme cold, limited to lower altitudes, good for: Kedarkantha, Brahmatal, Kuari Pass. Regional variations: Kerala/South India - October to February, Northeast - October to April, Ladakh/Spiti - June to September, Kashmir - May to September. Always check local conditions and organizer recommendations.',
      metadata: { category: 'planning', subcategory: 'seasons', priority: 'medium' }
    },
    {
      id: 'base-himachal-treks',
      type: 'general' as const,
      title: 'Popular Himachal Pradesh Treks',
      content: 'Top Himachal treks: Beginner-friendly: Triund (2900m, 2 days), Kheerganga (2960m, 2 days), Prashar Lake (2730m, 2 days). Moderate: Hampta Pass (4270m, 5 days), Bhrigu Lake (4250m, 3 days), Chandrakhani Pass (3660m, 2 days). Challenging: Pin Parvati Pass (5319m, 10 days), Bara Bhangal Trek (4800m, 8 days). Best time: May-June and September-October. Regions: Manali (Hampta, Bhrigu, Beas Kund), Dharamshala (Triund, Indrahar Pass), Spiti (Pin Parvati, Spiti Valley circuit). Access: Manali, Dharamshala, and Shimla are main starting points with good bus and flight connectivity.',
      metadata: { category: 'destinations', region: 'himachal', priority: 'high' }
    },
    {
      id: 'base-uttarakhand-treks',
      type: 'general' as const,
      title: 'Popular Uttarakhand Treks',
      content: 'Top Uttarakhand treks: Beginner: Dayara Bugyal (3750m, 4 days), Deoriatal-Chandrashila (4000m, 4 days), Nag Tibba (3022m, 2 days). Moderate: Kedarkantha (3850m, 5 days), Har ki Dun (3566m, 7 days), Brahmatal (3734m, 6 days). Challenging: Roopkund (5029m, 8 days), Valley of Flowers with Hemkund (4632m, 6 days), Auden Col (5490m, 12 days). Religious treks: Char Dham Yatra, Tungnath-Chandrashila. Best time: May-June and September-October (snow treks: December-March). Access: Rishikesh, Dehradun are main hubs. Most treks start from remote villages accessible by local transport.',
      metadata: { category: 'destinations', region: 'uttarakhand', priority: 'high' }
    },
    {
      id: 'base-ladakh-treks',
      type: 'general' as const,
      title: 'Popular Ladakh Treks',
      content: 'Top Ladakh treks: Moderate: Markha Valley (5200m, 7 days), Sham Valley (3720m, 4 days), Likir to Temisgam (3750m, 3 days). Challenging: Chadar Trek - frozen Zanskar river (3350m, 8 days, January-February only), Stok Kangri (6153m, 9 days, requires mountaineering skills). Features: High altitude desert, ancient monasteries, unique culture. Best time: June to mid-September (Chadar: late January to mid-February). Important: Minimum 2-3 days acclimatization in Leh required before any trek. Altitude consideration: All treks start above 3000m. Access: Fly to Leh or drive from Manali (2 days). Permits: Some areas need permits arranged by organizer.',
      metadata: { category: 'destinations', region: 'ladakh', priority: 'high' }
    },
    {
      id: 'base-kashmir-treks',
      type: 'general' as const,
      title: 'Popular Kashmir Treks',
      content: 'Top Kashmir treks: Beginner: Tarsar Marsar (3800m, 7 days), Gangabal Lake (3570m, 5 days). Moderate: Kashmir Great Lakes (4200m, 8 days - one of India most beautiful), Vishansar Lake (3710m, 4 days). Challenging: Warwan Valley (4200m, 9 days). Features: Alpine meadows, pristine lakes, flower-filled valleys, pine forests. Best time: July to mid-September. Highlights: Kashmir Great Lakes passes through 7 alpine lakes. Access: Srinagar is the base for most treks. Local transport to trek starting points. Current status: Check current situation and advisories before planning. Permits: Easy to obtain through organizers.',
      metadata: { category: 'destinations', region: 'kashmir', priority: 'medium' }
    },
    {
      id: 'base-sikkim-treks',
      type: 'general' as const,
      title: 'Popular Sikkim Treks',
      content: 'Top Sikkim treks: Beginner: Dzongri Trek (4020m, 6 days), Sandakphu-Phalut (3600m, 6 days). Moderate: Goecha La (4940m, 10 days - close-up views of Kanchenjunga). Challenging: Green Lake (5000m, 14 days), Singalila Ridge. Features: Kanchenjunga views, rhododendron forests, Buddhist monasteries, diverse flora and fauna. Best time: March-May (rhododendrons bloom), September-November. Special: Permits mandatory for all treks, arranged by registered organizers. Access: Bagdogra airport or NJP railway station, then drive to trek start points. Goecha La restricted - limited permits daily. International border area - no foreigners beyond certain points.',
      metadata: { category: 'destinations', region: 'sikkim', priority: 'medium' }
    },
    
    // Travel Tips
    {
      id: 'base-budget-tips',
      type: 'general' as const,
      title: 'Budget Travel Tips for Treks',
      content: 'Budget trekking tips: Off-season discounts: Travel during shoulder season (early spring or late autumn) for 20-30% savings. Group bookings: Form groups of 6+ for automatic discounts. Book early: Early bird discounts up to 15% for bookings 2+ months ahead. Shared transport: Share taxis from base towns with other trekkers. Local stays: Stay in homestays instead of hotels (₹500-800 vs ₹2000-3000). Food: Carry dry snacks, energy bars from home, eat at local dhabas (₹150-250 per meal). Gear rental: Rent expensive gear (sleeping bags, jackets, shoes) instead of buying (₹200-500 per item per trek). Compare: Check multiple organizers, read reviews on TrekTribe. Inclusions: Verify what included - permits, meals, guides, transport. Hidden costs: Ask about tips, porter charges, emergency evacuation insurance.',
      metadata: { category: 'planning', subcategory: 'budget', priority: 'medium' }
    },
    {
      id: 'base-photography-tips',
      type: 'general' as const,
      title: 'Trek Photography Tips',
      content: 'Photography tips for treks: Equipment: Lightweight mirrorless camera or good smartphone, Extra batteries and SD cards, Power bank (10000mAh+), Lightweight tripod or gorilla pod, Lens cloth and zip-lock bags for protection. Best times: Golden hour (sunrise/sunset) for warm light, Blue hour (post-sunset) for dramatic skies, Overcast days for even lighting. Composition: Rule of thirds, Leading lines with trails, Frame mountains with foreground elements, Capture local culture respectfully (ask permission). Smartphone tips: Clean lens regularly, Use HDR for high contrast, Portrait mode for subjects, Panorama for landscapes, Avoid digital zoom. Protection: Keep gear in dry bags, Carry in front pack for quick access, Let camera adjust to temperature before use (prevent condensation). Respect: No flash near wildlife, Ask before photographing people, No drones in restricted areas.',
      metadata: { category: 'general', subcategory: 'photography', priority: 'low' }
    },
    {
      id: 'base-local-culture',
      type: 'general' as const,
      title: 'Respecting Local Culture and Environment',
      content: 'Cultural sensitivity and environmental responsibility: Respect local customs: Remove shoes before entering temples/monasteries, Ask permission before photography, Dress modestly in religious places and villages, Greet locals respectfully (Namaste, Julley in Ladakh, Khurumari in Sikkim). Environmental ethics: Carry back all waste - leave no trace, Use designated toilet spots or bury waste 6 inches deep away from water, Avoid plastic bottles - use reusable, Do not pick flowers or disturb wildlife, Stay on marked trails - prevent erosion, No loud music - preserve tranquility. Support local: Buy from local shops and homestays, Hire local guides and porters - boosts local economy, Learn few local words - shows respect. Monastery etiquette: Walk clockwise around stupas, Do not touch religious artifacts, Maintain silence, No pointing feet toward Buddha statues, Small donation appreciated.',
      metadata: { category: 'general', subcategory: 'culture', priority: 'medium' }
    },
    {
      id: 'base-trekking-etiquette',
      type: 'general' as const,
      title: 'Trekking Trail Etiquette',
      content: 'Trail etiquette for trekkers: Right of way: Uphill trekkers have right of way, Step aside on wider side of trail, Pack animals (mules, horses) always have priority. Group behavior: Stay together, inform leader if leaving group, Wait at junctions, Help fellow trekkers in difficulty, Share trail info with others. Camping etiquette: Keep noise low especially early morning/late evening, Respect campsite boundaries, Clean up before leaving, Do not damage trees for firewood. Pace: Trek at sustainable pace - slow and steady, Take breaks every hour, Stay hydrated, Listen to your body. Communication: Carry whistle for emergencies, Keep phone in airplane mode (save battery), Check in at checkpoints, Inform changes in plans. Trail sharing: Greet fellow trekkers, Share weather and trail condition info, Help if someone in distress, Respect private property.',
      metadata: { category: 'general', subcategory: 'etiquette', priority: 'medium' }
    },
    
    // Common Questions
    {
      id: 'base-toilet-hygiene',
      type: 'faq' as const,
      title: 'Toilet and Hygiene on Treks',
      content: 'Toilet facilities on treks: Campsites: Usually have basic toilet tents - carry toilet paper. On trail: Use natural spots away from water sources (min 60 meters), dig 6-inch hole, bury waste completely, carry used toilet paper in zip-lock. Essentials to carry: Toilet paper in zip-lock, Hand sanitizer, Wet wipes, Trowel or small shovel, Pee cloth for women (quick-dry fabric). Hygiene tips: Wash hands thoroughly with soap, Use sanitizer frequently, Avoid touching face with dirty hands, Keep personal items clean. Women-specific: Period on trek is manageable, carry extra supplies in waterproof bags, use menstrual cup (better than pads), dispose pads properly (carry back), pain medication if needed. Dignity: Trek groups respect privacy needs, inform leader about comfort concerns.',
      metadata: { category: 'faq', subcategory: 'hygiene', priority: 'medium' }
    },
    {
      id: 'base-mobile-network',
      type: 'faq' as const,
      title: 'Mobile Network and Communication',
      content: 'Mobile connectivity on treks: Base towns: Good 4G coverage in Manali, Rishikesh, Leh, Srinagar. On trek: Limited or no network on most trails, Last connectivity point usually at trek start village. Network coverage: Himachal: BSNL, Airtel work better, Uttarakhand: BSNL most reliable, Ladakh: BSNL, Jio, Airtel have coverage in Leh, Kashmir: Postpaid connections work better. Tips: Get BSNL postpaid if frequent trekker, Inform family about no-network periods, Download offline maps, Carry power bank (20000mAh for long treks), Keep phone in airplane mode to save battery. Emergency: Satellite phones with some organizers for emergencies, Trek leaders have communication devices, Emergency evacuation protocols in place. Pre-inform: Share trek itinerary, expected no-contact days, alternative contact (trek organizer number).',
      metadata: { category: 'faq', subcategory: 'communication', priority: 'medium' }
    },
    {
      id: 'base-food-trek',
      type: 'faq' as const,
      title: 'Food and Meals on Treks',
      content: 'Trek food and nutrition: Typical meals: Breakfast: Oats, parathas, bread-jam, tea/coffee. Lunch: Packed meal (parathas, boiled eggs, fruits, energy bars). Dinner: Rice, dal, sabzi, chapati (warm meal at campsite). Snacks: Tea and biscuits at stops. Dietary needs: Inform organizer about: vegetarian/vegan, Jain, allergies, food restrictions. Most treks cater to Indian vegetarian food well. Hygiene: Food prepared fresh at campsites, Boiled/filtered water, Avoid raw vegetables at high altitude. Carry personal: Energy bars, dry fruits, chocolate, ORS sachets, favorite snacks. Stay nourished: Eat even if not hungry (body needs energy), High-calorie foods at altitude, Hot fluids help acclimatization, No alcohol (dehydrates and affects acclimatization). Special diets: Inform at booking, Trek food is generally simple - carry supplements if on specialized diet.',
      metadata: { category: 'faq', subcategory: 'food', priority: 'medium' }
    },
    {
      id: 'base-solo-travel',
      type: 'faq' as const,
      title: 'Solo Traveler Information',
      content: 'Solo trekking on TrekTribe: Welcome: Solo travelers welcomed on all group treks, You will trek with a group - never alone. Benefits: Meet like-minded people, No dependency on friends schedules, Flexibility in choosing trips, Often make lifelong friends. Costs: Some organizers charge single-tent supplement (10-20% extra), Many allow tent sharing with same-gender trekker (no extra cost), Mention willingness to share in booking. Safety: Trek with certified guides, Group safety protocols followed, Emergency support available. Solo female: Many solo women trek regularly, Women-only groups available for some treks, Female trek leaders available. Tips: Join TrekTribe community to find trek buddies, Read reviews, choose reputed organizers, Inform family about trek details, Keep emergency contacts handy. Age: No age bar if fit, Groups usually have mixed ages (20s-50s).',
      metadata: { category: 'faq', audience: 'solo', priority: 'high' }
    },
    {
      id: 'base-insurance',
      type: 'policy' as const,
      title: 'Travel Insurance for Treks',
      content: 'Trek insurance importance and options: Why needed: Medical emergencies at high altitude, Emergency evacuation costs (₹2-5 lakhs), Trip cancellations, Lost baggage. What it covers: Medical treatment, Emergency helicopter evacuation, Trip cancellation/interruption, Lost/stolen baggage, Adventure activities coverage. Providers in India: ICICI Lombard, Bajaj Allianz, HDFC Ergo, Religare. International: World Nomads (covers adventure activities). Cost: ₹500-2000 for domestic trek, ₹3000-8000 for international. Key points: Check adventure activities coverage, Verify altitude limit (some exclude above 6000m), Read exclusions carefully, Keep policy copy and emergency numbers, Inform organizer if insured. TrekTribe recommendation: Highly recommended for all treks, Mandatory for international and high-altitude treks, Consider annual policy if frequent trekker.',
      metadata: { category: 'requirements', subcategory: 'insurance', priority: 'high' }
    },
    {
      id: 'base-children-treks',
      type: 'faq' as const,
      title: 'Trekking with Children',
      content: 'Family treks with kids: Age guidelines: 8+ years for easy treks (Triund, Kheerganga), 12+ years for moderate treks, 16+ for challenging high-altitude treks. Kid-friendly treks: Short duration (2-3 days), Lower altitude (below 3500m), Well-marked trails, Examples: Triund, Prashar Lake, Nag Tibba base camp. Preparation: Build stamina through regular walks, Practice with day hikes, Get medical check-up, Ensure vaccinations updated. Packing for kids: Layers of warm clothing, Extra snacks they like, Comfortable broken-in shoes, Personal medication, Entertainment (books, cards), Own water bottle and daypack. Tips: Trek during school holidays, Start early each day (kids tire by afternoon), Take frequent breaks, Keep them engaged - nature games, Carry favorite comfort food, Do not push too hard. Safety: Child should be comfortable with long walks, Parent must accompany, Inform organizer about child in group, Extra supervision required.',
      metadata: { category: 'faq', audience: 'families', priority: 'medium' }
    }
  ];

  constructor() {
    this.transformerService = TransformerEmbeddingService.getInstance();
  }

  async initialize() {
    if (this.isInitialized) return;
    
    console.log('🚀 Initializing Knowledge Base...');
    
    // Initialize transformer model first
    await this.transformerService.initialize();
    console.log('✅ Transformer embeddings service initialized');
    
    // Load base knowledge + extended knowledge
    this.documents = [...this.BASE_KNOWLEDGE, ...EXTENDED_KNOWLEDGE];
    
    // Fetch and index live data
    await this.refreshKnowledgeBase();
    
    // Start periodic refresh (every 2 hours)
    this.startPeriodicRefresh(2 * 60 * 60 * 1000);
    
    this.isInitialized = true;
    console.log('✅ Knowledge Base initialized with', this.documents.length, 'documents');
  }

  async refreshKnowledgeBase() {
    try {
      console.log('🔄 Refreshing knowledge base...');
      
      // Fetch trips
      const trips = await dataFetcherService.fetchAllTrips();
      const tripDocs: KnowledgeDocument[] = trips.map(trip => ({
        id: `trip-${trip.id}`,
        type: 'trip' as const,
        title: trip.title,
        content: this.formatTripContent(trip),
        metadata: {
          tripId: trip.id,
          destination: trip.destination,
          categories: trip.categories,
          price: trip.price,
          duration: trip.duration_days,
          startDate: trip.startDate,
          endDate: trip.endDate,
          organizer: trip.organizer
        }
      }));

      // Fetch organizers
      const organizers = await dataFetcherService.fetchAllOrganizers();
      const organizerDocs: KnowledgeDocument[] = organizers.map(org => ({
        id: `organizer-${org.id}`,
        type: 'organizer' as const,
        title: org.name,
        content: this.formatOrganizerContent(org),
        metadata: {
          organizerId: org.id,
          email: org.email,
          location: org.location,
          specialties: org.specialties
        }
      }));

      // Combine base knowledge with live data
      this.documents = [
        ...this.BASE_KNOWLEDGE,
        ...tripDocs,
        ...organizerDocs
      ];

      // Generate embeddings for all documents
      await this.generateEmbeddings();
      
      console.log(`✅ Knowledge base refreshed: ${this.documents.length} documents (${tripDocs.length} trips, ${organizerDocs.length} organizers, ${this.BASE_KNOWLEDGE.length} base docs)`);
    } catch (error: any) {
      console.error('❌ Error refreshing knowledge base:', error.message);
    }
  }

  private formatTripContent(trip: any): string {
    const parts = [
      `Trip: ${trip.title}`,
      `Destination: ${trip.destination}`,
      `Description: ${trip.description}`,
      `Categories: ${trip.categories.join(', ')}`,
      `Price: ₹${trip.price}`,
      trip.duration_days ? `Duration: ${trip.duration_days} days` : '',
      `Capacity: ${trip.capacity} people`,
      trip.schedule && trip.schedule.length > 0 ? `Itinerary: ${trip.schedule.map((s: any) => `Day ${s.day}: ${s.title}`).join('; ')}` : '',
      trip.paymentConfig ? `Payment: ${trip.paymentConfig.paymentType} payment via ${trip.paymentConfig.paymentMethods.join('/')}` : '',
      trip.paymentConfig?.refundPolicy ? `Refund Policy: ${trip.paymentConfig.refundPolicy}` : '',
      trip.organizer ? `Organizer: ${trip.organizer.name} (${trip.organizer.email})` : ''
    ];
    
    return parts.filter(Boolean).join('. ');
  }

  private formatOrganizerContent(org: any): string {
    const parts = [
      `Organizer: ${org.name}`,
      org.location ? `Location: ${org.location}` : '',
      org.bio ? `Bio: ${org.bio}` : '',
      org.specialties && org.specialties.length > 0 ? `Specialties: ${org.specialties.join(', ')}` : '',
      `Contact: ${org.contactEmail || org.email}`
    ];
    
    return parts.filter(Boolean).join('. ');
  }

  private async generateEmbeddings() {
    console.log('🔄 Generating embeddings using transformer model...');
    
    // Use batch embeddings for better performance
    try {
      const texts = this.documents.map(doc => doc.content);
      const embeddings = await this.transformerService.generateBatchEmbeddings(texts);
      
      this.embeddings = this.documents.map((doc, idx) => ({
        id: doc.id,
        embedding: embeddings[idx]
      }));
      
      console.log(`✅ Generated ${this.embeddings.length} transformer-based embeddings`);
    } catch (error) {
      console.error('Error generating batch embeddings:', error);
      throw error;
    }
    
    console.log(`✅ Generated ${this.embeddings.length} embeddings`);
  }

  async search(query: string, topK: number = 5, type?: string): Promise<SearchResult[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // Generate query embedding using transformer
      const queryEmbedding = await this.transformerService.generateEmbedding(query);
      
      // Calculate similarities
      const similarities = this.embeddings.map(({ id, embedding }) => ({
        id,
        similarity: this.cosineSimilarity(queryEmbedding, embedding)
      }));

      // Sort by similarity
      similarities.sort((a, b) => b.similarity - a.similarity);

      // Get top K results
      const topResults = similarities.slice(0, topK);

      // Map to documents with similarity scores
      const results: SearchResult[] = topResults
        .map(({ id, similarity }) => {
          const document = this.documents.find(d => d.id === id);
          return document ? { document, similarity } : null;
        })
        .filter((r): r is SearchResult => r !== null);

      // Filter by type if specified
      if (type) {
        return results.filter(r => r.document.type === type);
      }

      return results;
    } catch (error: any) {
      console.error('Error searching knowledge base:', error.message);
      return [];
    }
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, val, i) => sum + val * (b[i] || 0), 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    
    if (magnitudeA === 0 || magnitudeB === 0) return 0;
    return dotProduct / (magnitudeA * magnitudeB);
  }

  private startPeriodicRefresh(intervalMs: number) {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }

    this.refreshInterval = setInterval(() => {
      console.log('⏰ Periodic knowledge base refresh triggered');
      this.refreshKnowledgeBase();
    }, intervalMs);
  }

  getStats() {
    return {
      totalDocuments: this.documents.length,
      documentsByType: {
        trip: this.documents.filter(d => d.type === 'trip').length,
        organizer: this.documents.filter(d => d.type === 'organizer').length,
        faq: this.documents.filter(d => d.type === 'faq').length,
        policy: this.documents.filter(d => d.type === 'policy').length,
        general: this.documents.filter(d => d.type === 'general').length
      },
      totalEmbeddings: this.embeddings.length,
      isInitialized: this.isInitialized,
      lastRefresh: dataFetcherService.getLastFetchTime()
    };
  }

  async shutdown() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
    console.log('🛑 Knowledge Base service shut down');
  }
}

// Singleton instance
export const knowledgeBaseService = new KnowledgeBaseService();
