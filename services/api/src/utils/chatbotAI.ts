import { Trip } from '../models/Trip';
import { User } from '../models/User';
import { Payment } from '../models/Payment';
import { Rating } from '../models/Rating';

interface ChatContext {
  userId?: string;
  sessionId: string;
  previousMessages: ChatMessage[];
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  intent?: string;
  entities?: any;
}

interface ChatResponse {
  message: string;
  intent: string;
  confidence: number;
  actions?: any[];
  suggestions?: string[];
  data?: any;
}

class TrekTribeChatbot {
  private knowledgeBase: any;
  private intents: Map<string, any> = new Map();
  private entities: Map<string, string[]> = new Map();

  constructor() {
    this.initializeKnowledgeBase();
    this.initializeIntents();
    this.initializeEntities();
  }

  private initializeKnowledgeBase() {
    this.knowledgeBase = {
      company: {
        name: "Trek Tribe",
        tagline: "Adventure Awaits",
        description: "Trek Tribe is a platform connecting adventure enthusiasts with certified organizers for unforgettable trekking experiences worldwide.",
        founded: "2023",
        mission: "To make wilderness adventures accessible, safe, and sustainable while building a community of nature lovers.",
        values: ["Safety First", "Eco-Friendly", "Community", "Adventure", "Sustainability"]
      },
      
      features: {
        booking: "Easy multi-step booking process with advance payment options",
        payment: "QR code payments, UPI, card, and netbanking support",
        safety: "100% safety record with certified guides and emergency protocols",
        tracking: "Real-time trip tracking and SOS features",
        community: "Connect with fellow adventurers and share experiences",
        ratings: "Authentic reviews and rating system with fake review detection"
      },

      policies: {
        cancellation: "Cancellation allowed with refunds based on timing: 90% (30+ days), 70% (15+ days), 50% (7+ days), 25% (3+ days)",
        refund: "Refunds processed within 5-7 business days",
        safety: "All guides are certified with first aid training. Emergency equipment carried on every trip.",
        environment: "100% carbon offset through reforestation projects",
        age_limit: "Generally 16+ years. Some trips may have specific age requirements.",
        fitness: "Fitness requirements vary by trip difficulty. Basic fitness required for all trips."
      },

      trip_categories: {
        mountain: "High-altitude trekking, peak climbing, mountaineering expeditions",
        forest: "Forest trails, wildlife spotting, nature walks",
        desert: "Desert camping, sand dune exploration, camel safaris",
        water: "River rafting, lake trekking, coastal adventures",
        cultural: "Village visits, local community interaction, cultural immersion",
        wildlife: "Safari experiences, bird watching, conservation trips"
      },

      difficulty_levels: {
        beginner: "Easy trails, minimal experience required, 2-4 hours walking",
        intermediate: "Moderate fitness needed, some experience helpful, 4-6 hours walking",
        advanced: "High fitness required, previous trekking experience essential, 6+ hours challenging terrain"
      },

      equipment: {
        provided: ["Professional backpacks", "Weather-appropriate clothing", "Camping equipment", "Navigation gear", "First aid supplies", "Cooking equipment"],
        bring: ["Personal items", "Medications", "Comfortable trekking shoes", "Water bottle", "Sunscreen", "Personal hygiene items"]
      },

      contact: {
        email: "support@trekktribe.com",
        phone: "+91-XXXXX-XXXXX",
        support_hours: "24/7 for emergency, 9 AM - 9 PM for general queries",
        response_time: "Within 2 hours during business hours"
      }
    };
  }

