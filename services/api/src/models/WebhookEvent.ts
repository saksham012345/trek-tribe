import mongoose, { Schema, Document } from 'mongoose';

export interface IWebhookEvent extends Document {
  eventId: string;
  source: string;
  processedAt?: Date;
  rawPayload?: any;
}

const WebhookEventSchema: Schema = new Schema(
  {
    eventId: { type: String, required: true, unique: true },
    source: { type: String, required: true },
    processedAt: { type: Date },
    rawPayload: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

// `eventId` is declared `unique: true` on the field; do not add a duplicate
// single-field index here to avoid duplicate index warnings.

export default mongoose.model<IWebhookEvent>('WebhookEvent', WebhookEventSchema);
