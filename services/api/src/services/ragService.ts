import { KnowledgeBase, KnowledgeType } from '../models/KnowledgeBase';
import { embeddingService } from './embeddingService';
import { logger } from '../utils/logger';

interface RAGContext {
  userPreferences?: {
    difficulty?: string;
    destination?: string;
    budget?: { min?: number; max?: number };
    interests?: string[];
  };
  conversationHistory?: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>;
}

interface RAGResponse {
  answer: string;
  sources: Array<{
    title: string;
    type: KnowledgeType;
    score: number;
    content?: string;
  }>;
  confidence: number;
  intent?: string;
  suggestedActions?: string[];
}

export class RAGService {
  /**
   * Generate contextual response using RAG
   */
  public async generateRAGResponse(
    query: string,
    context: RAGContext = {}
  ): Promise<RAGResponse> {
    try {
      logger.info('Generating RAG response', { query, hasContext: !!context.userPreferences });

      // Search for relevant information
      const searchResults = await this.enhancedSearch(query, context, {
        maxResults: 5,
        types: ['faq', 'guide', 'policy', 'trip'],
        useEmbeddings: true
      });

      const { trips, knowledge } = searchResults;

      // Build response based on found information
      let answer = '';
      let sources: Array<{ title: string; type: KnowledgeType; score: number; content?: string }> = [];
      let confidence = 0;

      // Process knowledge results
      if (knowledge.length > 0) {
        const topKnowledge = knowledge.slice(0, 3);
        answer = this.synthesizeKnowledgeResponse(query, topKnowledge);
        sources = topKnowledge.map(k => ({ 
          title: k.title, 
          type: k.type, 
          score: k.score,
          content: k.content.substring(0, 150)
        }));
        confidence = Math.min(topKnowledge.reduce((sum, k) => sum + k.score, 0) / topKnowledge.length, 1.0);
      }

      // Add trip information if relevant
      if (trips.length > 0 && this.isQueryTripRelated(query)) {
        const topTrips = trips.slice(0, 2);
        if (answer) answer += '\n\n';
        answer += this.synthesizeTripResponse(query, topTrips);
        sources.push(...topTrips.map(t => ({ 
          title: t.title || 'Trip', 
          type: 'trip' as KnowledgeType, 
          score: t.score,
          content: t.text?.substring(0, 150)
        })));
      }

      // Fallback if no good results
      if (!answer || confidence < 0.2) {
        answer = 'I don\'t have specific information about that in our knowledge base. Let me connect you with our support team for detailed assistance.';
        confidence = 0.1;
      }

      // Detect intent and suggest actions
      const intent = this.detectIntent(query);
      const suggestedActions = this.generateSuggestedActions(intent, sources);

      return { 
        answer, 
        sources, 
        confidence, 
        intent,
        suggestedActions
      };

    } catch (error: any) {
      logger.error('Error generating RAG response', { error: error.message, query });
      return {
        answer: 'I apologize, but I\'m having trouble accessing our knowledge base right now. Let me connect you with our support team.',
        sources: [],
        confidence: 0.1
      };
    }
  }

  /**
   * Enhanced search with semantic understanding
   */
  public async enhancedSearch(
    query: string, 
    context: RAGContext = {}, 
    options: { maxResults?: number; types?: KnowledgeType[]; useEmbeddings?: boolean } = {}
  ): Promise<{ 
    trips: Array<{ title: string; score: number; text?: string }>; 
    knowledge: Array<{ title: string; content: string; type: KnowledgeType; score: number }> 
  }> {
    const { maxResults = 5, types = ['faq', 'guide', 'trip'], useEmbeddings = true } = options;
    
    // Search knowledge base
    let knowledge: Array<{ title: string; content: string; type: KnowledgeType; score: number }> = [];
    
    try {
      if (useEmbeddings && embeddingService.isReady()) {
        // Use embedding-based search
        knowledge = await this.searchKnowledgeWithEmbeddings(query, context, { maxResults, types });
      } else {
        // Fallback to text-based search
        knowledge = await this.searchKnowledgeWithText(query, context, { maxResults, types });
      }
    } catch (error: any) {
      logger.error('Error searching knowledge base', { error: error.message });
      // Continue with empty results
    }
    
    // For now, return empty trips array (this would integrate with existing trip search)
    const trips: Array<{ title: string; score: number; text?: string }> = [];
    
    return { trips, knowledge };
  }

