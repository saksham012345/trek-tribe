import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import api from '../config/api';
import { User } from '../types';

interface TripSummary {
  _id: string;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  participants: string[];
  capacity: number;
  price: number;
  status: 'active' | 'cancelled' | 'completed';
  pendingVerifications: number;
}

interface BookingVerification {
  _id: string;
  tripId: string;
  tripTitle: string;
  travelerName: string;
  travelerEmail: string;
  numberOfGuests: number;
  totalAmount: number;
  paymentScreenshot?: {
    url: string;
    filename: string;
    uploadedAt: string;
  };
  bookingStatus: 'pending' | 'confirmed' | 'cancelled';
  paymentVerificationStatus: 'pending' | 'verified' | 'rejected';
  createdAt: string;
  participants: Array<{
    name: string;
    phone: string;
    age?: number;
  }>;
}

interface OrganizerDashboardProps {
  user: User;
}

const OrganizerDashboard: React.FC<OrganizerDashboardProps> = ({ user }) => {
  const [trips, setTrips] = useState<TripSummary[]>([]);
  const [pendingBookings, setPendingBookings] = useState<BookingVerification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [verificationLoading, setVerificationLoading] = useState<string | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [notifications, setNotifications] = useState<Array<{ id: string; message: string; type: 'success' | 'info' | 'error'; timestamp: Date }>>([]);

  useEffect(() => {
    fetchDashboardData();
    initializeSocket();
    
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, []);

  const initializeSocket = () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const newSocket = io(process.env.REACT_APP_API_URL || 'http://localhost:4000', {
      auth: { token },
      path: '/socket.io/'
    });

    newSocket.on('connect', () => {
      console.log('🔌 Connected to real-time updates');
    });

    newSocket.on('booking_update', (data) => {
      console.log('📬 Booking update received:', data);
      addNotification(data.message, 'info');
      fetchDashboardData(); // Refresh data
    });

    newSocket.on('organizer_notification', (data) => {
      console.log('🔔 Organizer notification:', data);
      addNotification(data.message, 'success');
      
      if (data.type === 'joined' || data.type === 'payment_verified') {
        fetchDashboardData();
      }
    });

    newSocket.on('error', (error) => {
      console.error('Socket error:', error);
    });

    setSocket(newSocket);
  };

  const fetchDashboardData = async () => {
    try {
      const [tripsResponse, bookingsResponse] = await Promise.all([
        api.get('/organizer/trips'),
        api.get('/organizer/pending-verifications')
      ]);
      
      setTrips((tripsResponse.data as any).trips || []);
      setPendingBookings((bookingsResponse.data as any).bookings || []);
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to load dashboard data');
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const addNotification = (message: string, type: 'success' | 'info' | 'error') => {
    const notification = {
      id: Date.now().toString(),
      message,
      type,
      timestamp: new Date()
    };
    
    setNotifications(prev => [notification, ...prev.slice(0, 4)]); // Keep only 5 most recent
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== notification.id));
    }, 5000);
  };

  const handleVerifyPayment = async (bookingId: string, action: 'verify' | 'reject') => {
    setVerificationLoading(bookingId);
    try {
      await api.post(`/organizer/verify-payment/${bookingId}`, { 
        action,
        notes: action === 'reject' ? 'Payment verification failed' : 'Payment verified successfully'
      });
      
      addNotification(
        `Payment ${action === 'verify' ? 'verified' : 'rejected'} successfully!`, 
        action === 'verify' ? 'success' : 'info'
      );
      
      // Refresh data
      fetchDashboardData();
    } catch (error: any) {
      setError(error.response?.data?.error || `Failed to ${action} payment`);
      addNotification(`Error: ${error.response?.data?.error || 'Action failed'}`, 'error');
    } finally {
      setVerificationLoading(null);
    }
  };

  const openPaymentScreenshot = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-forest-50 to-nature-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-nature-600 mx-auto mb-4"></div>
          <p className="text-forest-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-forest-50 to-nature-50 p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-forest-800 to-nature-600 bg-clip-text text-transparent mb-2">
            🏔️ Organizer Dashboard
          </h1>
          <p className="text-forest-600">
            Welcome back, <span className="font-semibold">{user.name}</span>! Manage your trips and verify payments.
          </p>
        </div>
      </div>

      {/* Real-time Notifications */}
      {notifications.length > 0 && (
        <div className="max-w-7xl mx-auto mb-6">
          <div className="space-y-2">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-4 rounded-xl shadow-lg border-l-4 ${
                  notification.type === 'success' 
                    ? 'bg-green-50 border-green-500 text-green-800'
                    : notification.type === 'error'
                    ? 'bg-red-50 border-red-500 text-red-800'
                    : 'bg-blue-50 border-blue-500 text-blue-800'
                } animate-slide-down`}
              >
                <div className="flex justify-between items-start">
                  <p className="text-sm font-medium">{notification.message}</p>
                  <span className="text-xs opacity-70">
                    {notification.timestamp.toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="max-w-7xl mx-auto mb-6">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl">
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto grid lg:grid-cols-3 gap-8">
        {/* Trip Overview */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-2xl font-bold text-forest-800 mb-6 flex items-center gap-2">
              🎯 Your Trips Overview
            </h2>
            
            {trips.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🏕️</div>
                <h3 className="text-xl font-semibold text-forest-700 mb-2">No trips yet</h3>
                <p className="text-forest-600">Create your first amazing adventure!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {trips.map((trip) => (
                  <div key={trip._id} className="bg-gradient-to-r from-forest-50 to-nature-50 rounded-xl p-4 border border-forest-200">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="text-lg font-semibold text-forest-800">{trip.title}</h3>
                        <p className="text-forest-600">📍 {trip.destination}</p>
                      </div>
                      <div className="text-right">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          trip.status === 'active' ? 'bg-green-100 text-green-800' :
                          trip.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {trip.status.charAt(0).toUpperCase() + trip.status.slice(1)}
                        </span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-forest-600">📅 Dates:</span>
                        <p className="font-medium text-forest-800">
                          {new Date(trip.startDate).toLocaleDateString()} - {new Date(trip.endDate).toLocaleDateString()}
                        </p>
                      </div>
                      <div>
                        <span className="text-forest-600">👥 Participants:</span>
                        <p className="font-medium text-forest-800">
                          {trip.participants.length} / {trip.capacity}
                        </p>
                      </div>
                      <div>
                        <span className="text-forest-600">💰 Price:</span>
                        <p className="font-bold text-nature-600 text-lg">
                          ₹{trip.price.toLocaleString()}
                        </p>
                      </div>
                    </div>
                    
                    {trip.pendingVerifications > 0 && (
                      <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                        <p className="text-sm text-amber-700 font-medium">
                          ⚠️ {trip.pendingVerifications} payment(s) pending verification
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Payment Verification Panel */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-2xl font-bold text-forest-800 mb-6 flex items-center gap-2">
              💳 Payment Verification
            </h2>
            
            {pendingBookings.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-3">✅</div>
                <h3 className="text-lg font-semibold text-forest-700 mb-1">All caught up!</h3>
                <p className="text-sm text-forest-600">No payments pending verification.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingBookings.map((booking) => (
                  <div key={booking._id} className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-semibold text-forest-800">{booking.travelerName}</h3>
                        <p className="text-sm text-forest-600">{booking.tripTitle}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-nature-600">
                          ₹{booking.totalAmount.toLocaleString()}
                        </p>
                        <p className="text-xs text-forest-500">
                          {booking.numberOfGuests} traveler{booking.numberOfGuests > 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="text-sm">
                        <p className="text-forest-600 mb-1">Travelers:</p>
                        <div className="space-y-1">
                          {booking.participants.map((participant, index) => (
                            <div key={index} className="flex justify-between bg-white rounded-lg p-2">
                              <span className="font-medium">{participant.name}</span>
                              <span className="text-forest-600">{participant.phone}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      {booking.paymentScreenshot && (
                        <div>
                          <p className="text-sm text-forest-600 mb-2">Payment Screenshot:</p>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openPaymentScreenshot(booking.paymentScreenshot!.url)}
                              className="text-blue-600 hover:text-blue-800 text-sm underline"
                            >
                              📄 View Screenshot
                            </button>
                            <span className="text-xs text-forest-500">
                              Uploaded: {new Date(booking.paymentScreenshot.uploadedAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      )}
                      
                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={() => handleVerifyPayment(booking._id, 'verify')}
                          disabled={verificationLoading === booking._id}
                          className="flex-1 px-3 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {verificationLoading === booking._id ? '⏳' : '✅'} Verify
                        </button>
                        <button
                          onClick={() => handleVerifyPayment(booking._id, 'reject')}
                          disabled={verificationLoading === booking._id}
                          className="flex-1 px-3 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {verificationLoading === booking._id ? '⏳' : '❌'} Reject
                        </button>
                      </div>
                    </div>
                    
                    <div className="mt-3 pt-2 border-t border-blue-200 text-xs text-forest-500">
                      Booking created: {new Date(booking.createdAt).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrganizerDashboard;