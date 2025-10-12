import mongoose, { Document, Schema } from 'mongoose';

export interface PostDocument extends Document {
  authorId: mongoose.Types.ObjectId;
  type: 'trip_memory' | 'general_post' | 'link_share' | 'experience';
  title: string;
  content: string;
  images?: string[];
  links?: Array<{
    title: string;
    url: string;
    description?: string;
  }>;
  tripData?: {
    tripId?: mongoose.Types.ObjectId;
    destination: string;
    startDate: Date;
    endDate: Date;
    participants?: number;
    highlights?: string[];
    rating?: number;
  };
  tags?: string[];
  likes: mongoose.Types.ObjectId[];
  comments: mongoose.Types.ObjectId[];
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const postSchema = new Schema(
  {
    authorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    type: {
      type: String,
      enum: ['trip_memory', 'general_post', 'link_share', 'experience'],
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      maxlength: 200,
      trim: true
    },
    content: {
      type: String,
      required: true,
      maxlength: 2000,
      trim: true
    },
    images: [{
      type: String,
      validate: {
        validator: function(v: string) {
          return /^https?:\/\/.+\.(jpg|jpeg|png|webp)$/i.test(v);
        },
        message: 'Invalid image URL format'
      }
    }],
    links: [{
      title: {
        type: String,
        required: true,
        maxlength: 100,
        trim: true
      },
      url: {
        type: String,
        required: true,
        validate: {
          validator: function(v: string) {
            try {
              new URL(v);
              return true;
            } catch {
              return false;
            }
          },
          message: 'Invalid URL format'
        }
      },
      description: {
        type: String,
        maxlength: 200,
        trim: true
      }
    }],
    tripData: {
      tripId: {
        type: Schema.Types.ObjectId,
        ref: 'Trip'
      },
      destination: {
        type: String,
        maxlength: 100,
        trim: true
      },
      startDate: Date,
      endDate: Date,
      participants: {
        type: Number,
        min: 1
      },
      highlights: [{
        type: String,
        maxlength: 100,
        trim: true
      }],
      rating: {
        type: Number,
        min: 1,
        max: 5
      }
    },
    tags: [{
      type: String,
      lowercase: true,
      trim: true,
      maxlength: 30
    }],
    likes: [{
      type: Schema.Types.ObjectId,
      ref: 'User'
    }],
    comments: [{
      type: Schema.Types.ObjectId,
      ref: 'Comment'
    }],
    isPublic: {
      type: Boolean,
      default: true,
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Text search index
postSchema.index({ title: 'text', content: 'text', tags: 'text' });

export const Post = (mongoose.models.Post || mongoose.model('Post', postSchema)) as any;
