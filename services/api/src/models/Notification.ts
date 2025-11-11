import mongoose, { Schema, Document } from 'mongoose';

export interface INotification extends Document {
  userId: mongoose.Types.ObjectId;
  type: 'ticket' | 'chat' | 'verification' | 'payment' | 'booking' | 'lead' | 'system' | 'reminder';
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high';
  isRead: boolean;
  readAt?: Date;
  actionUrl?: string;
  actionType?: 'view_ticket' | 'view_trip' | 'make_payment' | 'verify_trip' | 'respond_chat' | 'view_lead';
  relatedTo?: {
    type: 'ticket' | 'trip' | 'booking' | 'payment' | 'lead' | 'chat';
    id: mongoose.Types.ObjectId;
  };
  metadata?: any;
  emailSent: boolean;
  emailSentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: ['ticket', 'chat', 'verification', 'payment', 'booking', 'lead', 'system', 'reminder'],
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
    },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date },
    actionUrl: { type: String },
    actionType: {
      type: String,
      enum: ['view_ticket', 'view_trip', 'make_payment', 'verify_trip', 'respond_chat', 'view_lead'],
    },
    relatedTo: {
      type: {
        type: String,
        enum: ['ticket', 'trip', 'booking', 'payment', 'lead', 'chat'],
      },
      id: { type: Schema.Types.ObjectId },
    },
    metadata: { type: Schema.Types.Mixed },
    emailSent: { type: Boolean, default: false },
    emailSentAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

// Indexes
NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ isRead: 1 });
NotificationSchema.index({ type: 1 });

export default mongoose.model<INotification>('Notification', NotificationSchema);
