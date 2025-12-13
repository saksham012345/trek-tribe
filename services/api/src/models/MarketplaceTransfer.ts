import mongoose, { Schema, Document, Types } from 'mongoose';

export type TransferStatus = 'pending' | 'initiated' | 'processed' | 'failed' | 'reversed';

export interface MarketplaceTransferDocument extends Document {
  orderId: Types.ObjectId; // ref MarketplaceOrder
  organizerId: Types.ObjectId;
  paymentId: string;
  transferId?: string; // Razorpay transfer id
  amount: number;
  commissionAmount: number;
  razorpayFeeAmount: number;
  payoutAmount: number;
  status: TransferStatus;
  holdUntil?: Date;
  processedAt?: Date;
  failureReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const marketplaceTransferSchema = new Schema(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'MarketplaceOrder', required: true, index: true },
    organizerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    paymentId: { type: String, required: true },
    transferId: { type: String },
    amount: { type: Number, required: true },
    commissionAmount: { type: Number, required: true },
    razorpayFeeAmount: { type: Number, required: true },
    payoutAmount: { type: Number, required: true },
    status: { type: String, enum: ['pending', 'initiated', 'processed', 'failed', 'reversed'], default: 'pending' },
    holdUntil: { type: Date },
    processedAt: { type: Date },
    failureReason: { type: String },
  },
  { timestamps: true }
);

export const MarketplaceTransfer = mongoose.model<MarketplaceTransferDocument>('MarketplaceTransfer', marketplaceTransferSchema);
