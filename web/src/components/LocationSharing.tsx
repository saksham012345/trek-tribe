import React, { useState, useEffect } from 'react';
import api from '../config/api';

interface LocationSharingProps {
  tripId: string;
  tripTitle: string;
  isActive: boolean;
  userRole: 'participant' | 'organizer';
  onLocationUpdate?: (location: any) => void;
}

interface LocationData {
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy?: number;
  timestamp: Date;
}

const LocationSharing: React.FC<LocationSharingProps> = ({ 
  tripId, 
  tripTitle, 
  isActive, 
  userRole,
  onLocationUpdate 
}) => {
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [locationError, setLocationError] = useState<string>('');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [watchId, setWatchId] = useState<number | null>(null);

  useEffect(() => {
    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [watchId]);

  const getCurrentLocation = (): Promise<LocationData> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by this browser'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const locationData: LocationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            altitude: position.coords.altitude || undefined,
            accuracy: position.coords.accuracy,
            timestamp: new Date()
          };
          resolve(locationData);
        },
        (error) => {
          let errorMessage = 'Unknown location error';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Location access denied by user';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Location information unavailable';
              break;
            case error.TIMEOUT:
              errorMessage = 'Location request timed out';
              break;
          }
          reject(new Error(errorMessage));
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000 // 1 minute
        }
      );
    });
  };

  const shareLocation = async () => {
    try {
      setLocationError('');
      const location = await getCurrentLocation();
      
      await api.post(`/tracking/trips/${tripId}/location`, {
        latitude: location.latitude,
        longitude: location.longitude,
        altitude: location.altitude,
        accuracy: location.accuracy
      });

      setCurrentLocation(location);
      setLastUpdate(new Date());
      onLocationUpdate && onLocationUpdate(location);
      
    } catch (error: any) {
      setLocationError(error.message);
      console.error('Error sharing location:', error);
    }
  };

  const startContinuousSharing = async () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by this browser');
      return;
    }

    setIsSharing(true);
    setLocationError('');

    // Share current location immediately
    try {
      await shareLocation();
    } catch (error: any) {
      setLocationError(error.message);
    }

    // Start watching position
    const id = navigator.geolocation.watchPosition(
      async (position) => {
        try {
          const locationData: LocationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            altitude: position.coords.altitude || undefined,
            accuracy: position.coords.accuracy,
            timestamp: new Date()
          };

          await api.post(`/tracking/trips/${tripId}/location`, {
            latitude: locationData.latitude,
            longitude: locationData.longitude,
            altitude: locationData.altitude,
            accuracy: locationData.accuracy
          });

          setCurrentLocation(locationData);
          setLastUpdate(new Date());
          onLocationUpdate && onLocationUpdate(locationData);
          
        } catch (error: any) {
          console.error('Error updating location:', error);
          setLocationError('Failed to update location');
        }
      },
      (error) => {
        let errorMessage = 'Location tracking error';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location access denied';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location unavailable';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timeout';
            break;
        }
        setLocationError(errorMessage);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 30000 // 30 seconds
      }
    );

    setWatchId(id);
  };

  const stopSharing = () => {
    setIsSharing(false);
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }
  };

  const markTripComplete = async () => {
    try {
      const location = await getCurrentLocation();
      
      await api.post(`/tracking/trips/${tripId}/complete`, {
        latitude: location.latitude,
        longitude: location.longitude,
        altitude: location.altitude,
        accuracy: location.accuracy
      });

      alert('Trip marked as completed successfully!');
      stopSharing();
      
    } catch (error: any) {
      console.error('Error completing trip:', error);
      alert('Failed to mark trip as complete. You can try again later.');
    }
  };

  const sendSOS = async () => {
    if (!window.confirm('Send emergency SOS alert? This will notify your emergency contacts and the trip organizer.')) {
      return;
    }

    try {
      const location = await getCurrentLocation();
      
      await api.post(`/tracking/trips/${tripId}/sos`, {
        latitude: location.latitude,
        longitude: location.longitude,
        altitude: location.altitude,
        accuracy: location.accuracy
      });

      alert('Emergency SOS sent! Your emergency contacts have been notified.');
      
    } catch (error: any) {
      console.error('Error sending SOS:', error);
      alert('Failed to send SOS alert. Please try calling emergency services directly.');
    }
  };

  if (!isActive) {
    return (
      <div className="bg-gray-100 rounded-lg p-4 text-center">
        <div className="text-gray-500 mb-2">📍</div>
        <p className="text-sm text-gray-600">Location sharing will be available when the trip starts</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          📍 Location Sharing
        </h3>
        <div className="flex items-center gap-2">
          {isSharing && (
            <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
              ACTIVE
            </span>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {locationError && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            <p className="text-sm">{locationError}</p>
          </div>
        )}

        {currentLocation && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">Current Location</h4>
            <div className="text-sm text-blue-800 space-y-1">
              <div>📍 {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}</div>
              {currentLocation.accuracy && (
                <div>🎯 Accuracy: ±{Math.round(currentLocation.accuracy)}m</div>
              )}
              {lastUpdate && (
                <div>🕐 Last updated: {lastUpdate.toLocaleTimeString()}</div>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            onClick={shareLocation}
            disabled={isSharing}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            📍 Share Current Location
          </button>

          {!isSharing ? (
            <button
              onClick={startContinuousSharing}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              🔄 Start Auto-Sharing
            </button>
          ) : (
            <button
              onClick={stopSharing}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              ⏹️ Stop Sharing
            </button>
          )}

          <button
            onClick={markTripComplete}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            ✅ Complete Trip
          </button>

          <button
            onClick={sendSOS}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            🚨 Emergency SOS
          </button>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h4 className="font-medium text-yellow-800 mb-2">📱 Safety Features</h4>
          <ul className="text-sm text-yellow-700 space-y-1">
            <li>• Your location is shared with emergency contacts</li>
            <li>• Auto-sharing updates every 30 seconds when active</li>
            <li>• Emergency SOS alerts all contacts immediately</li>
            <li>• Location data is encrypted and secure</li>
          </ul>
        </div>

        {userRole === 'participant' && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium text-gray-800 mb-2">💡 Tips</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Keep your phone charged for continuous tracking</li>
              <li>• Use auto-sharing for long hikes or remote areas</li>
              <li>• Send regular location updates to stay connected</li>
              <li>• Don't hesitate to use SOS if you feel unsafe</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default LocationSharing;