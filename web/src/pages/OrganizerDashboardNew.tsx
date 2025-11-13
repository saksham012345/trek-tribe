import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import { useToast, ToastContainer } from '../components/Toast';

interface DashboardStats {
  trips: {
    total: number;
    active: number;
    upcoming: number;
    completed: number;
  };
  bookings: {
    total: number;
    pending: number;
    confirmed: number;
    cancelled: number;
  };
  revenue: {
    total: number;
    thisMonth: number;
    lastMonth: number;
    growth: number;
  };
  participants: {
    total: number;
    thisMonth: number;
  };
}

interface AutoPayInfo {
  isSetup: boolean;
  scheduledPaymentDate?: string;
  daysUntilPayment?: number;
  subscriptionActive: boolean;
  listingsRemaining: number;
}

interface SubscriptionInfo {
  isActive: boolean;
  tripsPublished: number;
  tripsLimit: number;
  expiresAt?: string;
  daysRemaining?: number;
}

interface Alert {
  id: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  message: string;
  action?: {
    label: string;
    url: string;
  };
}

interface QuickAction {
  label: string;
  icon: string;
  url: string;
  badge?: number;
  color: string;
}

interface RecentTrip {
  _id: string;
  title: string;
  startDate: string;
  participants: number;
  capacity: number;
  status: string;
}

interface RecentBooking {
  _id: string;
  tripTitle: string;
  travelerName: string;
  status: string;
  amount: number;
  createdAt: string;
}

interface OrganizerDashboardData {
  stats: DashboardStats;
  autoPay: AutoPayInfo;
  subscription: SubscriptionInfo;
  alerts: Alert[];
  quickActions: QuickAction[];
  recentTrips: RecentTrip[];
  recentBookings: RecentBooking[];
}

