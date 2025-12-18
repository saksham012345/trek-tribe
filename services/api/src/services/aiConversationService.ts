import AIConversation, { IAIConversation, ICompressedMessage } from '../models/AIConversation';
import mongoose from 'mongoose';

/**
 * Service for managing AI conversations with minimal storage
 * Handles context, follow-ups, and automatic summarization
 */
class AIConversationService {
  private static instance: AIConversationService;
  
  static getInstance(): AIConversationService {
    if (!AIConversationService.instance) {
      AIConversationService.instance = new AIConversationService();
    }
    return AIConversationService.instance;
  }

  /**
   * Get or create conversation for a session
   */
  async getOrCreateConversation(sessionId: string, userId?: string): Promise<IAIConversation> {
    return await AIConversation.getOrCreate(sessionId, userId);
  }

  /**
   * Get conversation by session ID
   */
  async getConversation(sessionId: string): Promise<IAIConversation | null> {
    return await AIConversation.findOne({ sessionId });
  }

  /**
   * Add user message to conversation
   */
  async addUserMessage(
    sessionId: string,
    message: string,
    metadata?: {
      intent?: string;
      entities?: string[];
      sentiment?: 'positive' | 'negative' | 'neutral';
    }
  ): Promise<IAIConversation> {
    const conversation = await this.getOrCreateConversation(sessionId);
    await conversation.addMessage('user', message, metadata);
    await conversation.save();
    return conversation;
  }

  /**
   * Add AI assistant response to conversation
   */
  async addAssistantMessage(
    sessionId: string,
    message: string,
    metadata?: {
      intent?: string;
      entities?: string[];
      requiresFollowUp?: boolean;
    }
  ): Promise<IAIConversation> {
    const conversation = await this.getOrCreateConversation(sessionId);
    await conversation.addMessage('assistant', message, metadata);
    await conversation.save();
    return conversation;
  }

  /**
   * Get conversation history (for context in AI responses)
   */
  async getConversationHistory(sessionId: string, limit: number = 6): Promise<ICompressedMessage[]> {
    const conversation = await AIConversation.findOne({ sessionId });
    if (!conversation) {
      return [];
    }
    
    // Return last N messages
    return conversation.messages.slice(-limit);
  }

  /**
   * Get conversation context for follow-up handling
   */
  async getConversationContext(sessionId: string): Promise<any> {
    const conversation = await AIConversation.findOne({ sessionId });
    if (!conversation) {
      return null;
    }
    
    return conversation.getContext();
  }

  /**
   * Update conversation context
   */
  async updateConversationContext(
    sessionId: string,
    update: {
      intent?: string;
      entities?: string[];
      relatedTrips?: mongoose.Types.ObjectId[];
      relatedBookings?: mongoose.Types.ObjectId[];
    }
  ): Promise<void> {
    const conversation = await AIConversation.findOne({ sessionId });
    if (!conversation) {
      return;
    }
    
    conversation.updateContext(update);
    await conversation.save();
  }

