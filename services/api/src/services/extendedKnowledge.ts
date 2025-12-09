// Extended knowledge base with more categories and sample prompts
export const EXTENDED_KNOWLEDGE = [
  // Transportation & Logistics
  {
    id: 'ext-transport-options',
    type: 'general' as const,
    title: 'Transportation Options to Trek Locations',
    content: 'Getting to trek starting points: By Air: Major airports - Delhi (for Himachal/Uttarakhand), Bagdogra (Sikkim), Leh (Ladakh), Srinagar (Kashmir). By Train: Nearest stations - Kathgodam/Haldwani (Uttarakhand), Joginder Nagar/Pathankot (Himachal). New Jalpaiguri (Sikkim). By Bus: State transport and private buses from Delhi, Chandigarh to hill stations. Shared taxis: Available from all base towns to trek villages (₹300-800 per person). Private taxi: ₹2500-5000 for Manali-trek start. Last mile: Local jeeps or walking from road head. Book transport: Through organizer for convenience, recommended for groups. Travel time: Add 1-2 days buffer for delays in hills. Sample prompt: "How do I reach Manali from Delhi?"',
    metadata: { category: 'transport', priority: 'high', samplePrompts: ['How to reach Himachal treks?', 'Transport from Delhi to Manali', 'Getting to Leh from Delhi'] }
  },
  {
    id: 'ext-accommodation',
    type: 'general' as const,
    title: 'Accommodation Options',
    content: 'Where to stay before/after treks: Budget (₹500-1000): Hostels, dormitories, basic guesthouses, shared bathrooms. Mid-range (₹1500-3000): Private rooms in guesthouses, hotels with attached bath, hot water. Homestays (₹800-1500): Stay with local families, authentic experience, home-cooked meals, cultural immersion. Luxury (₹5000+): Premium hotels, resorts in base towns. Trek accommodation: Tents/camping (included in package), Basic lodges on some popular routes, Sleeping bag provided or rentable. Pre-book: Accommodation in peak season (May-June, Sept-Oct), Last minute bookings risky, may not get preferred options. Popular areas: Manali: Old Manali for backpacker vibe, Rishikesh: Laxman Jhula/Ram Jhula areas, Leh: Near main bazaar. Sample prompt: "Where should I stay in Manali before my trek?"',
    metadata: { category: 'accommodation', priority: 'medium', samplePrompts: ['Hotels in Manali', 'Cheap accommodation for trekkers', 'Homestays in Himachal'] }
  },

  // Weather & Conditions
  {
    id: 'ext-weather-forecast',
    type: 'general' as const,
    title: 'Weather Conditions and Forecast Tips',
    content: 'Understanding Himalayan weather: Unpredictable: Mountains create own weather systems, can change within hours. Temperature ranges: Base (2000m): 15-25°C day, 5-15°C night. Mid (3000-4000m): 5-15°C day, -5 to 5°C night. High (4000m+): -5 to 10°C day, -10 to -20°C night. Seasons: Pre-monsoon (April-May): Clear, gradually warming, occasional showers. Monsoon (June-Aug): Heavy rain in lower Himalayas, dry in Ladakh/Spiti. Post-monsoon (Sept-Nov): Best weather, clear skies, stable temperatures. Winter (Dec-March): Snow, extreme cold, limited accessibility. Weather apps: Windy.com (most accurate for mountains), Mountain-Forecast.com (altitude-specific), Local apps: Mausam (IMD official). Check: 7-day forecast before departure, Daily updates during trek, Organizer for ground reality. Risks: Unexpected snow can close passes, Landslides during monsoon, Flash floods in valleys. Sample prompt: "What\'s the weather like in Ladakh in July?"',
    metadata: { category: 'weather', priority: 'high', samplePrompts: ['Weather in Himachal in October', 'Best weather app for trekking', 'When does it snow in Himalayas'] }
  },
  {
    id: 'ext-monsoon-precautions',
    type: 'general' as const,
    title: 'Monsoon Trekking Precautions',
    content: 'Trekking during monsoon (June-August): Avoid if possible: Most Himalayan treks closed, landslide risk, leeches, limited visibility. Safe zones: Ladakh, Spiti, Zanskar (rain shadow), Pin Parvati, Rupin Pass (if weather permits). Extra precautions: Waterproof everything, Extra socks (feet stay wet), Leech-proof socks/repellent, Quick-dry clothes only, Emergency shelter, Check road status daily. Leeches: Salt/tobacco powder deters them, Don\'t pull forcefully (leaves mouth parts), Clean wound with antiseptic, They\'re not dangerous, just annoying. Landslides: Never camp near slopes, Start early (slides common in afternoon after heating), Have alternate routes planned. Rivers: Unbridged crossings dangerous after rain, Cross early morning (lowest water), Use rope for group crossing. Decision making: Turn back if unsafe, No shame in aborting, Rescues difficult in monsoon. Sample prompt: "Is it safe to trek in monsoon?"',
    metadata: { category: 'weather', subcategory: 'monsoon', priority: 'high', samplePrompts: ['Monsoon trekking safety', 'Leeches on treks', 'Rain gear for trekking'] }
  },

  // Gear & Equipment
  {
    id: 'ext-gear-buying-guide',
    type: 'general' as const,
    title: 'Trekking Gear Buying Guide',
    content: 'Essential gear to buy vs rent: Buy (₹10,000-20,000 total): Good trekking shoes (₹3000-6000), Trekking backpack 50-60L (₹2000-5000), Daypack 20-25L (₹1000-2000), Trekking pants (₹1500-3000), Trek poles (₹1000-2500). Rent (₹200-500 per item per trek): Sleeping bag, Down jacket, Tent (usually provided). Budget brands: Decathlon (best value for money), Quechua, Wildcraft, Forclaz. Premium: The North Face, Columbia, Mammut, Patagonia. Shoes: Most important investment, Break in before trek (at least 2 weeks), Waterproof + ankle support, Visit store for fitting. Backpack: Hip belt for weight distribution, Rain cover included, Try with weight before buying. When to upgrade: After 3-4 treks, invest in quality gear, Buy during sale seasons (₹2000-5000 savings). Gear check: Test everything before trip, Clean and dry after each use, Store properly to extend life. Sample prompt: "What trekking gear should I buy?"',
    metadata: { category: 'gear', priority: 'high', samplePrompts: ['Best trekking shoes under 5000', 'Decathlon gear for trekking', 'Buy vs rent trekking equipment'] }
  },
  {
    id: 'ext-gear-rental',
    type: 'general' as const,
    title: 'Gear Rental Options',
    content: 'Renting trekking equipment: Where: Base towns (Manali, Rishikesh, Leh), Trek organizers (often included), Online rental services. Cost: Sleeping bag: ₹300-600 per trek, Down jacket: ₹400-700, Tent: ₹300-500, Trek poles: ₹150-300, Crampons/ice axe: ₹200-400. Quality check: Inspect before paying, Check zippers, tears, cleanliness, Test sleeping bag warmth rating. Deposit: Usually ₹2000-5000 refundable, Return in same condition, Photo/video at pickup recommended. Included in package: Most organizers provide tents, sleeping mats, Some provide sleeping bags (verify), Kitchen equipment always provided. Personal items: Never rent: shoes, socks, inner clothes, Better to buy: trekking pants, base layers, Shareable in group: First aid, repair kit. Advance booking: Peak season (May-June, Sept-Oct), Group bookings need advance notice, Check cancellation policy. Sample prompt: "Where can I rent trekking gear in Manali?"',
    metadata: { category: 'gear', subcategory: 'rental', priority: 'medium', samplePrompts: ['Sleeping bag rental in Rishikesh', 'Gear rental costs', 'Do I need to bring my own tent'] }
  },

  // Medical & Health
  {
    id: 'ext-vaccinations',
    type: 'general' as const,
    title: 'Vaccinations and Medical Preparation',
    content: 'Recommended vaccinations for trekking: Routine: Ensure up-to-date: Tetanus (booster every 10 years), Hepatitis A & B (food/water borne), Typhoid (valid 3 years). Regional: Rabies (if dog/monkey prone areas), Japanese Encephalitis (Northeast monsoon season). Not usually required: Yellow fever, Malaria prophylaxis (rare in high altitude). When: Get 4-6 weeks before trek, Some need multiple doses. Medical check-up: Especially if: Over 50 years, Heart/lung conditions, Diabetes, High blood pressure. Tests: ECG, Chest X-ray (if required by organizer), Blood pressure check. Prescriptions: Get medicines prescribed, Carry in original packaging, Doctor\'s note for international, Extra doses for emergency. Dental: Fix issues before trek (toothache at altitude is terrible). Vision: Carry extra contact lenses/glasses, Prescription sunglasses recommended. Sample prompt: "Do I need any vaccinations for trekking?"',
    metadata: { category: 'health', subcategory: 'medical', priority: 'medium', samplePrompts: ['Vaccinations for Himalayan trek', 'Medical check-up before trek', 'Can diabetics go on treks'] }
  },
  {
    id: 'ext-common-ailments',
    type: 'general' as const,
    title: 'Common Trek Ailments and Treatment',
    content: 'Common health issues on treks and solutions: Blisters: Prevention: Well-fitted boots, moisture-wicking socks, tape hotspots. Treatment: Don\'t pop if possible, if needed: sterilize needle, drain, antiseptic, moleskin. Dehydration: Symptoms: Dark urine, headache, fatigue, dizziness. Solution: Drink 3-4L water daily, ORS sachets, Avoid caffeine/alcohol. Digestive issues: Diarrhea common (new water/food), Carry Imodium, ORS, Avoid raw vegetables, Drink only boiled/purified water. Sunburn: Intense at altitude (thinner atmosphere), High SPF 50+ sunscreen, Reapply every 2 hours, Lip balm essential. Muscle soreness: Normal first 2 days, Stretch morning and evening, Massage sore areas, Pain relief if needed. Breathlessness: Walk slow and steady, Inhale deep through nose, Exhale through mouth, Stop if chest pain. Cold/flu: Common in groups, Carry own utensils, Wash hands frequently, Isolate if possible, Basic cold medicines. Sample prompt: "How to treat blisters while trekking?"',
    metadata: { category: 'health', subcategory: 'ailments', priority: 'high', samplePrompts: ['Blister treatment on trek', 'Stomach problems while trekking', 'Sunburn at high altitude'] }
  },

  // Cultural Experiences
  {
    id: 'ext-local-festivals',
    type: 'general' as const,
    title: 'Local Festivals and Cultural Events',
    content: 'Experiencing local culture during treks: Himachal festivals: Kullu Dussehra (October) - 7-day celebration, Losar (Feb-March) - Tibetan New Year in Spiti/Kinnaur, Minjar Fair (July-Aug) in Chamba. Uttarakhand: Nanda Devi Raj Jat (every 12 years, next 2032), Kumbh Mela (Haridwar), Holi (March) - special in hill towns. Ladakh: Hemis Festival (June-July) - masked dances, Ladakh Festival (September) - cultural showcase, Losar (December) - Ladakhi New Year. Sikkim: Losoong (December) - harvest festival, Saga Dawa (May-June) - Buddha\'s birthday, Bumchu (Feb-March) - sacred water ceremony. Benefits: Trek during festivals for cultural immersion, Book early (accommodation scarce), Expect crowds at popular sites. Etiquette: Ask before photographing ceremonies, Remove shoes at religious sites, Dress modestly, Small donations appreciated. Homestay during festivals: Best way to experience, Families include you in celebrations, Learn traditional cooking, dances. Sample prompt: "What festivals can I experience while trekking?"',
    metadata: { category: 'culture', subcategory: 'festivals', priority: 'low', samplePrompts: ['Festivals in Himachal', 'Hemis festival dates', 'Cultural events in Ladakh'] }
  },
  {
    id: 'ext-local-cuisine',
    type: 'general' as const,
    title: 'Local Cuisine to Try',
    content: 'Must-try local foods in trekking regions: Himachal: Siddu (steamed bread), Chha Ghost (marinated lamb), Aktori (cake made from buckwheat), Thukpa (noodle soup). Uttarakhand: Kafuli (spinach curry), Chainsoo (black gram dish), Bhatt ki Churkani (black bean), Singodi (sweet in malu leaf). Ladakh: Momos (dumplings), Thukpa, Skyu (pasta-vegetable stew), Butter tea, Tingmo (steamed bread), Khambir (local bread). Sikkim: Gundruk (fermented leafy greens), Kinema (fermented soy), Sha Phaley (meat pastry), Chhurpi (hard cheese). Where to eat: Homestays: Most authentic, Local dhabas: Inexpensive, filling, Base town restaurants: Variety but may lack authenticity. Food safety: Prefer fresh cooked items, Avoid raw salads in remote areas, Drink boiled water with meals. Vegetarian: Always available, Most local dishes have veg versions. Try at: Markets in base towns, During festivals (special dishes), Homestays (best experience). Sample prompt: "What local food should I try in Spiti?"',
    metadata: { category: 'culture', subcategory: 'food', priority: 'low', samplePrompts: ['Ladakhi food', 'What to eat in Himachal', 'Traditional dishes in Uttarakhand'] }
  },

  // Technology & Apps
  {
    id: 'ext-useful-apps',
    type: 'general' as const,
    title: 'Useful Apps for Trekking',
    content: 'Essential smartphone apps for trekkers: Navigation: Maps.me (offline maps - essential), Google Maps (mark trek start in advance), Gaia GPS (premium, detailed topo maps). Weather: Windy.com, Mountain-Forecast.com, Mausam (IMD official). Fitness tracking: Strava, AllTrails, Fitbit. Safety: SOS Emergency (location sharing), What3Words (precise location), National Geographic Maps. Altitude: Altimeter apps (track elevation), Peak Finder (identify mountains). Language: Google Translate (download offline), Duolingo (learn basics). Bird/plant identification: Seek by iNaturalist, Google Lens. Star gazing: Sky Map, Star Walk (night sky identification). Banking: UPI apps (PhonePe, Google Pay), Mobile banking. Communication: WhatsApp (common in India), Telegram. Download before: Offline maps of entire region, Key contacts, Travel documents. Battery saving: Airplane mode during trek, Turn off data/GPS when not needed, Power banks essential. Sample prompt: "Best apps for trekking in India?"',
    metadata: { category: 'technology', priority: 'medium', samplePrompts: ['Offline maps for trekking', 'Weather apps for mountains', 'GPS app for Himalayas'] }
  },
  {
    id: 'ext-power-charging',
    type: 'general' as const,
    title: 'Power and Charging on Treks',
    content: 'Managing electronics and charging: Power availability: Base towns: 24/7 electricity (bring adapters), Trek villages: Limited hours (6-10 PM common), Campsites: Usually none (solar sometimes). Bring: Power banks (20,000mAh minimum for 5-day trek), Multiple charging cables, Universal adapter, Headlamp (better than phone flashlight). Solar chargers: Useful for long treks (10+ days), Weather dependent (clouds reduce efficiency), Expensive (₹3000-8000), Not essential for shorter treks. Battery management: Airplane mode (huge savings), Turn off auto-sync, brightness, Location off when not navigating, Download maps/music offline. Charging strategy: Charge everything at base town, Use power bank strategically, Prioritize emergency device. Group sharing: One solar charger for group, Rotate charging priority, Keep one phone fully charged as emergency. Waterproofing: Zip-lock bags for phones, Waterproof phone cases recommended, Keep electronics inside sleeping bag at night (prevents moisture damage). Sample prompt: "How do I charge my phone while trekking?"',
    metadata: { category: 'technology', priority: 'medium', samplePrompts: ['Charging on trek', 'Solar charger for trekking', 'Power bank capacity needed'] }
  },

  // Women-Specific
  {
    id: 'ext-women-hygiene',
    type: 'general' as const,
    title: 'Women-Specific Hygiene and Comfort',
    content: 'Hygiene tips for women trekkers: Menstruation: Menstrual cups (best - reusable, no waste), Sanitary pads (carry extra, pack out used ones), Period underwear (backup option), Pain relief (carry sufficient), Tracking app (know your cycle). Changing facilities: Toilet tents have privacy, Use poncho/sarong for outdoor, Change in sleeping bag if needed. Disposal: Never leave pads on trail, Carry zip-lock disposal bags, Burn or carry back to base (follow organizer guidance). Washing: Baby wipes (unscented), No-rinse body wash, Dry shampoo (saves water and time). Clothing: Sports bras (high support, moisture-wicking), Quick-dry underwear (bring extras), Pee cloth (washable, quick-dry), Privacy during bathroom: Inform group you need break, Use trekking poles for balance, Scout private spots in advance. Breast-feeding mothers: Possible on easy treks with baby carrier, Need extra calories, Stay hydrated, Consult pediatrician. Tips from women trekkers: Inform organizer about needs, Many women trek during periods (not a problem), Groups are understanding and supportive. Sample prompt: "How to manage periods while trekking?"',
    metadata: { category: 'women', priority: 'high', samplePrompts: ['Periods on trek', 'Female hygiene trekking', 'Menstrual cup for mountains'] }
  },
  {
    id: 'ext-women-clothing',
    type: 'general' as const,
    title: 'Women Trekking Clothing Guide',
    content: 'Clothing recommendations for women trekkers: Base layer: Thermal tops and bottoms (avoid cotton), Sports bras (2-3, high support), Quick-dry underwear (5-6 pairs). Mid layer: Fleece jacket or pullover, Long-sleeve moisture-wicking shirts, Trekking pants (convertible useful). Outer layer: Windproof/waterproof jacket, Rain pants, Down jacket (high altitude). Bottoms: Trekking pants (avoid jeans), Thermal leggings (under pants for cold), Comfortable shorts (for easy treks). Accessories: Sun hat/cap, Balaclava (cold protection), Buff/scarf (multi-use), Gloves (light and heavy pair). Special considerations: Longer tops (squat-friendly), High-waist pants (no gap when bending), Zippered pockets (security). Modesty: Many Himalayan regions conservative, Long sleeves recommended in villages, Loose comfortable clothes. Where to buy: Decathlon (affordable, good quality), Wildcraft, Quechua, Premium: The North Face, Columbia. Sizing: Try with layers underneath, Room for movement important, Not too loose (catches on branches). Sample prompt: "What clothes should women wear for trekking?"',
    metadata: { category: 'women', subcategory: 'clothing', priority: 'medium', samplePrompts: ['Women trekking clothes', 'Best pants for female trekkers', 'Modest clothing for Himalayas'] }
  },

  // Seniors & Special Needs
  {
    id: 'ext-senior-trekkers',
    type: 'general' as const,
    title: 'Trekking for Senior Citizens',
    content: 'Trekking guidelines for seniors (60+ years): Health check essential: Comprehensive medical exam, ECG mandatory, Lung function test, Get doctor clearance in writing. Suitable treks: Easy grade only initially (Triund, Prashar Lake), Lower altitude preferred (<3500m), Shorter duration (2-3 days), Well-supported with porters. Fitness preparation: Start 8-12 weeks in advance, Daily walks with gradual increase, Focus on endurance over intensity, Joint strengthening exercises, Consult physiotherapist. Precautions: Trek with companion/family, Inform organizer of age and conditions, Carry all medications (2x needed), Travel insurance mandatory, Emergency evacuation cover. Pace: Walk very slowly, no rushing, Rest every 30-45 minutes, Listen to body signals, No pressure to complete. Benefits: Age is just a number with right preparation, Many 60-70 year olds trek successfully, Builds confidence and fitness, Social connections. Inspiring: Many seniors complete challenging treks, Some start trekking post-retirement, Age limit mainly about fitness, not years. Sample prompt: "Can a 65 year old go trekking?"',
    metadata: { category: 'seniors', priority: 'medium', samplePrompts: ['Trekking for seniors', 'Age limit for trekking', 'Easy treks for elderly'] }
  },
  {
    id: 'ext-disabilities',
    type: 'general' as const,
    title: 'Trekking with Disabilities',
    content: 'Accessible trekking and adaptive adventures: Wheelchair accessible: Limited options but growing, Wheelchair-friendly trails in some National Parks, Adapted equipment available through specialized organizers. Visually impaired: Buddy system essential, Many blind trekkers successful, Audio cues and support, Specialized organizations offer guided treks. Hearing impaired: No special limitations for trekking, Visual communication with guide, WhatsApp groups helpful, Fellow trekkers supportive. Prosthetic users: Many amputees trek successfully, Specialized prosthetics for terrain, Extra padding needed, Consult doctor and prosthetist. Mental health: Trekking therapeutic for many, Inform organizer for support, Medication routine maintained, Buddy system helps. Organizations: Adventures Beyond Barriers, Himalayan Disability Trust, Accessible Adventures India. Preparation: Extra time for acclimatization, Specialized gear may be needed, Support person essential, Inform organizer well in advance. Inspiration: Many differently-abled complete Himalayas, Attitude and preparation key, Community very supportive. Sample prompt: "Can I trek with a prosthetic leg?"',
    metadata: { category: 'accessibility', priority: 'low', samplePrompts: ['Accessible treks', 'Trekking with prosthetic', 'Blind trekking in Himalayas'] }
  },

  // Offbeat & Adventure
  {
    id: 'ext-winter-treks',
    type: 'general' as const,
    title: 'Best Winter Treks in India',
    content: 'Top winter trekking destinations (December-March): Beginner winter treks: Kedarkantha (Uttarakhand, 3850m) - best winter trek, Brahmatal (Uttarakhand, 3734m) - alpine lake, Kuari Pass (Uttarakhand, 3860m) - panoramic views, Nag Tibba (Uttarakhand, 3022m) - weekend trek. Moderate winter: Sandakphu (West Bengal, 3636m) - Kanchenjunga views, Har ki Dun (Uttarakhand, 3566m) - snow valley. Challenging: Chadar Trek (Ladakh, 3350m) - frozen river (Jan-Feb only), Roopkund (snow season) - extreme cold. Why winter: Snow-covered landscapes magical, Clear visibility, Fewer trekkers, Unique experience. Challenges: Extreme cold (-10 to -20°C at night), Heavy snow possible, Shorter daylight hours, Extra gear needed. Preparation: Extensive cold weather training, Test gear in cold conditions, Higher fitness requirement, Mental preparation essential. Best time within winter: Mid-December to end February, Avoid late March (snow melts, slush), Early season has less snow buildup. Sample prompt: "Which are the best winter treks?"',
    metadata: { category: 'adventure', subcategory: 'winter', priority: 'medium', samplePrompts: ['Winter treks in Himachal', 'Kedarkantha in December', 'Chadar trek preparation'] }
  },
  {
    id: 'ext-offbeat-treks',
    type: 'general' as const,
    title: 'Offbeat and Unexplored Treks',
    content: 'Lesser-known trekking gems in Himalayas: Himachal offbeat: Bara Bhangal (remote tribal area, 8 days), Kinner Kailash (Hindu pilgrimage + trek), Miyar Valley (Zanskar-like, less crowded), Jalori Pass to Serolsar Lake (easy, beautiful). Uttarakhand hidden: Milam Glacier (Indo-Tibetan border), Panchachuli Base Camp (remote), Kuari Pass circular (lesser done route), Pangarchulla Peak (technical). Sikkim unexplored: Dzongri-Goechala complete circuit, Singalila Ridge eastern route, Lam Pokhari (sacred lake). Ladakh remote: Sham Valley extended routes, Nubra to Turtuk (near Pakistan border), Zanskar frozen river summer route. Northeast: Dzukou Valley (Nagaland-Manipur), Bailey Trail (Arunachal), Sandakphu from Sikkim side. Why offbeat: Fewer crowds, Authentic local experience, Pristine environment, Lower costs sometimes. Challenges: Less infrastructure, Requires experience, Longer approach, Permits may be complex. Sample prompt: "Tell me about offbeat treks in Himalayas"',
    metadata: { category: 'adventure', subcategory: 'offbeat', priority: 'low', samplePrompts: ['Offbeat treks', 'Hidden treks in Uttarakhand', 'Remote Himalayan treks'] }
  },

  // Environmental
  {
    id: 'ext-eco-trekking',
    type: 'general' as const,
    title: 'Eco-Friendly and Sustainable Trekking',
    content: 'Being an environmentally responsible trekker: Leave No Trace principles: Pack out all trash (even biodegradable), Use designated toilet areas or dig catholes, Stay on marked trails, Camp in established sites, Respect wildlife (observe from distance), Leave natural objects as found, Minimize campfire impact (use stoves). Plastic-free: Reusable water bottles (purification tablets), Cloth bags instead of plastic, Eco-friendly toiletries, No single-use plastics, Carry reusable cutlery. Water conservation: Don\'t waste water (precious in mountains), Use biodegradable soap away from streams, Minimal bathing (dry shampoo, wipes), Don\'t pollute water sources. Support local: Buy from village shops, Hire local guides and porters, Stay in homestays, Buy local handicrafts. Carbon footprint: Carpooling to trek start, Public transport where possible, Offset flights with tree planting. Organize clean-up: Join trek clean-up drives, Pick trash on trails (carry extra bag), Volunteer with environmental orgs. Educate: Set example for others, Call out irresponsible behavior politely, Share eco-tips with fellow trekkers. Sample prompt: "How to trek responsibly and protect environment?"',
    metadata: { category: 'environment', priority: 'high', samplePrompts: ['Eco-friendly trekking', 'Leave no trace', 'Sustainable trekking tips'] }
  },
  {
    id: 'ext-wildlife-himalayas',
    type: 'general' as const,
    title: 'Wildlife in the Himalayas',
    content: 'Animals you might encounter on treks: Common: Himalayan Monal (state bird Uttarakhand), Langurs and monkeys, Mountain goats/sheep, Various birds (eagles, vultures), Yaks (domesticated in Ladakh/Sikkim). Occasionally seen: Himalayan Black Bear, Red Panda (Sikkim), Musk Deer, Snow Leopard (extremely rare, high altitude), Blue Sheep (Bharal). Safety: Make noise while walking (alerts bears), Store food properly, No feeding wildlife, Maintain safe distance, Follow guide instructions. Bear safety: If you see a bear: Stop, stay calm, back away slowly, speak in calm voice, make yourself appear large, Never run, never climb trees, Use bear spray if charging (rare). Bird watching: Best seasons: Spring and autumn migration, Carry binoculars, Early morning best time, Many endemic species. Photography: Use telephoto lens (don\'t approach), Never use flash, Respect animal space, Never bait or disturb. Conservation: Many species endangered, Report poaching to authorities, Support conservation organizations, Follow park rules strictly. Sample prompt: "What animals can I see while trekking?"',
    metadata: { category: 'wildlife', priority: 'low', samplePrompts: ['Wildlife in Himachal', 'Bear safety on treks', 'Bird watching while trekking'] }
  }
];

