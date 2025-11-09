import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type PromoCodeType = 'percentage' | 'fixed' | 'free_shipping' | 'trip_slot';
export type PromoCodeStatus = 'active' | 'inactive' | 'expired' | 'exhausted';

export interface PromoCodeUsage {
  userId: Types.ObjectId;
  bookingId?: Types.ObjectId;
  tripId?: Types.ObjectId;
  usedAt: Date;
  discountApplied: number;
  orderAmount: number;
}

export interface PromoCodeDocument extends Document {
  code: string;
  name: string;
  description?: string;
  
  // Discount configuration
  type: PromoCodeType;
  discountValue: number; // Percentage (0-100) or Fixed amount
  maxDiscount?: number; // Maximum discount amount (for percentage types)
  minPurchaseAmount?: number; // Minimum order value required
  
  // Applicability
  applicableFor: ('trip' | 'booking' | 'subscription')[];
  specificTripIds?: Types.ObjectId[]; // Apply only to specific trips
  specificCategories?: string[]; // Apply only to specific trip categories
  
  // Validity
  status: PromoCodeStatus;
  startDate: Date;
  endDate: Date;
  
  // Usage limits
  maxTotalUsage?: number; // Total times this code can be used
  maxUsagePerUser: number; // How many times one user can use this code
  totalUsed: number;
  
  // Usage tracking
  usageHistory: PromoCodeUsage[];
  
  // Restrictions
  firstTimeUsersOnly: boolean;
  verifiedUsersOnly: boolean;
  minTripRating?: number; // Apply only to trips with this minimum rating
  
  // Creator and metadata
  createdBy: Types.ObjectId;
  isPublic: boolean; // If false, code must be shared privately
  
  createdAt: Date;
  updatedAt: Date;
}

const promoCodeUsageSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  bookingId: { type: Schema.Types.ObjectId, ref: 'GroupBooking' },
  tripId: { type: Schema.Types.ObjectId, ref: 'Trip' },
  usedAt: { type: Date, default: Date.now },
  discountApplied: { type: Number, required: true, min: 0 },
  orderAmount: { type: Number, required: true, min: 0 }
}, { _id: false });

