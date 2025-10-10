import { logger } from '../utils/logger';
import { Trip } from '../models/Trip';
import { User } from '../models/User';
import { SupportTicket } from '../models/SupportTicket';
import { GroupBooking } from '../models/GroupBooking';
import { Review } from '../models/Review';
import mongoose from 'mongoose';

interface AIResponse {
  message: string;
  requiresHumanSupport: boolean;
  suggestedActions?: string[];
  confidence: number;
  quickReplies?: string[];
  multipleChoice?: {
    question: string;
    options: Array<{
      id: string;
      text: string;
      value: string;
    }>;
  };
  additionalData?: {
    recommendations?: TripRecommendation[];
    interpretedIntent?: string;
    suggestions?: Array<{
      text: string;
      type: string;
      confidence: number;
    }>;
    extractedFilters?: {
      destination?: string;
      category?: string;
      difficultyLevel?: string;
      priceRange?: { min: number; max: number };
    };
    analytics?: UserAnalytics;
    availability?: TripAvailability;
    organizerProfile?: OrganizerProfile;
  };
}

interface ChatContext {
  userId?: string;
  userRole?: string;
  tripId?: string;
  userPreferences?: {
    budget?: { min: number; max: number };
    difficulty?: 'beginner' | 'intermediate' | 'advanced';
    interests?: string[];
    duration?: number;
  };
  previousMessages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>;
}

interface TripAvailability {
  tripId: string;
  title: string;
  availableSpots: number;
  totalCapacity: number;
  nextDeparture?: Date;
  upcomingDepartures: Date[];
  bookingCount: number;
  isAlmostFull: boolean;
}

interface OrganizerProfile {
  id: string;
  name: string;
  rating: number;
  totalTrips: number;
  experience: string;
  specialties: string[];
  languages: string[];
  certifications: string[];
  totalReviews: number;
}

interface TripRecommendation {
  trip: any;
  score: number;
  reason: string;
  matchingFactors: string[];
}

interface UserAnalytics {
  bookingHistory: any[];
  preferences: {
    favoriteDestinations: string[];
    preferredDifficulty: string;
    averageBudget: number;
    seasonalPreference: string[];
  };
  trendingInterests: string[];
  recommendedBudget: { min: number; max: number };
}

interface KnowledgeBase {
  patterns: Array<{
    keywords: string[];
    response: string;
    confidence: number;
    requiresHuman: boolean;
    actions?: string[];
    quickReplies?: string[];
    multipleChoice?: {
      question: string;
      options: Array<{
        id: string;
        text: string;
        value: string;
      }>;
    };
  }>;
  contextualResponses: {
    booking: string[];
    cancellation: string[];
    payment: string[];
    tripInfo: string[];
    account: string[];
    general: string[];
  };
}

class TrekTribeAI {
  private knowledgeBase: KnowledgeBase;
  private tripCache: Map<string, any> = new Map();
  private availabilityCache: Map<string, TripAvailability> = new Map();
  private organizerCache: Map<string, OrganizerProfile> = new Map();
  private userAnalyticsCache: Map<string, UserAnalytics> = new Map();

  constructor() {
    this.knowledgeBase = this.initializeKnowledgeBase();
    logger.info('Trek Tribe AI initialized with advanced capabilities');
  }

