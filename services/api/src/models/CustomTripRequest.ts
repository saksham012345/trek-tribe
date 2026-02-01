import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type RequestStatus = 'open' | 'assigned_to_organizers' | 'proposal_selected' | 'needs_review' | 'converted' | 'cancelled';

export interface QualitySnapshot {
    stayType?: string;
    comfortLevel?: string;
    transportType?: string;
    maxGroupSize?: string;
    safetyPlanPresent?: boolean;
}

export interface Proposal {
    organizerId: Types.ObjectId;
    price: number;
    currency: string;
    itinerarySummary: string;
    inclusions: string[];
    exclusions: string[];
    qualitySnapshot: QualitySnapshot;
    valueStatement: string; // Max 500 chars
    priceBreakdown?: string;
    cancellationPolicy: string;
    validUntil?: Date;
    status: 'pending' | 'accepted' | 'rejected';
    sealed: boolean; // True until selected
    createdAt: Date;
    _id?: any; // Mongoose subdocument ID
}

export interface CustomTripRequestDocument extends Document {
    travelerId: Types.ObjectId;
    destination: string;
    startDate?: Date;
    endDate?: Date;
    flexibleDates: boolean;
    budget?: number;
    numberOfTravelers: number;
    // Enhanced structured fields
    tripType: 'relaxed' | 'adventure' | 'cultural' | 'religious' | 'wildlife' | 'mixed';
    experienceLevel: 'beginner' | 'intermediate' | 'advanced';
    ageGroup: '18-25' | '25-40' | '40-60' | 'family' | 'seniors' | 'mixed';
    specialNeeds?: string;
    privacyLevel: 'private' | 'invite-only';
    preferences?: string; // Additional free text

    status: RequestStatus;
    adminNotes?: string;
    assignedOrganizers: Types.ObjectId[]; // Organizers selected by logic to view this request
    proposals: Proposal[];
    convertedTripId?: Types.ObjectId; // Link to the private Trip created from this request
    createdAt: Date;
    updatedAt: Date;
}

const proposalSchema = new Schema({
    organizerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    price: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    itinerarySummary: { type: String, required: true },
    inclusions: [{ type: String }],
    exclusions: [{ type: String }],
    qualitySnapshot: {
        stayType: { type: String, required: true },
        comfortLevel: { type: String, required: true },
        transportType: { type: String, required: true },
        maxGroupSize: { type: String, required: true },
        safetyPlanPresent: { type: Boolean, default: false }
    },
    valueStatement: {
        type: String,
        required: true,
        maxlength: 500
        // Regex validation will be handled in route layer for better error messages
    },
    priceBreakdown: { type: String },
    cancellationPolicy: { type: String, required: true },
    validUntil: { type: Date },
    status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
    sealed: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
}, { _id: true });

const customTripRequestSchema = new Schema(
    {
        travelerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        destination: { type: String, required: true },
        startDate: { type: Date },
        endDate: { type: Date },
        flexibleDates: { type: Boolean, default: false },
        budget: { type: Number },
        numberOfTravelers: { type: Number, default: 1 },

        // New Fields
        tripType: {
            type: String,
            enum: ['relaxed', 'adventure', 'cultural', 'religious', 'wildlife', 'mixed'],
            default: 'mixed'
        },
        experienceLevel: {
            type: String,
            enum: ['beginner', 'intermediate', 'advanced'],
            default: 'beginner'
        },
        ageGroup: {
            type: String,
            enum: ['18-25', '25-40', '40-60', 'family', 'seniors', 'mixed'],
            default: 'mixed'
        },
        specialNeeds: { type: String },
        privacyLevel: { type: String, enum: ['private', 'invite-only'], default: 'private' },
        preferences: { type: String },

        status: {
            type: String,
            enum: ['open', 'assigned_to_organizers', 'proposal_selected', 'needs_review', 'converted', 'cancelled'],
            default: 'open',
            index: true
        },
        adminNotes: { type: String },
        assignedOrganizers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
        proposals: [proposalSchema],
        convertedTripId: { type: Schema.Types.ObjectId, ref: 'Trip' }
    },
    { timestamps: true }
);

export const CustomTripRequest = (mongoose.models.CustomTripRequest || mongoose.model<CustomTripRequestDocument>('CustomTripRequest', customTripRequestSchema)) as Model<CustomTripRequestDocument>;
