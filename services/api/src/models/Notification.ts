import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface NotificationDocument extends Document {
  userId: Types.ObjectId;
  title: string;
  message: string;
  type: 'trip_update' | 'payment' | 'booking' | 'reminder' | 'cancellation' | 'weather' | 'emergency' | 'system' | 'marketing';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  channels: ('push' | 'email' | 'sms')[];
  relatedTripId?: Types.ObjectId;
  relatedPaymentId?: Types.ObjectId;
  data?: any; // Additional data for the notification
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'read';
  readAt?: Date;
  sentAt?: Date;
  deliveredAt?: Date;
  failureReason?: string;
  retryCount: number;
  maxRetries: number;
  scheduledFor?: Date;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, maxlength: 100 },
    message: { type: String, required: true, maxlength: 500 },
    type: { 
      type: String, 
      enum: ['trip_update', 'payment', 'booking', 'reminder', 'cancellation', 'weather', 'emergency', 'system', 'marketing'], 
      required: true,
      index: true
    },
    priority: { 
      type: String, 
      enum: ['low', 'normal', 'high', 'urgent'], 
      default: 'normal',
      index: true
    },
    channels: [{ 
      type: String, 
      enum: ['push', 'email', 'sms'],
      required: true 
    }],
    relatedTripId: { type: Schema.Types.ObjectId, ref: 'Trip', index: true },
    relatedPaymentId: { type: Schema.Types.ObjectId, ref: 'Payment', index: true },
    data: { type: Schema.Types.Mixed },
    status: { 
      type: String, 
      enum: ['pending', 'sent', 'delivered', 'failed', 'read'], 
      default: 'pending',
      index: true 
    },
    readAt: { type: Date },
    sentAt: { type: Date },
    deliveredAt: { type: Date },
    failureReason: { type: String },
    retryCount: { type: Number, default: 0 },
    maxRetries: { type: Number, default: 3 },
    scheduledFor: { type: Date, index: true },
    expiresAt: { type: Date, index: true }
  },
  { timestamps: true }
);

// Compound indexes for efficient queries
notificationSchema.index({ userId: 1, status: 1, createdAt: -1 });
notificationSchema.index({ type: 1, priority: 1, createdAt: -1 });
notificationSchema.index({ status: 1, scheduledFor: 1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

export const Notification = (mongoose.models.Notification || mongoose.model('Notification', notificationSchema)) as any as Model<NotificationDocument>;