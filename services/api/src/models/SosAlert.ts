import mongoose, { Schema, Document, Model } from 'mongoose';

export type SosStatus = 'active' | 'acknowledged' | 'resolved' | 'false_alarm';
export type SosPriority = 'critical' | 'high' | 'medium';
export type SosType = 'medical' | 'accident' | 'lost' | 'weather' | 'equipment_failure' | 'security' | 'other';

export interface SosAlertDocument extends Document {
  userId: mongoose.Types.ObjectId;
  tripId?: mongoose.Types.ObjectId;
  type: SosType;
  priority: SosPriority;
  status: SosStatus;
  message: string;
  location?: {
    coordinates: [number, number]; // [longitude, latitude]
    address?: string;
    accuracy?: number;
  };
  assignedAgentId?: mongoose.Types.ObjectId;
  acknowledgedAt?: Date;
  acknowledgedBy?: mongoose.Types.ObjectId;
  resolvedAt?: Date;
  resolvedBy?: mongoose.Types.ObjectId;
  emergencyContacts?: Array<{
    name: string;
    phone: string;
    notifiedAt: Date;
    acknowledged: boolean;
  }>;
  actionsTaken?: Array<{
    agentId: mongoose.Types.ObjectId;
    action: string;
    timestamp: Date;
  }>;
  notes?: Array<{
    agentId: mongoose.Types.ObjectId;
    note: string;
    createdAt: Date;
    isInternal: boolean;
  }>;
  attachments?: Array<{
    type: 'image' | 'audio' | 'video' | 'document';
    filename: string;
    url: string;
    uploadedAt: Date;
  }>;
  deviceInfo?: {
    batteryLevel?: number;
    networkSignal?: number;
    deviceType?: string;
  };
  followUpRequired: boolean;
  escalatedToAuthorities?: {
    authority: string;
    contactPerson?: string;
    phone?: string;
    referenceNumber?: string;
    escalatedAt: Date;
  };
  resolutionDetails?: string;
  userFeedback?: {
    rating: number;
    comment?: string;
    submittedAt: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const sosAlertSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  tripId: { type: Schema.Types.ObjectId, ref: 'Trip', index: true },
  type: {
    type: String,
    enum: ['medical', 'accident', 'lost', 'weather', 'equipment_failure', 'security', 'other'],
    required: true,
    index: true
  },
  priority: {
    type: String,
    enum: ['critical', 'high', 'medium'],
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['active', 'acknowledged', 'resolved', 'false_alarm'],
    default: 'active',
    index: true
  },
  message: { type: String, required: true },
  location: {
    coordinates: {
      type: [Number],
      validate: {
        validator: function(v: number[]) {
          return v && v.length === 2 && 
            v[0] >= -180 && v[0] <= 180 && // longitude
            v[1] >= -90 && v[1] <= 90; // latitude
        },
        message: 'Coordinates must be [longitude, latitude] with valid ranges'
      },
      index: '2dsphere'
    },
    address: { type: String },
    accuracy: { type: Number } // in meters
  },
  assignedAgentId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  acknowledgedAt: { type: Date },
  acknowledgedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  resolvedAt: { type: Date },
  resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  emergencyContacts: [{
    name: { type: String, required: true },
    phone: { type: String, required: true },
    notifiedAt: { type: Date, default: Date.now },
    acknowledged: { type: Boolean, default: false }
  }],
  actionsTaken: [{
    agentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
  }],
  notes: [{
    agentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    note: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    isInternal: { type: Boolean, default: true }
  }],
  attachments: [{
    type: { type: String, enum: ['image', 'audio', 'video', 'document'], required: true },
    filename: { type: String, required: true },
    url: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now }
  }],
  deviceInfo: {
    batteryLevel: { type: Number, min: 0, max: 100 },
    networkSignal: { type: Number, min: 0, max: 100 },
    deviceType: { type: String }
  },
  followUpRequired: { type: Boolean, default: true },
  escalatedToAuthorities: {
    authority: { type: String },
    contactPerson: { type: String },
    phone: { type: String },
    referenceNumber: { type: String },
    escalatedAt: { type: Date }
  },
  resolutionDetails: { type: String },
  userFeedback: {
    rating: { type: Number, min: 1, max: 5 },
    comment: { type: String },
    submittedAt: { type: Date }
  }
}, { timestamps: true });

// Indexes for common queries
sosAlertSchema.index({ status: 1, priority: -1, createdAt: -1 });
sosAlertSchema.index({ assignedAgentId: 1, status: 1 });
sosAlertSchema.index({ type: 1, status: 1 });
sosAlertSchema.index({ createdAt: -1 });

export const SosAlert = (mongoose.models.SosAlert || mongoose.model('SosAlert', sosAlertSchema)) as Model<SosAlertDocument>;