const OrganizerDashboardNew: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toasts, success, error: showError, removeToast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<OrganizerDashboardData | null>(null);

  useEffect(() => {
    if (user?.role !== 'organizer') {
      navigate('/');
      return;
    }
    fetchDashboardData();
  }, [user, navigate]);

  const fetchDashboardData = async () => {
    try {
      const response = await api.get('/api/dashboard/organizer');
      setData(response.data);
    } catch (error: any) {
      showError(error.response?.data?.error || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const getAlertColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-50 border-red-500 text-red-800';
      case 'high': return 'bg-orange-50 border-orange-500 text-orange-800';
      case 'medium': return 'bg-yellow-50 border-yellow-500 text-yellow-800';
      case 'low': return 'bg-blue-50 border-blue-500 text-blue-800';
      default: return 'bg-gray-50 border-gray-500 text-gray-800';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount / 100);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-forest-50 via-nature-50 to-forest-100 flex items-center justify-center">
        <div className="text-center">
          <svg className="animate-spin h-12 w-12 text-forest-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-forest-600 font-medium">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <div className="min-h-screen bg-gradient-to-br from-forest-50 via-nature-50 to-forest-100 p-4 md:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-forest-900 mb-2">
                  🏔️ Organizer Dashboard
                </h1>
                <p className="text-forest-600">
                  Welcome back, <span className="font-semibold">{user?.name}</span>!
                </p>
              </div>
              <button
                onClick={() => navigate('/trips/create')}
                className="px-6 py-3 bg-gradient-to-r from-forest-600 to-nature-600 text-white font-semibold rounded-xl hover:from-forest-700 hover:to-nature-700 transition-all shadow-lg hover:shadow-xl"
              >
                + Create New Trip
              </button>
            </div>
          </div>

          {/* Alerts */}
          {data.alerts.length > 0 && (
            <div className="space-y-3">
              {data.alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-4 rounded-xl border-l-4 ${getAlertColor(alert.priority)} shadow-md`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-sm mb-1">{alert.title}</h3>
                      <p className="text-sm opacity-90">{alert.message}</p>
                    </div>
                    {alert.action && (
                      <button
                        onClick={() => navigate(alert.action!.url)}
                        className="px-4 py-2 bg-white/80 hover:bg-white rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
                      >
                        {alert.action.label}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Trips */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="w-12 h-12 bg-forest-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-forest-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                </div>
                <span className="text-xs font-medium text-forest-500">TRIPS</span>
              </div>
              <h3 className="text-3xl font-bold text-forest-900">{data.stats.trips.total}</h3>
              <p className="text-sm text-forest-600 mt-1">
                {data.stats.trips.active} active, {data.stats.trips.upcoming} upcoming
              </p>
            </div>

            {/* Total Bookings */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <span className="text-xs font-medium text-blue-500">BOOKINGS</span>
              </div>
              <h3 className="text-3xl font-bold text-blue-900">{data.stats.bookings.total}</h3>
              <p className="text-sm text-blue-600 mt-1">
                {data.stats.bookings.pending} pending verification
              </p>
            </div>

            {/* Total Revenue */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="w-12 h-12 bg-nature-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-nature-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <span className="text-xs font-medium text-nature-500">REVENUE</span>
              </div>
              <h3 className="text-3xl font-bold text-nature-900">{formatCurrency(data.stats.revenue.total)}</h3>
              <p className="text-sm text-nature-600 mt-1">
                {data.stats.revenue.growth >= 0 ? '+' : ''}{data.stats.revenue.growth.toFixed(1)}% from last month
              </p>
            </div>

            {/* Total Participants */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <span className="text-xs font-medium text-purple-500">TRAVELERS</span>
              </div>
              <h3 className="text-3xl font-bold text-purple-900">{data.stats.participants.total}</h3>
              <p className="text-sm text-purple-600 mt-1">
                {data.stats.participants.thisMonth} this month
              </p>
            </div>
          </div>

          {/* Auto-Pay & Subscription Info */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Auto-Pay Status */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="text-lg font-bold text-forest-900 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-nature-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                Auto-Pay Status
              </h3>
              
              {data.autoPay.isSetup ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${data.autoPay.subscriptionActive ? 'bg-green-500' : 'bg-orange-500'} animate-pulse`} />
                    <span className="text-sm font-medium text-forest-700">
                      {data.autoPay.subscriptionActive ? 'Active' : 'Pending Payment'}
                    </span>
                  </div>
                  
                  {data.autoPay.scheduledPaymentDate && (
                    <div className="bg-forest-50 rounded-lg p-4">
                      <p className="text-sm text-forest-600 mb-1">Next payment scheduled:</p>
                      <p className="text-lg font-bold text-forest-900">{formatDate(data.autoPay.scheduledPaymentDate)}</p>
                      {data.autoPay.daysUntilPayment !== undefined && (
                        <p className="text-sm text-forest-600 mt-1">{data.autoPay.daysUntilPayment} days remaining</p>
                      )}
                    </div>
                  )}
                  
                  <button
                    onClick={() => navigate('/auto-pay/manage')}
                    className="w-full py-2 px-4 border-2 border-forest-300 text-forest-700 font-medium rounded-lg hover:bg-forest-50 transition-colors"
                  >
                    Manage Auto-Pay
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                    <p className="text-sm text-orange-800">
                      <span className="font-semibold">Action Required:</span> Setup auto-pay to keep your listings active.
                    </p>
                  </div>
                  <button
                    onClick={() => navigate('/setup-auto-pay')}
                    className="w-full py-3 px-4 bg-gradient-to-r from-forest-600 to-nature-600 text-white font-semibold rounded-lg hover:from-forest-700 hover:to-nature-700 transition-all"
                  >
                    Setup Auto-Pay Now
                  </button>
                </div>
              )}
            </div>

            {/* Subscription Info */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="text-lg font-bold text-forest-900 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-nature-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Subscription
              </h3>
              
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-forest-600">Listings Used</span>
                    <span className="text-sm font-bold text-forest-900">
                      {data.subscription.tripsPublished} / {data.subscription.tripsLimit}
                    </span>
                  </div>
                  <div className="w-full h-3 bg-forest-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-forest-500 to-nature-500 transition-all"
                      style={{ width: `${(data.subscription.tripsPublished / data.subscription.tripsLimit) * 100}%` }}
                    />
                  </div>
                </div>
                
                {data.subscription.expiresAt && (
                  <div className="bg-forest-50 rounded-lg p-4">
                    <p className="text-sm text-forest-600 mb-1">Subscription expires:</p>
                    <p className="text-lg font-bold text-forest-900">{formatDate(data.subscription.expiresAt)}</p>
                    {data.subscription.daysRemaining !== undefined && (
                      <p className="text-sm text-forest-600 mt-1">{data.subscription.daysRemaining} days remaining</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="text-lg font-bold text-forest-900 mb-4">Quick Actions</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {data.quickActions.map((action, index) => (
                <button
                  key={index}
                  onClick={() => navigate(action.url)}
                  className="relative p-4 bg-forest-50 rounded-xl hover:bg-forest-100 transition-colors text-left"
                >
                  {action.badge !== undefined && action.badge > 0 && (
                    <span className={`absolute top-2 right-2 px-2 py-1 bg-${action.color}-500 text-white text-xs font-bold rounded-full`}>
                      {action.badge}
                    </span>
                  )}
                  <div className="text-2xl mb-2">{action.icon}</div>
                  <p className="text-sm font-medium text-forest-900">{action.label}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Recent Trips and Bookings */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Trips */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-forest-900">Recent Trips</h3>
                <button
                  onClick={() => navigate('/trips')}
                  className="text-sm text-nature-600 hover:text-nature-700 font-medium"
                >
                  View All →
                </button>
              </div>
              
              <div className="space-y-3">
                {data.recentTrips.length > 0 ? (
                  data.recentTrips.map((trip) => (
                    <div
                      key={trip._id}
                      onClick={() => navigate(`/trips/${trip._id}`)}
                      className="p-4 bg-forest-50 rounded-lg hover:bg-forest-100 transition-colors cursor-pointer"
                    >
                      <h4 className="font-semibold text-forest-900 mb-1">{trip.title}</h4>
                      <div className="flex items-center justify-between text-sm text-forest-600">
                        <span>{formatDate(trip.startDate)}</span>
                        <span>{trip.participants}/{trip.capacity} travelers</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-forest-500 text-center py-8">No trips yet</p>
                )}
              </div>
            </div>

            {/* Recent Bookings */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-forest-900">Recent Bookings</h3>
                <button
                  onClick={() => navigate('/bookings')}
                  className="text-sm text-nature-600 hover:text-nature-700 font-medium"
                >
                  View All →
                </button>
              </div>
              
              <div className="space-y-3">
                {data.recentBookings.length > 0 ? (
                  data.recentBookings.map((booking) => (
                    <div
                      key={booking._id}
                      onClick={() => navigate(`/bookings/${booking._id}`)}
                      className="p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer"
                    >
                      <div className="flex items-start justify-between mb-1">
                        <h4 className="font-semibold text-blue-900">{booking.travelerName}</h4>
                        <span className={`px-2 py-1 text-xs font-medium rounded ${
                          booking.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                          booking.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {booking.status}
                        </span>
                      </div>
                      <p className="text-sm text-blue-700 mb-1">{booking.tripTitle}</p>
                      <div className="flex items-center justify-between text-sm text-blue-600">
                        <span>{formatDate(booking.createdAt)}</span>
                        <span className="font-semibold">{formatCurrency(booking.amount)}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-forest-500 text-center py-8">No bookings yet</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default OrganizerDashboardNew;