  private initializeKnowledgeBase(): KnowledgeBase {
    return {
      patterns: [
        {
          keywords: ['book', 'booking', 'reserve', 'join trip', 'sign up'],
          response: "To book a trek with us, browse our available adventures and click 'Join Trip' on any adventure that catches your eye! You'll create an account, fill in participant details, and secure your spot. Each trip has clear pricing, pickup points, and what's included. Need help choosing the perfect adventure?",
          confidence: 0.9,
          requiresHuman: false,
          actions: ['Browse Available Trips', 'View Pricing']
        },
        {
          keywords: ['cancel', 'cancellation', 'refund', 'cancel booking'],
          response: "I understand you need to cancel your booking. Our cancellation policy varies by trip timing: Full refund if cancelled 30+ days before, 50% refund for 15-29 days, and 25% for 7-14 days. For cancellations within 7 days, we'll connect you with our team to discuss options based on your specific situation.",
          confidence: 0.8,
          requiresHuman: true,
          actions: ['Contact Support', 'View Policy']
        },
        {
          keywords: ['payment', 'pay', 'price', 'cost', 'money', 'fee'],
          response: "Our trips have transparent pricing displayed on each adventure page. We accept all major credit cards, UPI, and digital wallets. Payment is secure and processed immediately to confirm your booking. Group discounts are available for 6+ people, and we offer flexible EMI options for premium treks.",
          confidence: 0.8,
          requiresHuman: false,
          actions: ['View Pricing', 'Group Booking']
        },
        {
          keywords: ['pickup', 'drop', 'meeting point', 'where to meet', 'location'],
          response: "Each trip has designated pickup and drop-off points for your convenience. Common pickup locations include major metro stations, bus terminals, and city centers. Exact pickup times and locations are shared 2-3 days before departure via WhatsApp and email. Need pickup from a specific location?",
          confidence: 0.85,
          requiresHuman: false,
          actions: ['View Trip Details', 'Contact Organizer']
        },
        {
          keywords: ['what included', 'inclusions', 'what do you provide', 'whats covered'],
          response: "Great question! Our trips typically include transportation, accommodation, meals (as mentioned), experienced trek leaders, safety equipment, and permits. We also provide pickup/drop-off from designated points, first aid support, and photography services on most treks. Specific inclusions vary by trip - check each adventure's detailed page!",
          confidence: 0.85,
          requiresHuman: false,
          actions: ['View Trip Details', 'Compare Trips']
        },
        {
          keywords: ['safety', 'safe', 'security', 'emergency', 'medical'],
          response: "Your safety is our top priority! All our trek leaders are certified, we carry comprehensive first aid kits, and maintain 24/7 emergency communication. We conduct safety briefings before each trek, provide quality safety equipment, and have tie-ups with local medical facilities. Our team is trained in wilderness first aid and emergency response.",
          confidence: 0.9,
          requiresHuman: false,
          actions: ['Safety Guidelines', 'Emergency Contacts']
        },
        {
          keywords: ['weather', 'climate', 'season', 'best time', 'rain'],
          response: "Weather can make or break your trek! We provide detailed weather information for each destination and season. Most Himalayan treks are best from March-May and September-November. Monsoon treks have their own charm but require different preparation. We monitor weather closely and may adjust itineraries for safety.",
          confidence: 0.8,
          requiresHuman: false,
          actions: ['Weather Info', 'Best Time to Visit']
        },
        {
          keywords: ['group size', 'how many people', 'batch size', 'crowd'],
          response: "We maintain optimal group sizes for the best experience! Most treks accommodate 12-20 participants, ensuring personalized attention while keeping the adventure social. Smaller groups for technical treks (8-12) and larger groups for easy trails (up to 25). This ensures safety, environmental responsibility, and great group dynamics!",
          confidence: 0.8,
          requiresHuman: false,
          actions: ['View Group Details', 'Join Group']
        },
        {
          keywords: ['difficulty', 'fitness', 'easy', 'hard', 'beginner', 'experience'],
          response: "We have adventures for every fitness level! Our difficulty ratings range from Easy (beginners welcome) to Challenging (experienced trekkers). Each trip page shows the difficulty level, required fitness, and preparation tips. Don't worry - our leaders provide support throughout, and we believe anyone with determination can complete most treks!",
          confidence: 0.85,
          requiresHuman: false,
          actions: ['Difficulty Guide', 'Fitness Tips']
        },
        {
          keywords: ['solo', 'alone', 'single', 'by myself', 'solo traveler'],
          response: "Solo travelers are absolutely welcome! In fact, many of our adventurers join solo and make lifelong friends. We ensure a safe, inclusive environment where solo travelers feel comfortable. No single supplement charges, and our trip leaders make sure everyone's included in the group activities.",
          confidence: 0.9,
          requiresHuman: false,
          actions: ['Solo Travel Tips', 'Join Community']
        },
        {
          keywords: ['age limit', 'too old', 'too young', 'minimum age', 'children'],
          response: "Age is just a number for most of our adventures! Generally, participants should be 16+ for standard treks, though some family-friendly trips welcome younger adventurers with parents. Upper age limit depends on fitness rather than years. We've had adventurers in their 60s completing challenging treks!",
          confidence: 0.8,
          requiresHuman: false,
          actions: ['Age Guidelines', 'Family Trips']
        },
        {
          keywords: ['gear', 'equipment', 'what to bring', 'packing', 'clothes'],
          response: "We'll send you a detailed packing list after booking! Essential items include trekking shoes, warm clothes, rain gear, and personal items. We provide technical equipment like ropes, harnesses (where needed), and group gear. Many items can be rented from us or local shops. Pack light but smart!",
          confidence: 0.85,
          requiresHuman: false,
          actions: ['Packing List', 'Gear Rental']
        },
        {
          keywords: ['food', 'meals', 'vegetarian', 'dietary', 'allergies'],
          response: "Delicious, nutritious meals are part of the adventure! We serve fresh, local cuisine with vegetarian and non-vegetarian options. Special dietary requirements, allergies, or food preferences can be accommodated - just let us know during booking. Our cooks are experienced in preparing mountain meals that fuel your trek!",
          confidence: 0.85,
          requiresHuman: false,
          actions: ['Menu Details', 'Dietary Preferences']
        },
        {
          keywords: ['accommodation', 'stay', 'hotel', 'tent', 'camping'],
          response: "Accommodation varies by trek - from cozy guesthouses and homestays to adventure camping under the stars! All accommodations are clean, safe, and selected for the authentic experience they offer. Camping treks include quality tents and sleeping arrangements. Details are on each trip page.",
          confidence: 0.85,
          requiresHuman: false,
          actions: ['Accommodation Details', 'Photo Gallery']
        },
        {
          keywords: ['permit', 'permission', 'documents', 'id proof'],
          response: "We handle most permits for you! Just bring a valid photo ID (Aadhar, Passport, or Driving License). For certain areas, we'll need ID copies in advance. International travelers need passport copies. We take care of forest permissions, camping permits, and other required documentation.",
          confidence: 0.8,
          requiresHuman: false,
          actions: ['Document Requirements', 'Permit Info']
        },
        {
          keywords: ['insurance', 'covered', 'medical insurance'],
          response: "We strongly recommend travel insurance for all adventures! While we maintain high safety standards, insurance provides additional peace of mind for medical emergencies, trip cancellations, or gear loss. We can recommend good travel insurance providers that cover adventure activities.",
          confidence: 0.75,
          requiresHuman: true,
          actions: ['Insurance Options', 'Safety Info']
        },
        {
          keywords: ['contact', 'phone', 'whatsapp', 'call', 'reach'],
          response: "You can reach us through multiple channels! Use this chat for instant support, WhatsApp us for quick queries, or call our support team during business hours. After booking, you'll get dedicated WhatsApp group access and direct contact with your trek leader.",
          confidence: 0.9,
          requiresHuman: false,
          actions: ['Contact Details', 'WhatsApp Support']
        },
        {
          keywords: ['organizer', 'leader', 'guide', 'who leads'],
          response: "Our trek leaders are the heart of Trek Tribe! Each organizer is experienced, certified, and passionate about the mountains. They're trained in first aid, wilderness safety, and creating amazing group experiences. You can view organizer profiles on trip pages to see their experience and traveler reviews.",
          confidence: 0.85,
          requiresHuman: false,
          actions: ['Meet Organizers', 'Leader Profiles']
        },
        {
          keywords: ['reviews', 'testimonials', 'feedback', 'rating'],
          response: "Check out authentic reviews from fellow adventurers! Each trip and organizer has verified reviews from past participants. We encourage honest feedback to help improve our services and help future travelers choose the right adventure. Your review after the trip helps the community too!",
          confidence: 0.8,
          requiresHuman: false,
          actions: ['Read Reviews', 'View Ratings']
        },
        {
          keywords: ['customize', 'private', 'custom trip', 'tailor made'],
          response: "Absolutely! We love creating custom adventures tailored to your group's preferences, dates, and interests. Whether it's a corporate outing, family adventure, or friends' group with specific requirements, our organizers can design the perfect trek for you. Minimum group size applies.",
          confidence: 0.75,
          requiresHuman: true,
          actions: ['Custom Trip Inquiry', 'Group Booking']
        },
        {
          keywords: ['help', 'support', 'assistance', 'question'],
          response: "I'm here to help! What would you like to know about?",
          confidence: 0.9,
          requiresHuman: false,
          actions: ['Ask Question'],
          quickReplies: [
            'Trip Booking Process',
            'Cancellation Policy', 
            'What\'s Included',
            'Safety Measures',
            'Group Size Info',
            'Talk to Human Agent'
          ]
        },
        {
          keywords: ['interested', 'want to book', 'like to join'],
          response: "Great to hear you're interested! Let me help you find the perfect adventure.",
          confidence: 0.85,
          requiresHuman: false,
          multipleChoice: {
            question: "What type of adventure are you looking for?",
            options: [
              { id: 'easy', text: 'Easy Treks (Beginner Friendly)', value: 'easy_trek' },
              { id: 'moderate', text: 'Moderate Treks (Some Experience)', value: 'moderate_trek' },
              { id: 'challenging', text: 'Challenging Treks (Experienced)', value: 'challenging_trek' },
              { id: 'adventure', text: 'Adventure Sports', value: 'adventure_sports' },
              { id: 'wildlife', text: 'Wildlife Safaris', value: 'wildlife_safari' }
            ]
          }
        },
        {
          keywords: ['price', 'cost', 'budget', 'affordable'],
          response: "Our treks are priced transparently with no hidden costs. Let me help you find something within your budget.",
          confidence: 0.85,
          requiresHuman: false,
          multipleChoice: {
            question: "What's your preferred budget range per person?",
            options: [
              { id: 'budget1', text: 'Under ₹2,000', value: 'under_2000' },
              { id: 'budget2', text: '₹2,000 - ₹5,000', value: '2000_5000' },
              { id: 'budget3', text: '₹5,000 - ₹10,000', value: '5000_10000' },
              { id: 'budget4', text: '₹10,000 - ₹20,000', value: '10000_20000' },
              { id: 'budget5', text: 'Above ₹20,000', value: 'above_20000' }
            ]
          }
        },
        {
          keywords: ['availability', 'available', 'spots left', 'full', 'seats', 'space'],
          response: "Let me check real-time availability for you!",
          confidence: 0.9,
          requiresHuman: false,
          actions: ['Check Availability', 'View Calendar']
        },
        {
          keywords: ['recommend', 'suggest', 'best trip', 'which trek', 'advice'],
          response: "I'd love to recommend the perfect adventure for you! Let me analyze your preferences.",
          confidence: 0.9,
          requiresHuman: false,
          actions: ['Get Recommendations', 'Browse Trips'],
          multipleChoice: {
            question: "What type of experience are you looking for?",
            options: [
              { id: 'adventure', text: 'High Adventure & Thrill', value: 'adventure' },
              { id: 'scenic', text: 'Scenic & Photography', value: 'scenic' },
              { id: 'cultural', text: 'Cultural Immersion', value: 'cultural' },
              { id: 'peaceful', text: 'Peaceful & Meditation', value: 'peaceful' },
              { id: 'challenge', text: 'Physical Challenge', value: 'challenge' }
            ]
          }
        },
        {
          keywords: ['organizer', 'guide', 'leader', 'who leads', 'trek leader'],
          response: "Great question! Let me tell you about our amazing organizers and trek leaders.",
          confidence: 0.9,
          requiresHuman: false,
          actions: ['View Organizer Profiles', 'Leader Experience']
        },
        {
          keywords: ['book now', 'complete booking', 'help me book', 'guide booking'],
          response: "I'll guide you through the booking process step by step! Let's get you booked on your perfect adventure.",
          confidence: 0.95,
          requiresHuman: false,
          actions: ['Start Booking', 'Choose Trip']
        },
        {
          keywords: ['my trips', 'my bookings', 'history', 'past trips', 'previous'],
          response: "Let me pull up your booking history and travel preferences!",
          confidence: 0.9,
          requiresHuman: false,
          actions: ['View History', 'Trip Analytics']
        }
      ],
      contextualResponses: {
        booking: [
          "Ready for your next adventure? I can help you find the perfect trek and walk you through the booking process!",
          "Booking with Trek Tribe is simple and secure. Let me guide you through finding your ideal adventure!",
          "Exciting! Let's get you booked on an amazing trek. What kind of adventure are you looking for?"
        ],
        cancellation: [
          "I understand you need to cancel. Let me explain our policy and connect you with our team for the best possible solution.",
          "Cancellations can be stressful. Our team will work with you to find the best option based on your specific situation."
        ],
        payment: [
          "Our payment process is secure and straightforward. Let me explain the options and any applicable discounts!",
          "Payment queries are common! We accept multiple payment methods and offer flexible options for different group sizes."
        ],
        tripInfo: [
          "I'd love to help you learn more about our treks! Each adventure is carefully crafted for an unforgettable experience.",
          "Great question about our trips! We pride ourselves on detailed planning and transparent communication."
        ],
        account: [
          "Account issues? No worries! I can guide you through account setup, profile updates, or booking management.",
          "Let me help you with your account. Trek Tribe makes it easy to manage your adventures and preferences."
        ],
        general: [
          "Welcome to Trek Tribe! I'm here to help you discover your next adventure. What would you like to know?",
          "Hi there! I'm your Trek Tribe assistant, ready to help you plan an amazing adventure. How can I assist you today?",
          "Hello! Whether you're a seasoned trekker or just starting your adventure journey, I'm here to help!"
        ]
      }
    };
  }

