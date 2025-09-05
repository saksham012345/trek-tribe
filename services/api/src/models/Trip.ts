import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface TripDocument extends Document {
  organizerId: Types.ObjectId;
  title: string;
  description: string;
  categories: string[];
  destination: string;
  location?: { type: 'Point'; coordinates: [number, number] };
  schedule: { day: number; title: string; activities: string[] }[];
  images: string[];
  capacity: number;
  price: number;
  startDate: Date;
  endDate: Date;
  participants: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

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
    capacity: { type: Number, required: true },
    price: { type: Number, required: true },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true, index: true },
    participants: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

tripSchema.index({ title: 'text', description: 'text', destination: 'text' });

export const Trip: Model<TripDocument> = mongoose.models.Trip || mongoose.model<TripDocument>('Trip', tripSchema);


