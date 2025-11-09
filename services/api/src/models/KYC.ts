import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type KYCStatus = 'pending' | 'under_review' | 'approved' | 'rejected' | 'resubmission_required';
export type DocumentType = 'aadhaar' | 'pan' | 'passport' | 'driving_license' | 'business_license' | 'gst' | 'incorporation_certificate' | 'bank_statement' | 'address_proof';

export interface KYCDocument {
  type: DocumentType;
  documentNumber: string;
  documentUrl: string; // Firebase/CDN URL
  filename: string;
  uploadedAt: Date;
  verifiedAt?: Date;
  verifiedBy?: Types.ObjectId;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  expiryDate?: Date;
}

export interface BusinessInfo {
  companyName?: string;
  companyType?: 'individual' | 'partnership' | 'private_limited' | 'llp' | 'proprietorship';
  gstNumber?: string;
  panNumber?: string;
  registrationNumber?: string;
  yearOfEstablishment?: number;
  businessAddress?: string;
  website?: string;
}

export interface BankDetails {
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
  bankName: string;
  branchName: string;
  accountType: 'savings' | 'current';
  isVerified: boolean;
  verifiedAt?: Date;
}

export interface VerificationChecklist {
  identityVerified: boolean;
  addressVerified: boolean;
  businessVerified: boolean;
  bankVerified: boolean;
  policeClearance: boolean;
  backgroundCheck: boolean;
}

export interface KYCDocumentInterface extends Document {
  userId: Types.ObjectId;
  userRole: 'organizer' | 'agent';
  
  // Personal Information
  fullName: string;
  dateOfBirth: Date;
  gender: 'male' | 'female' | 'other';
  nationality: string;
  
  // Contact Information
  email: string;
  phone: string;
  alternatePhone?: string;
  
  // Address
  address: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
  };
  
  // Documents
  documents: KYCDocument[];
  
  // Business Information (for organizers)
  businessInfo?: BusinessInfo;
  
  // Bank Details
  bankDetails?: BankDetails;
  
  // Verification Status
  status: 'pending' | 'under_review' | 'approved' | 'rejected' | 'resubmission_required';
  verificationChecklist: VerificationChecklist;
  
  // Admin Review
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  reviewNotes?: string;
  rejectionReason?: string;
  
  // Trust Score (0-100)
  trustScore: number;
  
  // Risk Assessment
  riskLevel: 'low' | 'medium' | 'high';
  riskFlags: string[];
  
  // Verification Badge
  verificationBadge: 'none' | 'basic' | 'verified' | 'premium';
  badgeIssuedAt?: Date;
  
  // Compliance
  termsAccepted: boolean;
  termsAcceptedAt?: Date;
  privacyPolicyAccepted: boolean;
  backgroundCheckConsent: boolean;
  
  // Metadata
  submittedAt: Date;
  lastUpdatedBy?: Types.ObjectId;
  notes?: string;
  
  createdAt: Date;
  updatedAt: Date;
  
  // Virtuals
  completionPercentage: number;
  isFullyVerified: boolean;
  
  // Methods
  approve(adminId: Types.ObjectId, notes?: string): Promise<this>;
  reject(adminId: Types.ObjectId, reason: string, notes?: string): Promise<this>;
  requestResubmission(adminId: Types.ObjectId, reason: string): Promise<this>;
}

const kycDocumentSchema = new Schema({
  type: { 
    type: String, 
    enum: ['aadhaar', 'pan', 'passport', 'driving_license', 'business_license', 'gst', 'incorporation_certificate', 'bank_statement', 'address_proof'],
    required: true 
  },
  documentNumber: { type: String, required: true },
  documentUrl: { type: String, required: true },
  filename: { type: String, required: true },
  uploadedAt: { type: Date, default: Date.now },
  verifiedAt: { type: Date },
  verifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected'], 
    default: 'pending' 
  },
  rejectionReason: { type: String },
  expiryDate: { type: Date }
}, { _id: false });

const businessInfoSchema = new Schema({
  companyName: { type: String },
  companyType: { 
    type: String, 
    enum: ['individual', 'partnership', 'private_limited', 'llp', 'proprietorship'] 
  },
  gstNumber: { type: String },
  panNumber: { type: String },
  registrationNumber: { type: String },
  yearOfEstablishment: { type: Number, min: 1900, max: new Date().getFullYear() },
  businessAddress: { type: String },
  website: { type: String }
}, { _id: false });

