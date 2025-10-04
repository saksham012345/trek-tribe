import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../config/api';
import LocationSharing from '../components/LocationSharing';
import { User } from '../types';

interface Trip {
  _id: string;
  title: string;
  description: string;
  destination: string;
  startDate: string;
  endDate: string;
  organizerId: string;
  participants: string[];
}

interface LocationPoint {
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy?: number;
  timestamp: string;
}

interface ParticipantTracking {
  userId: string;
  userName: string;
  status: 'joined' | 'started' | 'active' | 'completed' | 'emergency';
  lastLocation?: LocationPoint;
  startLocation?: LocationPoint;
  endLocation?: LocationPoint;
  lastCheckIn?: string;
  emergencyContactsNotified?: boolean;
}

interface TripTracking {
  _id: string;
  tripId: string;
  organizerId: string;
  status: 'not_started' | 'active' | 'completed' | 'emergency' | 'paused';
  startedAt?: string;
  completedAt?: string;
  participants: ParticipantTracking[];
  emergencyAlerts: any[];
}

interface TripTrackingProps {
  user: User;
}

const TripTrackingPage: React.FC<TripTrackingProps> = ({ user }) => {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [tracking, setTracking] = useState<TripTracking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!tripId) {
      navigate('/trips');
      return;
    }

    fetchTripAndTracking();
  }, [tripId]);

  const fetchTripAndTracking = async () => {
    try {
      setLoading(true);
      setError('');

      // Fetch trip details
      const tripResponse = await api.get(`/trips/${tripId}`);
      setTrip(tripResponse.data);

      // Fetch tracking data
      try {
        const trackingResponse = await api.get(`/tracking/trips/${tripId}`);
        setTracking(trackingResponse.data.tracking);
      } catch (trackingError: any) {
        if (trackingError.response?.status === 404) {
          // Tracking not initialized yet
          setTracking(null);
        } else {
          throw trackingError;
        }
      }

    } catch (error: any) {
      console.error('Error fetching trip data:', error);
      setError(error.response?.data?.error || 'Failed to load trip data');
    } finally {
      setLoading(false);
    }
  };

  const initializeTracking = async () => {
    if (!tripId || user.role !== 'organizer') return;

    try {
      const response = await api.post(`/tracking/trips/${tripId}/initialize`);
      setTracking(response.data.tracking);
    } catch (error: any) {
      console.error('Error initializing tracking:', error);
      alert('Failed to initialize trip tracking');
    }
  };

  const startTrip = async () => {
    if (!tripId || user.role !== 'organizer') return;

    try {
      const response = await api.post(`/tracking/trips/${tripId}/start`);
      setTracking(response.data.tracking);
    } catch (error: any) {
      console.error('Error starting trip:', error);
      alert('Failed to start trip');
    }
  };

  const getUserRole = (): 'participant' | 'organizer' => {
    if (!trip) return 'participant';
    return trip.organizerId === user.id ? 'organizer' : 'participant';
  };

  const getCurrentParticipant = (): ParticipantTracking | null => {
    if (!tracking) return null;
    return tracking.participants.find(p => p.userId === user.id) || null;
  };

  const formatLastSeen = (timestamp?: string) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hours ago`;
    return date.toLocaleDateString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      case 'emergency': return 'bg-red-100 text-red-800';
      case 'started': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-lg shadow-md p-8">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-gray-200 rounded w-1/3"></div>
              <div className="h-4 bg-gray-200 rounded w-2/3"></div>
              <div className="h-64 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <div className="text-6xl mb-4">❌</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {error || 'Trip Not Found'}
            </h1>
            <p className="text-gray-600 mb-6">
              The trip you're looking for doesn't exist or you don't have access to it.
            </p>
            <button
              onClick={() => navigate('/trips')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium"
            >
              Back to Trips
            </button>
          </div>
        </div>
      </div>
    );
  }

  const userRole = getUserRole();
  const currentParticipant = getCurrentParticipant();
  const isTrackingActive = tracking?.status === 'active';

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Trip Header */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{trip.title}</h1>
              <p className="text-lg text-gray-600 mb-4">{trip.description}</p>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <div className="flex items-center gap-1">
                  <span>📍</span>
                  <span>{trip.destination}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span>📅</span>
                  <span>
                    {new Date(trip.startDate).toLocaleDateString()} - {new Date(trip.endDate).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {tracking && (
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(tracking.status)}`}>
                  {tracking.status.toUpperCase()}
                </span>
              )}
              <span className="text-sm text-gray-500">
                {userRole === 'organizer' ? '👨‍💼 Organizer' : '🧳 Participant'}
              </span>
            </div>
          </div>

          {/* Organizer Controls */}
          {userRole === 'organizer' && (
            <div className="border-t pt-4">
              <h3 className="font-medium text-gray-900 mb-3">Trip Controls</h3>
              <div className="flex gap-3">
                {!tracking && (
                  <button
                    onClick={initializeTracking}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
                  >
                    🚀 Initialize Tracking
                  </button>
                )}
                {tracking && tracking.status === 'not_started' && (
                  <button
                    onClick={startTrip}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
                  >
                    ▶️ Start Trip
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Location Sharing */}
          <LocationSharing
            tripId={tripId!}
            tripTitle={trip.title}
            isActive={isTrackingActive}
            userRole={userRole}
            onLocationUpdate={() => {
              // Refresh tracking data after location update
              fetchTripAndTracking();
            }}
          />

          {/* Participants Status */}
          {tracking && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                👥 Participants ({tracking.participants.length})
              </h3>
              <div className="space-y-3">
                {tracking.participants.map((participant) => (
                  <div
                    key={participant.userId}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-medium">
                        {participant.userName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">
                          {participant.userName}
                          {participant.userId === user.id && (
                            <span className="ml-2 text-xs text-blue-600">(You)</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">
                          Last seen: {formatLastSeen(participant.lastCheckIn)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(participant.status)}`}>
                        {participant.status}
                      </span>
                      {participant.lastLocation && (
                        <div className="text-xs text-green-600" title="Location available">
                          📍
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Emergency Alerts */}
        {tracking && tracking.emergencyAlerts.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-red-900 mb-4 flex items-center gap-2">
              🚨 Emergency Alerts
            </h3>
            <div className="space-y-3">
              {tracking.emergencyAlerts.map((alert, index) => (
                <div key={index} className="bg-red-100 rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium text-red-900">
                        {alert.type.replace('_', ' ').toUpperCase()} Alert
                      </div>
                      <div className="text-sm text-red-700 mt-1">
                        {new Date(alert.timestamp).toLocaleString()}
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      alert.resolved ? 'bg-green-100 text-green-800' : 'bg-red-200 text-red-800'
                    }`}>
                      {alert.resolved ? 'Resolved' : 'Active'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No Tracking Message */}
        {!tracking && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
            <div className="text-4xl mb-4">🗺️</div>
            <h3 className="text-lg font-semibold text-yellow-900 mb-2">
              Trip Tracking Not Started
            </h3>
            <p className="text-yellow-700">
              {userRole === 'organizer' 
                ? 'Initialize trip tracking to enable location sharing and safety features.'
                : 'The organizer hasn\'t started trip tracking yet. Check back later!'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TripTrackingPage;