  private initializeIntents() {
    this.intents = new Map([
      ['greeting', {
        patterns: ['hello', 'hi', 'hey', 'good morning', 'good evening', 'namaste'],
        responses: [
          "Hello! 🏔️ Welcome to Trek Tribe! I'm here to help you with all your trekking questions.",
          "Hi there! 🌿 Ready for your next adventure? I can help you find the perfect trek!",
          "Hey adventurer! 👋 How can I assist you with your trekking plans today?"
        ]
      }],
      
      ['trip_search', {
        patterns: ['find trip', 'search trip', 'show trips', 'available trips', 'book trip', 'trek options', 'adventures'],
        responses: [
          "I'd love to help you find the perfect adventure! 🗺️ What type of experience are you looking for?",
          "Great! Let me help you discover amazing trips. Are you interested in mountains, forests, deserts, or something else?"
        ],
        actions: ['search_trips']
      }],

      ['trip_details', {
        patterns: ['trip details', 'tell me about', 'information about', 'what is included', 'itinerary'],
        responses: [
          "I can provide detailed information about any trip! Which specific adventure interests you?",
          "Sure! I'd be happy to share trip details. Please tell me the trip name or destination."
        ],
        actions: ['get_trip_details']
      }],

      ['booking_help', {
        patterns: ['how to book', 'booking process', 'reserve trip', 'make reservation', 'payment'],
        responses: [
          "Booking with Trek Tribe is easy! 📱 Here's how it works:\n1. Choose your trip\n2. Add participant details\n3. Select payment option (full/advance)\n4. Complete payment via QR code, UPI, or card\n5. Get confirmation email\n\nWould you like me to help you with a specific booking?"
        ]
      }],

      ['payment_help', {
        patterns: ['payment options', 'how to pay', 'qr code', 'advance payment', 'refund'],
        responses: [
          "We offer flexible payment options! 💳\n\n🔸 QR Code (UPI scanning)\n🔸 Direct UPI\n🔸 Credit/Debit Cards\n🔸 Net Banking\n\nYou can choose:\n✅ Full Payment: Pay complete amount upfront\n✅ Advance Payment: Pay partial amount now, balance later\n\nAll payments are secure and instant!"
        ]
      }],

      ['cancellation_policy', {
        patterns: ['cancel trip', 'cancellation policy', 'refund policy', 'cancel booking'],
        responses: [
          "Our cancellation policy is fair and flexible! 🔄\n\n📅 **Refund Structure:**\n• 30+ days before trip: 90% refund\n• 15+ days before trip: 70% refund\n• 7+ days before trip: 50% refund\n• 3+ days before trip: 25% refund\n• Less than 3 days: No refund\n\n💰 Refunds processed within 5-7 business days\n\nNeed help with a specific cancellation?"
        ]
      }],

      ['safety_info', {
        patterns: ['safety', 'safe', 'security', 'emergency', 'first aid', 'guide'],
        responses: [
          "Safety is our top priority! 🛡️\n\n✅ 100% safety record\n✅ Certified guides with first aid training\n✅ Emergency equipment on every trip\n✅ Real-time tracking and SOS features\n✅ 24/7 emergency support\n✅ Comprehensive insurance coverage\n\nOur guides are wilderness professionals who prioritize your safety above all else!"
        ]
      }],

      ['difficulty_levels', {
        patterns: ['difficulty', 'fitness required', 'beginner', 'intermediate', 'advanced', 'hard', 'easy'],
        responses: [
          "We have trips for every fitness level! 💪\n\n🟢 **Beginner:** Easy trails, 2-4 hours walking, minimal experience needed\n🟡 **Intermediate:** Moderate fitness, 4-6 hours walking, some experience helpful\n🔴 **Advanced:** High fitness required, 6+ hours challenging terrain, experience essential\n\nWhich level interests you? I can recommend perfect trips!"
        ]
      }],

      ['equipment_info', {
        patterns: ['equipment', 'gear', 'what to bring', 'packing list', 'provided'],
        responses: [
          "We've got you covered with equipment! 🎒\n\n**✅ We Provide:**\n• Professional backpacks\n• Weather-appropriate clothing\n• Camping equipment\n• Navigation & safety gear\n• First aid supplies\n• Cooking equipment\n\n**📋 You Bring:**\n• Personal items & medications\n• Comfortable trekking shoes\n• Water bottle & sunscreen\n• Personal hygiene items\n\nDetailed packing list sent after booking!"
        ]
      }],

      ['locations', {
        patterns: ['destinations', 'where', 'locations', 'countries', 'places'],
        responses: [
          "We offer adventures across 47+ countries! 🌍\n\n**Popular Destinations:**\n🏔️ Himalayas (Nepal, India)\n🌲 Amazon Rainforest (Peru, Brazil)\n❄️ Iceland (Northern Lights)\n🏜️ Sahara Desert (Morocco)\n🌺 New Zealand (Milford Track)\n🦘 Australia (Outback Adventures)\n\nWhere would you like to explore?"
        ]
      }],

      ['pricing', {
        patterns: ['price', 'cost', 'how much', 'expensive', 'budget', 'cheap'],
        responses: [
          "Our trips are priced competitively with great value! 💰\n\n**Typical Price Ranges:**\n🟢 Local trips: ₹2,000 - ₹8,000\n🟡 Domestic adventures: ₹5,000 - ₹25,000\n🔴 International expeditions: ₹25,000 - ₹1,50,000\n\n💡 **Included:** Accommodation, meals, guides, equipment, permits\n💳 **Payment:** Full payment or advance options available\n\nWould you like to see trips in a specific budget range?"
        ]
      }],

      ['reviews_ratings', {
        patterns: ['reviews', 'ratings', 'feedback', 'testimonials', 'experiences'],
        responses: [
          "Our community loves their adventures! ⭐\n\n📊 **Our Stats:**\n• 98.4% satisfaction rate\n• Average 4.8/5 star rating\n• 2,000+ verified reviews\n• Anti-fake review system\n\nAll reviews are from verified participants. You can read authentic experiences from fellow adventurers before booking!"
        ]
      }],

      ['support_contact', {
        patterns: ['contact', 'support', 'help', 'phone', 'email', 'reach'],
        responses: [
          "We're always here to help! 📞\n\n**Contact Options:**\n📧 Email: support@trekktribe.com\n📱 Phone: +91-XXXXX-XXXXX\n💬 Chat: Right here with me!\n\n⏰ **Support Hours:**\n• Emergency: 24/7\n• General queries: 9 AM - 9 PM\n• Response time: Within 2 hours\n\nWhat can I help you with right now?"
        ]
      }],

      ['eco_friendly', {
        patterns: ['environment', 'eco', 'sustainable', 'carbon', 'planet', 'green'],
        responses: [
          "We're committed to protecting our planet! 🌱\n\n**Our Environmental Promise:**\n🌳 100% carbon offset through reforestation\n♻️ Leave No Trace principles\n🤝 Supporting local communities\n🐾 Wildlife conservation efforts\n🌊 Zero waste expeditions\n\nEvery adventure helps preserve the wilderness we love!"
        ]
      }],

      ['agent_request', {
        patterns: ['human agent', 'speak to agent', 'connect to agent', 'live chat', 'human help', 'customer service', 'talk to person', 'real person'],
        responses: [
          "I'd be happy to connect you with one of our human experts! 👨‍💼\n\nOur agents can help with:\n🔸 Complex booking issues\n🔸 Custom trip planning\n🔸 Special requirements\n🔸 Detailed trip consultation\n\nWould you like me to transfer you to an available agent now?"
        ],
        actions: ['escalate_to_agent']
      }],

      ['complaint', {
        patterns: ['complaint', 'problem', 'issue', 'unhappy', 'dissatisfied', 'wrong', 'error', 'mistake'],
        responses: [
          "I'm sorry to hear you're experiencing an issue! 😔\n\nI want to make sure you get the best help possible. Let me connect you with a human agent who can personally resolve this for you.\n\nShould I transfer you to our support team right away?"
        ],
        actions: ['escalate_to_agent']
      }],
    ]);
  }

