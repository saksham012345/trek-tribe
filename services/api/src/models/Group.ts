import mongoose, { Document, Schema, Model } from 'mongoose';

export interface GroupDocument extends Document {
  name: string;
  description: string;
  category: 'trekking' | 'camping' | 'wildlife' | 'adventure' | 'photography' | 'cycling' | 'other';
  coverImage?: string;
  creatorId: mongoose.Types.ObjectId;
  admins: mongoose.Types.ObjectId[];
  members: mongoose.Types.ObjectId[];
  memberCount: number;
  isPublic: boolean;
  tags: string[];
  rules?: string;
  location?: string;
  createdAt: Date;
  updatedAt: Date;
}

const groupSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
      index: true
    },
    description: {
      type: String,
      required: true,
      maxlength: 1000,
      trim: true
    },
    category: {
      type: String,
      enum: ['trekking', 'camping', 'wildlife', 'adventure', 'photography', 'cycling', 'other'],
      required: true,
      index: true
    },
    coverImage: {
      type: String,
      validate: {
        validator: function(v: string) {
          return !v || /^https?:\/\/.+\.(jpg|jpeg|png|webp)$/i.test(v);
        },
        message: 'Invalid image URL format'
      }
    },
    creatorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    admins: [{
      type: Schema.Types.ObjectId,
      ref: 'User'
    }],
    members: [{
      type: Schema.Types.ObjectId,
      ref: 'User'
    }],
    memberCount: {
      type: Number,
      default: 0
    },
    isPublic: {
      type: Boolean,
      default: true,
      index: true
    },
    tags: [{
      type: String,
      lowercase: true,
      trim: true,
      maxlength: 30
    }],
    rules: {
      type: String,
      maxlength: 2000
    },
    location: {
      type: String,
      maxlength: 100
    }
  },
  {
    timestamps: true
  }
);

// Text search index
groupSchema.index({ name: 'text', description: 'text', tags: 'text' });

export const Group = (mongoose.models.Group || mongoose.model('Group', groupSchema)) as Model<GroupDocument>;
