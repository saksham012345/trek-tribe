import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { User } from '../types';

interface AdminStats {
  totalUsers: number;
  totalTrips: number;
  activeAgents: number;
  totalRevenue: number;
  pendingReports: number;
  systemAlerts: number;
  monthlyGrowth: {
    users: number;
    trips: number;
    revenue: number;
  };
}

interface SystemAlert {
  id: string;
  type: 'warning' | 'error' | 'info';
  message: string;
  timestamp: string;
  resolved: boolean;
}

interface RecentActivity {
  id: string;
  type: 'user_registration' | 'trip_created' | 'booking' | 'report' | 'agent_action';
  description: string;
  timestamp: string;
  userId?: string;
  severity?: 'low' | 'medium' | 'high';
}

interface AdminProfileProps {
  user: User;
}

const AdminProfile: React.FC<AdminProfileProps> = ({ user }) => {
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    totalTrips: 0,
    activeAgents: 0,
    totalRevenue: 0,
    pendingReports: 0,
    systemAlerts: 0,
    monthlyGrowth: { users: 0, trips: 0, revenue: 0 }
  });
  
  const [systemAlerts, setSystemAlerts] = useState<SystemAlert[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAdminData = async () => {
      try {
        // Fetch admin statistics
        const statsResponse = await axios.get('/admin/statistics', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        
        // Fetch system alerts
        const alertsResponse = await axios.get('/admin/alerts', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        
        // Fetch recent activity
        const activityResponse = await axios.get('/admin/recent-activity', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });

        if (statsResponse.data.success) {
          setStats(statsResponse.data.data);
        }
        
        if (alertsResponse.data.success) {
          setSystemAlerts(alertsResponse.data.alerts);
        }
        
        if (activityResponse.data.success) {
          setRecentActivity(activityResponse.data.activities);
        }
      } catch (error) {
        console.error('Error fetching admin data:', error);
        // Set mock data for development
        setStats({
          totalUsers: 1247,
          totalTrips: 89,
          activeAgents: 12,
          totalRevenue: 156789,
          pendingReports: 5,
          systemAlerts: 2,
          monthlyGrowth: { users: 23, trips: 8, revenue: 15 }
        });
        
        setSystemAlerts([
          {
            id: '1',
            type: 'warning',
            message: 'Server response time above threshold',
            timestamp: new Date().toISOString(),
            resolved: false
          },
          {
            id: '2',
            type: 'info',
            message: 'Scheduled maintenance in 24 hours',
            timestamp: new Date().toISOString(),
            resolved: false
          }
        ]);
        
        setRecentActivity([
          {
            id: '1',
            type: 'user_registration',
            description: 'New user registered: john@example.com',
            timestamp: new Date().toISOString(),
            severity: 'low'
          },
          {
            id: '2',
            type: 'trip_created',
            description: 'New trip created: Himalayan Adventure',
            timestamp: new Date().toISOString(),
            severity: 'medium'
          }
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchAdminData();
  }, []);

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'error': return '🚨';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      default: return '📋';
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'user_registration': return '👤';
      case 'trip_created': return '🏔️';
      case 'booking': return '🎯';
      case 'report': return '📋';
      case 'agent_action': return '🛡️';
      default: return '📊';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-forest-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-forest-200 border-t-forest-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-forest-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-forest-800 to-nature-800 rounded-2xl shadow-xl p-8 text-white mb-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-nature-500 rounded-full flex items-center justify-center">
                  <span className="text-2xl">👑</span>
                </div>
                <div>
                  <h1 className="text-3xl font-bold">Administrator Dashboard</h1>
                  <p className="text-forest-100">Welcome back, {user.name}</p>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-forest-200 mb-1">Last Login</div>
              <div className="text-lg font-medium">{new Date().toLocaleDateString()}</div>
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid lg:grid-cols-4 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Users</p>
                <p className="text-3xl font-bold text-gray-900">{stats.totalUsers.toLocaleString()}</p>
                <p className="text-sm text-green-600 flex items-center gap-1">
                  <span>📈</span> +{stats.monthlyGrowth.users}% this month
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <span className="text-2xl">👥</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Trips</p>
                <p className="text-3xl font-bold text-gray-900">{stats.totalTrips}</p>
                <p className="text-sm text-green-600 flex items-center gap-1">
                  <span>📈</span> +{stats.monthlyGrowth.trips} this month
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <span className="text-2xl">🏔️</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-purple-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Revenue</p>
                <p className="text-3xl font-bold text-gray-900">{formatCurrency(stats.totalRevenue)}</p>
                <p className="text-sm text-green-600 flex items-center gap-1">
                  <span>📈</span> +{stats.monthlyGrowth.revenue}% this month
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <span className="text-2xl">💰</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-orange-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Agents</p>
                <p className="text-3xl font-bold text-gray-900">{stats.activeAgents}</p>
                <p className="text-sm text-blue-600">Online and available</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <span className="text-2xl">🛡️</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8 mb-8">
          {/* Quick Actions */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <span>⚡</span> Quick Actions
            </h2>
            <div className="space-y-3">
              <Link
                to="/admin"
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-forest-50 transition-colors group"
              >
                <div className="w-10 h-10 bg-forest-100 rounded-lg flex items-center justify-center group-hover:bg-forest-200">
                  <span className="text-lg">📊</span>
                </div>
                <div>
                  <p className="font-medium text-gray-900">Full Dashboard</p>
                  <p className="text-sm text-gray-500">Complete admin panel</p>
                </div>
              </Link>

              <Link
                to="/admin/users"
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-nature-50 transition-colors group"
              >
                <div className="w-10 h-10 bg-nature-100 rounded-lg flex items-center justify-center group-hover:bg-nature-200">
                  <span className="text-lg">👥</span>
                </div>
                <div>
                  <p className="font-medium text-gray-900">Manage Users</p>
                  <p className="text-sm text-gray-500">User accounts & roles</p>
                </div>
              </Link>

              <Link
                to="/admin/reports"
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-earth-50 transition-colors group"
              >
                <div className="w-10 h-10 bg-earth-100 rounded-lg flex items-center justify-center group-hover:bg-earth-200">
                  <span className="text-lg">📋</span>
                </div>
                <div>
                  <p className="font-medium text-gray-900">Review Reports</p>
                  <p className="text-sm text-gray-500">{stats.pendingReports} pending</p>
                </div>
              </Link>

              <Link
                to="/admin/settings"
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors group"
              >
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center group-hover:bg-gray-200">
                  <span className="text-lg">⚙️</span>
                </div>
                <div>
                  <p className="font-medium text-gray-900">System Settings</p>
                  <p className="text-sm text-gray-500">Configuration & preferences</p>
                </div>
              </Link>
            </div>
          </div>

          {/* System Alerts */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <span>🚨</span> System Alerts
            </h2>
            <div className="space-y-3">
              {systemAlerts.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <span className="text-4xl mb-2 block">✅</span>
                  <p>All systems operational</p>
                </div>
              ) : (
                systemAlerts.slice(0, 4).map((alert) => (
                  <div key={alert.id} className={`p-3 rounded-lg border-l-4 ${
                    alert.type === 'error' ? 'bg-red-50 border-red-400' :
                    alert.type === 'warning' ? 'bg-yellow-50 border-yellow-400' :
                    'bg-blue-50 border-blue-400'
                  }`}>
                    <div className="flex items-start gap-3">
                      <span className="text-lg">{getAlertIcon(alert.type)}</span>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 text-sm">{alert.message}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(alert.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <span>📈</span> Recent Activity
            </h2>
            <div className="space-y-3">
              {recentActivity.slice(0, 5).map((activity) => (
                <div key={activity.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50">
                  <span className="text-lg">{getActivityIcon(activity.type)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {activity.description}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(activity.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Account Information */}
        <div className="grid lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <span>👤</span> Account Information
            </h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-3 border-b border-gray-100">
                <span className="text-gray-600">Full Name</span>
                <span className="font-medium text-gray-900">{user.name}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-gray-100">
                <span className="text-gray-600">Email Address</span>
                <span className="font-medium text-gray-900">{user.email}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-gray-100">
                <span className="text-gray-600">Role</span>
                <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
                  Administrator
                </span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-gray-100">
                <span className="text-gray-600">Access Level</span>
                <span className="font-medium text-gray-900">Full System Access</span>
              </div>
              <div className="flex justify-between items-center py-3">
                <span className="text-gray-600">Account Status</span>
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                  Active
                </span>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-100">
              <div className="flex gap-3">
                <Link
                  to="/data-management"
                  className="flex-1 bg-forest-600 hover:bg-forest-700 text-white py-2 px-4 rounded-lg font-medium text-center transition-colors"
                >
                  Privacy Settings
                </Link>
                <Link
                  to="/cookie-settings"
                  className="flex-1 bg-nature-600 hover:bg-nature-700 text-white py-2 px-4 rounded-lg font-medium text-center transition-colors"
                >
                  Cookie Settings
                </Link>
              </div>
            </div>
          </div>

          {/* System Health */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <span>💚</span> System Health
            </h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-3 border-b border-gray-100">
                <span className="text-gray-600">Server Status</span>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-green-600 font-medium">Operational</span>
                </div>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-gray-100">
                <span className="text-gray-600">Database</span>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-green-600 font-medium">Healthy</span>
                </div>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-gray-100">
                <span className="text-gray-600">Payment Gateway</span>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-green-600 font-medium">Connected</span>
                </div>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-gray-100">
                <span className="text-gray-600">Email Service</span>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  <span className="text-yellow-600 font-medium">Degraded</span>
                </div>
              </div>
              <div className="flex justify-between items-center py-3">
                <span className="text-gray-600">Backup System</span>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-green-600 font-medium">Active</span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-100">
              <Link
                to="/admin/system-health"
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 py-2 px-4 rounded-lg font-medium text-center transition-colors block"
              >
                View Detailed Diagnostics
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminProfile;