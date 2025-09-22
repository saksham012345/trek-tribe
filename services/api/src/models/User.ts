import mongoose, { Schema, Document, Model } from 'mongoose';

export type UserRole = 'traveler' | 'organizer' | 'admin';

interface UserPreferences {
  categories?: string[];
  budgetRange?: [number, number];
  locations?: string[];
}

export interface UserDocument extends Document {
  email: string;
  passwordHash: string;
  name: string;
  role: UserRole;
  preferences?: UserPreferences;
  createdAt: Date;
  updatedAt: Date;
}

// Define schema without explicit generic type to avoid union complexity
const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, index: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true },
    role: { 
      type: String, 
      enum: ['traveler', 'organizer', 'admin'], 
      default: 'traveler', 
      index: true 
    },
    preferences: {
      type: {
        categories: [{ type: String }],
        budgetRange: { 
          type: [Number], 
          validate: {
            validator: function(v: number[]) {
              return !v || v.length === 0 || v.length === 2;
            },
            message: 'Budget range must have exactly 2 numbers or be empty'
          }
        },
        locations: [{ type: String }]
      },
      required: false
    }
  },
  { timestamps: true }
);

userSchema.index({ name: 'text', email: 'text' });

// Export with proper typing to avoid complex union types
export const User = (mongoose.models.User || mongoose.model('User', userSchema)) as any as Model<UserDocument>;


