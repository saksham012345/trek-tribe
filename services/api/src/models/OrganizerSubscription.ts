import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type SubscriptionStatus = 'pending_payment' | 'active' | 'expired' | 'cancelled' | 'trial';
export type SubscriptionPlan = 'trial' | 'free-trial' | 'starter' | 'basic' | 'pro' | 'professional' | 'premium' | 'enterprise';

export interface PaymentRecord {
  amount: number;
  currency: string;
  paymentMethod: string;
  transactionId: string;
  paymentDate: Date;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  receiptUrl?: string;
}

export interface TripUsageRecord {
  tripId: Types.ObjectId;
  tripTitle: string;
  createdAt: Date;
  status: 'active' | 'completed' | 'cancelled';
}

export interface OrganizerSubscriptionDocument extends Document {
  organizerId: Types.ObjectId;

  // Subscription plan details
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  isTrialActive: boolean;
  crmAccess?: boolean;

  // Subscription dates
  subscriptionStartDate?: Date;
  subscriptionEndDate?: Date;
  trialStartDate?: Date;
  trialEndDate?: Date;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;

  // Trip limits and usage
  tripsPerCycle: number; // 5 trips per ₹1499 payment
  tripsUsed: number;
  tripsRemaining: number;
  tripUsageHistory: TripUsageRecord[];

  // Pricing
  pricePerCycle: number; // ₹1499
  currency: string;

  // Payment history
  payments: PaymentRecord[];
  totalPaid: number;
  lastPaymentDate?: Date;
  nextPaymentDue?: Date;

  // Razorpay integration
  razorpayOrderId?: string;
  razorpayPaymentId?: string;

  // Auto-renewal
  autoRenew: boolean;
  paymentMethodId?: string;

  // Notifications
  notificationsSent: {
    type: 'trial_ending' | 'trial_ended' | 'payment_due' | 'payment_failed' | 'trips_exhausted' | 'subscription_renewed';
    sentAt: Date;
    message: string;
  }[];