  /**
   * Search knowledge base using embeddings
   */
  private async searchKnowledgeWithEmbeddings(
    query: string,
    context: RAGContext,
    options: { maxResults: number; types: KnowledgeType[] }
  ): Promise<Array<{ title: string; content: string; type: KnowledgeType; score: number }>> {
    try {
      // Generate embedding for the query
      const queryEmbedding = await embeddingService.generateEmbedding(query);
      
      // Build search context for filtering
      const searchContext: any = {};
      if (context.userPreferences) {
        if (context.userPreferences.difficulty) {
          searchContext.difficulty = context.userPreferences.difficulty;
        }
        if (context.userPreferences.destination) {
          searchContext.destination = context.userPreferences.destination;
        }
        if (context.userPreferences.budget) {
          searchContext.priceRange = context.userPreferences.budget;
        }
      }
      
      // Get knowledge documents with embeddings
      const knowledgeDocs = await KnowledgeBase.find({
        isActive: true,
        type: { $in: options.types },
        embedding: { $exists: true, $ne: [] }
      })
      .select('title summary content type embedding relevanceScore queryCount')
      .limit(options.maxResults * 3); // Get more for similarity filtering
      
      // Calculate similarities
      const similarities = knowledgeDocs.map(doc => {
        const similarity = embeddingService.calculateSimilarity(queryEmbedding.embedding, doc.embedding);
        return {
          title: doc.title,
          content: doc.summary || doc.content.substring(0, 300),
          type: doc.type,
          score: similarity * doc.relevanceScore, // Boost by relevance score
          doc
        };
      });
      
      // Sort by similarity and return top results
      return similarities
        .filter(item => item.score > 0.2) // Filter low similarity
        .sort((a, b) => b.score - a.score)
        .slice(0, options.maxResults);
        
    } catch (error: any) {
      logger.error('Error in embedding-based knowledge search', { error: error.message });
      throw error;
    }
  }

  /**
   * Search knowledge base using text search (fallback)
   */
  private async searchKnowledgeWithText(
    query: string,
    context: RAGContext,
    options: { maxResults: number; types: KnowledgeType[] }
  ): Promise<Array<{ title: string; content: string; type: KnowledgeType; score: number }>> {
    try {
      // Use MongoDB text search
      const results = await (KnowledgeBase as any).semanticSearch(query, {
        type: options.types,
        limit: options.maxResults
      });
      
      return results.map((doc: any) => ({
        title: doc.title,
        content: doc.summary || doc.content.substring(0, 300),
        type: doc.type,
        score: doc.relevanceScore
      }));
    } catch (error: any) {
      logger.error('Error in text-based knowledge search', { error: error.message });
      return [];
    }
  }

  /**
   * Synthesize response from knowledge base results
   */
  private synthesizeKnowledgeResponse(
    query: string,
    knowledge: Array<{ title: string; content: string; type: KnowledgeType; score: number }>
  ): string {
    if (knowledge.length === 0) return '';
    
    let response = '';
    
    // Group by type for better organization
    const grouped = knowledge.reduce((acc, item) => {
      if (!acc[item.type]) acc[item.type] = [];
      acc[item.type].push(item);
      return acc;
    }, {} as Record<KnowledgeType, typeof knowledge>);
    
    // FAQ responses
    if (grouped.faq && grouped.faq.length > 0) {
      response += grouped.faq.slice(0, 2).map(item => item.content).join('\n\n');
    }
    
    // Guide responses
    if (grouped.guide && grouped.guide.length > 0) {
      if (response) response += '\n\n';
      response += grouped.guide.slice(0, 1).map(item => item.content).join('\n\n');
    }
    
    // Policy responses
    if (grouped.policy && grouped.policy.length > 0) {
      if (response) response += '\n\n';
      response += `**Policy Information:**\n${grouped.policy.slice(0, 1).map(item => item.content).join('\n\n')}`;
    }
    
    return response || knowledge[0].content;
  }

