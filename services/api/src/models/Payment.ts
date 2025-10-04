import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface PaymentDocument extends Document {
  userId: Types.ObjectId;
  tripId: Types.ObjectId;
  organizerId: Types.ObjectId;
  bookingId: string; // Unique booking reference
  amount: number;
  currency: string;
  paymentMethod: 'upi' | 'card' | 'netbanking' | 'wallet' | 'qr_code';
  paymentGateway: string; // razorpay, stripe, etc.
  paymentId?: string; // Gateway payment ID
  status: 'pending' | 'completed' | 'failed' | 'refunded' | 'cancelled';
  paymentType: 'full' | 'advance' | 'balance';
  advanceAmount?: number; // If advance payment
  balanceAmount?: number; // Remaining amount after advance
  qrCodeData?: string; // QR code payment data
  participants: {
    userId: Types.ObjectId;
    name: string;
    email: string;
    phone?: string;
    emergencyContact?: {
      name: string;
      phone: string;
      relationship: string;
    };
  }[];
  refundAmount?: number;
  refundReason?: string;
  refundedAt?: Date;
  metadata?: any; // Additional payment gateway data
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tripId: { type: Schema.Types.ObjectId, ref: 'Trip', required: true, index: true },
    organizerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    bookingId: { 
      type: String, 
      required: true, 
      unique: true, 
      default: () => 'TT' + Date.now() + Math.random().toString(36).substr(2, 5).toUpperCase()
    },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR' },
    paymentMethod: { 
      type: String, 
      enum: ['upi', 'card', 'netbanking', 'wallet', 'qr_code'], 
      required: true 
    },
    paymentGateway: { type: String, required: true },
    paymentId: { type: String },
    status: { 
      type: String, 
      enum: ['pending', 'completed', 'failed', 'refunded', 'cancelled'], 
      default: 'pending',
      index: true 
    },
    paymentType: { 
      type: String, 
      enum: ['full', 'advance', 'balance'], 
      required: true 
    },
    advanceAmount: { type: Number, min: 0 },
    balanceAmount: { type: Number, min: 0 },
    qrCodeData: { type: String },
    participants: [{
      userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
      name: { type: String, required: true },
      email: { type: String, required: true },
      phone: { type: String },
      emergencyContact: {
        name: { type: String, required: true },
        phone: { type: String, required: true },
        relationship: { type: String, required: true }
      }
    }],
    refundAmount: { type: Number, min: 0 },
    refundReason: { type: String },
    refundedAt: { type: Date },
    metadata: { type: Schema.Types.Mixed }
  },
  { timestamps: true }
);

// Indexes for efficient queries
paymentSchema.index({ bookingId: 1 }, { unique: true });
paymentSchema.index({ status: 1, createdAt: -1 });
paymentSchema.index({ paymentType: 1, status: 1 });

export const Payment = (mongoose.models.Payment || mongoose.model('Payment', paymentSchema)) as any as Model<PaymentDocument>;