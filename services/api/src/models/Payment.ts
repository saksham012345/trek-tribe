import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type PaymentStatus = 'created' | 'paid' | 'failed' | 'refunded';
export type PaymentType = 'subscription' | 'trip_booking';

export interface PaymentDocument extends Document {
    amount: number; // Amount in smallest currency unit (paise)
    currency: string;
    razorpayOrderId: string;
    razorpayPaymentId?: string;
    razorpaySignature?: string;
    status: PaymentStatus;
    type: PaymentType;
    metadata: {
        userId: Types.ObjectId;
        tripId?: Types.ObjectId; // For trip bookings
        subscriptionId?: Types.ObjectId; // For subscriptions
        bookingId?: Types.ObjectId; // Link to specific booking record
    };
    errorReason?: string;
    createdAt: Date;
    updatedAt: Date;
}

const paymentSchema = new Schema(
    {
        amount: { type: Number, required: true },
        currency: { type: String, default: 'INR' },
        razorpayOrderId: { type: String, required: true, unique: true, index: true },
        razorpayPaymentId: { type: String, index: true },
        razorpaySignature: { type: String },
        status: {
            type: String,
            enum: ['created', 'paid', 'failed', 'refunded'],
            default: 'created',
            index: true
        },
        type: {
            type: String,
            enum: ['subscription', 'trip_booking'],
            required: true
        },
        metadata: {
            userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
            tripId: { type: Schema.Types.ObjectId, ref: 'Trip' },
            subscriptionId: { type: Schema.Types.ObjectId, ref: 'OrganizerSubscription' },
            bookingId: { type: Schema.Types.ObjectId, ref: 'GroupBooking' }
        },
        errorReason: { type: String }
    },
    { timestamps: true }
);

// Indexes for faster lookups
paymentSchema.index({ 'metadata.userId': 1 });
paymentSchema.index({ 'metadata.tripId': 1 });
paymentSchema.index({ 'metadata.subscriptionId': 1 });

// ==================== CRITICAL INDEXES ====================
// Index 1: User payment history (receipts, transaction history)
paymentSchema.index({ 'metadata.userId': 1, createdAt: -1 });

// Index 2: Webhook lookup by orderId (Razorpay callback verification)
// Note: `razorpayOrderId` is defined with `unique: true, index: true` in
// the field definition above; explicit schema.index() is omitted to avoid
// duplicate index creation.
// ===========================================================

export const Payment = (mongoose.models.Payment || mongoose.model<PaymentDocument>('Payment', paymentSchema)) as Model<PaymentDocument>;