  async analyzeQuery(query: string, context: ChatContext): Promise<AIResponse> {
    try {
      const normalizedQuery = query.toLowerCase().trim();
      
      // Find best matching pattern
      let bestMatch = this.findBestMatch(normalizedQuery);
      
      // If no good match, try contextual analysis
      if (!bestMatch || bestMatch.confidence < 0.6) {
        bestMatch = this.analyzeContext(normalizedQuery, context);
      }
      
      // Enhance response with context
      if (bestMatch) {
        const enhancedResponse = await this.enhanceWithTripContext(bestMatch, context);
        return enhancedResponse;
      }
      
      // Fallback to general response
      return this.getGeneralResponse(normalizedQuery);
      
    } catch (error: any) {
      logger.error('Error in Trek Tribe AI analysis', { error: error.message, query });
      return this.getGeneralResponse(query);
    }
  }
  
  private findBestMatch(query: string): { pattern: any; confidence: number } | null {
    let bestMatch = null;
    let highestScore = 0;
    
    for (const pattern of this.knowledgeBase.patterns) {
      let score = 0;
      let matchedKeywords = 0;
      
      for (const keyword of pattern.keywords) {
        if (query.includes(keyword.toLowerCase())) {
          matchedKeywords++;
          // Longer keywords get higher scores
          score += keyword.length;
          
          // Exact phrase matches get bonus
          if (query.includes(keyword.toLowerCase())) {
            score += 5;
          }
        }
      }
      
      // Calculate confidence based on keyword matches
      const matchRatio = matchedKeywords / pattern.keywords.length;
      const finalScore = score * matchRatio;
      
      if (finalScore > highestScore && matchRatio > 0.3) {
        highestScore = finalScore;
        bestMatch = {
          pattern,
          confidence: Math.min(pattern.confidence * matchRatio, 0.95)
        };
      }
    }
    
    return bestMatch;
  }
  
