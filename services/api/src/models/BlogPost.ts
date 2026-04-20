import mongoose, { Schema, Document, Model } from 'mongoose';

export interface BlogPostDocument extends Document {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage?: string;
  tags: string[];
  status: 'draft' | 'published';
  publishedAt?: Date;
  authorId: mongoose.Types.ObjectId;
  readTimeMinutes: number;
  createdAt: Date;
  updatedAt: Date;
}

const blogPostSchema = new Schema<BlogPostDocument>(
  {
    title: { type: String, required: true, trim: true, maxlength: 180 },
    slug: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
    excerpt: { type: String, required: true, maxlength: 320, trim: true },
    content: { type: String, required: true, trim: true },
    coverImage: { type: String },
    tags: { type: [String], default: [] },
    status: {
      type: String,
      enum: ['draft', 'published'],
      default: 'draft',
      index: true
    },
    publishedAt: { type: Date, index: true },
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    readTimeMinutes: { type: Number, default: 4, min: 1, max: 60 }
  },
  { timestamps: true }
);

blogPostSchema.index({ title: 'text', excerpt: 'text', content: 'text', tags: 'text' });

export const BlogPost = (mongoose.models.BlogPost ||
  mongoose.model<BlogPostDocument>('BlogPost', blogPostSchema)) as Model<BlogPostDocument>;

