
import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import api from '../config/api';
import { useAuth } from '../contexts/AuthContext';
import { Navigate, useNavigate } from 'react-router-dom';
import { UserEditModal } from '../components/UserEditModal';
// Chart imports removed as we use custom UI components
// import { Chart as ChartJS, ... } from 'chart.js';
// import { Bar, Line, Doughnut } from 'react-chartjs-2';

interface UserContact {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  isVerified: boolean;
  location?: string;
  dateOfBirth?: string;
  emergencyContact?: {
    name: string;
    relationship: string;
    phone: string;
    email?: string;
  };
  createdAt: string;
  lastActive?: string;
}

interface Trip {
  _id: string;
  title: string;
  destination: string;
  price: number;
  status: 'active' | 'cancelled' | 'completed';
  participants: string[];
  organizerId: {
    _id: string;
    name: string;
    email: string;
  };
  startDate: string;
  endDate: string;
  createdAt: string;
  categories: string[];
}

interface DashboardStats {
  users: {
    total: number;
    byRole: { role: string; count: number }[];
    recentUsers: any[];
  };
  trips: {
    total: number;
    byStatus: { status: string; count: number }[];
    recentTrips: any[];
  };
  bookings: {
    total: number;
    revenue: number;
    recentBookings: any[];
  };
  subscriptions?: {
    total: number;
    active: number;
    byPlan: { plan: string; count: number; revenue: number }[];
    revenue: {
      total: number;
      thisMonth: number;
    };
  };
  tickets?: {
    total: number;
    byStatus: { status: string; count: number }[];
    open: number;
    inProgress: number;
    resolved: number;
  };
  system: {
    uptime: number;
    memoryUsage: any;
    dbStatus: string;
    whatsappStatus: boolean;
  };
}