  private initializeEntities() {
    this.entities = new Map([
      ['destinations', ['nepal', 'himalaya', 'amazon', 'iceland', 'morocco', 'sahara', 'peru', 'india', 'new zealand', 'australia']],
      ['activities', ['trek', 'hike', 'climb', 'safari', 'camping', 'rafting', 'mountaineering']],
      ['difficulties', ['easy', 'beginner', 'intermediate', 'moderate', 'advanced', 'hard', 'challenging']],
      ['durations', ['day', 'days', 'week', 'weeks', 'month', 'weekend']],
      ['prices', ['cheap', 'budget', 'expensive', 'cost', 'price', 'affordable']],
      ['seasons', ['summer', 'winter', 'monsoon', 'spring', 'autumn']]
    ]);
  }

  async processMessage(message: string, context: ChatContext): Promise<ChatResponse> {
    const normalizedMessage = message.toLowerCase().trim();
    
    // Extract intent and entities
    const intent = this.extractIntent(normalizedMessage);
    const entities = this.extractEntities(normalizedMessage);
    
    // Generate response based on intent
    const response = await this.generateResponse(intent, entities, normalizedMessage, context);
    
    return {
      message: response.message,
      intent: intent.name,
      confidence: intent.confidence,
      actions: response.actions,
      suggestions: response.suggestions,
      data: response.data
    };
  }