// Sample prompts by category for testing
export const SAMPLE_PROMPTS = {
  booking: [
    'How do I book a trek?',
    'Can I book for my friends?',
    'What if I want to cancel?',
    'How do group discounts work?'
  ],
  payment: [
    'What payment methods do you accept?',
    'Can I pay in installments?',
    'How long does payment verification take?',
    'I made payment but haven\'t received confirmation'
  ],
  packing: [
    'What should I pack for winter trek?',
    'Packing list for monsoon',
    'Do I need sleeping bag?',
    'What clothes for summer trek?'
  ],
  safety: [
    'Is it safe for solo women?',
    'What if I get lost?',
    'How to prevent altitude sickness?',
    'First aid essentials'
  ],
  destinations: [
    'Best treks in Himachal?',
    'Where to trek in October?',
    'Easy treks for beginners',
    'Ladakh vs Spiti which is better?'
  ],
  gear: [
    'Should I buy or rent gear?',
    'Best trekking shoes under 5000',
    'Where to rent sleeping bag?',
    'Decathlon gear good for trekking?'
  ],
  transport: [
    'How to reach Manali from Delhi?',
    'Train to Uttarakhand?',
    'Shared taxi cost',
    'Best way to reach Leh?'
  ],
  health: [
    'Do I need vaccinations?',
    'Can diabetics trek?',
    'What if I have asthma?',
    'Altitude sickness symptoms'
  ],
  weather: [
    'What\'s the weather in July?',
    'When does it snow?',
    'Best season for trekking?',
    'Is monsoon trekking safe?'
  ],
  culture: [
    'What festivals can I attend?',
    'Local food to try?',
    'Cultural etiquette',
    'What language do they speak?'
  ],
  women: [
    'How to manage periods on trek?',
    'What clothes for women?',
    'Safety tips for solo female',
    'Sanitary facilities on trek?'
  ],
  seniors: [
    'Can 65 year old trek?',
    'Easy treks for elderly?',
    'Medical certificate required?',
    'Age limit for trekking?'
  ],
  technology: [
    'Best apps for trekking?',
    'Offline maps?',
    'How to charge phone?',
    'Will I get mobile network?'
  ],
  budget: [
    'Cheapest treks?',
    'How to save money?',
    'Affordable gear?',
    'Budget accommodation options?'
  ],
  family: [
    'Can I trek with 8 year old?',
    'Family-friendly treks',
    'Kid-safe treks',
    'What age is safe for kids?'
  ]
};