  /**
   * Detect if user message is a follow-up question
   */
  detectFollowUp(message: string, context: any): {
    isFollowUp: boolean;
    followUpType?: 'clarification' | 'continuation' | 'related';
    referenceContext?: any;
  } {
    const lowerMessage = message.toLowerCase().trim();
    
    // Follow-up indicators (expanded to catch messy/gibberish inputs)
    const clarificationWords = [
      'what', 'which', 'how', 'why', 'where', 'when', 'more', 'more about', 'explain',
      'details', 'about that', 'elaborate', 'tell me', 'tell me more', 'clarify'
    ];
    const continuationWords = [
      'and', 'also', 'additionally', 'furthermore', 'what else', 'anything else',
      'btw', 'btw,', 'plus', 'next', 'then'
    ];
    const referenceWords = [
      'it', 'that', 'this', 'those', 'these', 'them', 'one', 'there', 'same', 'thing', 'stuff'
    ];
    const fillerWords = ['uh', 'uhh', 'umm', 'hmm', 'lol', 'lmao', 'asdf', 'asd', 'jk', 'pls', 'plz'];
    
    // Short or noisy messages are likely follow-ups
    const isShort = message.split(' ').filter(Boolean).length <= 6;
    const hasQuestionMark = lowerMessage.includes('?');
    const hasFiller = fillerWords.some(word => lowerMessage.includes(word));
    const isMostlyPunctuationOrFiller = lowerMessage.replace(/[a-z0-9]/gi, '').length > lowerMessage.length * 0.4 || hasFiller;
    
    // Contains reference words
    const hasReference = referenceWords.some(word => 
      new RegExp(`\\b${word}\\b`, 'i').test(lowerMessage)
    );
    
    // Contains clarification words
    const hasClarification = clarificationWords.some(word => lowerMessage.includes(word));
    
    // Contains continuation words
    const hasContinuation = continuationWords.some(word => lowerMessage.includes(word));
    
    // Check if context exists
    const hasContext = context && (
      context.lastIntent || 
      context.lastEntities?.length > 0 ||
      context.recentMessages?.length > 0
    );
    
    // Determine if it's a follow-up
    if (!hasContext) {
      return { isFollowUp: false };
    }
    
    // World knowledge questions should NOT be follow-ups unless explicitly referencing previous context
    const worldKnowledgePatterns = [
      /what is (the|a) capital/i,
      /who is/i, /who was/i, /who are/i,
      /what is (the|a) population/i,
      /where is (the|a)/i,
      /when did/i, /when was/i,
      /how (tall|high|far|long|big|small) is/i,
      /what are the|what is the (largest|biggest|smallest)/i
    ];
    const isWorldKnowledge = worldKnowledgePatterns.some(pattern => pattern.test(message));
    if (isWorldKnowledge && !hasReference) {
      return { isFollowUp: false };
    }
    
    if (isShort && (hasReference || hasFiller || isMostlyPunctuationOrFiller) && !hasQuestionMark) {
      return {
        isFollowUp: true,
        followUpType: 'clarification',
        referenceContext: {
          lastIntent: context.lastIntent,
          lastEntities: context.lastEntities,
          relatedTrips: context.relatedTrips,
          relatedBookings: context.relatedBookings
        }
      };
    }
    
    if (hasClarification && hasReference && hasContext) {
      return {
        isFollowUp: true,
        followUpType: 'clarification',
        referenceContext: {
          lastIntent: context.lastIntent,
          lastEntities: context.lastEntities
        }
      };
    }
    
    if (hasContinuation && hasContext) {
      return {
        isFollowUp: true,
        followUpType: 'continuation',
        referenceContext: {
          lastIntent: context.lastIntent,
          lastEntities: context.lastEntities
        }
      };
    }

    // Catch-all: short + question + context
    if (hasContext && (isShort || hasQuestionMark)) {
      return {
        isFollowUp: true,
        followUpType: 'clarification',
        referenceContext: {
          lastIntent: context.lastIntent,
          lastEntities: context.lastEntities,
          relatedTrips: context.relatedTrips,
          relatedBookings: context.relatedBookings
        }
      };
    }
    
    return { isFollowUp: false };
  }

  /**
   * Enhance message with context for follow-up handling
   */
  enhanceMessageWithContext(message: string, context: any): string {
    if (!context) {
      return message;
    }
    
    const followUpInfo = this.detectFollowUp(message, context);
    
    if (!followUpInfo.isFollowUp || !followUpInfo.referenceContext) {
      return message;
    }
    
    // Build context prefix
    const contextParts: string[] = [];
    
    if (followUpInfo.referenceContext.lastIntent) {
      contextParts.push(`Previous topic: ${followUpInfo.referenceContext.lastIntent}`);
    }
    
    if (followUpInfo.referenceContext.lastEntities?.length > 0) {
      contextParts.push(`Mentioned: ${followUpInfo.referenceContext.lastEntities.join(', ')}`);
    }
    
    if (contextParts.length === 0) {
      return message;
    }
    
    // Return enhanced message
    return `[Context: ${contextParts.join(' | ')}]\n\nUser follow-up question: ${message}`;
  }

