import mongoose, { Schema, Document } from 'mongoose';

export interface IUserActivity extends Document {
  userId: mongoose.Types.ObjectId;
  userType: 'user' | 'organizer';
  activityType: 'trip_view' | 'trip_created' | 'booking_made' | 'chat_initiated' | 'ticket_created' | 'payment_made' | 'profile_updated' | 'document_uploaded' | 'login' | 'logout';
  description: string;
  metadata: {
    tripId?: mongoose.Types.ObjectId;
    bookingId?: mongoose.Types.ObjectId;
    ticketId?: mongoose.Types.ObjectId;
    paymentId?: string;
    amount?: number;
    ipAddress?: string;
    userAgent?: string;
    location?: string;
  };
  createdAt: Date;
}

const UserActivitySchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    userType: {
      type: String,
      enum: ['user', 'organizer'],
      required: true,
    },
    activityType: {
      type: String,
      enum: [
        'trip_view',
        'trip_created',
        'booking_made',
        'chat_initiated',
        'ticket_created',
        'payment_made',
        'profile_updated',
        'document_uploaded',
        'login',
        'logout',
      ],
      required: true,
    },
    description: { type: String, required: true },
    metadata: {
      tripId: { type: Schema.Types.ObjectId, ref: 'Trip' },
      bookingId: { type: Schema.Types.ObjectId, ref: 'Booking' },
      ticketId: { type: Schema.Types.ObjectId, ref: 'Ticket' },
      paymentId: { type: String },
      amount: { type: Number },
      ipAddress: { type: String },
      userAgent: { type: String },
      location: { type: String },
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Indexes
UserActivitySchema.index({ userId: 1, createdAt: -1 });
UserActivitySchema.index({ activityType: 1 });
UserActivitySchema.index({ createdAt: -1 });

export default mongoose.model<IUserActivity>('UserActivity', UserActivitySchema);
