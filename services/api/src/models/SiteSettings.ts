import mongoose, { Schema, Document, Model } from 'mongoose';

export type PaymentProvider = 'razorpay' | 'manual' | 'stripe';
export type SmsProvider = 'twilio' | 'disabled';
export type EmailProvider = 'sendgrid' | 'disabled';

export interface SiteSettingsDocument extends Document {
  key: 'global';
  home: {
    heroImages: string[];
    overlayStyle: 'light' | 'dark';
    fontFamily: string;
    discoverColumnsDesktop: number;
    discoverColumnsMobile: number;
  };
  contact: {
    supportEmail: string;
    otpFromEmail: string;
    bookingFromEmail: string;
  };
  notifications: {
    emailEnabled: boolean;
    smsEnabled: boolean;
    sendFollowerTripAlerts: boolean;
    tripReminderHours: number;
  };
  integrations: {
    paymentProvider: PaymentProvider;
    emailProvider: EmailProvider;
    smsProvider: SmsProvider;
    twilioFromNumber?: string;
  };
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const siteSettingsSchema = new Schema<SiteSettingsDocument>(
  {
    key: {
      type: String,
      enum: ['global'],
      default: 'global',
      unique: true,
      required: true
    },
    home: {
      heroImages: {
        type: [String],
        default: []
      },
      overlayStyle: {
        type: String,
        enum: ['light', 'dark'],
        default: 'light'
      },
      fontFamily: {
        type: String,
        default: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
      },
      discoverColumnsDesktop: {
        type: Number,
        default: 3,
        min: 1,
        max: 6
      },
      discoverColumnsMobile: {
        type: Number,
        default: 2,
        min: 1,
        max: 4
      }
    },
    contact: {
      supportEmail: {
        type: String,
        default: 'support@trektribe.com'
      },
      otpFromEmail: {
        type: String,
        default: 'support@trektribe.com'
      },
      bookingFromEmail: {
        type: String,
        default: 'support@trektribe.com'
      }
    },
    notifications: {
      emailEnabled: { type: Boolean, default: true },
      smsEnabled: { type: Boolean, default: false },
      sendFollowerTripAlerts: { type: Boolean, default: true },
      tripReminderHours: { type: Number, default: 24, min: 1, max: 72 }
    },
    integrations: {
      paymentProvider: {
        type: String,
        enum: ['razorpay', 'manual', 'stripe'],
        default: 'razorpay'
      },
      emailProvider: {
        type: String,
        enum: ['sendgrid', 'disabled'],
        default: 'sendgrid'
      },
      smsProvider: {
        type: String,
        enum: ['twilio', 'disabled'],
        default: 'disabled'
      },
      twilioFromNumber: { type: String }
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  { timestamps: true }
);

export const SiteSettings = (mongoose.models.SiteSettings ||
  mongoose.model<SiteSettingsDocument>('SiteSettings', siteSettingsSchema)) as Model<SiteSettingsDocument>;

