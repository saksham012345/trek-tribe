import mongoose, { Schema, Document } from 'mongoose';

export type LeadEventType =
  | 'trip_viewed'
  | 'chat_message'
  | 'inquiry_submitted'
  | 'email_opened'
  | 'booking_started'
  | 'booking_abandoned';

export interface ILeadActivity extends Document {
  leadId: mongoose.Types.ObjectId;
  eventType: LeadEventType;
  metadata: Record<string, any>;
  timestamp: Date;
}

const LeadActivitySchema = new Schema<ILeadActivity>(
  {
    leadId: { type: Schema.Types.ObjectId, ref: 'Lead', required: true },
    eventType: {
      type: String,
      enum: ['trip_viewed', 'chat_message', 'inquiry_submitted', 'email_opened', 'booking_started', 'booking_abandoned'],
      required: true,
    },
    metadata: { type: Schema.Types.Mixed, default: {} },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

LeadActivitySchema.index({ leadId: 1, timestamp: -1 });
LeadActivitySchema.index({ eventType: 1 });

export const LeadActivity = mongoose.model<ILeadActivity>('LeadActivity', LeadActivitySchema);
