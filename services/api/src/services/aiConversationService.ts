import { prisma } from '../lib/prisma';
import { AIConversation as AIConversationRow, AIConversationMessage } from '@prisma/client';

/** A conversation with its messages loaded. */
type ConversationWithMessages = AIConversationRow & { messages: AIConversationMessage[] };

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * The Mongoose model carried this behaviour as statics and instance methods
 * (getOrCreate, addMessage, summarizeAndCompress, getContext, escalateToHuman).
 * Prisma has no place to hang them, so they live here as plain functions - which
 * also makes it visible that addMessage does three writes, not one.
 */

async function getOrCreate(sessionId: string, userId?: string): Promise<ConversationWithMessages> {
  const existing = await prisma.aIConversation.findUnique({
    where: { sessionId },
    include: { messages: { orderBy: { timestamp: 'asc' } } }
  });
  if (existing) return existing;

  // sessionId is unique, so two callers racing to start the same conversation
  // cannot both create one - the second gets the first's row.
  return await prisma.aIConversation.upsert({
    where: { sessionId },
    create: { sessionId, userId, expiresAt: new Date(Date.now() + THIRTY_DAYS_MS) },
    update: {},
    include: { messages: { orderBy: { timestamp: 'asc' } } }
  });
}

/**
 * Keep only the most recent 8 messages, after folding what the older ones knew
 * into the summary. The Mongoose version reassigned this.messages to a slice;
 * here the rows are deleted, which is the same intent said out loud.
 */
async function summarizeAndCompress(conversationId: string): Promise<void> {
  const messages = await prisma.aIConversationMessage.findMany({
    where: { conversationId },
    orderBy: { timestamp: 'asc' }
  });

  const topics = new Set<string>();
  const entities = new Set<string>();
  for (const msg of messages) {
    const meta = (msg.metadata ?? {}) as any;
    if (meta.intent) topics.add(meta.intent);
    if (Array.isArray(meta.entities)) meta.entities.forEach((e: string) => entities.add(e));
  }

  const conversation = await prisma.aIConversation.findUnique({
    where: { id: conversationId }
  });

  await prisma.aIConversation.update({
    where: { id: conversationId },
    data: {
      summary: {
        topics: Array.from(topics),
        keyEntities: Array.from(entities),
        resolution: conversation?.escalated ? 'escalated' : 'ongoing',
        lastSummaryAt: new Date().toISOString()
      }
    }
  });

  if (messages.length > 8) {
    const doomed = messages.slice(0, messages.length - 8).map(m => m.id);
    await prisma.aIConversationMessage.deleteMany({ where: { id: { in: doomed } } });
  }
}

