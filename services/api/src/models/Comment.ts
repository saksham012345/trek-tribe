import mongoose, { Document, Schema } from 'mongoose';

export interface CommentDocument extends Document {
  postId: mongoose.Types.ObjectId;
  authorId: mongoose.Types.ObjectId;
  content: string;
  parentCommentId?: mongoose.Types.ObjectId;
  likes: mongoose.Types.ObjectId[];
  isEdited: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const commentSchema = new Schema(
  {
    postId: {
      type: Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
      index: true
    },
    authorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    content: {
      type: String,
      required: true,
      maxlength: 500,
      trim: true
    },
    parentCommentId: {
      type: Schema.Types.ObjectId,
      ref: 'Comment'
    },
    likes: [{
      type: Schema.Types.ObjectId,
      ref: 'User'
    }],
    isEdited: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

export const Comment = (mongoose.models.Comment || mongoose.model('Comment', commentSchema)) as any;