const promoCodeSchema = new Schema(
  {
    code: { 
      type: String, 
      required: true, 
      unique: true, 
      uppercase: true,
      trim: true,
      index: true,
      validate: {
        validator: function(v: string) {
          return /^[A-Z0-9]{4,20}$/.test(v);
        },
        message: 'Code must be 4-20 characters (letters and numbers only)'
      }
    },
    name: { type: String, required: true },
    description: { type: String, maxlength: 500 },
    
    // Discount configuration
    type: { 
      type: String, 
      enum: ['percentage', 'fixed', 'free_shipping', 'trip_slot'], 
      required: true 
    },
    discountValue: { 
      type: Number, 
      required: true, 
      min: 0,
      validate: {
        validator: function(v: number) {
          if (this.type === 'percentage') {
            return v >= 0 && v <= 100;
          }
          return v >= 0;
        },
        message: 'Percentage discount must be between 0 and 100'
      }
    },
    maxDiscount: { type: Number, min: 0 },
    minPurchaseAmount: { type: Number, min: 0, default: 0 },
    
    // Applicability
    applicableFor: {
      type: [{ type: String, enum: ['trip', 'booking', 'subscription'] }],
      default: ['booking'],
      validate: {
        validator: function(v: string[]) {
          return v && v.length > 0;
        },
        message: 'At least one application type is required'
      }
    },
    specificTripIds: [{ type: Schema.Types.ObjectId, ref: 'Trip' }],
    specificCategories: [{ type: String }],
    
    // Validity
    status: { 
      type: String, 
      enum: ['active', 'inactive', 'expired', 'exhausted'], 
      default: 'active',
      index: true
    },
    startDate: { type: Date, required: true, default: Date.now },
    endDate: { type: Date, required: true },
    
    // Usage limits
    maxTotalUsage: { type: Number, min: 1 },
    maxUsagePerUser: { type: Number, default: 1, min: 1 },
    totalUsed: { type: Number, default: 0, min: 0 },
    
    // Usage tracking
    usageHistory: { type: [promoCodeUsageSchema], default: [] },
    
    // Restrictions
    firstTimeUsersOnly: { type: Boolean, default: false },
    verifiedUsersOnly: { type: Boolean, default: false },
    minTripRating: { type: Number, min: 0, max: 5 },
    
    // Creator
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    isPublic: { type: Boolean, default: true },
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes
promoCodeSchema.index({ code: 1, status: 1 });
promoCodeSchema.index({ startDate: 1, endDate: 1 });
promoCodeSchema.index({ status: 1, isPublic: 1 });
promoCodeSchema.index({ createdBy: 1 });

// Virtual for checking if code is valid
promoCodeSchema.virtual('isValid').get(function() {
  const now = new Date();
  return (
    this.status === 'active' &&
    now >= this.startDate &&
    now <= this.endDate &&
    (!this.maxTotalUsage || this.totalUsed < this.maxTotalUsage)
  );
});

// Virtual for usage percentage
promoCodeSchema.virtual('usagePercentage').get(function() {
  if (!this.maxTotalUsage) return 0;
  return Math.round((this.totalUsed / this.maxTotalUsage) * 100);
});

// Pre-save middleware to update status
promoCodeSchema.pre('save', function(next) {
  const now = new Date();
  
  // Check if expired
  if (now > this.endDate && this.status === 'active') {
    this.status = 'expired';
  }
  
  // Check if exhausted
  if (this.maxTotalUsage && this.totalUsed >= this.maxTotalUsage && this.status === 'active') {
    this.status = 'exhausted';
  }
  
  next();
});

// Method to validate promo code for a user
promoCodeSchema.methods.validateForUser = async function(userId: Types.ObjectId, orderAmount: number, tripId?: Types.ObjectId) {
  // Check if code is valid
  if (!this.isValid) {
    return { 
      valid: false, 
      message: `Promo code is ${this.status}` 
    };
  }
  
  // Check date validity
  const now = new Date();
  if (now < this.startDate) {
    return { 
      valid: false, 
      message: `Promo code is not yet active. Valid from ${this.startDate.toDateString()}` 
    };
  }
  if (now > this.endDate) {
    return { 
      valid: false, 
      message: 'Promo code has expired' 
    };
  }
  
  // Check minimum purchase amount
  if (this.minPurchaseAmount && orderAmount < this.minPurchaseAmount) {
    return { 
      valid: false, 
      message: `Minimum purchase amount of ₹${this.minPurchaseAmount} required` 
    };
  }
  
  // Check user usage limit
  const userUsageCount = this.usageHistory.filter(
    (usage: any) => usage.userId.toString() === userId.toString()
  ).length;
  
  if (userUsageCount >= this.maxUsagePerUser) {
    return { 
      valid: false, 
      message: `You have already used this code ${this.maxUsagePerUser} time(s)` 
    };
  }
  
  // Check total usage limit
  if (this.maxTotalUsage && this.totalUsed >= this.maxTotalUsage) {
    return { 
      valid: false, 
      message: 'Promo code usage limit exhausted' 
    };
  }
  
  // Check specific trip restriction
  if (this.specificTripIds && this.specificTripIds.length > 0 && tripId) {
    const isApplicable = this.specificTripIds.some(
      (id: any) => id.toString() === tripId.toString()
    );
    if (!isApplicable) {
      return { 
        valid: false, 
        message: 'This promo code is not applicable for this trip' 
      };
    }
  }
  
  return { 
    valid: true, 
    message: 'Promo code is valid' 
  };
};

// Method to calculate discount
promoCodeSchema.methods.calculateDiscount = function(orderAmount: number): number {
  let discount = 0;
  
  switch (this.type) {
    case 'percentage':
      discount = (orderAmount * this.discountValue) / 100;
      if (this.maxDiscount) {
        discount = Math.min(discount, this.maxDiscount);
      }
      break;
    case 'fixed':
      discount = Math.min(this.discountValue, orderAmount);
      break;
    case 'free_shipping':
      // Handle based on your shipping logic
      discount = 0;
      break;
    case 'trip_slot':
      // Special handling for free trip slots
      discount = 0;
      break;
    default:
      discount = 0;
  }
  
  return Math.round(discount);
};

// Method to apply promo code
promoCodeSchema.methods.apply = async function(
  userId: Types.ObjectId, 
  orderAmount: number, 
  bookingId?: Types.ObjectId,
  tripId?: Types.ObjectId
) {
  // Validate first
  const validation = await this.validateForUser(userId, orderAmount, tripId);
  if (!validation.valid) {
    throw new Error(validation.message);
  }
  
  // Calculate discount
  const discountAmount = this.calculateDiscount(orderAmount);
  
  // Record usage
  this.usageHistory.push({
    userId,
    bookingId,
    tripId,
    usedAt: new Date(),
    discountApplied: discountAmount,
    orderAmount
  });
  
  this.totalUsed += 1;
  
  await this.save();
  
  return {
    discountAmount,
    finalAmount: orderAmount - discountAmount,
    message: 'Promo code applied successfully'
  };
};

// Static method to find valid promo codes
promoCodeSchema.statics.findValidCodes = async function(isPublic: boolean = true) {
  const now = new Date();
  return this.find({
    status: 'active',
    startDate: { $lte: now },
    endDate: { $gte: now },
    isPublic,
    $expr: {
      $or: [
        { $eq: ['$maxTotalUsage', null] },
        { $lt: ['$totalUsed', '$maxTotalUsage'] }
      ]
    }
  });
};

// Static method to get promo code stats
promoCodeSchema.statics.getStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalUsage: { $sum: '$totalUsed' }
      }
    }
  ]);
  
  const topCodes = await this.aggregate([
    {
      $match: { status: 'active' }
    },
    {
      $sort: { totalUsed: -1 }
    },
    {
      $limit: 10
    },
    {
      $project: {
        code: 1,
        name: 1,
        totalUsed: 1,
        discountValue: 1,
        type: 1
      }
    }
  ]);
  
  return { byStatus: stats, topCodes };
};

export const PromoCode = (mongoose.models.PromoCode || 
  mongoose.model('PromoCode', promoCodeSchema)) as Model<PromoCodeDocument>;
