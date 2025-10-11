import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface GroupParticipant {
  name: string;
  email: string;
  phone: string;
  dateOfBirth?: Date;
  gender?: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  medicalConditions?: string;
  dietaryRestrictions?: string;
  experienceLevel: 'beginner' | 'intermediate' | 'advanced';
  specialRequests?: string;
  isMainBooker: boolean;
}

export interface GroupBookingDocument extends Document {
  tripId: Types.ObjectId;
  mainBookerId: Types.ObjectId;
  participants: GroupParticipant[];
  numberOfGuests: number; // Total number of guests (same as totalParticipants but clearer naming)
  totalParticipants: number;
  selectedPackageId?: string; // Package option selected
  packageName?: string; // Package name for reference
  totalAmount: number;
  pricePerPerson: number;
  groupDiscount: number;
  discountAmount: number;
  finalAmount: number;
  // Payment breakdown
  paymentType: 'full' | 'advance';
  advanceAmount?: number;
  remainingAmount?: number;
  paymentStatus: 'pending' | 'partial' | 'completed' | 'failed' | 'refunded';
  paymentMethod: string;
  paymentTransactionId?: string;
  paymentDetails?: {
    transactionDate?: Date;
    paymentGateway?: string;
    gatewayTransactionId?: string;
    paymentReference?: string;
  };
  // Payment screenshot upload
  paymentScreenshot?: {
    filename: string;
    originalName: string;
    url: string;
    uploadedAt: Date;
  };
  paymentVerificationStatus: 'pending' | 'verified' | 'rejected';
  paymentVerificationNotes?: string;
  verifiedBy?: Types.ObjectId; // Admin/Organizer who verified
  verifiedAt?: Date;
  verificationNotes?: string; // Additional verification notes
  rejectionReason?: string; // Reason for payment rejection
  bookingStatus: 'confirmed' | 'pending' | 'cancelled' | 'completed';
  specialRequests?: string;
  notes?: string;
  cancellationReason?: string;
  cancellationDate?: Date;
  refundAmount?: number;
  refundStatus?: 'pending' | 'processed' | 'failed';
  createdAt: Date;
  updatedAt: Date;
}

const groupParticipantSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, lowercase: true },
  phone: { type: String, required: true },
  dateOfBirth: { type: Date },
  gender: { type: String, enum: ['male', 'female', 'other', 'prefer-not-to-say'] },
  emergencyContactName: { type: String, required: true },
  emergencyContactPhone: { type: String, required: true },
  medicalConditions: { type: String },
  dietaryRestrictions: { type: String },
  experienceLevel: { 
    type: String, 
    enum: ['beginner', 'intermediate', 'advanced'], 
    required: true 
  },
  specialRequests: { type: String },
  isMainBooker: { type: Boolean, default: false }
}, { _id: false });

