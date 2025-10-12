import mongoose, { Document, Schema } from 'mongoose';

export interface FollowDocument extends Document {
  followerId: mongoose.Types.ObjectId;
  followingId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const followSchema = new Schema(
  {
    followerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    followingId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Ensure a user can only follow another user once
followSchema.index({ followerId: 1, followingId: 1 }, { unique: true });

export const Follow = (mongoose.models.Follow || mongoose.model('Follow', followSchema)) as any;
