import React, { useState, useEffect } from 'react';
import api from '../config/api';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';

interface PlatformAnalytics {
  trips: { total: number; verified: number; active: number; pending: number };
  users: { total: number; organizers: number; travelers: number; growth: number };
  revenue: { total: number; thisMonth: number; subscriptions: number; growth: number };
  subscriptions: { active: number; trials: number; expired: number; premium: number };
  leads: { total: number; conversionRate: number };
  performance: { avgResponseTime: string; supportLoad: number };
}

interface Subscription {
  _id: string;
  organizerId: { name: string; email: string };
  plan: string;
  status: string;
  subscriptionEndDate: string;
  tripsUsed: number;
  tripsPerCycle: number;
  totalPaid: number;
}

interface TripVerification {
  _id: string;
  tripId: { title: string; destination: string };
  organizerId: { name: string };
  status: string;
  createdAt: string;
}

const AdminCRMDashboard: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [analytics, setAnalytics] = useState<PlatformAnalytics | null>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [verifications, setVerifications] = useState<TripVerification[]>([]);
  const [loading, setLoading] = useState(true);
  const [revenueData, setRevenueData] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, [activeTab]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'overview' || activeTab === 'analytics') {
        const response = await api.get('/api/analytics/dashboard');
        setAnalytics(response.data);
      }
      if (activeTab === 'revenue') {
        const response = await api.get('/api/analytics/revenue');
        setRevenueData(response.data.monthlyRevenue || response.data.data?.monthlyRevenue || []);
      }
      if (activeTab === 'subscriptions') {
        const response = await api.get('/api/crm/subscriptions');
        setSubscriptions(response.data.data || response.data.subscriptions || []);
      }
      if (activeTab === 'verifications') {
        const response = await api.get('/api/crm/verifications');
        setVerifications(response.data.data || response.data.verifications || []);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'overview', name: 'Overview', icon: '📊' },
    { id: 'analytics', name: 'Analytics', icon: '📈' },
    { id: 'revenue', name: 'Revenue', icon: '💰' },
    { id: 'subscriptions', name: 'Subscriptions', icon: '💳' },
    { id: 'verifications', name: 'Verifications', icon: '✅' },
    { id: 'users', name: 'Users', icon: '👥' },
    { id: 'audit', name: 'Audit Logs', icon: '📋' },
  ];

  if (!user || user.role !== 'admin') {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-purple-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-red-600 to-purple-600 bg-clip-text text-transparent">
                🛠️ Admin Control Panel
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Platform Management & Analytics
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-400 animate-pulse"></div>
                <span className="text-sm text-gray-600">System Online</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-4 px-2 border-b-2 font-medium text-sm whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? 'border-red-500 text-red-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span>{tab.icon}</span>
                {tab.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && (
          <div>
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Trips</p>
                    <p className="text-3xl font-bold text-gray-900 mt-1">
                      {analytics?.trips.total || 0}
                    </p>
                    <p className="text-xs text-blue-600 mt-1">
                      {analytics?.trips.active || 0} active
                    </p>
                  </div>
                  <div className="p-4 bg-blue-100 rounded-full">
                    <span className="text-3xl">🗺️</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-green-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Users</p>
                    <p className="text-3xl font-bold text-gray-900 mt-1">
                      {analytics?.users.total || 0}
                    </p>
                    <p className="text-xs text-green-600 mt-1">
                      ↑ {analytics?.users.growth || 0}% growth
                    </p>
                  </div>
                  <div className="p-4 bg-green-100 rounded-full">
                    <span className="text-3xl">👥</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-purple-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Monthly Revenue</p>
                    <p className="text-3xl font-bold text-gray-900 mt-1">
                      ₹{(analytics?.revenue.thisMonth || 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-purple-600 mt-1">
                      ↑ {analytics?.revenue.growth || 0}% MoM
                    </p>
                  </div>
                  <div className="p-4 bg-purple-100 rounded-full">
                    <span className="text-3xl">💰</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-amber-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Active Subscriptions</p>
                    <p className="text-3xl font-bold text-gray-900 mt-1">
                      {analytics?.subscriptions.active || 0}
                    </p>
                    <p className="text-xs text-amber-600 mt-1">
                      {analytics?.subscriptions.premium || 0} premium
                    </p>
                  </div>
                  <div className="p-4 bg-amber-100 rounded-full">
                    <span className="text-3xl">💳</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">📊 Platform Health</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Verified Trips</span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-green-600 h-2 rounded-full"
                          style={{ width: `${((analytics?.trips.verified || 0) / (analytics?.trips.total || 1)) * 100}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-semibold text-gray-900">
                        {((analytics?.trips.verified || 0) / (analytics?.trips.total || 1) * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Premium Subscriptions</span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-amber-600 h-2 rounded-full"
                          style={{ width: `${((analytics?.subscriptions.premium || 0) / (analytics?.subscriptions.active || 1)) * 100}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-semibold text-gray-900">
                        {((analytics?.subscriptions.premium || 0) / (analytics?.subscriptions.active || 1) * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Lead Conversion</span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${analytics?.leads.conversionRate || 0}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-semibold text-gray-900">
                        {analytics?.leads.conversionRate?.toFixed(1) || 0}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">⚡ Quick Actions</h3>
                <div className="space-y-3">
                  <button className="w-full text-left px-4 py-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">✅</span>
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">Verify Pending Trips</p>
                        <p className="text-xs text-gray-600">{analytics?.trips.pending || 0} pending</p>
                      </div>
                    </div>
                  </button>

                  <button className="w-full text-left px-4 py-3 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">📊</span>
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">View Revenue Report</p>
                        <p className="text-xs text-gray-600">12-month analysis</p>
                      </div>
                    </div>
                  </button>

                  <button className="w-full text-left px-4 py-3 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">💳</span>
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">Manage Subscriptions</p>
                        <p className="text-xs text-gray-600">{analytics?.subscriptions.active || 0} active</p>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl shadow-lg p-6">
                <p className="text-sm text-gray-600">Total Revenue</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  ₹{(analytics?.revenue.total || 0).toLocaleString()}
                </p>
                <p className="text-xs text-green-600 mt-1">All-time earnings</p>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6">
                <p className="text-sm text-gray-600">Organizers</p>
                <p className="text-3xl font-bold text-blue-600 mt-2">
                  {analytics?.users.organizers || 0}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {((analytics?.users.organizers || 0) / (analytics?.users.total || 1) * 100).toFixed(0)}% of users
                </p>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6">
                <p className="text-sm text-gray-600">Travelers</p>
                <p className="text-3xl font-bold text-green-600 mt-2">
                  {analytics?.users.travelers || 0}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {((analytics?.users.travelers || 0) / (analytics?.users.total || 1) * 100).toFixed(0)}% of users
                </p>
              </div>
            </div>

            {/* Charts Placeholder */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">📈 Growth Trends</h3>
              <div className="h-80 flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg">
                <div className="text-center">
                  <p className="text-gray-500 text-lg mb-2">Advanced Analytics Dashboard</p>
                  <p className="text-gray-400 text-sm">User growth, revenue trends, and conversion metrics</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'revenue' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">💰 Revenue Dashboard</h3>
              
              {loading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
                </div>
              ) : revenueData.length === 0 ? (
                <div className="text-center py-12">
                  <span className="text-4xl">📊</span>
                  <p className="text-gray-500 mt-4">No revenue data available</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {revenueData.slice(0, 12).map((month, index) => (
                    <div key={index} className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg">
                      <div>
                        <p className="font-semibold text-gray-900">{month.month}</p>
                        <p className="text-xs text-gray-600">{month.subscriptions} subscriptions</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-purple-600">
                          ₹{month.revenue.toLocaleString()}
                        </p>
                        {month.growth && (
                          <p className={`text-xs ${month.growth > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {month.growth > 0 ? '↑' : '↓'} {Math.abs(month.growth).toFixed(1)}%
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'subscriptions' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">💳 Subscription Management</h3>
              <select className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
                <option>All Plans</option>
                <option>Basic</option>
                <option>Premium</option>
                <option>Trial</option>
              </select>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
              </div>
            ) : subscriptions.length === 0 ? (
              <div className="text-center py-12">
                <span className="text-4xl">💳</span>
                <p className="text-gray-500 mt-4">No subscriptions found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Organizer</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Plan</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trips</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Revenue</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expires</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {subscriptions.map((sub) => (
                      <tr key={sub._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{sub.organizerId.name}</p>
                            <p className="text-xs text-gray-500">{sub.organizerId.email}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            sub.plan === 'premium' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {sub.plan.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            sub.status === 'active' ? 'bg-green-100 text-green-800' :
                            sub.status === 'trial' ? 'bg-purple-100 text-purple-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {sub.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {sub.tripsUsed} / {sub.tripsPerCycle}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                          ₹{sub.totalPaid.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">
                          {new Date(sub.subscriptionEndDate).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'verifications' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">✅ Trip Verifications</h3>
              <select className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
                <option>All Status</option>
                <option>Pending</option>
                <option>Approved</option>
                <option>Rejected</option>
              </select>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              </div>
            ) : verifications.length === 0 ? (
              <div className="text-center py-12">
                <span className="text-4xl">✅</span>
                <p className="text-gray-500 mt-4">No pending verifications</p>
              </div>
            ) : (
              <div className="space-y-4">
                {verifications.map((verification) => (
                  <div key={verification._id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">{verification.tripId.title}</p>
                        <p className="text-sm text-gray-600">📍 {verification.tripId.destination}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          By: {verification.organizerId.name}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          verification.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          verification.status === 'approved' ? 'bg-green-100 text-green-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {verification.status.toUpperCase()}
                        </span>
                        <p className="text-xs text-gray-500">
                          {new Date(verification.createdAt).toLocaleDateString()}
                        </p>
                        {verification.status === 'pending' && (
                          <div className="flex gap-2 mt-2">
                            <button className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700">
                              Approve
                            </button>
                            <button className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700">
                              Reject
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'users' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">👥 User Management</h3>
            <div className="text-center py-12">
              <span className="text-4xl">👥</span>
              <p className="text-gray-500 mt-4">User management features coming soon...</p>
            </div>
          </div>
        )}

        {activeTab === 'audit' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">📋 Audit Logs</h3>
            <div className="text-center py-12">
              <span className="text-4xl">📋</span>
              <p className="text-gray-500 mt-4">Audit log viewer coming soon...</p>
              <p className="text-xs text-gray-400 mt-2">Track all admin actions, payment operations, and user authentication events</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminCRMDashboard;
