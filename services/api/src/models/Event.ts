import mongoose, { Document, Schema, Model } from 'mongoose';

export interface EventDocument extends Document {
  title: string;
  description: string;
  eventType: 'trip' | 'meetup' | 'workshop' | 'webinar' | 'other';
  startDate: Date;
  endDate: Date;
  location?: string;
  isVirtual: boolean;
  virtualLink?: string;
  organizerId: mongoose.Types.ObjectId;
  groupId?: mongoose.Types.ObjectId;
  coverImage?: string;
  capacity?: number;
  attendees: mongoose.Types.ObjectId[];
  attendeeCount: number;
  invitees: mongoose.Types.ObjectId[];
  status: 'upcoming' | 'ongoing' | 'completed' | 'cancelled';
  tags: string[];
  price?: number;
  isPaid: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const eventSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
      index: true
    },
    description: {
      type: String,
      required: true,
      maxlength: 2000,
      trim: true
    },
    eventType: {
      type: String,
      enum: ['trip', 'meetup', 'workshop', 'webinar', 'other'],
      required: true,
      index: true
    },
    startDate: {
      type: Date,
      required: true,
      index: true
    },
    endDate: {
      type: Date,
      required: true
    },
    location: {
      type: String,
      maxlength: 200
    },
    isVirtual: {
      type: Boolean,
      default: false
    },
    virtualLink: {
      type: String,
      validate: {
        validator: function(v: string) {
          return !v || /^https?:\/\/.+/.test(v);
        },
        message: 'Invalid URL format'
      }
    },
    organizerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    groupId: {
      type: Schema.Types.ObjectId,
      ref: 'Group',
      index: true
    },
    coverImage: {
      type: String
    },
    capacity: {
      type: Number,
      min: 1
    },
    attendees: [{
      type: Schema.Types.ObjectId,
      ref: 'User'
    }],
    attendeeCount: {
      type: Number,
      default: 0
    },
    invitees: [{
      type: Schema.Types.ObjectId,
      ref: 'User'
    }],
    status: {
      type: String,
      enum: ['upcoming', 'ongoing', 'completed', 'cancelled'],
      default: 'upcoming',
      index: true
    },
    tags: [{
      type: String,
      lowercase: true,
      trim: true
    }],
    price: {
      type: Number,
      min: 0
    },
    isPaid: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

// Text search index
eventSchema.index({ title: 'text', description: 'text', tags: 'text' });

export const Event = (mongoose.models.Event || mongoose.model('Event', eventSchema)) as Model<EventDocument>;
