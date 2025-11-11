import mongoose, { Schema, Document } from 'mongoose';

export interface IChatMessage extends Document {
  conversationId: string;
  senderId: mongoose.Types.ObjectId;
  senderType: 'user' | 'organizer' | 'admin';
  recipientId?: mongoose.Types.ObjectId;
  recipientType?: 'user' | 'organizer' | 'admin';
  message: string;
  messageType: 'text' | 'image' | 'file' | 'system';
  attachments: {
    filename: string;
    url: string;
    type: string;
    size: number;
  }[];
  isRead: boolean;
  readAt?: Date;
  relatedTo?: {
    type: 'trip' | 'booking' | 'ticket';
    id: mongoose.Types.ObjectId;
  };
  metadata: {
    ipAddress?: string;
    userAgent?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const ChatMessageSchema: Schema = new Schema(
  {
    conversationId: { type: String, required: true, index: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    senderType: {
      type: String,
      enum: ['user', 'organizer', 'admin'],
      required: true,
    },
    recipientId: { type: Schema.Types.ObjectId, ref: 'User' },
    recipientType: {
      type: String,
      enum: ['user', 'organizer', 'admin'],
    },
    message: { type: String, required: true },
    messageType: {
      type: String,
      enum: ['text', 'image', 'file', 'system'],
      default: 'text',
    },
    attachments: [
      {
        filename: { type: String, required: true },
        url: { type: String, required: true },
        type: { type: String, required: true },
        size: { type: Number, required: true },
      },
    ],
    isRead: { type: Boolean, default: false },
    readAt: { type: Date },
    relatedTo: {
      type: {
        type: String,
        enum: ['trip', 'booking', 'ticket'],
      },
      id: { type: Schema.Types.ObjectId },
    },
    metadata: {
      ipAddress: { type: String },
      userAgent: { type: String },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for performance
ChatMessageSchema.index({ conversationId: 1, createdAt: -1 });
ChatMessageSchema.index({ senderId: 1 });
ChatMessageSchema.index({ recipientId: 1 });
ChatMessageSchema.index({ isRead: 1 });

export default mongoose.model<IChatMessage>('ChatMessage', ChatMessageSchema);
