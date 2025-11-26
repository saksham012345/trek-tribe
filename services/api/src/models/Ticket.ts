import mongoose, { Schema, Document } from 'mongoose';

export interface ITicket extends Document {
  ticketNumber: string;
  subject: string;
  description: string;
  category: 'booking' | 'payment' | 'verification' | 'technical' | 'inquiry' | 'complaint' | 'other';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'waiting_customer' | 'resolved' | 'closed' | 'cancelled';
  requesterId: mongoose.Types.ObjectId;
  requesterType: 'user' | 'organizer';
  assignedTo?: mongoose.Types.ObjectId;
  tripId?: mongoose.Types.ObjectId;
  bookingId?: mongoose.Types.ObjectId;
  attachments: {
    filename: string;
    url: string;
    uploadedAt: Date;
  }[];
  conversation: {
    senderId: mongoose.Types.ObjectId;
    senderType: 'user' | 'organizer' | 'admin';
    message: string;
    timestamp: Date;
    attachments?: {
      filename: string;
      url: string;
    }[];
  }[];
  resolution?: {
    resolvedBy: mongoose.Types.ObjectId;
    resolvedAt: Date;
    resolutionNote: string;
  };
  tags: string[];
  internalNotes: {
    noteBy: mongoose.Types.ObjectId;
    note: string;
    timestamp: Date;
  }[];
  responseTime?: number; // in minutes
  resolutionTime?: number; // in minutes
  satisfactionRating?: number; // 1-5
  createdAt: Date;
  updatedAt: Date;
}

const TicketSchema: Schema = new Schema(
  {
    ticketNumber: { type: String, required: true, unique: true },
    subject: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    category: {
      type: String,
      enum: ['booking', 'payment', 'verification', 'technical', 'inquiry', 'complaint', 'other'],
      required: true,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'waiting_customer', 'resolved', 'closed', 'cancelled'],
      default: 'pending',
    },
    requesterId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    requesterType: {
      type: String,
      enum: ['user', 'organizer'],
      required: true,
    },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
    tripId: { type: Schema.Types.ObjectId, ref: 'Trip' },
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking' },
    attachments: [
      {
        filename: { type: String, required: true },
        url: { type: String, required: true },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    conversation: [
      {
        senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        senderType: {
          type: String,
          enum: ['user', 'organizer', 'admin'],
          required: true,
        },
        message: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
        attachments: [
          {
            filename: { type: String },
            url: { type: String },
          },
        ],
      },
    ],
    resolution: {
      resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      resolvedAt: { type: Date },
      resolutionNote: { type: String },
    },
    tags: [{ type: String }],
    internalNotes: [
      {
        noteBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        note: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
      },
    ],
    responseTime: { type: Number },
    resolutionTime: { type: Number },
    satisfactionRating: { type: Number, min: 1, max: 5 },
  },
  {
    timestamps: true,
  }
);

// Auto-generate ticket number
TicketSchema.pre('save', async function (next) {
  if (!this.ticketNumber) {
    const count = await mongoose.model('Ticket').countDocuments();
    this.ticketNumber = `TKT-${Date.now()}-${(count + 1).toString().padStart(5, '0')}`;
  }
  next();
});

// Indexes
// `ticketNumber` is declared `unique: true` on the field which creates
// the index at schema creation. Avoid duplicating the same single-field
// index here to prevent Mongoose duplicate-index warnings.
TicketSchema.index({ requesterId: 1 });
TicketSchema.index({ status: 1 });
TicketSchema.index({ assignedTo: 1 });
TicketSchema.index({ createdAt: -1 });

export default mongoose.model<ITicket>('Ticket', TicketSchema);