  /**
   * Extract intent and entities from message (basic NLP)
   */
  extractMetadata(message: string): {
    intent?: string;
    entities?: string[];
    sentiment?: 'positive' | 'negative' | 'neutral';
  } {
    const lowerMessage = message.toLowerCase();
    
    // Intent detection
    let intent: string | undefined;
    
    if (/\b(book|booking|reserve|reservation)\b/.test(lowerMessage)) {
      intent = 'booking';
    } else if (/\b(cancel|refund|cancellation)\b/.test(lowerMessage)) {
      intent = 'cancellation';
    } else if (/\b(recommend|suggestion|suggest|best|popular)\b/.test(lowerMessage)) {
      intent = 'recommendation';
    } else if (/\b(safety|safe|danger|risk|emergency)\b/.test(lowerMessage)) {
      intent = 'safety';
    } else if (/\b(pack|packing|gear|equipment|bring)\b/.test(lowerMessage)) {
      intent = 'packing';
    } else if (/\b(weather|temperature|rain|snow|climate)\b/.test(lowerMessage)) {
      intent = 'weather';
    } else if (/\b(payment|pay|cost|price|amount)\b/.test(lowerMessage)) {
      intent = 'payment';
    } else if (/\b(help|support|assist|question)\b/.test(lowerMessage)) {
      intent = 'general_help';
    }
    
    // Entity extraction (basic pattern matching)
    const entities: string[] = [];
    
    // Location entities
    const locations = [
      'manali', 'leh', 'ladakh', 'spiti', 'himachal', 'uttarakhand', 
      'kashmir', 'sikkim', 'kedarkantha', 'roopkund', 'hampta', 
      'triund', 'chadar', 'markha valley'
    ];
    locations.forEach(loc => {
      if (lowerMessage.includes(loc)) {
        entities.push(loc.charAt(0).toUpperCase() + loc.slice(1));
      }
    });
    
    // Season entities
    const seasons = ['winter', 'summer', 'monsoon', 'spring', 'autumn'];
    seasons.forEach(season => {
      if (lowerMessage.includes(season)) {
        entities.push(season);
      }
    });
    
    // Difficulty entities
    const difficulties = ['easy', 'moderate', 'difficult', 'challenging', 'beginner'];
    difficulties.forEach(diff => {
      if (lowerMessage.includes(diff)) {
        entities.push(diff);
      }
    });
    
    // Sentiment detection (basic)
    let sentiment: 'positive' | 'negative' | 'neutral' = 'neutral';
    
    const positiveWords = ['great', 'good', 'awesome', 'excellent', 'perfect', 'love', 'thanks', 'thank'];
    const negativeWords = ['bad', 'poor', 'terrible', 'awful', 'problem', 'issue', 'complaint', 'worried', 'concern'];
    
    const hasPositive = positiveWords.some(word => lowerMessage.includes(word));
    const hasNegative = negativeWords.some(word => lowerMessage.includes(word));
    
    if (hasPositive && !hasNegative) {
      sentiment = 'positive';
    } else if (hasNegative && !hasPositive) {
      sentiment = 'negative';
    }
    
    return {
      intent,
      entities: entities.length > 0 ? entities : undefined,
      sentiment
    };
  }

  /**
   * Escalate conversation to human agent
   */
  async escalateToHuman(sessionId: string, reason: string): Promise<void> {
    const conversation = await AIConversation.findOne({ sessionId });
    if (!conversation) {
      return;
    }
    
    conversation.escalateToHuman(reason);
    await conversation.save();
  }

  /**
   * Get conversations for human agent review
   */
  async getEscalatedConversations(agentId?: string): Promise<IAIConversation[]> {
    const query: any = {
      'escalation.escalated': true
    };
    
    if (agentId) {
      query['escalation.assignedAgent'] = agentId;
    } else {
      // Get unassigned escalations
      query['escalation.assignedAgent'] = { $exists: false };
    }
    
    return await AIConversation.find(query)
      .sort({ 'escalation.escalatedAt': -1 })
      .populate('userId', 'name email phone')
      .limit(50);
  }