  private analyzeContext(query: string, context: ChatContext): { pattern: any; confidence: number } | null {
    // Context-based analysis
    const contextClues = {
      booking: ['book', 'reserve', 'join', 'signup', 'register'],
      payment: ['pay', 'price', 'cost', 'money', 'charge', 'fee', 'discount'],
      cancellation: ['cancel', 'refund', 'return', 'change mind'],
      tripInfo: ['trip', 'trek', 'adventure', 'detail', 'information'],
      account: ['account', 'profile', 'login', 'password', 'signup']
    };
    
    let bestContext = null;
    let maxMatches = 0;
    
    for (const [contextType, keywords] of Object.entries(contextClues)) {
      const matches = keywords.filter(keyword => query.includes(keyword)).length;
      if (matches > maxMatches) {
        maxMatches = matches;
        bestContext = contextType;
      }
    }
    
    if (bestContext && maxMatches > 0) {
      const responses = this.knowledgeBase.contextualResponses[bestContext as keyof typeof this.knowledgeBase.contextualResponses];
      if (responses && responses.length > 0) {
        const randomResponse = responses[Math.floor(Math.random() * responses.length)];
        return {
          pattern: {
            keywords: contextClues[bestContext as keyof typeof contextClues],
            response: randomResponse,
            confidence: 0.7,
            requiresHuman: bestContext === 'cancellation',
            actions: this.getContextActions(bestContext)
          },
          confidence: 0.7
        };
      }
    }
    
    return null;
  }
  
  private getContextActions(context: string): string[] {
    const actionMap: { [key: string]: string[] } = {
      booking: ['Browse Available Trips', 'View Pricing'],
      payment: ['View Pricing', 'Payment Methods'],
      cancellation: ['Contact Support', 'View Policy'],
      tripInfo: ['View Trip Details', 'Contact Organizer'],
      account: ['Account Settings', 'Help Center']
    };
    
    return actionMap[context] || ['Browse Available Trips', 'Contact Support'];
  }
  
