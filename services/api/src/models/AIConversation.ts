import mongoose, { Schema, Document } from 'mongoose';

/**
 * Compressed message format to minimize storage
 * Only stores essential data for context
 */
export interface ICompressedMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  // Optional fields used by analytics-only calculations
  responseTime?: number;
  topic?: string;
  requiresHumanAgent?: boolean;
  sender?: string;
  // Optional metadata for important context
  metadata?: {
    intent?: string; // e.g., 'booking', 'safety', 'recommendation'
    entities?: string[]; // e.g., ['Manali', 'winter trek', 'booking-123']
    sentiment?: 'positive' | 'negative' | 'neutral';
    requiresFollowUp?: boolean;
  };
}

export interface IAIConversation extends Document {
  // Session identifier (can be userId or anonymous sessionId)
  sessionId: string;
  userId?: mongoose.Types.ObjectId;
  
  // Conversation metadata
  startedAt: Date;
  lastInteractionAt: Date;
  
  // Compressed message history (only last N messages)
  messages: ICompressedMessage[];
  
  // Conversation summary (updated periodically to reduce message storage)
  summary?: {
    topics: string[]; // e.g., ['booking inquiry', 'safety concerns']
    keyEntities: string[]; // e.g., ['Kedarkantha trek', 'December']
    resolution?: 'resolved' | 'escalated' | 'ongoing';
    lastSummaryAt: Date;
  };
  
  // Context for follow-up questions
  context: {
    lastIntent?: string;
    lastEntities?: string[];
    relatedTrips?: mongoose.Types.ObjectId[];
    relatedBookings?: mongoose.Types.ObjectId[];
    currentTrip?: string; // Current trip name being discussed
    organizer?: string; // Organizer name for context
  };
  
  // Human agent handoff tracking
  escalation?: {
    escalated: boolean;
    escalatedAt?: Date;
    reason?: string;
    assignedAgent?: mongoose.Types.ObjectId;
  };
  
  // Metrics for quality improvement
  metrics: {
    messageCount: number;
    avgResponseTime?: number;
    userSatisfaction?: 1 | 2 | 3 | 4 | 5;
    aiConfidenceAvg?: number;
  };
  
  // TTL for automatic cleanup
  expiresAt?: Date;
  
  createdAt: Date;
  updatedAt: Date;
  
  // Instance methods
  addMessage(role: 'user' | 'assistant' | 'system', content: string, metadata?: ICompressedMessage['metadata']): Promise<void>;
  summarizeAndCompress(): Promise<void>;
  getContext(): any;
  updateContext(update: {
    intent?: string;
    entities?: string[];
    relatedTrips?: mongoose.Types.ObjectId[];
    relatedBookings?: mongoose.Types.ObjectId[];
    currentTrip?: string;
    organizer?: string;
  }): void;
  escalateToHuman(reason: string): void;
}

// Add static methods interface
export interface IAIConversationModel extends mongoose.Model<IAIConversation> {
  getOrCreate(sessionId: string, userId?: string): Promise<IAIConversation>;
  cleanupOldConversations(daysOld: number): Promise<number>;
}

const CompressedMessageSchema = new Schema({
  role: { 
    type: String, 
    enum: ['user', 'assistant', 'system'], 
    required: true 
  },
  content: { 
    type: String, 
    required: true,
    // Truncate very long messages to save space
    maxlength: 2000 
  },
  timestamp: { 
    type: Date, 
    default: Date.now,
    required: true 
  },
  metadata: {
    intent: { type: String },
    entities: [{ type: String }],
    sentiment: { 
      type: String, 
      enum: ['positive', 'negative', 'neutral'] 
    },
    requiresFollowUp: { type: Boolean, default: false }
  }
}, { _id: false });

const AIConversationSchema: Schema = new Schema(
  {
    sessionId: { 
      type: String, 
      required: true, 
      index: true,
      unique: true 
    },
    userId: { 
      type: Schema.Types.ObjectId, 
      ref: 'User',
      sparse: true, // Allow null for anonymous sessions
      index: true
    },
    startedAt: { 
      type: Date, 
      default: Date.now,
      required: true 
    },
    lastInteractionAt: { 
      type: Date, 
      default: Date.now,
      required: true,
      index: true // For cleanup queries
    },
    
    // Store only last 10 messages to minimize storage
    // Older messages are summarized and removed
    messages: {
      type: [CompressedMessageSchema],
      validate: {
        validator: function(messages: ICompressedMessage[]) {
          return messages.length <= 20; // Hard limit
        },
        message: 'Message history cannot exceed 20 messages'
      },
      default: []
    },
    
    summary: {
      topics: [{ type: String }],
      keyEntities: [{ type: String }],
      resolution: { 
        type: String, 
        enum: ['resolved', 'escalated', 'ongoing'],
        default: 'ongoing'
      },
      lastSummaryAt: { type: Date }
    },
    
    context: {
      lastIntent: { type: String },
      lastEntities: [{ type: String }],
      relatedTrips: [{ type: Schema.Types.ObjectId, ref: 'Trip' }],
      relatedBookings: [{ type: Schema.Types.ObjectId, ref: 'Booking' }],
      currentTrip: { type: String },
      organizer: { type: String }
    },
    
    escalation: {
      escalated: { type: Boolean, default: false },
      escalatedAt: { type: Date },
      reason: { type: String },
      assignedAgent: { type: Schema.Types.ObjectId, ref: 'User' }
    },
    
    metrics: {
      messageCount: { type: Number, default: 0 },
      avgResponseTime: { type: Number }, // in milliseconds
      userSatisfaction: { 
        type: Number, 
        min: 1, 
        max: 5 
      },
      aiConfidenceAvg: { type: Number, min: 0, max: 1 }
    },
    
    // Auto-expire conversations after 30 days of inactivity
    expiresAt: { 
      type: Date
    }
  },
  {
    timestamps: true
  }
);

