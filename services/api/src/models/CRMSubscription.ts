import mongoose, { Schema, Document } from 'mongoose';

export interface ICRMSubscription extends Document {
  organizerId: mongoose.Types.ObjectId;
  planType: 'trip_package_5' | 'trip_package_10' | 'trip_package_20' | 'trip_package_50' | 'crm_bundle' | 'trial';
  status: 'active' | 'expired' | 'cancelled' | 'pending_payment';
  
  // Trip Package Details
  tripPackage?: {
    packageType: '5_trips' | '10_trips' | '20_trips' | '50_trips';
    totalTrips: number; // 5, 10, 20, or 50
    usedTrips: number;
    remainingTrips: number;
    pricePerPackage: number; // ₹1499, ₹2499, ₹4499, ₹9999
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
    razorpayOrderId?: string;
    razorpayPaymentId?: string;
    razorpaySignature?: string;
    transactionId: string;
    amount: number;
    currency: string;
    paymentMethod: string;
    status: 'pending' | 'completed' | 'failed' | 'refunded';
    paidAt?: Date;
    metadata?: any;
  }[];
  
  // Trial notification tracking
  notifications: {
    trialEndingIn7Days: boolean;
    trialEndingIn1Day: boolean;
    trialExpired: boolean;
    paymentReminder: boolean;
    lastReminderSentAt?: Date;
  };
  
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
      enum: ['trip_package_5', 'trip_package_10', 'trip_package_20', 'trip_package_50', 'crm_bundle', 'trial'],
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'expired', 'cancelled', 'pending_payment'],
      default: 'active',
    },
    
    tripPackage: {
      packageType: { 
        type: String, 
        enum: ['5_trips', '10_trips', '20_trips', '50_trips'],
        default: '5_trips'
      },
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
        razorpayOrderId: { type: String },
        razorpayPaymentId: { type: String },
        razorpaySignature: { type: String },
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
    
    notifications: {
      trialEndingIn7Days: { type: Boolean, default: false },
      trialEndingIn1Day: { type: Boolean, default: false },
      trialExpired: { type: Boolean, default: false },
      paymentReminder: { type: Boolean, default: false },
      lastReminderSentAt: { type: Date },
    },
    
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