const bankDetailsSchema = new Schema({
  accountHolderName: { type: String, required: true },
  accountNumber: { type: String, required: true },
  ifscCode: { type: String, required: true, uppercase: true },
  bankName: { type: String, required: true },
  branchName: { type: String, required: true },
  accountType: { type: String, enum: ['savings', 'current'], required: true },
  isVerified: { type: Boolean, default: false },
  verifiedAt: { type: Date }
}, { _id: false });

const verificationChecklistSchema = new Schema({
  identityVerified: { type: Boolean, default: false },
  addressVerified: { type: Boolean, default: false },
  businessVerified: { type: Boolean, default: false },
  bankVerified: { type: Boolean, default: false },
  policeClearance: { type: Boolean, default: false },
  backgroundCheck: { type: Boolean, default: false }
}, { _id: false });

const addressSchema = new Schema({
  line1: { type: String, required: true },
  line2: { type: String },
  city: { type: String, required: true },
  state: { type: String, required: true },
  pincode: { type: String, required: true },
  country: { type: String, default: 'India' }
}, { _id: false });

const kycSchema = new Schema(
  {
    userId: { 
      type: Schema.Types.ObjectId, 
      ref: 'User', 
      required: true, 
      unique: true,
      index: true 
    },
    userRole: { 
      type: String, 
      enum: ['organizer', 'agent'], 
      required: true,
      index: true
    },
    
    // Personal Information
    fullName: { type: String, required: true },
    dateOfBirth: { type: Date, required: true },
    gender: { type: String, enum: ['male', 'female', 'other'], required: true },
    nationality: { type: String, default: 'Indian' },
    
    // Contact
    email: { type: String, required: true, lowercase: true },
    phone: { type: String, required: true },
    alternatePhone: { type: String },
    
    // Address
    address: { type: addressSchema, required: true },
    
    // Documents
    documents: { 
      type: [kycDocumentSchema], 
      validate: {
        validator: function(docs: any[]) {
          return docs && docs.length > 0;
        },
        message: 'At least one document is required'
      }
    },
    
    // Business Information
    businessInfo: { type: businessInfoSchema },
    
    // Bank Details
    bankDetails: { type: bankDetailsSchema },
    
    // Verification Status
    status: { 
      type: String, 
      enum: ['pending', 'under_review', 'approved', 'rejected', 'resubmission_required'], 
      default: 'pending',
      index: true
    },
    verificationChecklist: { 
      type: verificationChecklistSchema, 
      default: () => ({
        identityVerified: false,
        addressVerified: false,
        businessVerified: false,
        bankVerified: false,
        policeClearance: false,
        backgroundCheck: false
      })
    },
    
    // Admin Review
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    reviewNotes: { type: String, maxlength: 2000 },
    rejectionReason: { type: String },
    
    // Trust Score
    trustScore: { type: Number, default: 0, min: 0, max: 100 },
    
    // Risk Assessment
    riskLevel: { 
      type: String, 
      enum: ['low', 'medium', 'high'], 
      default: 'medium',
      index: true
    },
    riskFlags: [{ type: String }],
    
    // Verification Badge
    verificationBadge: { 
      type: String, 
      enum: ['none', 'basic', 'verified', 'premium'], 
      default: 'none',
      index: true
    },
    badgeIssuedAt: { type: Date },
    
    // Compliance
    termsAccepted: { type: Boolean, default: false, required: true },
    termsAcceptedAt: { type: Date },
    privacyPolicyAccepted: { type: Boolean, default: false, required: true },
    backgroundCheckConsent: { type: Boolean, default: false },
    
    // Metadata
    submittedAt: { type: Date, default: Date.now },
    lastUpdatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    notes: { type: String, maxlength: 1000 }
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes
kycSchema.index({ status: 1, userRole: 1 });
kycSchema.index({ userId: 1, status: 1 });
kycSchema.index({ 'documents.type': 1, 'documents.status': 1 });
kycSchema.index({ verificationBadge: 1 });
kycSchema.index({ createdAt: -1 });

// Virtual for completion percentage
kycSchema.virtual('completionPercentage').get(function() {
  let score = 0;
  const maxScore = 6;
  
  if (this.verificationChecklist.identityVerified) score++;
  if (this.verificationChecklist.addressVerified) score++;
  if (this.verificationChecklist.businessVerified) score++;
  if (this.verificationChecklist.bankVerified) score++;
  if (this.verificationChecklist.policeClearance) score++;
  if (this.verificationChecklist.backgroundCheck) score++;
  
  return Math.round((score / maxScore) * 100);
});

// Virtual for checking if fully verified
kycSchema.virtual('isFullyVerified').get(function() {
  const checklist = this.verificationChecklist;
  return (
    checklist.identityVerified &&
    checklist.addressVerified &&
    (this.userRole === 'agent' || checklist.businessVerified) &&
    checklist.bankVerified
  );
});

// Pre-save middleware to calculate trust score
kycSchema.pre('save', function(next) {
  let score = 0;
  
  // Document verification (40 points)
  const approvedDocs = this.documents.filter(doc => doc.status === 'approved').length;
  score += Math.min(40, approvedDocs * 10);
  
  // Checklist completion (40 points)
  const checklist = this.verificationChecklist;
  if (checklist.identityVerified) score += 10;
  if (checklist.addressVerified) score += 10;
  if (checklist.businessVerified) score += 5;
  if (checklist.bankVerified) score += 10;
  if (checklist.policeClearance) score += 3;
  if (checklist.backgroundCheck) score += 2;
  
  // Additional factors (20 points)
  if (this.bankDetails?.isVerified) score += 10;
  if (this.businessInfo?.gstNumber) score += 5;
  if (this.termsAccepted && this.privacyPolicyAccepted) score += 5;
  
  this.trustScore = Math.min(100, score);
  
  // Determine verification badge based on trust score
  if (this.status === 'approved') {
    const checklist = this.verificationChecklist;
    const isFullyVerified = (
      checklist.identityVerified &&
      checklist.addressVerified &&
      (this.userRole === 'agent' || checklist.businessVerified) &&
      checklist.bankVerified
    );
    
    if (this.trustScore >= 90 && isFullyVerified) {
      this.verificationBadge = 'premium';
    } else if (this.trustScore >= 70) {
      this.verificationBadge = 'verified';
    } else if (this.trustScore >= 50) {
      this.verificationBadge = 'basic';
    }
    
    if (this.verificationBadge !== 'none' && !this.badgeIssuedAt) {
      this.badgeIssuedAt = new Date();
    }
  } else {
    this.verificationBadge = 'none';
  }
  
  // Determine risk level
  if (this.riskFlags.length >= 3 || this.trustScore < 40) {
    this.riskLevel = 'high';
  } else if (this.riskFlags.length >= 1 || this.trustScore < 70) {
    this.riskLevel = 'medium';
  } else {
    this.riskLevel = 'low';
  }
  
  next();
});

// Method to approve KYC
kycSchema.methods.approve = async function(adminId: Types.ObjectId, notes?: string) {
  this.status = 'approved';
  this.reviewedBy = adminId;
  this.reviewedAt = new Date();
  this.reviewNotes = notes;
  return this.save();
};

// Method to reject KYC
kycSchema.methods.reject = async function(adminId: Types.ObjectId, reason: string, notes?: string) {
  this.status = 'rejected';
  this.reviewedBy = adminId;
  this.reviewedAt = new Date();
  this.rejectionReason = reason;
  this.reviewNotes = notes;
  this.verificationBadge = 'none';
  return this.save();
};

// Method to request resubmission
kycSchema.methods.requestResubmission = async function(adminId: Types.ObjectId, reason: string) {
  this.status = 'resubmission_required';
  this.reviewedBy = adminId;
  this.reviewedAt = new Date();
  this.rejectionReason = reason;
  return this.save();
};

// Static method to get pending KYC count
kycSchema.statics.getPendingCount = async function(): Promise<number> {
  return this.countDocuments({ 
    status: { $in: ['pending', 'under_review'] } 
  });
};

// Static method to get KYC stats
kycSchema.statics.getStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);
  
  const byRole = await this.aggregate([
    {
      $group: {
        _id: '$userRole',
        count: { $sum: 1 }
      }
    }
  ]);
  
  return { byStatus: stats, byRole };
};

export const KYC = (mongoose.models.KYC || 
  mongoose.model('KYC', kycSchema)) as Model<KYCDocumentInterface>;
