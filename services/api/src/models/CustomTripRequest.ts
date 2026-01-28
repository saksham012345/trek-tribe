import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type RequestStatus = 'open' | 'assigned_to_organizers' | 'proposal_selected' | 'converted' | 'cancelled';

export interface Proposal {
    organizerId: Types.ObjectId;
    price: number;
    currency: string;
    itinerarySummary: string;
    inclusions: string[];
    exclusions: string[];
    validUntil?: Date;
    status: 'pending' | 'accepted' | 'rejected';
    createdAt: Date;
}

export interface CustomTripRequestDocument extends Document {
    travelerId: Types.ObjectId;
    destination: string;
    startDate?: Date;
    endDate?: Date;
    flexibleDates: boolean;
    budget?: number;
    numberOfTravelers: number;
    preferences?: string; // Free text requirements
    status: RequestStatus;
    adminNotes?: string;
    assignedOrganizers: Types.ObjectId[]; // Organizers selected by Admin to view this request
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
    validUntil: { type: Date },
    status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
    createdAt: { type: Date, default: Date.now }
}, { _id: true }); // Give proposals an ID for easy referencing

const customTripRequestSchema = new Schema(
    {
        travelerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        destination: { type: String, required: true },
        startDate: { type: Date },
        endDate: { type: Date },
        flexibleDates: { type: Boolean, default: false },
        budget: { type: Number },
        numberOfTravelers: { type: Number, default: 1 },
        preferences: { type: String },
        status: {
            type: String,
            enum: ['open', 'assigned_to_organizers', 'proposal_selected', 'converted', 'cancelled'],
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