  // Real-time trip availability
  private async getTripAvailability(tripId: string): Promise<TripAvailability | null> {
    try {
      // Check cache first
      if (this.availabilityCache.has(tripId)) {
        const cached = this.availabilityCache.get(tripId)!;
        // Cache valid for 2 minutes for availability data
        if (Date.now() - cached.bookingCount < 2 * 60 * 1000) {
          return cached;
        }
      }

      // Fetch real-time data
      const trip = await Trip.findById(tripId).select('title capacity participants startDate endDate');
      if (!trip) return null;

      const bookingCount = await GroupBooking.countDocuments({ tripId, status: 'confirmed' });
      const availableSpots = trip.capacity - trip.participants.length;
      
      const availability: TripAvailability = {
        tripId,
        title: trip.title,
        availableSpots,
        totalCapacity: trip.capacity,
        nextDeparture: trip.startDate,
        upcomingDepartures: [trip.startDate], // Can be enhanced with multiple dates
        bookingCount,
        isAlmostFull: availableSpots <= Math.ceil(trip.capacity * 0.2) // Less than 20% available
      };

      // Cache for 2 minutes
      this.availabilityCache.set(tripId, availability);
      setTimeout(() => this.availabilityCache.delete(tripId), 2 * 60 * 1000);

      return availability;
    } catch (error) {
      logger.error('Error fetching trip availability', { error, tripId });
      return null;
    }
  }

  // Organizer profile integration
  private async getOrganizerProfile(organizerId: string): Promise<OrganizerProfile | null> {
    try {
      if (this.organizerCache.has(organizerId)) {
        return this.organizerCache.get(organizerId)!;
      }

      const organizer = await User.findById(organizerId).select('name role');
      if (!organizer) return null;

      // Get organizer stats
      const totalTrips = await Trip.countDocuments({ organizerId });
      const reviews = await Review.find({ organizerId }).select('rating');
      const totalReviews = reviews.length;
      const avgRating = totalReviews > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews : 0;

      // Get organizer trips to determine specialties
      const organizerTrips = await Trip.find({ organizerId }).select('categories destination difficultyLevel');
      const categories = organizerTrips.flatMap(t => t.categories);
      const destinations = organizerTrips.map(t => t.destination);
      const difficulties = organizerTrips.map(t => t.categories.find(c => ['beginner', 'intermediate', 'advanced', 'easy', 'moderate', 'difficult'].includes(c.toLowerCase())) || 'intermediate');
      
      const specialties = [...new Set(categories)].slice(0, 5);
      const experience = this.calculateExperience(totalTrips, avgRating);

      const profile: OrganizerProfile = {
        id: organizerId,
        name: organizer.name,
        rating: Math.round(avgRating * 10) / 10,
        totalTrips,
        experience,
        specialties,
        languages: ['English', 'Hindi'], // Default - can be enhanced
        certifications: this.getCertifications(totalTrips, avgRating),
        totalReviews
      };

      // Cache for 30 minutes
      this.organizerCache.set(organizerId, profile);
      setTimeout(() => this.organizerCache.delete(organizerId), 30 * 60 * 1000);

      return profile;
    } catch (error) {
      logger.error('Error fetching organizer profile', { error, organizerId });
      return null;
    }
  }

  // Smart trip recommendations
  private async getSmartRecommendations(context: ChatContext): Promise<TripRecommendation[]> {
    try {
      const userAnalytics = context.userId ? await this.getUserAnalytics(context.userId) : null;
      
      // Build query based on context and analytics
      let query: any = { status: 'active' };
      
      // Apply filters based on user preferences
      if (context.userPreferences?.difficulty) {
        query.difficultyLevel = context.userPreferences.difficulty;
      }
      
      if (context.userPreferences?.budget) {
        query.price = {
          $gte: context.userPreferences.budget.min,
          $lte: context.userPreferences.budget.max
        };
      }

      // Fetch trips
      const trips = await Trip.find(query)
        .populate('organizerId', 'name')
        .select('title destination price categories difficultyLevel duration organizerId')
        .limit(10);

      const recommendations: TripRecommendation[] = [];

      for (const trip of trips) {
        let score = 0;
        const matchingFactors: string[] = [];
        let reason = '';

        // Score based on user analytics
        if (userAnalytics) {
          // Destination preference
          if (userAnalytics.preferences.favoriteDestinations.includes(trip.destination)) {
            score += 30;
            matchingFactors.push('Favorite destination');
          }

          // Difficulty preference
          const tripDifficulty = trip.categories.find(c => ['beginner', 'intermediate', 'advanced', 'easy', 'moderate', 'difficult'].includes(c.toLowerCase())) || 'intermediate';
          if (userAnalytics.preferences.preferredDifficulty === tripDifficulty) {
            score += 25;
            matchingFactors.push('Preferred difficulty level');
          }

          // Budget match
          const budgetMatch = Math.abs(trip.price - userAnalytics.preferences.averageBudget) / userAnalytics.preferences.averageBudget;
          if (budgetMatch < 0.3) {
            score += 20;
            matchingFactors.push('Within preferred budget');
          }
        }

        // Score based on context preferences
        if (context.userPreferences) {
          if (context.userPreferences.interests) {
            const categoryMatch = trip.categories.some(cat => 
              context.userPreferences!.interests!.some(interest => 
                cat.toLowerCase().includes(interest.toLowerCase())
              )
            );
            if (categoryMatch) {
              score += 25;
              matchingFactors.push('Matches interests');
            }
          }
        }

        // Trending bonus
        const recentBookings = await GroupBooking.countDocuments({
          tripId: trip._id,
          createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        });
        if (recentBookings > 5) {
          score += 15;
          matchingFactors.push('Trending adventure');
        }

        // Generate reason
        if (matchingFactors.length > 0) {
          reason = `Perfect match! ${matchingFactors.join(', ')}.`;
        } else {
          reason = 'Popular adventure with great reviews.';
        }

        if (score > 0 || matchingFactors.length === 0) {
          recommendations.push({
            trip,
            score: Math.max(score, 10), // Minimum score
            reason,
            matchingFactors
          });
        }
      }

      // Sort by score
      return recommendations.sort((a, b) => b.score - a.score).slice(0, 5);
    } catch (error) {
      logger.error('Error getting smart recommendations', { error });
      return [];
    }
  }