const groupBookingSchema = new Schema(
  {
    tripId: { type: Schema.Types.ObjectId, ref: 'Trip', required: true, index: true },
    mainBookerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    participants: { 
      type: [groupParticipantSchema], 
      required: true,
      validate: {
        validator: function(participants: GroupParticipant[]) {
          return participants.length > 0 && participants.length <= 20; // Max 20 people per group
        },
        message: 'Group must have between 1 and 20 participants'
      }
    },
    numberOfGuests: { 
      type: Number, 
      required: true,
      min: 1,
      max: 20
    },
    totalParticipants: { 
      type: Number, 
      required: true,
      min: 1,
      max: 20
    },
    selectedPackageId: { type: String },
    packageName: { type: String },
    totalAmount: { type: Number, required: true, min: 0 },
    pricePerPerson: { type: Number, required: true, min: 0 },
    groupDiscount: { type: Number, default: 0, min: 0, max: 100 }, // Percentage
    discountAmount: { type: Number, default: 0, min: 0 },
    finalAmount: { type: Number, required: true, min: 0 },
    // Payment breakdown
    paymentType: { type: String, enum: ['full', 'advance'], default: 'full' },
    advanceAmount: { type: Number, min: 0 },
    remainingAmount: { type: Number, min: 0 },
    paymentStatus: { 
      type: String, 
      enum: ['pending', 'partial', 'completed', 'failed', 'refunded'], 
      default: 'pending',
      index: true
    },
    paymentMethod: { type: String, required: true },
    paymentTransactionId: { type: String },
    paymentDetails: {
      type: {
        transactionDate: { type: Date },
        paymentGateway: { type: String },
        gatewayTransactionId: { type: String },
        paymentReference: { type: String }
      },
      required: false
    },
    // Payment screenshot upload
    paymentScreenshot: {
      type: {
        filename: { type: String, required: true },
        originalName: { type: String, required: true },
        url: { type: String, required: true },
        uploadedAt: { type: Date, default: Date.now }
      },
      required: false
    },
    paymentVerificationStatus: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: 'pending',
      index: true
    },
    paymentVerificationNotes: { type: String },
    verifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    verifiedAt: { type: Date },
    verificationNotes: { type: String },
    rejectionReason: { type: String },
    bookingStatus: { 
      type: String, 
      enum: ['confirmed', 'pending', 'cancelled', 'completed'], 
      default: 'pending',
      index: true
    },
    specialRequests: { type: String },
    notes: { type: String },
    cancellationReason: { type: String },
    cancellationDate: { type: Date },
    refundAmount: { type: Number, min: 0 },
    refundStatus: { 
      type: String, 
      enum: ['pending', 'processed', 'failed']
    }
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes for better query performance
groupBookingSchema.index({ tripId: 1, mainBookerId: 1 });
groupBookingSchema.index({ paymentStatus: 1, bookingStatus: 1 });
groupBookingSchema.index({ createdAt: -1 });

// Virtual for main booker participant
groupBookingSchema.virtual('mainBooker').get(function() {
  return this.participants.find((p: any) => p.isMainBooker);
});

// Pre-save middleware to calculate amounts
groupBookingSchema.pre('save', function(next) {
  // Calculate total participants
  this.totalParticipants = this.participants.length;
  
  // Sync numberOfGuests with totalParticipants if not explicitly set
  if (!this.numberOfGuests) {
    this.numberOfGuests = this.totalParticipants;
  }
  
  // Calculate total amount before discount
  this.totalAmount = this.pricePerPerson * this.numberOfGuests;
  
  // Apply group discount
  if (this.groupDiscount > 0) {
    this.discountAmount = (this.totalAmount * this.groupDiscount) / 100;
    this.finalAmount = this.totalAmount - this.discountAmount;
  } else {
    this.discountAmount = 0;
    this.finalAmount = this.totalAmount;
  }
  
  // Calculate payment breakdown for advance payments
  if (this.paymentType === 'advance' && this.advanceAmount) {
    this.remainingAmount = this.finalAmount - this.advanceAmount;
  } else {
    this.remainingAmount = 0;
  }
  
  // Ensure at least one participant is marked as main booker
  const hasMainBooker = this.participants.some((p: any) => p.isMainBooker);
  if (!hasMainBooker && this.participants.length > 0) {
    this.participants[0].isMainBooker = true;
  }
  
  next();
});

// Static method to calculate group discount
groupBookingSchema.statics.calculateGroupDiscount = function(participantCount: number): number {
  if (participantCount >= 15) return 20; // 20% discount for 15+ people
  if (participantCount >= 10) return 15; // 15% discount for 10-14 people
  if (participantCount >= 6) return 10;  // 10% discount for 6-9 people
  if (participantCount >= 4) return 5;   // 5% discount for 4-5 people
  return 0; // No discount for less than 4 people
};

// Instance method to add participant
groupBookingSchema.methods.addParticipant = function(participant: Omit<GroupParticipant, 'isMainBooker'>) {
  if (this.participants.length >= 20) {
    throw new Error('Maximum 20 participants allowed per group booking');
  }
  
  this.participants.push({
    ...participant,
    isMainBooker: false
  });
  
  // Recalculate discount
  this.groupDiscount = (this.constructor as any).calculateGroupDiscount(this.participants.length);
  
  return this.save();
};

// Instance method to remove participant
groupBookingSchema.methods.removeParticipant = function(participantEmail: string) {
  const participantIndex = this.participants.findIndex(
    (p: GroupParticipant) => p.email.toLowerCase() === participantEmail.toLowerCase()
  );
  
  if (participantIndex === -1) {
    throw new Error('Participant not found');
  }
  
  const participant = this.participants[participantIndex];
  if (participant.isMainBooker && this.participants.length > 1) {
    throw new Error('Cannot remove main booker. Transfer main booker role first.');
  }
  
  this.participants.splice(participantIndex, 1);
  
  if (this.participants.length === 0) {
    throw new Error('Cannot remove all participants');
  }
  
  // Recalculate discount
  this.groupDiscount = (this.constructor as any).calculateGroupDiscount(this.participants.length);
  
  return this.save();
};

// Instance method to transfer main booker
groupBookingSchema.methods.transferMainBooker = function(newMainBookerEmail: string) {
  const currentMainBooker = this.participants.find((p: GroupParticipant) => p.isMainBooker);
  const newMainBooker = this.participants.find(
    (p: GroupParticipant) => p.email.toLowerCase() === newMainBookerEmail.toLowerCase()
  );
  
  if (!newMainBooker) {
    throw new Error('New main booker not found in participants');
  }
  
  if (currentMainBooker) {
    currentMainBooker.isMainBooker = false;
  }
  
  newMainBooker.isMainBooker = true;
  
  return this.save();
};

// Define model interface with static and instance methods
interface GroupBookingModel extends Model<GroupBookingDocument> {
  calculateGroupDiscount(participantCount: number): number;
}

// Add instance method types to document interface
export interface GroupBookingDocumentWithMethods extends GroupBookingDocument {
  addParticipant(participant: Omit<GroupParticipant, 'isMainBooker'>): Promise<GroupBookingDocument>;
  removeParticipant(participantEmail: string): Promise<GroupBookingDocument>;
  transferMainBooker(newMainBookerEmail: string): Promise<GroupBookingDocument>;
}

export const GroupBooking = (mongoose.models.GroupBooking || 
  mongoose.model('GroupBooking', groupBookingSchema)) as GroupBookingModel;
