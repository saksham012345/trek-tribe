import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface ParticipantInfo {
  userId: Types.ObjectId;
  emergencyContactName: string;
  emergencyContactPhone: string;
  medicalConditions?: string;
  dietaryRestrictions?: string;
  experienceLevel: 'beginner' | 'intermediate' | 'advanced';
  specialRequests?: string;
  joinedAt: Date;
}

export interface TripDocument extends Document {
  organizerId: Types.ObjectId;
  title: string;
  description: string;
  categories: string[];
  destination: string;
  location?: { type: 'Point'; coordinates: [number, number] };
  schedule: { day: number; title: string; activities: string[] }[];
  images: string[];
  coverImage?: string;
  itinerary?: string;
  itineraryPdf?: string;
  capacity: number;
  price: number;
  startDate: Date;
  endDate: Date;
  participants: Types.ObjectId[];
  participantDetails: ParticipantInfo[];
  status: 'active' | 'cancelled' | 'completed';
  createdAt: Date;
  updatedAt: Date;
}

const participantInfoSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  emergencyContactName: { type: String, required: true },
  emergencyContactPhone: { type: String, required: true },
  medicalConditions: String,
  dietaryRestrictions: String,
  experienceLevel: { type: String, enum: ['beginner', 'intermediate', 'advanced'], required: true },
  specialRequests: String,
  joinedAt: { type: Date, default: Date.now }
});

const tripSchema = new Schema<TripDocument>(
  {
    organizerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, index: true },
    description: { type: String, required: true },
    categories: [{ type: String, index: true }],
    destination: { type: String, required: true, index: true },
    location: {
      type: { type: String, enum: ['Point'] },
      coordinates: { type: [Number], index: '2dsphere' },
    },
    schedule: [{ day: Number, title: String, activities: [String] }],
    images: [{ type: String }],
    coverImage: String,
    itinerary: String,
    itineraryPdf: String,
    capacity: { type: Number, required: true },
    price: { type: Number, required: true },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true, index: true },
    participants: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    participantDetails: [participantInfoSchema],
    status: { type: String, enum: ['active', 'cancelled', 'completed'], default: 'active' },
  },
  { timestamps: true }
);

tripSchema.index({ title: 'text', description: 'text', destination: 'text' });

export const Trip: Model<TripDocument> = mongoose.models.Trip || mongoose.model<TripDocument>('Trip', tripSchema);