const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [userContacts, setUserContacts] = useState<UserContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [socket, setSocket] = useState<any | null>(null);
  const [notifications, setNotifications] = useState<Array<{ id: string; message: string; type: 'success' | 'info' | 'error'; timestamp: Date }>>([]);

  // Trips management state
  const [trips, setTrips] = useState<Trip[]>([]);
  const [tripsLoading, setTripsLoading] = useState(false);
  const [tripSearchQuery, setTripSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [tripCurrentPage, setTripCurrentPage] = useState(1);
  const [editingUser, setEditingUser] = useState<UserContact | null>(null);

  // Advanced Analytics State
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [retentionData, setRetentionData] = useState<any[]>([]);
  const [activityData, setActivityData] = useState<any>(null);
  const [topOrganizers, setTopOrganizers] = useState<any[]>([]);

  useEffect(() => {
    if (user && user.role === 'admin') {
      fetchDashboardStats();
      initializeSocket();
    }

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [user]);

  const initializeSocket = () => {
    if (!user) return; // Use user from AuthContext instead of token

    // Cookies are sent automatically, no need to pass token in auth
    const newSocket = io(process.env.REACT_APP_API_URL || process.env.REACT_APP_SOCKET_URL || (typeof window !== 'undefined' ? window.location.origin : ''), {
      path: '/socket.io/',
      withCredentials: true // Send cookies
    } as any);

    newSocket.on('connect', () => {
      console.log('🔌 Admin dashboard connected to real-time updates');
    });

    newSocket.on('admin_update', (data) => {
      console.log('📈 Admin update received:', data);
      addNotification(`System Update: ${data.type} `, 'info');
      fetchDashboardStats(); // Refresh stats
    });

    newSocket.on('trip_update', (data) => {
      if (data.type === 'created') {
        addNotification(`New trip created: ${data.trip.title} `, 'success');
        fetchDashboardStats();
      }
    });

    newSocket.on('error', (error) => {
      console.error('Admin socket error:', error);
    });

    setSocket(newSocket);
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

  const fetchDashboardStats = async () => {
    try {
      const [statsRes] = await Promise.all([
        api.get('/admin/stats')
      ]);

      const data = statsRes.data as {
        users: { total: number; byRole: any[]; recentUsers: any[] };
        trips: { total: number; byStatus: any[]; recentTrips: any[]; totalBookings?: number; totalRevenue?: number; recentBookings?: any[] };
        subscriptions?: { total: number; active: number; byPlan: any[]; revenue: { total: number; thisMonth: number } };
        tickets?: { total: number; byStatus: any[]; open: number; inProgress: number; resolved: number };
      };
      setStats({
        users: data.users,
        trips: data.trips,
        bookings: {
          total: data.trips.totalBookings || 0,
          revenue: data.trips.totalRevenue || 0,
          recentBookings: data.trips.recentBookings || []
        },
        subscriptions: data.subscriptions,
        tickets: data.tickets,
        system: {
          uptime: 0,
          memoryUsage: {},
          dbStatus: 'connected',
          whatsappStatus: false
        }
      });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch dashboard stats');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserContacts = async () => {
    setContactsLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', currentPage.toString());
      params.append('limit', '50');
      if (searchQuery) params.append('search', searchQuery);
      if (roleFilter !== 'all') params.append('role', roleFilter);

      const response = await api.get(`/admin/users/contacts?${params.toString()}`);
      const responseData = response.data as { users: any[] };
      setUserContacts(responseData.users);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch user contacts');
    } finally {
      setContactsLoading(false);
    }
  };

  const exportUserContacts = async () => {
    try {
      const params = new URLSearchParams();
      if (roleFilter !== 'all') params.append('role', roleFilter);

      const response = await api.get(`/admin/users/export-contacts?${params.toString()}`, {
        responseType: 'blob'
      });

      const blob = new Blob([response.data as BlobPart], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `trek - tribe - users - ${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to export user contacts');
    }
  };

  const fetchTrips = async () => {
    setTripsLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', tripCurrentPage.toString());
      params.append('limit', '20');
      if (tripSearchQuery) params.append('search', tripSearchQuery);
      if (statusFilter !== 'all') params.append('status', statusFilter);

      const response = await api.get(`/admin/trips?${params.toString()}`);
      const responseData = response.data as { trips: Trip[] };
      setTrips(responseData.trips);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch trips');
    } finally {
      setTripsLoading(false);
    }
  };

  const updateTripStatus = async (tripId: string, newStatus: string) => {
    try {
      await api.patch(`/admin/trips/${tripId}/status`, { status: newStatus });
      addNotification(`Trip status updated to ${newStatus}`, 'success');
      fetchTrips(); // Refresh trips list
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update trip status');
    }
  };

  // Fetch contacts when users tab is active
  React.useEffect(() => {
    if (activeTab === 'users') {
      fetchUserContacts();
    }
  }, [activeTab, currentPage, searchQuery, roleFilter]);

  // Fetch trips when trips tab is active
  React.useEffect(() => {
    if (activeTab === 'trips') {
      fetchTrips();
    }
  }, [activeTab, tripCurrentPage, tripSearchQuery, statusFilter]);

  const formatBytes = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const TripsManagement = () => (
    <div className="space-y-6">
      {/* Trips Header */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">🗺️ Trips Management</h3>
            <p className="text-sm text-gray-600 mt-1">
              Manage all trips across the platform, update status, and view organizer details.
            </p>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex gap-4 mb-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search trips by title or destination..."
              value={tripSearchQuery}
              onChange={(e) => setTripSearchQuery(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500 focus:border-forest-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500 focus:border-forest-500"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="cancelled">Cancelled</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      {/* Trips Table */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        {tripsLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-forest-600"></div>
            <span className="ml-3 text-gray-600">Loading trips...</span>
          </div>
        ) : trips.length === 0 ? (
          <div className="text-center py-12">
            <span className="text-gray-500">No trips found matching your criteria.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Trip Details
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Organizer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status & Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Participants
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {trips?.map((trip) => (
                  <tr key={trip._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-start">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{trip.title}</div>
                          <div className="text-sm text-gray-500">📍 {trip.destination}</div>
                          <div className="text-xs text-gray-400 mt-1">
                            {new Date(trip.startDate).toLocaleDateString()} - {new Date(trip.endDate).toLocaleDateString()}
                          </div>
                          {trip.categories && trip.categories.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {trip.categories?.slice(0, 3).map((category, idx) => (
                                <span key={idx} className="inline-flex px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">
                                  {category}
                                </span>
                              ))}
                              {(trip.categories?.length || 0) > 3 && (
                                <span className="text-xs text-gray-400">+{(trip.categories?.length || 0) - 3} more</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-8 w-8">
                          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-forest-400 to-nature-500 flex items-center justify-center text-white text-sm font-bold">
                            {trip.organizerId?.name ? trip.organizerId.name.charAt(0).toUpperCase() : '?'}
                          </div>
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900">{trip.organizerId?.name || 'Unknown'}</div>
                          <div className="text-sm text-gray-500">{trip.organizerId?.email || 'No email'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-2">
                        <div className={`inline-flex px-2 py-1 text-xs rounded-full ${trip.status === 'active' ? 'bg-green-100 text-green-800' :
                          trip.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                          {trip.status.toUpperCase()}
                        </div>
                        <div className="text-sm font-medium text-gray-900">
                          ₹{trip.price.toLocaleString()}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        <span className="font-medium">{trip.participants?.length || 0}</span> participants
                      </div>
                      <div className="text-xs text-gray-500">
                        Revenue: ₹{((trip.participants?.length || 0) * trip.price).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        {trip.status === 'active' && (
                          <>
                            <button
                              onClick={() => updateTripStatus(trip._id, 'completed')}
                              className="text-blue-600 hover:text-blue-900 text-sm font-medium"
                            >
                              Complete
                            </button>
                            <span className="text-gray-300">|</span>
                            <button
                              onClick={() => updateTripStatus(trip._id, 'cancelled')}
                              className="text-red-600 hover:text-red-900 text-sm font-medium"
                            >
                              Cancel
                            </button>
                          </>
                        )}
                        {trip.status === 'cancelled' && (
                          <button
                            onClick={() => updateTripStatus(trip._id, 'active')}
                            className="text-green-600 hover:text-green-900 text-sm font-medium"
                          >
                            Reactivate
                          </button>
                        )}
                        {trip.status === 'completed' && (
                          <span className="text-sm text-gray-400">No actions</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  // Redirect if not admin (after all hooks)
  if (!user || user.role !== 'admin') {
    return <Navigate to="/login" replace />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-forest-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-4">⚠️ Error</div>
          <p className="text-gray-600">{error}</p>
          <button
            onClick={fetchDashboardStats}
            className="mt-4 bg-forest-600 text-white px-4 py-2 rounded-lg hover:bg-forest-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-2xl font-bold text-gray-900">
              🛠️ Admin Dashboard
            </h1>
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/admin/organizer-verification')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm font-medium"
              >
                <span>🔐</span>
                Organizer Verification
              </button>
              <span className="text-sm text-gray-500">
                Welcome back, {user.name}
              </span>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${stats?.system.whatsappStatus ? 'bg-green-400' : 'bg-red-400'}`}></div>
                <span className="text-sm text-gray-600">
                  WhatsApp {stats?.system.whatsappStatus ? 'Connected' : 'Disconnected'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className="flex space-x-8 border-b border-gray-200">
          {[
            { id: 'overview', name: 'Overview', icon: '📊' },
            { id: 'users', name: 'Users', icon: '👥' },
            { id: 'trips', name: 'Trips', icon: '🗺️' },
            { id: 'system', name: 'System', icon: '⚙️' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm ${activeTab === tab.id
                ? 'border-forest-500 text-forest-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              <span>{tab.icon}</span>
              {tab.name}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Stats Cards */}
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-blue-100">
                  <span className="text-2xl">👥</span>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Total Users</p>
                  <p className="text-2xl font-bold text-gray-900">{stats?.users.total || 0}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-green-100">
                  <span className="text-2xl">🗺️</span>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Total Trips</p>
                  <p className="text-2xl font-bold text-gray-900">{stats?.trips.total || 0}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-purple-100">
                  <span className="text-2xl">📅</span>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Total Bookings</p>
                  <p className="text-2xl font-bold text-gray-900">{stats?.bookings.total || 0}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-yellow-100">
                  <span className="text-2xl">💰</span>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Trip Revenue</p>
                  <p className="text-2xl font-bold text-gray-900">₹{stats?.bookings.revenue?.toLocaleString() || 0}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-emerald-100">
                  <span className="text-2xl">📊</span>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Subscription Revenue</p>
                  <p className="text-2xl font-bold text-gray-900">₹{stats?.subscriptions?.revenue.total?.toLocaleString() || 0}</p>
                  <p className="text-xs text-emerald-600 mt-1">
                    ₹{stats?.subscriptions?.revenue.thisMonth?.toLocaleString() || 0} this month
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-orange-100">
                  <span className="text-2xl">🎫</span>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Support Tickets</p>
                  <p className="text-2xl font-bold text-gray-900">{stats?.tickets?.total || 0}</p>
                  <p className="text-xs text-orange-600 mt-1">
                    {stats?.tickets?.open || 0} open, {stats?.tickets?.inProgress || 0} in progress
                  </p>
                </div>
              </div>
            </div>

            {/* Charts Section */}
            <div className="col-span-full grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
              {/* Subscription Revenue by Plan */}
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">💎 Revenue by Subscription Plan</h3>
                <div className="space-y-3">
                  {stats?.subscriptions?.byPlan && stats.subscriptions.byPlan.length > 0 ? stats.subscriptions.byPlan.map((item) => (
                    <div key={item.plan} className="flex justify-between items-center">
                      <div className="flex flex-col">
                        <span className="text-sm text-gray-600 capitalize font-medium">{item.plan}</span>
                        <span className="text-xs text-gray-400">{item.count} active</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-emerald-600 h-2 rounded-full"
                            style={{ width: `${(item.revenue / (stats?.subscriptions?.revenue.total || 1)) * 100}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium text-gray-900 min-w-[80px] text-right">
                          ₹{item.revenue?.toLocaleString() || 0}
                        </span>
                      </div>
                    </div>
                  )) : <p className="text-sm text-gray-400">No subscription data available</p>}
                </div>
              </div>

              {/* Tickets by Status */}
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">🎫 Support Tickets</h3>
                <div className="space-y-3">
                  {stats?.tickets?.byStatus && stats.tickets.byStatus.length > 0 ? stats.tickets.byStatus.map((item) => (
                    <div key={item.status} className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 capitalize">{item.status.replace(/-/g, ' ')}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${item.status === 'open' ? 'bg-red-600' :
                              item.status === 'in-progress' ? 'bg-yellow-600' :
                                item.status === 'resolved' ? 'bg-green-600' : 'bg-blue-600'
                              }`}
                            style={{ width: `${(item.count / (stats?.tickets?.total || 1)) * 100}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium text-gray-900">{item.count}</span>
                      </div>
                    </div>
                  )) : <p className="text-sm text-gray-400">No ticket data available</p>}
                </div>
              </div>
            </div>

            {/* Existing Charts Section */}
            <div className="col-span-full grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
              {/* Users by Role */}
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">👥 Users by Role</h3>
                <div className="space-y-3">
                  {stats?.users.byRole?.map((item) => (
                    <div key={item.role} className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 capitalize">{item.role}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-forest-600 h-2 rounded-full"
                            style={{ width: `${(item.count / (stats?.users.total || 1)) * 100}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium text-gray-900">{item.count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Trips by Status */}
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">🗺️ Trips by Status</h3>
                <div className="space-y-3">
                  {stats?.trips.byStatus?.map((item) => (
                    <div key={item.status} className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 capitalize">{item.status}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${item.status === 'active' ? 'bg-green-600' :
                              item.status === 'cancelled' ? 'bg-red-600' : 'bg-blue-600'
                              }`}
                            style={{ width: `${(item.count / (stats?.trips.total || 1)) * 100}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium text-gray-900">{item.count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="space-y-6">
            {/* User Contacts Header */}
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">👥 User Contact Information</h3>
                  <p className="text-sm text-red-600 font-medium mt-1">
                    ⚠️ This section contains sensitive user data. All access is logged and monitored.
                  </p>
                </div>
                <button
                  onClick={exportUserContacts}
                  className="bg-forest-600 text-white px-4 py-2 rounded-lg hover:bg-forest-700 transition-colors"
                >
                  📄 Export CSV
                </button>
              </div>

              {/* Search and Filters */}
              <div className="flex gap-4 mb-4">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Search users by name, email, or phone..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500 focus:border-forest-500"
                  />
                </div>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500 focus:border-forest-500"
                >
                  <option value="all">All Roles</option>
                  <option value="traveler">Travelers</option>
                  <option value="organizer">Organizers</option>
                  <option value="agent">Agents</option>
                  <option value="admin">Admins</option>
                </select>
              </div>
            </div>

            {/* User Contacts Table */}
            <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
              {contactsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-forest-600"></div>
                  <span className="ml-3 text-gray-600">Loading user contacts...</span>
                </div>
              ) : userContacts.length === 0 ? (
                <div className="text-center py-12">
                  <span className="text-gray-500">No users found matching your criteria.</span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          User Details
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Contact Information
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Emergency Contact
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {userContacts.map((contact) => (
                        <tr key={contact._id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-10 w-10">
                                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-forest-400 to-nature-500 flex items-center justify-center text-white font-bold">
                                  {contact.name.charAt(0).toUpperCase()}
                                </div>
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900">{contact.name}</div>
                                <div className="text-sm text-gray-500 capitalize">
                                  <span className={`inline-flex px-2 py-1 text-xs rounded-full ${contact.role === 'admin' ? 'bg-red-100 text-red-800' :
                                    contact.role === 'organizer' ? 'bg-blue-100 text-blue-800' :
                                      contact.role === 'agent' ? 'bg-purple-100 text-purple-800' :
                                        'bg-gray-100 text-gray-800'
                                    }`}>
                                    {contact.role}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="space-y-1">
                              <div className="text-sm text-gray-900">
                                📧 {contact.email}
                              </div>
                              {contact.phone && (
                                <div className="text-sm text-gray-900">
                                  📱 {contact.phone}
                                </div>
                              )}
                              {contact.location && (
                                <div className="text-sm text-gray-500">
                                  📍 {contact.location}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {contact.emergencyContact ? (
                              <div className="space-y-1">
                                <div className="text-sm text-gray-900">
                                  {contact.emergencyContact.name}
                                </div>
                                <div className="text-sm text-gray-500">
                                  ({contact.emergencyContact.relationship})
                                </div>
                                <div className="text-sm text-gray-900">
                                  📞 {contact.emergencyContact.phone}
                                </div>
                                {contact.emergencyContact.email && (
                                  <div className="text-sm text-gray-500">
                                    📧 {contact.emergencyContact.email}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-sm text-gray-400">Not provided</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="space-y-2">
                              <div className={`inline-flex px-2 py-1 text-xs rounded-full ${contact.isVerified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                }`}>
                                {contact.isVerified ? '✅ Verified' : '⏳ Unverified'}
                              </div>
                              <div className="text-xs text-gray-500">
                                Joined: {new Date(contact.createdAt).toLocaleDateString()}
                              </div>
                              {contact.lastActive && (
                                <div className="text-xs text-gray-500">
                                  Last active: {new Date(contact.lastActive).toLocaleDateString()}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button
                              onClick={() => setEditingUser(contact)}
                              className="text-forest-600 hover:text-forest-900"
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {editingUser && (
                <UserEditModal
                  user={editingUser}
                  onClose={() => setEditingUser(null)}
                  onUpdate={() => {
                    fetchUserContacts(); // Refresh list
                    fetchDashboardStats(); // Refresh stats
                  }}
                />
              )}
            </div>

            {/* Security Notice */}
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <span className="text-red-400 text-xl">⚠️</span>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    Data Privacy Notice
                  </h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>
                      This page contains sensitive personal information including phone numbers, email addresses, and emergency contacts.
                      Access to this data is restricted to administrators only and all activity is logged for security purposes.
                    </p>
                    <p className="mt-2">
                      Please ensure you comply with data protection regulations and only use this information for legitimate business purposes.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'trips' && (
          <TripsManagement />
        )}

        {activeTab === 'system' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* System Status */}
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">⚙️ System Status</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Uptime</span>
                  <span className="text-sm font-medium text-gray-900">
                    {formatUptime(stats?.system.uptime || 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Database Status</span>
                  <span className={`text-sm font-medium ${stats?.system.dbStatus === 'connected' ? 'text-green-600' : 'text-red-600'
                    }`}>
                    {stats?.system.dbStatus || 'unknown'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">WhatsApp Service</span>
                  <span className={`text-sm font-medium ${stats?.system.whatsappStatus ? 'text-green-600' : 'text-red-600'
                    }`}>
                    {stats?.system.whatsappStatus ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Memory Usage</span>
                  <span className="text-sm font-medium text-gray-900">
                    {formatBytes(stats?.system.memoryUsage?.used || 0)} / {formatBytes(stats?.system.memoryUsage?.total || 0)}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">🚀 Quick Actions</h3>
              <div className="space-y-3">
                <button
                  onClick={fetchDashboardStats}
                  className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">🔄</span>
                    <div>
                      <div className="text-sm font-medium text-gray-900">Refresh Statistics</div>
                      <div className="text-xs text-gray-500">Update all dashboard data</div>
                    </div>
                  </div>
                </button>

                <button className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">📊</span>
                    <div>
                      <div className="text-sm font-medium text-gray-900">Export Data</div>
                      <div className="text-xs text-gray-500">Download system reports</div>
                    </div>
                  </div>
                </button>

                <button className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">🧹</span>
                    <div>
                      <div className="text-sm font-medium text-gray-900">System Cleanup</div>
                      <div className="text-xs text-gray-500">Clean temporary files and logs</div>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;