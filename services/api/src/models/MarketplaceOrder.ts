import mongoose, { Schema, Document, Types } from 'mongoose';

export type MarketplaceOrderStatus = 'created' | 'paid' | 'failed' | 'refunded' | 'partial_refund';

export interface MarketplaceOrderDocument extends Document {
  orderId: string; // Razorpay order id
  paymentId?: string;
  userId: Types.ObjectId;
  organizerId: Types.ObjectId;
  tripId?: Types.ObjectId;
  amount: number; // in paise
  currency: string;
  notes?: Record<string, any>;
  status: MarketplaceOrderStatus;
  commissionAmount: number;
  commissionRate: number;
  organizerPayoutAmount: number;
  razorpayFeeAmount?: number;
  splitStatus: 'pending' | 'processed' | 'failed';
  refundStatus: 'none' | 'requested' | 'processed' | 'partial';
  createdAt: Date;
  updatedAt: Date;
}

const marketplaceOrderSchema = new Schema(
  {
    orderId: { type: String, required: true, unique: true, index: true },
    paymentId: { type: String },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    organizerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    tripId: { type: Schema.Types.ObjectId, ref: 'Trip' },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    notes: { type: Schema.Types.Mixed },
    status: { type: String, enum: ['created', 'paid', 'failed', 'refunded', 'partial_refund'], default: 'created' },
    commissionAmount: { type: Number, default: 0 },
    commissionRate: { type: Number, default: 5 },
    organizerPayoutAmount: { type: Number, default: 0 },
    razorpayFeeAmount: { type: Number, default: 0 },
    splitStatus: { type: String, enum: ['pending', 'processed', 'failed'], default: 'pending' },
    refundStatus: { type: String, enum: ['none', 'requested', 'processed', 'partial'], default: 'none' },
  },
  { timestamps: true }
);

export const MarketplaceOrder = mongoose.model<MarketplaceOrderDocument>('MarketplaceOrder', marketplaceOrderSchema);
