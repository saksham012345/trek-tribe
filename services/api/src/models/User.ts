import mongoose, { Schema, Document, Model } from 'mongoose';

export type UserRole = 'traveler' | 'organizer' | 'admin';

export interface UserDocument extends Document {
  email: string;
  passwordHash: string;
  name: string;
  role: UserRole;
  preferences?: {
    categories?: string[];
    budgetRange?: [number, number];
    locations?: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserDocument>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, index: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true },
    role: { type: String, enum: ['traveler', 'organizer', 'admin'], default: 'traveler', index: true },
    preferences: {
      categories: [{ type: String }],
      budgetRange: { type: [Number], validate: (v: number[]) => !v || v.length === 0 || v.length === 2 },
      locations: [{ type: String }],
    },
  },
  { timestamps: true }
);

userSchema.index({ name: 'text', email: 'text' });

export const User: Model<UserDocument> = mongoose.models.User || mongoose.model<UserDocument>('User', userSchema);


