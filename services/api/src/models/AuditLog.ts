import mongoose, { Schema, Document } from 'mongoose';

export interface AuditLogDocument extends Document {
  userId: mongoose.Types.ObjectId;
  userEmail?: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'VERIFY' | 'PAYMENT' | 'SUSPEND' | 'APPROVE' | 'REJECT';
  resource: 'Trip' | 'User' | 'Payment' | 'Subscription' | 'Ticket' | 'Lead' | 'Review' | 'Booking' | 'Auth';
  resourceId?: mongoose.Types.ObjectId;
  changes?: {
    before?: any;
    after?: any;
  };
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
    reason?: string;
    [key: string]: any;
  };
  timestamp: Date;
  status: 'SUCCESS' | 'FAILURE' | 'PENDING';
  errorMessage?: string;
}

const auditLogSchema = new Schema<AuditLogDocument>(
  {
    userId: { 
      type: Schema.Types.ObjectId, 
      ref: 'User', 
      required: true,
      index: true 
    },
    userEmail: { type: String },
    action: { 
      type: String, 
      enum: ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'VERIFY', 'PAYMENT', 'SUSPEND', 'APPROVE', 'REJECT'],
      required: true,
      index: true
    },
    resource: { 
      type: String, 
      enum: ['Trip', 'User', 'Payment', 'Subscription', 'Ticket', 'Lead', 'Review', 'Booking', 'Auth'],
      required: true,
      index: true
    },
    resourceId: { 
      type: Schema.Types.ObjectId,
      index: true
    },
    changes: {
      before: { type: Schema.Types.Mixed },
      after: { type: Schema.Types.Mixed }
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {}
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['SUCCESS', 'FAILURE', 'PENDING'],
      default: 'SUCCESS',
      index: true
    },
    errorMessage: { type: String }
  },
  { 
    timestamps: true,
    // Automatically create indexes
    autoIndex: true
  }
);

// Compound indexes for common queries
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ resource: 1, action: 1, timestamp: -1 });
auditLogSchema.index({ timestamp: -1 }); // For recent activity queries

// TTL index - automatically delete logs older than 90 days
auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const AuditLog = mongoose.model<AuditLogDocument>('AuditLog', auditLogSchema);