  private extractIntent(message: string): { name: string; confidence: number } {
    let bestMatch = { name: 'general', confidence: 0 };
    
    for (const [intentName, intentData] of this.intents) {
      let score = 0;
      const patterns = intentData.patterns || [];
      
      for (const pattern of patterns) {
        if (message.includes(pattern)) {
          score += pattern.length / message.length;
        }
      }
      
      if (score > bestMatch.confidence) {
        bestMatch = { name: intentName, confidence: score };
      }
    }
    
    return bestMatch;
  }

  private extractEntities(message: string): any {
    const extractedEntities: any = {};
    
    for (const [entityType, values] of this.entities) {
      const found = values.filter(value => message.includes(value));
      if (found.length > 0) {
        extractedEntities[entityType] = found;
      }
    }
    
    return extractedEntities;
  }

  private async generateResponse(
    intent: { name: string; confidence: number }, 
    entities: any, 
    originalMessage: string,
    context: ChatContext
  ): Promise<any> {
    const intentData = this.intents.get(intent.name);
    let message = '';
    let actions: any[] = [];
    let suggestions: string[] = [];
    let data: any = null;

    if (intentData && intentData.responses) {
      // Get random response from available responses
      const responses = intentData.responses;
      message = responses[Math.floor(Math.random() * responses.length)];
      actions = intentData.actions || [];
    } else {
      // Handle dynamic queries and trip-specific questions
      message = await this.generateDynamicResponse(originalMessage, entities, context);
    }

    // Add contextual suggestions
    suggestions = this.generateSuggestions(intent.name, entities);

    // Fetch relevant data if needed
    if (actions.includes('search_trips')) {
      data = await this.searchTrips(entities);
    }

    return { message, actions, suggestions, data };
  }