  /**
   * Assign escalated conversation to agent
   */
  async assignToAgent(sessionId: string, agentId: string): Promise<void> {
    await AIConversation.updateOne(
      { sessionId },
      { 
        $set: { 
          'escalation.assignedAgent': agentId 
        } 
      }
    );
  }

  /**
   * Get conversation for human agent view (full context)
   */
  async getConversationForAgent(sessionId: string): Promise<{
    conversation: IAIConversation | null;
    formattedHistory: Array<{
      role: string;
      message: string;
      timestamp: Date;
      metadata?: any;
    }>;
    summary: any;
  }> {
    const conversation = await AIConversation.findOne({ sessionId })
      .populate('userId', 'name email phone profilePhoto')
      .populate('context.relatedTrips', 'title destination')
      .populate('context.relatedBookings', 'bookingId status');
    
    if (!conversation) {
      return {
        conversation: null,
        formattedHistory: [],
        summary: null
      };
    }
    
    // Format history for human readability
    const formattedHistory = conversation.messages.map(msg => ({
      role: msg.role === 'user' ? 'Customer' : msg.role === 'assistant' ? 'AI Assistant' : 'System',
      message: msg.content,
      timestamp: msg.timestamp,
      metadata: msg.metadata
    }));
    
    return {
      conversation,
      formattedHistory,
      summary: conversation.summary
    };
  }

  /**
   * Update conversation metrics
   */
  async updateMetrics(
    sessionId: string,
    metrics: {
      responseTime?: number;
      userSatisfaction?: 1 | 2 | 3 | 4 | 5;
      aiConfidence?: number;
    }
  ): Promise<void> {
    const conversation = await AIConversation.findOne({ sessionId });
    if (!conversation) {
      return;
    }
    
    if (metrics.responseTime) {
      const currentAvg = conversation.metrics.avgResponseTime || 0;
      const count = conversation.metrics.messageCount;
      conversation.metrics.avgResponseTime = 
        (currentAvg * (count - 1) + metrics.responseTime) / count;
    }
    
    if (metrics.userSatisfaction) {
      conversation.metrics.userSatisfaction = metrics.userSatisfaction;
    }
    
    if (metrics.aiConfidence) {
      const currentAvg = conversation.metrics.aiConfidenceAvg || 0;
      const count = conversation.metrics.messageCount;
      conversation.metrics.aiConfidenceAvg = 
        (currentAvg * (count - 1) + metrics.aiConfidence) / count;
    }
    
    await conversation.save();
  }

  /**
   * Cleanup old conversations (run as cron job)
   */
  async cleanupOldConversations(daysOld: number = 30): Promise<number> {
    return await AIConversation.cleanupOldConversations(daysOld);
  }

  /**
   * Get conversation statistics
   */
  async getStatistics(): Promise<{
    totalConversations: number;
    activeConversations: number;
    escalatedConversations: number;
    avgMessagesPerConversation: number;
    avgSatisfactionScore: number;
  }> {
    const total = await AIConversation.countDocuments();
    const active = await AIConversation.countDocuments({
      lastInteractionAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    });
    const escalated = await AIConversation.countDocuments({
      'escalation.escalated': true
    });
    
    const avgMessages = await AIConversation.aggregate([
      { $group: { _id: null, avg: { $avg: '$metrics.messageCount' } } }
    ]);
    
    const avgSatisfaction = await AIConversation.aggregate([
      { $match: { 'metrics.userSatisfaction': { $exists: true } } },
      { $group: { _id: null, avg: { $avg: '$metrics.userSatisfaction' } } }
    ]);
    
    return {
      totalConversations: total,
      activeConversations: active,
      escalatedConversations: escalated,
      avgMessagesPerConversation: avgMessages[0]?.avg || 0,
      avgSatisfactionScore: avgSatisfaction[0]?.avg || 0
    };
  }
}

export const aiConversationService = AIConversationService.getInstance();
