import mongoose, { Schema, Document, Types } from 'mongoose';

export type LedgerEntryType = 'credit' | 'debit';
export type LedgerSource = 'order' | 'transfer' | 'refund' | 'adjustment';

export interface PayoutLedgerDocument extends Document {
  organizerId: Types.ObjectId;
  type: LedgerEntryType;
  source: LedgerSource;
  referenceId?: string; // e.g., orderId/transferId/refundId
  amount: number;
  currency: string;
  description?: string;
  balanceAfter?: number;
  createdAt: Date;
  updatedAt: Date;
}

const payoutLedgerSchema = new Schema(
  {
    organizerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['credit', 'debit'], required: true },
    source: { type: String, enum: ['order', 'transfer', 'refund', 'adjustment'], required: true },
    referenceId: { type: String },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    description: { type: String },
    balanceAfter: { type: Number },
  },
  { timestamps: true }
);

export const PayoutLedger = mongoose.model<PayoutLedgerDocument>('PayoutLedger', payoutLedgerSchema);