  private async generateDynamicResponse(message: string, entities: any, context: ChatContext): Promise<string> {
    // Handle specific trip queries
    if (message.includes('himalaya') || message.includes('everest')) {
      return "🏔️ Himalayan adventures are our specialty! We offer treks to Everest Base Camp, Annapurna Circuit, and many more. These trips range from 7-21 days with stunning mountain views. Would you like to see our Himalayan trip options?";
    }

    if (message.includes('amazon')) {
      return "🌿 Amazon expeditions offer incredible biodiversity! Our trips include jungle treks, wildlife spotting, and cultural exchanges with indigenous communities. Perfect for nature lovers! Interested in learning more?";
    }

    if (message.includes('group') || message.includes('solo')) {
      return "🤝 Both group and solo travelers are welcome! Most of our trips have small groups (8-15 people) which creates a great community feeling. Solo travelers often make lifelong friends. Which type of experience interests you?";
    }

    if (message.includes('weather') || message.includes('season')) {
      return "🌤️ Weather varies by destination and season. We provide detailed weather briefings and appropriate gear for each trip. Generally:\n• Himalayan treks: Best in Spring/Autumn\n• Desert adventures: Winter months\n• Tropical regions: Dry seasons\n\nWhich destination are you considering?";
    }

    if (message.includes('food') || message.includes('meal')) {
      return "🍽️ All meals are included in our trips! We provide:\n• Fresh, nutritious meals prepared by our team\n• Local cuisine experiences\n• Vegetarian/vegan options available\n• Dietary restrictions accommodated\n• Safe drinking water provided\n\nJust let us know your preferences during booking!";
    }

    if (message.includes('accommodation') || message.includes('stay')) {
      return "🏕️ Accommodation varies by trip type:\n• Camping: High-quality tents and sleeping bags\n• Lodge stays: Clean, comfortable local accommodations\n• Homestays: Authentic cultural experiences\n• Hotels: For certain city portions\n\nAll accommodations are safe, clean, and part of the adventure experience!";
    }

    if (message.includes('insurance') || message.includes('medical')) {
      return "🏥 Your safety is covered! We provide:\n• Comprehensive travel insurance\n• Emergency evacuation coverage\n• Medical support during trips\n• First aid trained guides\n• 24/7 emergency helpline\n\nWe recommend bringing personal medications and informing us of any health conditions.";
    }

    if (message.includes('fitness') || message.includes('preparation')) {
      return "💪 Preparation tips for a great experience:\n• Start cardio training 4-6 weeks before\n• Practice hiking with a backpack\n• Build leg strength and endurance\n• Get proper trekking shoes early\n• Practice with the gear you'll use\n\nWe'll send detailed preparation guides after booking. Which trip are you preparing for?";
    }

    if (message.includes('covid') || message.includes('safety protocol')) {
      return "😷 We follow all health and safety protocols:\n• Updated safety measures as per guidelines\n• Sanitization of equipment\n• Health checks before trips\n• Flexible booking policies\n• Small group sizes for safety\n\nYour health and safety remain our top priority!";
    }

    // Generic helpful response
    return "I'd be happy to help you with that! 😊 Could you please provide a bit more detail about what you're looking for? You can ask me about:\n\n🗺️ Trip destinations and details\n💳 Booking and payment process\n🎒 Equipment and preparation\n📋 Policies and cancellations\n⭐ Reviews and experiences\n\nWhat would you like to know more about?";
  }

  private generateSuggestions(intent: string, entities: any): string[] {
    const suggestions = [];

    switch (intent) {
      case 'greeting':
        suggestions.push("Show me popular trips", "Help with booking", "Safety information");
        break;
      case 'trip_search':
        suggestions.push("Himalayan treks", "Desert adventures", "Forest expeditions", "Beginner-friendly trips");
        break;
      case 'booking_help':
        suggestions.push("Payment options", "Cancellation policy", "Group booking");
        break;
      default:
        suggestions.push("Find trips", "Book adventure", "Contact support", "Safety info");
    }

    return suggestions;
  }

  private async searchTrips(entities: any): Promise<any> {
    try {
      const filter: any = { status: 'active' };
      
      // Build search filter based on entities
      if (entities.destinations) {
        filter.destination = { $regex: entities.destinations.join('|'), $options: 'i' };
      }
      
      if (entities.difficulties) {
        const difficultyMap: any = {
          'easy': 'beginner',
          'beginner': 'beginner',
          'moderate': 'intermediate',
          'intermediate': 'intermediate',
          'hard': 'advanced',
          'advanced': 'advanced'
        };
        
        const difficulties = entities.difficulties.map((d: string) => difficultyMap[d] || d);
        filter.difficultyLevel = { $in: difficulties };
      }

      const trips = await Trip.find(filter)
        .populate('organizerId', 'name averageRating')
        .limit(6)
        .lean();

      return trips;
    } catch (error) {
      console.error('Error searching trips:', error);
      return [];
    }
  }

  // Method to get trip-specific information
  async getTripInfo(tripId: string): Promise<any> {
    try {
      const trip = await Trip.findById(tripId)
        .populate('organizerId', 'name averageRating totalRatings')
        .lean();

      if (!trip) return null;

      const ratings = await Rating.find({ 
        tripId, 
        moderationStatus: 'approved' 
      })
      .populate('userId', 'name')
      .limit(5)
      .lean();

      return {
        trip,
        ratings,
        availability: trip.capacity - trip.participants.length
      };
    } catch (error) {
      console.error('Error getting trip info:', error);
      return null;
    }
  }
}

export const trekTribeChatbot = new TrekTribeChatbot();