  /**
   * Synthesize response from trip results
   */
  private synthesizeTripResponse(
    query: string, 
    trips: Array<{ title: string; score: number; text?: string }>
  ): string {
    if (trips.length === 0) return '';
    
    let response = 'Here are some relevant trips:\n\n';
    
    trips.forEach((trip, index) => {
      response += `${index + 1}. **${trip.title}**\n`;
      if (trip.text) {
        response += `   ${trip.text.substring(0, 100)}...\n`;
      }
      response += '\n';
    });
    
    return response;
  }

  /**
   * Check if query is trip-related
   */
  private isQueryTripRelated(query: string): boolean {
    const tripKeywords = ['trip', 'trek', 'adventure', 'destination', 'travel', 'journey', 'expedition', 'tour'];
    const lowerQuery = query.toLowerCase();
    return tripKeywords.some(keyword => lowerQuery.includes(keyword));
  }

  /**
   * Detect intent from query
   */
  private detectIntent(query: string): string {
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('book') || lowerQuery.includes('reserve')) {
      return 'booking';
    }
    if (lowerQuery.includes('cancel') || lowerQuery.includes('refund')) {
      return 'cancellation';
    }
    if (lowerQuery.includes('price') || lowerQuery.includes('cost') || lowerQuery.includes('budget')) {
      return 'pricing';
    }
    if (lowerQuery.includes('safety') || lowerQuery.includes('emergency')) {
      return 'safety';
    }
    if (lowerQuery.includes('what') && lowerQuery.includes('include')) {
      return 'inclusions';
    }
    if (this.isQueryTripRelated(query)) {
      return 'trip_info';
    }
    
    return 'general';
  }

  /**
   * Generate suggested actions based on intent and sources
   */
  private generateSuggestedActions(
    intent?: string, 
    sources: Array<{ type: KnowledgeType }> = []
  ): string[] {
    const actions: string[] = [];
    const sourceTypes = new Set(sources.map(s => s.type));
    
    // Intent-based actions
    switch (intent) {
      case 'booking':
        actions.push('View Available Trips', 'Start Booking Process');
        break;
      case 'cancellation':
        actions.push('View Cancellation Policy', 'Contact Support');
        break;
      case 'pricing':
        actions.push('View Trip Pricing', 'Calculate Budget');
        break;
      case 'safety':
        actions.push('Safety Guidelines', 'Emergency Contacts');
        break;
      case 'trip_info':
        actions.push('Browse Trips', 'Get Recommendations');
        break;
    }
    
    // Source-based actions
    if (sourceTypes.has('trip')) {
      actions.push('View Trip Details', 'Check Availability');
    }
    if (sourceTypes.has('faq')) {
      actions.push('More FAQs');
    }
    if (sourceTypes.has('guide')) {
      actions.push('View Guides');
    }
    if (sourceTypes.has('policy')) {
      actions.push('View Policies');
    }
    
    // Default actions if no specific ones
    if (actions.length === 0) {
      actions.push('Ask Another Question', 'Browse Trips', 'Contact Support');
    }
    
    // Remove duplicates and limit
    return [...new Set(actions)].slice(0, 4);
  }

  /**
   * Check if RAG service is ready
   */
  public isReady(): boolean {
    return embeddingService.isReady();
  }

  /**
   * Get enhanced service status
   */
  public getEnhancedStatus() {
    return {
      embeddingService: embeddingService.getStatus(),
      isReady: this.isReady()
    };
  }
}

export const ragService = new RAGService();