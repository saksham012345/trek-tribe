import mongoose, { Schema, Document, Types } from 'mongoose';

export type RefundStatus = 'pending' | 'processed' | 'failed';

export interface MarketplaceRefundDocument extends Document {
  orderId: Types.ObjectId;
  paymentId: string;
  refundId?: string; // Razorpay refund id
  amount: number;
  currency: string;
  reason?: string;
  reversedTransfer: boolean;
  status: RefundStatus;
  createdBy?: Types.ObjectId; // admin triggering refund
  processedAt?: Date;
  failureReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const marketplaceRefundSchema = new Schema(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'MarketplaceOrder', required: true, index: true },
    paymentId: { type: String, required: true },
    refundId: { type: String },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    reason: { type: String },
    reversedTransfer: { type: Boolean, default: false },
    status: { type: String, enum: ['pending', 'processed', 'failed'], default: 'pending' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    processedAt: { type: Date },
    failureReason: { type: String },
  },
  { timestamps: true }
);

export const MarketplaceRefund = mongoose.model<MarketplaceRefundDocument>('MarketplaceRefund', marketplaceRefundSchema);
