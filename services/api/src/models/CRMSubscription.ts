import mongoose, { Schema, Document } from 'mongoose';

export interface ICRMSubscription extends Document {
  organizerId: mongoose.Types.ObjectId;
  planType: 'trip_package' | 'crm_bundle' | 'trial';
  status: 'active' | 'expired' | 'cancelled' | 'pending_payment';
  
  // Trip Package Details
  tripPackage?: {
    totalTrips: number; // 5 trips for ₹1499
    usedTrips: number;
    remainingTrips: number;
    pricePerPackage: number; // ₹1499
  };
  
  // CRM Access Bundle
  crmBundle?: {
    hasAccess: boolean;
    price: number; // ₹2100
    features: string[];
  };
  
  // Trial Period
  trial?: {
    isActive: boolean;
    startDate: Date;
    endDate: Date; // First 2 months free
    monthsRemaining: number;
  };
  
  payments: {
    transactionId: string;
    amount: number;
    currency: string;
    paymentMethod: string;
    status: 'pending' | 'completed' | 'failed' | 'refunded';
    paidAt?: Date;
    metadata?: any;
  }[];
  
  startDate: Date;
  endDate?: Date;
  expiryReminderSent: boolean;
  
  billingHistory: {
    date: Date;
    amount: number;
    description: string;
    invoiceUrl?: string;
  }[];
  
  autoRenew: boolean;
  cancelledAt?: Date;
  cancellationReason?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

const CRMSubscriptionSchema: Schema = new Schema(
  {
    organizerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    planType: {
      type: String,
      enum: ['trip_package', 'crm_bundle', 'trial'],
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'expired', 'cancelled', 'pending_payment'],
      default: 'active',
    },
    
    tripPackage: {
      totalTrips: { type: Number, default: 5 },
      usedTrips: { type: Number, default: 0 },
      remainingTrips: { type: Number, default: 5 },
      pricePerPackage: { type: Number, default: 1499 },
    },
    
    crmBundle: {
      hasAccess: { type: Boolean, default: false },
      price: { type: Number, default: 2100 },
      features: [{ type: String }],
    },
    
    trial: {
      isActive: { type: Boolean, default: false },
      startDate: { type: Date },
      endDate: { type: Date },
      monthsRemaining: { type: Number, default: 2 },
    },
    
    payments: [
      {
        transactionId: { type: String, required: true },
        amount: { type: Number, required: true },
        currency: { type: String, default: 'INR' },
        paymentMethod: { type: String, required: true },
        status: {
          type: String,
          enum: ['pending', 'completed', 'failed', 'refunded'],
          default: 'pending',
        },
        paidAt: { type: Date },
        metadata: { type: Schema.Types.Mixed },
      },
    ],
    
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date },
    expiryReminderSent: { type: Boolean, default: false },
    
    billingHistory: [
      {
        date: { type: Date, default: Date.now },
        amount: { type: Number, required: true },
        description: { type: String, required: true },
        invoiceUrl: { type: String },
      },
    ],
    
    autoRenew: { type: Boolean, default: false },
    cancelledAt: { type: Date },
    cancellationReason: { type: String },
  },
  {
    timestamps: true,
  }
);

// Indexes
CRMSubscriptionSchema.index({ organizerId: 1 });
CRMSubscriptionSchema.index({ status: 1 });
CRMSubscriptionSchema.index({ endDate: 1 });

// Method to check if subscription is valid
CRMSubscriptionSchema.methods.isValid = function (): boolean {
  if (this.status === 'active') {
    // Check trial
    if (this.trial?.isActive && this.trial.endDate > new Date()) {
      return true;
    }
    // Check trip package
    if (this.tripPackage && this.tripPackage.remainingTrips > 0) {
      return true;
    }
    // Check CRM bundle
    if (this.crmBundle?.hasAccess && (!this.endDate || this.endDate > new Date())) {
      return true;
    }
  }
  return false;
};

export default mongoose.model<ICRMSubscription>('CRMSubscription', CRMSubscriptionSchema);
