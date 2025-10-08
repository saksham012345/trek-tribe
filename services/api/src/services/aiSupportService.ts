import { logger } from '../utils/logger';
import { Trip } from '../models/Trip';
import { User } from '../models/User';
import { SupportTicket } from '../models/SupportTicket';

interface AIResponse {
  message: string;
  requiresHumanSupport: boolean;
  suggestedActions?: string[];
  confidence: number;
}

interface ChatContext {
  userId?: string;
  userRole?: string;
  tripId?: string;
  previousMessages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>;
}

interface KnowledgeBase {
  patterns: Array<{
    keywords: string[];
    response: string;
    confidence: number;
    requiresHuman: boolean;
    actions?: string[];
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

  constructor() {
    this.knowledgeBase = this.initializeKnowledgeBase();
    logger.info('Trek Tribe AI initialized with custom knowledge base');
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
  
  private async enhanceWithTripContext(match: any, context: ChatContext): Promise<AIResponse> {
    let enhancedResponse = match.pattern.response;
    
    // If user is viewing a specific trip, add trip-specific information
    if (context.tripId) {
      const tripInfo = await this.getTripInfo(context.tripId);
      if (tripInfo) {
        if (match.pattern.keywords.includes('pickup') || match.pattern.keywords.includes('location')) {
          enhancedResponse += ` For ${tripInfo.title}, we have pickup points at ${tripInfo.pickupPoints?.join(', ') || 'multiple locations'}. Drop-off will be at ${tripInfo.dropOffPoints?.join(', ') || 'the same locations'}.`;
        }
        if (match.pattern.keywords.includes('price') || match.pattern.keywords.includes('cost')) {
          enhancedResponse += ` This specific trek (${tripInfo.title}) is priced at ₹${tripInfo.price} per person.`;
        }
      }
    }
    
    return {
      message: enhancedResponse,
      requiresHumanSupport: match.pattern.requiresHuman,
      suggestedActions: match.pattern.actions || [],
      confidence: match.confidence
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