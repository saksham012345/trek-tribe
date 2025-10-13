import mongoose, { Schema, Document, Model } from 'mongoose';

export type TicketStatus = 'open' | 'in-progress' | 'waiting-customer' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TicketCategory = 'booking' | 'payment' | 'technical' | 'general' | 'complaint' | 'refund';

export interface TicketMessage {
  _id?: any; // MongoDB auto-generated ID for subdocuments
  sender: 'customer' | 'agent';
  senderName: string;
  senderId?: string;
  message: string;
  timestamp: Date;
  attachments?: string[];
}

export interface SupportTicketDocument extends Document {
  ticketId: string;
  userId: string | any; // Can be string or populated User object
  assignedAgentId?: string | any; // Can be string or populated User object
  relatedTripId?: string | any; // Can be string or populated Trip object
  relatedBookingId?: string;
  
  subject: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  
  messages: TicketMessage[];
  
  customerEmail: string;
  customerName: string;
  customerPhone?: string;
  
  tags: string[];
  internalNotes: string[];
  
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  closedAt?: Date;
  
  // Performance tracking
  firstResponseTime?: Date;
  resolutionTime?: Date;
  customerSatisfactionRating?: number;
  customerFeedback?: string;
}

const ticketMessageSchema = new Schema({
  sender: {
    type: String,
    enum: ['customer', 'agent'],
    required: true
  },
  senderName: {
    type: String,
    required: true
  },
  senderId: {
    type: String
  },
  message: {
    type: String,
    required: true,
    maxlength: 2000
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  attachments: [{
    type: String
  }]
});

const supportTicketSchema = new Schema(
  {
    ticketId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    assignedAgentId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    relatedTripId: {
      type: Schema.Types.ObjectId,
      ref: 'Trip'
    },
    relatedBookingId: {
      type: String
    },
    
    subject: {
      type: String,
      required: true,
      maxlength: 200,
      index: 'text'
    },
    description: {
      type: String,
      required: true,
      maxlength: 1000
    },
    category: {
      type: String,
      enum: ['booking', 'payment', 'technical', 'general', 'complaint', 'refund'],
      default: 'general',
      index: true
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
      index: true
    },
    status: {
      type: String,
      enum: ['open', 'in-progress', 'waiting-customer', 'resolved', 'closed'],
      default: 'open',
      index: true
    },
    
    messages: [ticketMessageSchema],
    
    customerEmail: {
      type: String,
      required: true,
      index: true
    },
    customerName: {
      type: String,
      required: true
    },
    customerPhone: {
      type: String
    },
    
    tags: [{
      type: String,
      maxlength: 50
    }],
    internalNotes: [{
      type: String,
      maxlength: 500
    }],
    
    resolvedAt: {
      type: Date
    },
    closedAt: {
      type: Date
    },
    
    firstResponseTime: {
      type: Date
    },
    resolutionTime: {
      type: Date
    },
    customerSatisfactionRating: {
      type: Number,
      min: 1,
      max: 5
    },
    customerFeedback: {
      type: String,
      maxlength: 500
    }
  },
  { 
    timestamps: true 
  }
);

// Indexes for performance
supportTicketSchema.index({ status: 1, priority: 1, createdAt: -1 });
supportTicketSchema.index({ assignedAgentId: 1, status: 1 });
supportTicketSchema.index({ userId: 1, status: 1 });
supportTicketSchema.index({ category: 1, status: 1 });
supportTicketSchema.index({ createdAt: -1 });

// Text search index
supportTicketSchema.index({ 
  subject: 'text', 
  description: 'text',
  ticketId: 'text'
});

// Auto-generate ticket ID
supportTicketSchema.pre('save', async function(next) {
  if (this.isNew && !this.ticketId) {
    try {
      const SupportTicketModel = mongoose.models.SupportTicket || mongoose.model('SupportTicket', supportTicketSchema);
      const count = await SupportTicketModel.countDocuments();
      this.ticketId = `TT-${Date.now().toString().slice(-8)}-${(count + 1).toString().padStart(4, '0')}`;
    } catch (error) {
      console.error('Error generating ticket ID:', error);
      // Fallback to timestamp-based ID
      this.ticketId = `TT-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
    }
  }
  next();
});

// Calculate response and resolution times
supportTicketSchema.pre('save', function(next) {
  if (this.messages && this.messages.length > 0) {
    // Calculate first response time (first agent message)
    if (!this.firstResponseTime) {
      const firstAgentMessage = this.messages.find(msg => msg.sender === 'agent');
      if (firstAgentMessage) {
        this.firstResponseTime = firstAgentMessage.timestamp;
      }
    }
    
    // Calculate resolution time
    if (this.status === 'resolved' && !this.resolutionTime) {
      this.resolutionTime = new Date();
      this.resolvedAt = new Date();
    }
    
    if (this.status === 'closed' && !this.closedAt) {
      this.closedAt = new Date();
    }
  }
  next();
});

export const SupportTicket = (mongoose.models.SupportTicket || mongoose.model('SupportTicket', supportTicketSchema)) as Model<SupportTicketDocument>;