async function addMessage(
  sessionId: string,
  role: 'user' | 'assistant' | 'system',
  content: string,
  metadata?: any
): Promise<ConversationWithMessages> {
  const conversation = await getOrCreate(sessionId);

  await prisma.aIConversationMessage.create({
    data: {
      conversationId: conversation.id,
      role,
      content: content.substring(0, 2000), // Truncate if too long
      metadata: metadata ?? {}
    }
  });

  // Expiry rides on the last interaction, as before, and the prune job is what
  // actually deletes - Postgres has no TTL.
  await prisma.aIConversation.update({
    where: { id: conversation.id },
    data: {
      lastInteractionAt: new Date(),
      expiresAt: new Date(Date.now() + THIRTY_DAYS_MS)
    }
  });

  const count = await prisma.aIConversationMessage.count({
    where: { conversationId: conversation.id }
  });
  if (count > 15) {
    await summarizeAndCompress(conversation.id);
  }

  return (await prisma.aIConversation.findUnique({
    where: { id: conversation.id },
    include: { messages: { orderBy: { timestamp: 'asc' } } }
  }))!;
}
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
  async getOrCreateConversation(sessionId: string, userId?: string) {
    return await getOrCreate(sessionId, userId);
  }

  /**
   * Get conversation by session ID
   */
  async getConversation(sessionId: string) {
    return await prisma.aIConversation.findUnique({
      where: { sessionId },
      include: { messages: { orderBy: { timestamp: 'asc' } } }
    });
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
  ) {
    return await addMessage(sessionId, 'user', message, metadata);
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
  ) {
    return await addMessage(sessionId, 'assistant', message, metadata);
  }

  /**
   * Get conversation history (for context in AI responses)
   */
  async getConversationHistory(sessionId: string, limit: number = 6) {
    const conversation = await prisma.aIConversation.findUnique({ where: { sessionId } });
    if (!conversation) {
      return [];
    }

    // The last N messages are a query now, not a slice of a loaded array.
    const recent = await prisma.aIConversationMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: { timestamp: 'desc' },
      take: limit
    });
    return recent.reverse();
  }

  /**
   * Get conversation context for follow-up handling
   */
  async getConversationContext(sessionId: string): Promise<any> {
    const conversation = await prisma.aIConversation.findUnique({
      where: { sessionId },
      include: { messages: { orderBy: { timestamp: 'desc' }, take: 6 } }
    });
    if (!conversation) {
      return null;
    }

    // Was the getContext() instance method on the Mongoose document.
    const context = (conversation.context ?? {}) as any;
    return {
      lastIntent: context.lastIntent,
      lastEntities: context.lastEntities || [],
      recentMessages: [...conversation.messages].reverse(), // Last 3 exchanges
      summary: conversation.summary,
      relatedTrips: context.relatedTrips || [],
      relatedBookings: context.relatedBookings || [],
      currentTrip: context.currentTrip,
      organizer: context.organizer
    };
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
    const conversation = await prisma.aIConversation.findUnique({ where: { sessionId } });
    if (!conversation) {
      return;
    }

    // updateContext merged into the nested object; context is a JSON column, so
    // the merge happens here and is written whole.
    const current = (conversation.context ?? {}) as any;
    await prisma.aIConversation.update({
      where: { sessionId },
      data: {
        context: {
          ...current,
          ...(update.intent !== undefined ? { lastIntent: update.intent } : {}),
          ...(update.entities !== undefined ? { lastEntities: update.entities } : {}),
          ...(update.relatedTrips !== undefined
            ? { relatedTrips: update.relatedTrips.map(String) } : {}),
          ...(update.relatedBookings !== undefined
            ? { relatedBookings: update.relatedBookings.map(String) } : {})
        }
      }
    });
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
    const conversation = await prisma.aIConversation.findUnique({ where: { sessionId } });
    if (!conversation) {
      return;
    }

    await prisma.aIConversation.update({
      where: { sessionId },
      data: { escalated: true, escalatedAt: new Date(), escalationReason: reason }
    });
  }

  /**
   * Get conversations for human agent review
   */
  async getEscalatedConversations(agentId?: string) {
    // escalation was a nested object queried by dotted path; those are columns
    // now, with an index on (escalated, assignedAgentId) - which is the index
    // the Mongoose schema declared and this query wanted all along.
    const where = {
      escalated: true,
      assignedAgentId: agentId ? agentId : null
    };

    return await prisma.aIConversation.findMany({
      where,
      orderBy: { escalatedAt: 'desc' },
      take: 50
    });
  }

  /**
   * Assign escalated conversation to agent
   */
  async assignToAgent(sessionId: string, agentId: string): Promise<void> {
    await prisma.aIConversation.update({
      where: { sessionId },
      data: { assignedAgentId: agentId }
    });
  }

  /**
   * Get conversation for human agent view (full context)
   */
  async getConversationForAgent(sessionId: string): Promise<{
    conversation: ConversationWithMessages | null;
    formattedHistory: Array<{
      role: string;
      message: string;
      timestamp: Date;
      metadata?: any;
    }>;
    summary: any;
  }> {
    // The three populate() calls are gone: users, trips and bookings are all
    // still Mongo documents, and context holds their ids as strings in JSON.
    // Nothing in the response below read the populated fields.
    const conversation = await prisma.aIConversation.findUnique({
      where: { sessionId },
      include: { messages: { orderBy: { timestamp: 'asc' } } }
    });

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
    const conversation = await prisma.aIConversation.findUnique({ where: { sessionId } });
    if (!conversation) {
      return;
    }

    // messageCount was a stored number; it is a count of the message rows now,
    // so the running averages read the real count rather than a field that
    // could have drifted from it.
    const count = await prisma.aIConversationMessage.count({
      where: { conversationId: conversation.id }
    });

    const data: any = {};

    if (metrics.responseTime && count > 0) {
      const currentAvg = conversation.avgResponseTime || 0;
      data.avgResponseTime = (currentAvg * (count - 1) + metrics.responseTime) / count;
    }

    if (metrics.userSatisfaction) {
      data.userSatisfaction = metrics.userSatisfaction;
    }

    if (metrics.aiConfidence && count > 0) {
      const currentAvg = conversation.aiConfidenceAvg || 0;
      data.aiConfidenceAvg = (currentAvg * (count - 1) + metrics.aiConfidence) / count;
    }

    if (Object.keys(data).length > 0) {
      await prisma.aIConversation.update({ where: { sessionId }, data });
    }
  }

  /**
   * Cleanup old conversations (run as cron job)
   */
  async cleanupOldConversations(daysOld: number = 30): Promise<number> {
    // Was a Mongoose static leaning on the TTL index. Postgres has no TTL, so
    // this deletes by age directly - and scripts/prune-expired.ts is what runs
    // on a schedule.
    const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
    const result = await prisma.aIConversation.deleteMany({
      where: { lastInteractionAt: { lt: cutoff } }
    });
    return result.count;
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
    const [total, active, escalated, messageTotal, satisfaction] = await Promise.all([
      prisma.aIConversation.count(),
      prisma.aIConversation.count({
        where: { lastInteractionAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }
      }),
      prisma.aIConversation.count({ where: { escalated: true } }),
      // messageCount is no longer stored, so the average comes from counting the
      // rows rather than averaging a column that could disagree with them.
      prisma.aIConversationMessage.count(),
      prisma.aIConversation.aggregate({
        where: { userSatisfaction: { not: null } },
        _avg: { userSatisfaction: true }
      })
    ]);

    const avgMessages = [{ avg: total > 0 ? messageTotal / total : 0 }];
    const avgSatisfaction = [{ avg: satisfaction._avg.userSatisfaction ?? 0 }];

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
