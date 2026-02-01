import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import api from '../config/api';
import { User } from '../types';

import ExpenseStats from '../components/organizer/ExpenseStats';
import CRMPreviewSection from '../components/organizer/dashboard/CRMPreviewSection';
import TripsListSection from '../components/organizer/dashboard/TripsListSection';
import PaymentVerificationSection from '../components/organizer/dashboard/PaymentVerificationSection';

// Types (should eventually be moved to shared types)
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

import { FinanceSummary } from '../types/finance';

interface OrganizerDashboardProps {
  user: User;
}

const OrganizerDashboard: React.FC<OrganizerDashboardProps> = ({ user }) => {
  const navigate = useNavigate();
  const [trips, setTrips] = useState<TripSummary[]>([]);
  const [pendingBookings, setPendingBookings] = useState<BookingVerification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [verificationLoading, setVerificationLoading] = useState<string | null>(null);
  const [socket, setSocket] = useState<any | null>(null);
  const [notifications, setNotifications] = useState<Array<{ id: string; message: string; type: 'success' | 'info' | 'error'; timestamp: Date }>>([]);
  const [crmSubscription, setCrmSubscription] = useState<any | null>(null);
  const [hasCRMAccess, setHasCRMAccess] = useState(false);

  // Finance Module State
  const [activeTab, setActiveTab] = useState<'overview' | 'finance'>('overview');
  const [financeSummary, setFinanceSummary] = useState<FinanceSummary | null>(null);
  const [financeLoading, setFinanceLoading] = useState(false);

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
    if (!user) return; // Use user from AuthContext instead of token

    // Cookies are sent automatically, no need to pass token in auth
    const newSocket = io(process.env.REACT_APP_API_URL || process.env.REACT_APP_SOCKET_URL || (typeof window !== 'undefined' ? window.location.origin : ''), {
      path: '/socket.io/',
      withCredentials: true // Send cookies
    } as any);

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
      // Fetch CRM subscription info (if any)
      try {
        const crmRes = await api.get('/api/crm/subscriptions/my');
        setCrmSubscription(crmRes.data?.data || null);
      } catch (crmErr: any) {
        // Not critical; ignore if user has no crm subscription
        setCrmSubscription(null);
      }

      // Check CRM access from subscription plans OR organizer profile
      try {
        const accessRes = await api.get('/api/subscriptions/verify-crm-access');
        const hasCRMFromPlan = accessRes.data?.hasCRMAccess || false;
        const hasCRMFromProfile = Boolean(
          user?.organizerProfile && (
            ('crmEnabled' in (user.organizerProfile as any) && (user.organizerProfile as any).crmEnabled) ||
            ('crmAccess' in (user.organizerProfile as any) && (user.organizerProfile as any).crmAccess)
          )
        );
        setHasCRMAccess(hasCRMFromPlan || hasCRMFromProfile);
      } catch (accessErr: any) {
        // Fall back to checking organizer profile
        const hasCRMFromProfile = Boolean(
          user?.organizerProfile && (
            ('crmEnabled' in (user.organizerProfile as any) && (user.organizerProfile as any).crmEnabled) ||
            ('crmAccess' in (user.organizerProfile as any) && (user.organizerProfile as any).crmAccess)
          )
        );
        setHasCRMAccess(hasCRMFromProfile);
      }
    } catch (error: any) {
      // Don't set error or show message for 401 - let auth system handle it
      if (error?.response?.status === 401) {
        console.log('Authentication required - redirecting to login');
        // Don't set error state, just let auth interceptor handle redirect
      } else {
        setError(error.response?.data?.error || 'Failed to load dashboard data');
        console.error('Error fetching dashboard data:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchFinanceData = async () => {
    setFinanceLoading(true);
    try {
      const res = await api.get('/finance/overview');
      if (res.data?.summary) {
        setFinanceSummary(res.data.summary);
      }
    } catch (err: any) {
      console.error('Error fetching finance data:', err);
      // Optional: setError or toast
    } finally {
      setFinanceLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'finance' && !financeSummary) {
      fetchFinanceData();
    }
  }, [activeTab]);

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
            Welcome back, <span className="font-semibold">{user.name}</span>! Manage trips, verify payments, and preview CRM without purchasing yet.
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
                className={`p-4 rounded-xl shadow-lg border-l-4 ${notification.type === 'success'
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

      {/* Dashboard Tabs */}
      <div className="max-w-7xl mx-auto mb-8 flex space-x-4 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-4 px-4 font-medium text-sm transition-colors relative ${activeTab === 'overview'
            ? 'text-forest-700 border-b-2 border-forest-600'
            : 'text-gray-500 hover:text-gray-700'
            }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('finance')}
          className={`pb-4 px-4 font-medium text-sm transition-colors relative ${activeTab === 'finance'
            ? 'text-forest-700 border-b-2 border-forest-600'
            : 'text-gray-500 hover:text-gray-700'
            }`}
        >
          Finance & Profit
        </button>
      </div>

      {activeTab === 'finance' ? (
        <div className="max-w-7xl mx-auto">
          <div className="mb-6 flex justify-between items-center">
            <h2 className="text-2xl font-bold text-forest-800">Financial Overview</h2>
            <button
              onClick={fetchFinanceData}
              className="text-sm text-forest-600 hover:underline"
            >
              Refresh Data
            </button>
          </div>
          {financeSummary ? (
            <ExpenseStats summary={financeSummary} loading={financeLoading} />
          ) : (
            <div className="p-8 text-center text-gray-500 bg-white rounded-xl shadow-sm">
              {financeLoading ? 'Loading financial data...' : 'No financial data available yet.'}
            </div>
          )}
        </div>
      ) : (
        <>
          <TripsListSection trips={trips} />
          <div className="max-w-7xl mx-auto grid lg:grid-cols-3 gap-8">
            <PaymentVerificationSection
              pendingBookings={pendingBookings}
              verificationLoading={verificationLoading}
              handleVerifyPayment={handleVerifyPayment}
              openPaymentScreenshot={openPaymentScreenshot}
            />
          </div>
          <CRMPreviewSection hasCRMAccess={hasCRMAccess} crmSubscription={crmSubscription} />
        </>
      )}
    </div>
  );
};

export default OrganizerDashboard;