  // User analytics integration
  private async getUserAnalytics(userId: string): Promise<UserAnalytics | null> {
    try {
      if (this.userAnalyticsCache.has(userId)) {
        return this.userAnalyticsCache.get(userId)!;
      }

      // Fetch user's booking history
      const bookings = await GroupBooking.find({ mainBookerId: userId })
        .populate('tripId', 'destination price categories difficultyLevel')
        .select('tripId createdAt totalAmount')
        .sort({ createdAt: -1 });

      if (bookings.length === 0) {
        return null; // New user
      }

      const trips = bookings.map(b => b.tripId).filter(Boolean);
      const destinations = trips.map((t: any) => t.destination);
      const categories = trips.flatMap((t: any) => t.categories);
      const difficulties = trips.map((t: any) => t.difficultyLevel);
      const amounts = bookings.map(b => b.totalAmount);

      // Calculate preferences
      const favoriteDestinations = this.getTopItems(destinations, 3);
      const preferredDifficulty = this.getMostCommon(difficulties) || 'intermediate';
      const averageBudget = amounts.reduce((sum, amt) => sum + amt, 0) / amounts.length;
      
      // Seasonal preference analysis
      const bookingMonths = bookings.map(b => new Date(b.createdAt).getMonth());
      const seasonalPreference = this.getSeasonalPreference(bookingMonths);

      // Trending interests from recent bookings
      const recentCategories = bookings.slice(0, 3).flatMap(b => (b.tripId as any)?.categories || []);
      const trendingInterests = this.getTopItems(recentCategories, 5);

      const analytics: UserAnalytics = {
        bookingHistory: bookings,
        preferences: {
          favoriteDestinations,
          preferredDifficulty,
          averageBudget,
          seasonalPreference
        },
        trendingInterests,
        recommendedBudget: {
          min: Math.floor(averageBudget * 0.7),
          max: Math.ceil(averageBudget * 1.3)
        }
      };

      // Cache for 1 hour
      this.userAnalyticsCache.set(userId, analytics);
      setTimeout(() => this.userAnalyticsCache.delete(userId), 60 * 60 * 1000);

      return analytics;
    } catch (error) {
      logger.error('Error fetching user analytics', { error, userId });
      return null;
    }
  }

  // Helper methods
  private calculateExperience(totalTrips: number, avgRating: number): string {
    if (totalTrips >= 50 && avgRating >= 4.5) return 'Expert Trek Leader';
    if (totalTrips >= 25 && avgRating >= 4.0) return 'Senior Trek Leader';
    if (totalTrips >= 10 && avgRating >= 3.5) return 'Experienced Guide';
    if (totalTrips >= 5) return 'Qualified Guide';
    return 'New Trek Leader';
  }

  private getCertifications(totalTrips: number, avgRating: number): string[] {
    const certs = ['Basic First Aid'];
    if (totalTrips >= 10) certs.push('Wilderness First Aid');
    if (totalTrips >= 25) certs.push('Mountain Leadership');
    if (avgRating >= 4.5) certs.push('Excellence in Service');
    return certs;
  }

