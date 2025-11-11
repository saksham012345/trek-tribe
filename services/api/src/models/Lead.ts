import mongoose, { Schema, Document } from 'mongoose';

export interface ILead extends Document {
  userId?: mongoose.Types.ObjectId;
  tripId?: mongoose.Types.ObjectId;
  email: string;
  phone?: string;
  name?: string;
  source: 'trip_view' | 'inquiry' | 'partial_booking' | 'chat' | 'form' | 'other';
  status: 'new' | 'contacted' | 'interested' | 'not_interested' | 'converted' | 'lost';
  leadScore: number;
  interactions: {
    type: 'email' | 'call' | 'chat' | 'message' | 'visit';
    description: string;
    timestamp: Date;
    performedBy?: mongoose.Types.ObjectId;
  }[];
  metadata: {
    tripViewCount?: number;
    lastVisitedAt?: Date;
    inquiryMessage?: string;
    partialFormData?: any;
    tags?: string[];
    notes?: string;
  };
  assignedTo?: mongoose.Types.ObjectId;
  convertedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const LeadSchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    tripId: { type: Schema.Types.ObjectId, ref: 'Trip' },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    name: { type: String, trim: true },
    source: {
      type: String,
      enum: ['trip_view', 'inquiry', 'partial_booking', 'chat', 'form', 'other'],
      required: true,
    },
    status: {
      type: String,
      enum: ['new', 'contacted', 'interested', 'not_interested', 'converted', 'lost'],
      default: 'new',
    },
    leadScore: { type: Number, default: 0, min: 0, max: 100 },
    interactions: [
      {
        type: {
          type: String,
          enum: ['email', 'call', 'chat', 'message', 'visit'],
          required: true,
        },
        description: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
        performedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      },
    ],
    metadata: {
      tripViewCount: { type: Number, default: 0 },
      lastVisitedAt: { type: Date },
      inquiryMessage: { type: String },
      partialFormData: { type: Schema.Types.Mixed },
      tags: [{ type: String }],
      notes: { type: String },
    },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
    convertedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

// Indexes for performance
LeadSchema.index({ email: 1 });
LeadSchema.index({ status: 1 });
LeadSchema.index({ tripId: 1 });
LeadSchema.index({ assignedTo: 1 });
LeadSchema.index({ leadScore: -1 });
LeadSchema.index({ createdAt: -1 });

export default mongoose.model<ILead>('Lead', LeadSchema);
