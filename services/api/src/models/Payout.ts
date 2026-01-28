import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type PayoutStatus = 'pending' | 'approved' | 'paid';

export interface PayoutDocument extends Document {
    organizerId: Types.ObjectId;
    tripId: Types.ObjectId;
    totalBookingAmount: number;
    platformFee: number; // 4%
    netAmount: number; // Booking Amount - Platform Fee - Advances (if any)
    status: PayoutStatus;
    transactionReference?: string; // Manual bank transfer ID
    notes?: string;
    processedAt?: Date;
    processedBy?: Types.ObjectId; // Admin ID
    createdAt: Date;
    updatedAt: Date;
}

const payoutSchema = new Schema(
    {
        organizerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        tripId: { type: Schema.Types.ObjectId, ref: 'Trip', required: true, unique: true }, // Ensure one payout per trip
        totalBookingAmount: { type: Number, required: true, min: 0 },
        platformFee: { type: Number, required: true, min: 0 },
        netAmount: { type: Number, required: true, min: 0 },
        status: {
            type: String,
            enum: ['pending', 'approved', 'paid'],
            default: 'pending',
            index: true
        },
        transactionReference: { type: String },
        notes: { type: String },
        processedAt: { type: Date },
        processedBy: { type: Schema.Types.ObjectId, ref: 'User' }
    },
    { timestamps: true }
);

export const Payout = (mongoose.models.Payout || mongoose.model<PayoutDocument>('Payout', payoutSchema)) as Model<PayoutDocument>;