  // Metadata
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const paymentRecordSchema = new Schema({
  amount: { type: Number, required: true, min: 0 },
  currency: { type: String, default: 'INR' },
  paymentMethod: { type: String, required: true },
  transactionId: { type: String, required: true },
  paymentDate: { type: Date, default: Date.now },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  receiptUrl: { type: String }
}, { _id: false });

const tripUsageRecordSchema = new Schema({
  tripId: { type: Schema.Types.ObjectId, ref: 'Trip', required: true },
  tripTitle: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  status: {
    type: String,
    enum: ['active', 'completed', 'cancelled'],
    default: 'active'
  }
}, { _id: false });

const notificationSchema = new Schema({
  type: {
    type: String,
    enum: ['trial_ending', 'trial_ended', 'payment_due', 'payment_failed', 'trips_exhausted', 'subscription_renewed'],
    required: true
  },
  sentAt: { type: Date, default: Date.now },
  message: { type: String, required: true }
}, { _id: false });

const organizerSubscriptionSchema = new Schema(
  {
    organizerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },

    // Subscription plan
    plan: {
      type: String,
      enum: ['trial', 'free-trial', 'starter', 'basic', 'pro', 'professional', 'premium', 'enterprise'],
      default: 'free-trial'
    },
    status: {
      type: String,
      enum: ['pending_payment', 'active', 'expired', 'cancelled', 'trial'],
      default: 'pending_payment',
      index: true
    },

    // Trial status
    isTrialActive: { type: Boolean, default: false },

    // Feature Access
    crmAccess: { type: Boolean, default: false },

    // Subscription dates
    subscriptionStartDate: { type: Date },
    subscriptionEndDate: { type: Date },
    trialStartDate: { type: Date },
    trialEndDate: { type: Date },
    currentPeriodStart: { type: Date },
    currentPeriodEnd: { type: Date },

    // Trip limits
    tripsPerCycle: { type: Number, default: 5 },
    tripsUsed: { type: Number, default: 0, min: 0 },
    tripsRemaining: {
      type: Number,
      default: 5,
      min: 0
    },
    tripUsageHistory: { type: [tripUsageRecordSchema], default: [] },

    // Pricing
    pricePerCycle: { type: Number, default: 1499 }, // ₹1499
    currency: { type: String, default: 'INR' },

    // Payment
    payments: { type: [paymentRecordSchema], default: [] },
    totalPaid: { type: Number, default: 0, min: 0 },
    lastPaymentDate: { type: Date },
    nextPaymentDue: { type: Date },

    // Razorpay integration
    razorpayOrderId: { type: String },
    razorpayPaymentId: { type: String },

    // Auto-renewal
    autoRenew: { type: Boolean, default: false },
    paymentMethodId: { type: String },
    // Payment method validity flag - maintained by migration/validation scripts
    paymentMethodValid: { type: Boolean, default: undefined },

    // Notifications
    notificationsSent: { type: [notificationSchema], default: [] },

    // Metadata
    notes: { type: String, maxlength: 1000 }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes for performance
organizerSubscriptionSchema.index({ status: 1 });
organizerSubscriptionSchema.index({ status: 1, nextPaymentDue: 1 });
organizerSubscriptionSchema.index({ organizerId: 1, status: 1 });

// Virtual for checking if subscription is valid
organizerSubscriptionSchema.virtual('isValid').get(function () {
  // Subscription is valid only if active and not expired
  if (this.status === 'active' && this.subscriptionEndDate && new Date() <= this.subscriptionEndDate) {
    return true;
  }
  return false;
});

// Virtual for days remaining
organizerSubscriptionSchema.virtual('daysRemaining').get(function () {
  const targetDate = this.subscriptionEndDate;
  if (!targetDate) return 0;

  const diff = new Date(targetDate).getTime() - new Date().getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
});

// Pre-save middleware to calculate trips remaining
organizerSubscriptionSchema.pre('save', function (next) {
  this.tripsRemaining = Math.max(0, this.tripsPerCycle - this.tripsUsed);

  // Update status based on expiry
  if (this.status === 'active' && this.subscriptionEndDate && new Date() > this.subscriptionEndDate) {
    this.status = 'expired';
  }

  next();
});

// Method to use a trip slot
organizerSubscriptionSchema.methods.useTripSlot = async function (tripId: Types.ObjectId, tripTitle: string) {
  if (this.tripsRemaining <= 0) {
    throw new Error('No trip slots remaining. Please purchase more trips.');
  }

  this.tripsUsed += 1;
  this.tripUsageHistory.push({
    tripId,
    tripTitle,
    createdAt: new Date(),
    status: 'active'
  });

  return this.save();
};

// Method to add payment
organizerSubscriptionSchema.methods.addPayment = async function (paymentData: Partial<PaymentRecord>) {
  const payment: PaymentRecord = {
    amount: paymentData.amount!,
    currency: paymentData.currency || 'INR',
    paymentMethod: paymentData.paymentMethod!,
    transactionId: paymentData.transactionId!,
    paymentDate: paymentData.paymentDate || new Date(),
    status: paymentData.status || 'completed',
    receiptUrl: paymentData.receiptUrl
  };

  this.payments.push(payment);

  if (payment.status === 'completed') {
    this.totalPaid += payment.amount;
    this.lastPaymentDate = payment.paymentDate;

    // Reset trip counter for new cycle
    this.tripsUsed = 0;
    this.tripsRemaining = this.tripsPerCycle;

    // Extend subscription
    const currentEnd = this.subscriptionEndDate || new Date();
    const newEnd = new Date(currentEnd);
    newEnd.setMonth(newEnd.getMonth() + 1); // 1 month extension per payment

    this.subscriptionEndDate = newEnd;
    this.status = 'active';
    this.currentPeriodStart = new Date();
    this.currentPeriodEnd = newEnd;

    // Calculate next payment due (7 days before expiry)
    const nextDue = new Date(newEnd);
    nextDue.setDate(nextDue.getDate() - 7);
    this.nextPaymentDue = nextDue;
  }

  return this.save();
};

// Method to send notification
organizerSubscriptionSchema.methods.addNotification = function (type: string, message: string) {
  this.notificationsSent.push({
    type: type as any,
    sentAt: new Date(),
    message
  });
  return this.save();
};

// Static method to check if organizer can create trip
organizerSubscriptionSchema.statics.canCreateTrip = async function (organizerId: Types.ObjectId): Promise<{ allowed: boolean; message: string }> {
  const subscription = await this.findOne({ organizerId });

  if (!subscription) {
    // No subscription found - Create new pending subscription
    const newSubscription = await this.create({ organizerId });
    return {
      allowed: false,
      message: 'No active subscription found. Please purchase a plan to start creating trips.'
    };
  }

  // Check if subscription is valid
  if (!subscription.isValid) {
    return {
      allowed: false,
      message: 'Your subscription has expired. Please renew to create more trips.'
    };
  }

  // Check trip limit
  if (subscription.tripsRemaining <= 0) {
    return {
      allowed: false,
      message: `You have used all ${subscription.tripsPerCycle} trips for this cycle. Please purchase more trips.`
    };
  }

  return {
    allowed: true,
    message: `${subscription.tripsRemaining} trips remaining in current cycle`
  };
};

export const OrganizerSubscription = (mongoose.models.OrganizerSubscription ||
  mongoose.model('OrganizerSubscription', organizerSubscriptionSchema)) as Model<OrganizerSubscriptionDocument>;