// Indexes for performance
AIConversationSchema.index({ userId: 1, lastInteractionAt: -1 });
AIConversationSchema.index({ 'escalation.escalated': 1, 'escalation.assignedAgent': 1 });
AIConversationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index for auto-cleanup

// Methods

/**
 * Add message to conversation with automatic summarization
 * when message count exceeds threshold
 */
AIConversationSchema.methods.addMessage = async function(
  role: 'user' | 'assistant' | 'system',
  content: string,
  metadata?: ICompressedMessage['metadata']
): Promise<void> {
  const message: ICompressedMessage = {
    role,
    content: content.substring(0, 2000), // Truncate if too long
    timestamp: new Date(),
    metadata
  };
  
  this.messages.push(message);
  this.metrics.messageCount += 1;
  this.lastInteractionAt = new Date();
  
  // Auto-summarize if message count exceeds 15
  if (this.messages.length > 15) {
    await this.summarizeAndCompress();
  }
  
  // Update expiry (30 days from last interaction)
  this.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
};

/**
 * Summarize conversation and keep only recent messages
 * to minimize storage
 */
AIConversationSchema.methods.summarizeAndCompress = async function(): Promise<void> {
  // Extract topics and entities from messages
  const allTopics = new Set<string>();
  const allEntities = new Set<string>();
  
  this.messages.forEach((msg: ICompressedMessage) => {
    if (msg.metadata?.intent) {
      allTopics.add(msg.metadata.intent);
    }
    if (msg.metadata?.entities) {
      msg.metadata.entities.forEach(entity => allEntities.add(entity));
    }
  });
  
  // Update summary
  this.summary = {
    topics: Array.from(allTopics),
    keyEntities: Array.from(allEntities),
    resolution: this.escalation?.escalated ? 'escalated' : 'ongoing',
    lastSummaryAt: new Date()
  };
  
  // Keep only last 8 messages (4 exchanges)
  if (this.messages.length > 8) {
    this.messages = this.messages.slice(-8);
  }
};

/**
 * Get conversation context for follow-up handling
 */
AIConversationSchema.methods.getContext = function(): any {
  return {
    lastIntent: this.context.lastIntent,
    lastEntities: this.context.lastEntities || [],
    recentMessages: this.messages.slice(-6), // Last 3 exchanges
    summary: this.summary,
    relatedTrips: this.context.relatedTrips || [],
    relatedBookings: this.context.relatedBookings || [],
    currentTrip: this.context.currentTrip,
    organizer: this.context.organizer
  };
};

/**
 * Update context with new information
 */
AIConversationSchema.methods.updateContext = function(update: {
  intent?: string;
  entities?: string[];
  relatedTrips?: mongoose.Types.ObjectId[];
  relatedBookings?: mongoose.Types.ObjectId[];
  currentTrip?: string;
  organizer?: string;
}): void {
  if (update.intent) {
    this.context.lastIntent = update.intent;
  }
  if (update.entities) {
    this.context.lastEntities = update.entities;
  }
  if (update.relatedTrips) {
    this.context.relatedTrips = update.relatedTrips;
  }
  if (update.relatedBookings) {
    this.context.relatedBookings = update.relatedBookings;
  }
  if (update.currentTrip) {
    this.context.currentTrip = update.currentTrip;
  }
  if (update.organizer) {
    this.context.organizer = update.organizer;
  }
};

/**
 * Escalate to human agent
 */
AIConversationSchema.methods.escalateToHuman = function(reason: string): void {
  this.escalation = {
    escalated: true,
    escalatedAt: new Date(),
    reason
  };
  
  if (this.summary) {
    this.summary.resolution = 'escalated';
  }
};

/**
 * Static method to cleanup old conversations
 */
AIConversationSchema.statics.cleanupOldConversations = async function(daysOld: number = 30): Promise<number> {
  const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
  const result = await this.deleteMany({
    lastInteractionAt: { $lt: cutoffDate },
    'escalation.escalated': { $ne: true } // Keep escalated conversations
  });
  return result.deletedCount || 0;
};

/**
 * Static method to get or create conversation
 */
AIConversationSchema.statics.getOrCreate = async function(
  sessionId: string, 
  userId?: string
): Promise<IAIConversation> {
  let conversation = await this.findOne({ sessionId });
  
  if (!conversation) {
    conversation = await this.create({
      sessionId,
      userId,
      startedAt: new Date(),
      lastInteractionAt: new Date(),
      messages: [],
      context: {},
      metrics: { messageCount: 0 },
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    });
  }
  
  return conversation;
};

export default mongoose.model<IAIConversation, IAIConversationModel>('AIConversation', AIConversationSchema);
