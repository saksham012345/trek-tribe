import mongoose, { Schema, Document } from 'mongoose';

export type RetryJobStatus = 'pending' | 'in_progress' | 'failed' | 'completed' | 'cancelled';

export interface IRetryJob extends Document {
  jobType: string;
  referenceId: string;
  payload: any;
  retryCount: number;
  maxRetries?: number;
  lastAttempt?: Date;
  nextRetryAt?: Date;
  status: RetryJobStatus;
  lastError?: string;
  lastResult?: string;
  createdAt: Date;
  updatedAt: Date;
}

const RetryJobSchema: Schema = new Schema(
  {
    jobType: { type: String, required: true },
    referenceId: { type: String, required: true, index: true },
    payload: { type: Schema.Types.Mixed },
    retryCount: { type: Number, default: 0 },
    maxRetries: { type: Number, default: 5 },
    lastAttempt: { type: Date },
    nextRetryAt: { type: Date, default: Date.now, index: true },
    status: { type: String, enum: ['pending', 'in_progress', 'failed', 'completed', 'cancelled'], default: 'pending' },
    lastError: { type: String },
    lastResult: { type: String }
  },
  { timestamps: true }
);

RetryJobSchema.index({ nextRetryAt: 1, status: 1 });

export default mongoose.model<IRetryJob>('RetryJob', RetryJobSchema);
