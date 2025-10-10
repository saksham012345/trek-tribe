import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';

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
  system: {
    uptime: number;
    memoryUsage: any;
    dbStatus: string;
    whatsappStatus: boolean;
  };
}

const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [userContacts, setUserContacts] = useState<UserContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  // Redirect if not admin
  if (!user || user.role !== 'admin') {
    return <Navigate to="/login" replace />;
  }

  const fetchDashboardStats = async () => {
    try {
      const [statsRes] = await Promise.all([
        axios.get('/admin/stats')
      ]);

      const data = statsRes.data as {
        users: { total: number; byRole: any[]; recentUsers: any[] };
        trips: { total: number; byStatus: any[]; recentTrips: any[]; totalBookings?: number; totalRevenue?: number; recentBookings?: any[] };
      };
      setStats({
        users: data.users,
        trips: data.trips,
        bookings: {
          total: data.trips.totalBookings || 0,
          revenue: data.trips.totalRevenue || 0,
          recentBookings: data.trips.recentBookings || []
        },
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

      const response = await axios.get(`/admin/users/contacts?${params.toString()}`);
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

      const response = await axios.get(`/admin/users/export-contacts?${params.toString()}`, {
        responseType: 'blob'
      });

      const blob = new Blob([response.data as BlobPart], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `trek-tribe-users-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to export user contacts');
    }
  };

  // Fetch contacts when users tab is active
  React.useEffect(() => {
    if (activeTab === 'users') {
      fetchUserContacts();
    }
  }, [activeTab, currentPage, searchQuery, roleFilter]);

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
              className={`flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
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
                  <p className="text-sm font-medium text-gray-500">Total Revenue</p>
                  <p className="text-2xl font-bold text-gray-900">₹{stats?.bookings.revenue?.toLocaleString() || 0}</p>
                </div>
              </div>
            </div>

            {/* Charts Section */}
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
                            style={{width: `${(item.count / (stats?.users.total || 1)) * 100}%`}}
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
                            className={`h-2 rounded-full ${
                              item.status === 'active' ? 'bg-green-600' : 
                              item.status === 'cancelled' ? 'bg-red-600' : 'bg-blue-600'
                            }`}
                            style={{width: `${(item.count / (stats?.trips.total || 1)) * 100}%`}}
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
                                  <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                                    contact.role === 'admin' ? 'bg-red-100 text-red-800' :
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
                              <div className={`inline-flex px-2 py-1 text-xs rounded-full ${
                                contact.isVerified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
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
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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
                  <span className={`text-sm font-medium ${
                    stats?.system.dbStatus === 'connected' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {stats?.system.dbStatus || 'unknown'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">WhatsApp Service</span>
                  <span className={`text-sm font-medium ${
                    stats?.system.whatsappStatus ? 'text-green-600' : 'text-red-600'
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