  private getTopItems<T>(items: T[], count: number): T[] {
    const frequency = items.reduce((acc, item) => {
      acc[item as string] = (acc[item as string] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(frequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, count)
      .map(([item]) => item as T);
  }

  private getMostCommon<T>(items: T[]): T | null {
    if (items.length === 0) return null;
    const top = this.getTopItems(items, 1);
    return top.length > 0 ? top[0] : null;
  }

  private getSeasonalPreference(months: number[]): string[] {
    const seasons = months.map(m => {
      if ([11, 0, 1].includes(m)) return 'Winter';
      if ([2, 3, 4].includes(m)) return 'Spring';
      if ([5, 6, 7].includes(m)) return 'Summer';
      return 'Autumn';
    });
    return this.getTopItems(seasons, 2);
  }

  private async enhanceWithTripContext(match: any, context: ChatContext): Promise<AIResponse> {
    let enhancedResponse = match.pattern.response;
    let additionalData: any = {};
    
    // Handle availability queries
    if (match.pattern.keywords.some((k: string) => ['availability', 'available', 'spots', 'full'].includes(k))) {
      if (context.tripId) {
        const availability = await this.getTripAvailability(context.tripId);
        if (availability) {
          if (availability.isAlmostFull) {
            enhancedResponse = `⚠️ ${availability.title} is almost full! Only ${availability.availableSpots} out of ${availability.totalCapacity} spots remaining. This is a popular adventure with ${availability.bookingCount} confirmed bookings. I'd recommend booking soon to secure your spot!`;
          } else {
            enhancedResponse = `✅ Great news! ${availability.title} has ${availability.availableSpots} spots available out of ${availability.totalCapacity} total capacity. With ${availability.bookingCount} adventurers already booked, there's still plenty of room for you to join this amazing journey!`;
          }
          
          if (availability.nextDeparture) {
            enhancedResponse += ` Next departure: ${availability.nextDeparture.toLocaleDateString()}.`;
          }
        }
      } else {
        // General availability query - show trending trips
        const recommendations = await this.getSmartRecommendations(context);
        if (recommendations.length > 0) {
          enhancedResponse += ` Here are some trips with great availability:\n\n`;
          for (const rec of recommendations.slice(0, 3)) {
            const availability = await this.getTripAvailability(rec.trip._id);
            const status = availability?.isAlmostFull ? '🔥 Almost Full' : '✅ Available';
            enhancedResponse += `• ${rec.trip.title} - ₹${rec.trip.price} ${status}\n`;
          }
        }
      }
    }
    
    // Handle organizer/leader queries
    if (match.pattern.keywords.some((k: string) => ['organizer', 'guide', 'leader'].includes(k))) {
      if (context.tripId) {
        const tripInfo = await this.getTripInfo(context.tripId);
        if (tripInfo?.organizerId) {
          const organizer = await this.getOrganizerProfile(tripInfo.organizerId);
          if (organizer) {
            enhancedResponse = `Meet your trek leader! 🏔️\n\n**${organizer.name}** - ${organizer.experience}\n⭐ ${organizer.rating}/5.0 rating from ${organizer.totalReviews} reviews\n🎯 Led ${organizer.totalTrips} successful adventures\n🏆 Specialties: ${organizer.specialties.join(', ')}\n📜 Certifications: ${organizer.certifications.join(', ')}\n🗣️ Languages: ${organizer.languages.join(', ')}`;
            
            if (organizer.rating >= 4.5) {
              enhancedResponse += '\n\n🌟 This is one of our top-rated organizers with exceptional reviews!';
            }
          }
        }
      }
    }
    
    // Handle recommendation queries
    if (match.pattern.keywords.some((k: string) => ['recommend', 'suggest', 'best', 'advice'].includes(k))) {
      const recommendations = await this.getSmartRecommendations(context);
      if (recommendations.length > 0) {
        enhancedResponse = `🎯 Based on your preferences and travel history, here are my top recommendations:\n\n`;
        
        for (let i = 0; i < Math.min(3, recommendations.length); i++) {
          const rec = recommendations[i];
          const availability = await this.getTripAvailability(rec.trip._id);
          const organizer = await this.getOrganizerProfile(rec.trip.organizerId);
          
          enhancedResponse += `**${i + 1}. ${rec.trip.title}** (₹${rec.trip.price.toLocaleString()})\n`;
          enhancedResponse += `📍 ${rec.trip.destination} • ${rec.trip.difficultyLevel} level\n`;
          enhancedResponse += `🎯 ${rec.reason}\n`;
          
          if (availability) {
            enhancedResponse += `💺 ${availability.availableSpots} spots available`;
            if (availability.isAlmostFull) enhancedResponse += ' (Almost Full!)';
            enhancedResponse += '\n';
          }
          
          if (organizer && organizer.rating >= 4.0) {
            enhancedResponse += `👨‍🏫 Led by ${organizer.name} (⭐ ${organizer.rating}/5.0)\n`;
          }
          
          enhancedResponse += '\n';
        }
        
        additionalData.recommendations = recommendations;
      } else {
        enhancedResponse += ' Let me know your preferences (budget, difficulty, interests) for personalized suggestions!';
      }
    }
    
    // Handle user analytics queries
    if (match.pattern.keywords.some((k: string) => ['my trips', 'history', 'analytics'].includes(k)) && context.userId) {
      const analytics = await this.getUserAnalytics(context.userId);
      if (analytics) {
        enhancedResponse = `📊 Your Trek Tribe Analytics:\n\n`;
        enhancedResponse += `🎒 Total Adventures: ${analytics.bookingHistory.length}\n`;
        enhancedResponse += `💰 Average Budget: ₹${analytics.preferences.averageBudget.toLocaleString()}\n`;
        enhancedResponse += `🎯 Preferred Difficulty: ${analytics.preferences.preferredDifficulty}\n`;
        enhancedResponse += `📍 Favorite Destinations: ${analytics.preferences.favoriteDestinations.join(', ')}\n`;
        enhancedResponse += `🌤️ Best Seasons: ${analytics.preferences.seasonalPreference.join(', ')}\n`;
        
        if (analytics.trendingInterests.length > 0) {
          enhancedResponse += `\n🔥 Your Current Interests: ${analytics.trendingInterests.join(', ')}\n`;
        }
        
        enhancedResponse += `\n💡 Recommended Budget Range: ₹${analytics.recommendedBudget.min.toLocaleString()} - ₹${analytics.recommendedBudget.max.toLocaleString()}`;
        
        // Get personalized recommendations
        const recommendations = await this.getSmartRecommendations(context);
        if (recommendations.length > 0) {
          enhancedResponse += `\n\n🎯 Perfect for you right now:\n• ${recommendations[0].trip.title} - ${recommendations[0].reason}`;
        }
      } else {
        enhancedResponse = `Welcome to Trek Tribe! 🎒 You haven't booked any adventures yet, but I'm excited to help you plan your first epic journey! Let me know what kind of adventure interests you.`;
      }
    }
    
    // Handle booking assistance
    if (match.pattern.keywords.some((k: string) => ['book now', 'help me book', 'guide booking'].includes(k))) {
      if (context.tripId) {
        const availability = await this.getTripAvailability(context.tripId);
        const tripInfo = await this.getTripInfo(context.tripId);
        
        if (availability && tripInfo) {
          enhancedResponse = `🎯 Let's get you booked on ${availability.title}!\n\n`;
          
          if (availability.isAlmostFull) {
            enhancedResponse += `⚡ URGENT: Only ${availability.availableSpots} spots left! This adventure is in high demand.\n\n`;
          }
          
          enhancedResponse += `📋 Here's what you need to complete your booking:\n`;
          enhancedResponse += `💰 Price: ₹${tripInfo.price.toLocaleString()} per person\n`;
          enhancedResponse += `📅 Date: ${availability.nextDeparture?.toLocaleDateString()}\n`;
          enhancedResponse += `👥 Available spots: ${availability.availableSpots}\n\n`;
          
          enhancedResponse += `🚀 Ready to book? Click 'Join Trip' on the trip page and I'll guide you through each step!`;
        }
      } else {
        enhancedResponse += ' First, let me help you find the perfect adventure! What type of experience are you looking for?';
      }
    }
    
    // Original trip context enhancements
    if (context.tripId && !match.pattern.keywords.some((k: string) => ['availability', 'organizer', 'recommend'].includes(k))) {
      const tripInfo = await this.getTripInfo(context.tripId);
      if (tripInfo) {
        if (match.pattern.keywords.includes('pickup') || match.pattern.keywords.includes('location')) {
          enhancedResponse += ` For ${tripInfo.title}, we have pickup points at ${tripInfo.pickupPoints?.join(', ') || 'multiple locations'}. Drop-off will be at ${tripInfo.dropOffPoints?.join(', ') || 'the same locations'}.`;
        }
        if (match.pattern.keywords.includes('price') || match.pattern.keywords.includes('cost')) {
          enhancedResponse += ` This specific trek (${tripInfo.title}) is priced at ₹${tripInfo.price.toLocaleString()} per person.`;
        }
      }
    }
    
    return {
      message: enhancedResponse,
      requiresHumanSupport: match.pattern.requiresHuman,
      suggestedActions: match.pattern.actions || [],
      confidence: match.confidence,
      quickReplies: (match.pattern as any).quickReplies,
      multipleChoice: (match.pattern as any).multipleChoice,
      additionalData
    };
  }
  
  private async getTripInfo(tripId: string): Promise<any> {
    try {
      // Check cache first
      if (this.tripCache.has(tripId)) {
        return this.tripCache.get(tripId);
      }
      
      // Fetch from database
      const trip = await Trip.findById(tripId).select('title price pickupPoints dropOffPoints difficulty duration');
      if (trip) {
        // Cache for 10 minutes
        this.tripCache.set(tripId, trip);
        setTimeout(() => this.tripCache.delete(tripId), 10 * 60 * 1000);
        return trip;
      }
    } catch (error) {
      logger.error('Error fetching trip info for AI context', { error, tripId });
    }
    
    return null;
  }
  
  private getGeneralResponse(query: string): AIResponse {
    const generalResponses = this.knowledgeBase.contextualResponses.general;
    const randomResponse = generalResponses[Math.floor(Math.random() * generalResponses.length)];
    
    return {
      message: `${randomResponse} I can help you with booking trips, understanding our services, payment information, safety guidelines, and much more. What specific aspect would you like to know about?`,
      requiresHumanSupport: false,
      suggestedActions: ['Browse Available Trips', 'View Services', 'Contact Support'],
      confidence: 0.6
    };
  }
}

class AISupportService {
  private trekTribeAI: TrekTribeAI;

  constructor() {
    this.trekTribeAI = new TrekTribeAI();
  }

  async handleUserQuery(
    query: string, 
    context: ChatContext
  ): Promise<AIResponse> {
    return await this.trekTribeAI.analyzeQuery(query, context);
  }

  async createSupportTicket(
    userId: string,
    subject: string,
    description: string,
    category: string = 'general'
  ): Promise<string> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const ticket = await SupportTicket.create({
        userId,
        subject,
        description,
        category,
        priority: 'medium',
        customerEmail: user.email,
        customerName: user.name,
        customerPhone: user.phone,
        status: 'open',
        messages: [{
          sender: 'customer',
          senderName: user.name,
          message: description,
          timestamp: new Date()
        }]
      });

      logger.info('Support ticket created by Trek Tribe AI', { 
        ticketId: ticket.ticketId, 
        userId 
      });

      return ticket.ticketId;
    } catch (error: any) {
      logger.error('Error creating support ticket', { error: error.message, userId });
      throw error;
    }
  }

  isServiceReady(): boolean {
    return true; // Always ready with Trek Tribe AI
  }

  getServiceStatus() {
    return {
      aiEnabled: true,
      customAI: true,
      fallbackEnabled: true,
      isReady: true,
      aiType: 'Trek Tribe Custom AI'
    };
  }
}

// Export singleton instance
export const aiSupportService = new AISupportService();
export { AISupportService };