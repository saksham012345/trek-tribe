import mongoose, { Schema, Document, Model } from 'mongoose';

export type TrackingStatus = 'not_started' | 'active' | 'completed' | 'emergency' | 'paused';

interface LocationPoint {
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy?: number;
  timestamp: Date;
}

interface TripParticipantTracking {
  userId: string;
  userName: string;
  status: 'joined' | 'started' | 'active' | 'completed' | 'emergency';
  lastLocation?: LocationPoint;
  startLocation?: LocationPoint;
  endLocation?: LocationPoint;
  locationHistory?: LocationPoint[];
  lastCheckIn?: Date;
  emergencyContactsNotified?: boolean;
}

export interface TripTrackingDocument extends Document {
  tripId: string;
  organizerId: string;
  status: TrackingStatus;
  startedAt?: Date;
  completedAt?: Date;
  participants: TripParticipantTracking[];
  emergencyAlerts: {
    userId: string;
    type: 'no_movement' | 'sos' | 'off_route' | 'overdue';
    timestamp: Date;
    location?: LocationPoint;
    resolved: boolean;
    resolvedAt?: Date;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const tripTrackingSchema = new Schema(
  {
    tripId: { type: Schema.Types.ObjectId, ref: 'Trip', required: true, unique: true, index: true },
    organizerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: { 
      type: String, 
      enum: ['not_started', 'active', 'completed', 'emergency', 'paused'],
      default: 'not_started',
      index: true 
    },
    startedAt: { type: Date },
    completedAt: { type: Date },
    participants: [{
      userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
      userName: { type: String, required: true },
      status: { 
        type: String, 
        enum: ['joined', 'started', 'active', 'completed', 'emergency'],
        default: 'joined'
      },
      lastLocation: {
        latitude: { type: Number },
        longitude: { type: Number },
        altitude: { type: Number },
        accuracy: { type: Number },
        timestamp: { type: Date }
      },
      startLocation: {
        latitude: { type: Number },
        longitude: { type: Number },
        altitude: { type: Number },
        accuracy: { type: Number },
        timestamp: { type: Date }
      },
      endLocation: {
        latitude: { type: Number },
        longitude: { type: Number },
        altitude: { type: Number },
        accuracy: { type: Number },
        timestamp: { type: Date }
      },
      locationHistory: [{
        latitude: { type: Number, required: true },
        longitude: { type: Number, required: true },
        altitude: { type: Number },
        accuracy: { type: Number },
        timestamp: { type: Date, default: Date.now }
      }],
      lastCheckIn: { type: Date },
      emergencyContactsNotified: { type: Boolean, default: false }
    }],
    emergencyAlerts: [{
      userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
      type: { 
        type: String, 
        enum: ['no_movement', 'sos', 'off_route', 'overdue'],
        required: true 
      },
      timestamp: { type: Date, default: Date.now },
      location: {
        latitude: { type: Number },
        longitude: { type: Number },
        altitude: { type: Number },
        accuracy: { type: Number },
        timestamp: { type: Date }
      },
      resolved: { type: Boolean, default: false },
      resolvedAt: { type: Date }
    }]
  },
  { timestamps: true }
);

// Create indexes for efficient querying
tripTrackingSchema.index({ tripId: 1, status: 1 });
tripTrackingSchema.index({ organizerId: 1, status: 1 });
tripTrackingSchema.index({ 'participants.userId': 1 });
tripTrackingSchema.index({ 'emergencyAlerts.resolved': 1, 'emergencyAlerts.timestamp': -1 });

export const TripTracking = (mongoose.models.TripTracking || mongoose.model('TripTracking', tripTrackingSchema)) as any as Model<TripTrackingDocument>;