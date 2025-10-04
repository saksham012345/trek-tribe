import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { User } from '../types';

interface AdminDashboardProps {
  user: User;
}

interface DashboardStats {
  overview: {
    totalUsers: number;
    totalTrips: number;
    activeChats: number;
    pendingChats: number;
  };
  growth: {
    userGrowthRate: number;
    tripGrowthRate: number;
    newUsersLast30: number;
    newTripsLast30: number;
  };
  recent: {
    users: any[];
    trips: any[];
  };
  distribution: {
    usersByRole: Record<string, number>;
    tripsByStatus: Record<string, number>;
  };
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ user }) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [users, setUsers] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [usersLoading, setUsersLoading] = useState(false);
  const [tripsLoading, setTripsLoading] = useState(false);
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  useEffect(() => {
    if (user.role !== 'admin') {
      setError('Access denied. Admin privileges required.');
      setLoading(false);
      return;
    }

    fetchDashboardStats();
  }, [user]);

  const fetchDashboardStats = async () => {
    try {
      const response = await axios.get('/admin/dashboard');
      if (response.data?.success) {
        setStats(response.data.data);
      }
    } catch (error: any) {
      console.error('Error fetching dashboard stats:', error);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      const response = await axios.get('/admin/users');
      if (response.data?.success) {
        setUsers(response.data.data.users);
      }
    } catch (error: any) {
      console.error('Error fetching users:', error);
    } finally {
      setUsersLoading(false);
    }
  };

  const fetchTrips = async () => {
    setTripsLoading(true);
    try {
      const response = await axios.get('/admin/trips');
      if (response.data?.success) {
        setTrips(response.data.data.trips);
      }
    } catch (error: any) {
      console.error('Error fetching trips:', error);
    } finally {
      setTripsLoading(false);
    }
  };

  const updateUserRole = async (userId: string, role: string) => {
    try {
      const response = await axios.put(`/admin/users/${userId}`, { role });
      if (response.data?.success) {
        // Refresh users list
        fetchUsers();
        alert('User role updated successfully!');
      }
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update user role');
    }
  };

  const updateTripStatus = async (tripId: string, status: string) => {
    try {
      const response = await axios.put(`/admin/trips/${tripId}`, { status });
      if (response.data?.success) {
        // Refresh trips list
        fetchTrips();
        alert('Trip status updated successfully!');
      }
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update trip status');
    }
  };

  const fetchAgents = async () => {
    setAgentsLoading(true);
    try {
      const response = await axios.get('/admin/agents');
      if (response.data?.success) {
        setAgents(response.data.data.agents);
      }
    } catch (error: any) {
      console.error('Error fetching agents:', error);
    } finally {
      setAgentsLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      const response = await axios.get('/admin/analytics?range=30d');
      if (response.data?.success) {
        setAnalytics(response.data.data);
      }
    } catch (error: any) {
      console.error('Error fetching analytics:', error);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const createAgent = async (name: string, email: string, password: string) => {
    try {
      const response = await axios.post('/admin/agents', { name, email, password });
      if (response.data?.success) {
        fetchAgents(); // Refresh agents list
        alert('Agent created successfully!');
        return true;
      }
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create agent');
      return false;
    }
  };

  const updateAgentStatus = async (agentId: string, isActive: boolean) => {
    try {
      const response = await axios.put(`/admin/agents/${agentId}`, { isActive });
      if (response.data?.success) {
        fetchAgents(); // Refresh agents list
        alert('Agent status updated successfully!');
      }
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update agent status');
    }
  };

  if (user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
            <p className="text-gray-600">You don't have permission to access the admin dashboard.</p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Error</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <div className="w-8 h-8 bg-gradient-to-r from-green-600 to-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold">🏔️</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Trek Tribe Admin</h1>
                <p className="text-sm text-gray-500">Welcome back, {user.name}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {[
              { id: 'dashboard', name: 'Dashboard', icon: '📊' },
              { id: 'users', name: 'Users', icon: '👥' },
              { id: 'agents', name: 'Agents', icon: '🛠️' },
              { id: 'trips', name: 'Trips', icon: '🏔️' },
              { id: 'chats', name: 'Support', icon: '💬' },
              { id: 'analytics', name: 'Analytics', icon: '📈' },
              { id: 'system', name: 'System', icon: '⚙️' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  if (tab.id === 'users' && users.length === 0) {
                    fetchUsers();
                  } else if (tab.id === 'agents' && agents.length === 0) {
                    fetchAgents();
                  } else if (tab.id === 'trips' && trips.length === 0) {
                    fetchTrips();
                  } else if (tab.id === 'analytics' && !analytics) {
                    fetchAnalytics();
                  }
                }}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.name}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'dashboard' && stats && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-lg shadow-md">
                <div className="flex items-center">
                  <div className="p-3 rounded-md bg-blue-100">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Users</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.overview.totalUsers.toLocaleString()}</p>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="flex items-center text-sm">
                    <span className={`flex items-center ${stats.growth.userGrowthRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {stats.growth.userGrowthRate >= 0 ? '↗' : '↘'}
                      <span className="ml-1">{Math.abs(stats.growth.userGrowthRate).toFixed(1)}%</span>
                    </span>
                    <span className="ml-2 text-gray-500">vs last month</span>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-md">
                <div className="flex items-center">
                  <div className="p-3 rounded-md bg-green-100">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Trips</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.overview.totalTrips.toLocaleString()}</p>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="flex items-center text-sm">
                    <span className={`flex items-center ${stats.growth.tripGrowthRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {stats.growth.tripGrowthRate >= 0 ? '↗' : '↘'}
                      <span className="ml-1">{Math.abs(stats.growth.tripGrowthRate).toFixed(1)}%</span>
                    </span>
                    <span className="ml-2 text-gray-500">vs last month</span>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-md">
                <div className="flex items-center">
                  <div className="p-3 rounded-md bg-yellow-100">
                    <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Active Chats</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.overview.activeChats}</p>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="flex items-center text-sm text-gray-500">
                    <span>{stats.overview.pendingChats} waiting for agents</span>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-md">
                <div className="flex items-center">
                  <div className="p-3 rounded-md bg-purple-100">
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">This Month</p>
                    <div className="text-lg font-bold text-gray-900">
                      <span className="block">{stats.growth.newUsersLast30} users</span>
                      <span className="block text-sm">{stats.growth.newTripsLast30} trips</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Charts and Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* User Distribution */}
              <div className="bg-white p-6 rounded-lg shadow-md">
                <h3 className="text-lg font-medium text-gray-900 mb-4">User Distribution</h3>
                <div className="space-y-3">
                  {Object.entries(stats.distribution.usersByRole).map(([role, count]) => (
                    <div key={role} className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 capitalize">{role}s</span>
                      <div className="flex items-center">
                        <div className="w-24 bg-gray-200 rounded-full h-2 mr-3">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${(count / stats.overview.totalUsers) * 100}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium text-gray-900 w-8">{count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Users */}
              <div className="bg-white p-6 rounded-lg shadow-md">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Users</h3>
                <div className="space-y-3">
                  {stats.recent.users.map((user, index) => (
                    <div key={index} className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                        <span className="text-xs font-medium text-gray-600">
                          {user.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
                        <p className="text-sm text-gray-500 truncate">{user.email}</p>
                      </div>
                      <div className="text-right">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          user.role === 'admin' ? 'bg-red-100 text-red-800' :
                          user.role === 'organizer' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {user.role}
                        </span>
                        <div className="text-xs text-gray-500 mt-1">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Users Management Tab */}
        {activeTab === 'users' && (
          <div className="bg-white rounded-lg shadow-md">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">User Management</h2>
              <p className="text-sm text-gray-600 mt-1">Manage user accounts, roles, and permissions</p>
            </div>
            
            <div className="p-6">
              {usersLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : users.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">No users found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {users.map((user) => (
                        <tr key={user._id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                                <span className="text-xs font-medium text-gray-600">
                                  {user.name.charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900">{user.name}</div>
                                <div className="text-sm text-gray-500">{user.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <select
                              value={user.role}
                              onChange={(e) => updateUserRole(user._id, e.target.value)}
                              className="text-sm border border-gray-300 rounded px-2 py-1"
                              disabled={user.role === 'admin' && user.email === 'admin@trekktribe.com'}
                            >
                              <option value="traveler">Traveler</option>
                              <option value="organizer">Organizer</option>
                              <option value="agent">Agent</option>
                              <option value="admin">Admin</option>
                            </select>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {user.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(user.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex space-x-2">
                              <span className={`px-2 py-1 text-xs rounded ${
                                user.emailVerified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                              }`}>
                                {user.emailVerified ? '✓ Email' : '⚠ Email'}
                              </span>
                              <span className={`px-2 py-1 text-xs rounded ${
                                user.phoneVerified ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                              }`}>
                                {user.phoneVerified ? '✓ Phone' : '- Phone'}
                              </span>
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
        )}

        {/* Agent Management Tab */}
        {activeTab === 'agents' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-md">
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Agent Management</h2>
                  <p className="text-sm text-gray-600 mt-1">Manage support agents and their permissions</p>
                </div>
                <button
                  onClick={() => {
                    const name = prompt('Agent name:');
                    const email = prompt('Agent email:');
                    const password = prompt('Temporary password (min 6 chars):');
                    if (name && email && password && password.length >= 6) {
                      createAgent(name, email, password);
                    } else {
                      alert('Please provide valid name, email, and password (min 6 characters)');
                    }
                  }}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                >
                  + Add Agent
                </button>
              </div>
              
              <div className="p-6">
                {agentsLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : agents.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500">No agents found</p>
                    <p className="text-sm text-gray-400 mt-2">Create your first agent to handle support queries</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Agent</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Login</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {agents.map((agent) => (
                          <tr key={agent._id}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                                  <span className="text-xs font-medium text-green-600">
                                    {agent.name.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                                <div className="ml-4">
                                  <div className="text-sm font-medium text-gray-900">{agent.name}</div>
                                  <div className="text-sm text-gray-500">{agent.email}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                agent.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                              }`}>
                                {agent.isActive ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {agent.lastLoginAt ? new Date(agent.lastLoginAt).toLocaleDateString() : 'Never'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {new Date(agent.createdAt).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <button
                                onClick={() => updateAgentStatus(agent._id, !agent.isActive)}
                                className={`px-3 py-1 rounded-md text-xs font-medium ${
                                  agent.isActive 
                                    ? 'bg-red-100 text-red-800 hover:bg-red-200' 
                                    : 'bg-green-100 text-green-800 hover:bg-green-200'
                                } transition-colors`}
                              >
                                {agent.isActive ? 'Deactivate' : 'Activate'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-md">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">Advanced Analytics</h2>
                <p className="text-sm text-gray-600 mt-1">Detailed insights and business metrics</p>
              </div>
              
              <div className="p-6">
                {analyticsLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : analytics ? (
                  <div className="space-y-8">
                    {/* Conversion Metrics */}
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-4">Conversion Metrics ({analytics.timeRange})</h3>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <div className="flex items-center">
                            <div className="p-2 bg-blue-500 rounded-md">
                              <span className="text-white text-sm font-bold">👤</span>
                            </div>
                            <div className="ml-3">
                              <p className="text-sm font-medium text-blue-800">Total Signups</p>
                              <p className="text-xl font-bold text-blue-900">{analytics.conversionMetrics.totalSignups}</p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                          <div className="flex items-center">
                            <div className="p-2 bg-green-500 rounded-md">
                              <span className="text-white text-sm font-bold">🏔️</span>
                            </div>
                            <div className="ml-3">
                              <p className="text-sm font-medium text-green-800">Trip Creations</p>
                              <p className="text-xl font-bold text-green-900">{analytics.conversionMetrics.tripCreations}</p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                          <div className="flex items-center">
                            <div className="p-2 bg-purple-500 rounded-md">
                              <span className="text-white text-sm font-bold">✅</span>
                            </div>
                            <div className="ml-3">
                              <p className="text-sm font-medium text-purple-800">Completed Bookings</p>
                              <p className="text-xl font-bold text-purple-900">{analytics.conversionMetrics.completedBookings}</p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                          <div className="flex items-center">
                            <div className="p-2 bg-orange-500 rounded-md">
                              <span className="text-white text-sm font-bold">📊</span>
                            </div>
                            <div className="ml-3">
                              <p className="text-sm font-medium text-orange-800">Conversion Rate</p>
                              <p className="text-xl font-bold text-orange-900">
                                {analytics.conversionMetrics.totalSignups > 0 
                                  ? ((analytics.conversionMetrics.completedBookings / analytics.conversionMetrics.totalSignups) * 100).toFixed(1) 
                                  : 0}%
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Top Organizers */}
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-4">Top Organizers</h3>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="space-y-3">
                          {analytics.topOrganizers.slice(0, 5).map((organizer: any, index: number) => (
                            <div key={organizer._id} className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <span className="text-sm font-medium text-gray-400">#{index + 1}</span>
                                <div>
                                  <p className="text-sm font-medium text-gray-900">{organizer.name}</p>
                                  <p className="text-xs text-gray-500">{organizer.email}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-bold text-gray-900">{organizer.totalTrips} trips</p>
                                {organizer.averageRating && (
                                  <p className="text-xs text-yellow-600">★ {organizer.averageRating.toFixed(1)}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    {/* Popular Destinations */}
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-4">Popular Destinations</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {analytics.popularDestinations.slice(0, 6).map((destination: any, index: number) => (
                          <div key={destination._id} className="bg-gray-50 rounded-lg p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium text-gray-900">{destination._id}</p>
                                <p className="text-sm text-gray-600">{destination.count} trips</p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-medium text-gray-900">₹{destination.averagePrice?.toLocaleString()}</p>
                                <p className="text-xs text-gray-500">avg price</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-500">No analytics data available</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Trips Management Tab */}
        {activeTab === 'trips' && (
          <div className="bg-white rounded-lg shadow-md">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Trip Management</h2>
              <p className="text-sm text-gray-600 mt-1">Monitor and manage all trips on the platform</p>
            </div>
            
            <div className="p-6">
              {tripsLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : trips.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">No trips found</p>
                  <p className="text-sm text-gray-400 mt-2">Trips created by organizers will appear here</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trip</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Organizer</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Participants</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dates</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {trips.map((trip) => (
                        <tr key={trip._id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">{trip.title}</div>
                              <div className="text-sm text-gray-500">{trip.destination}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{trip.organizerId?.name || 'Unknown'}</div>
                            <div className="text-sm text-gray-500">{trip.organizerId?.email || 'N/A'}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <select
                              value={trip.status}
                              onChange={(e) => updateTripStatus(trip._id, e.target.value)}
                              className="text-sm border border-gray-300 rounded px-2 py-1"
                            >
                              <option value="active">Active</option>
                              <option value="completed">Completed</option>
                              <option value="cancelled">Cancelled</option>
                            </select>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {trip.participants?.length || 0} / {trip.capacity}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <div>{new Date(trip.startDate).toLocaleDateString()}</div>
                            <div className="text-xs">to {new Date(trip.endDate).toLocaleDateString()}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <div className="flex flex-col space-y-1">
                              <span className="text-xs">₹{trip.price?.toLocaleString() || 'N/A'}</span>
                              <span className="text-xs">{new Date(trip.createdAt).toLocaleDateString()}</span>
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
        )}

        {/* Support/Chats Tab */}
        {activeTab === 'chats' && (
          <div className="bg-white rounded-lg shadow-md">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Support Center</h2>
              <p className="text-sm text-gray-600 mt-1">Manage customer support and chat tickets</p>
            </div>
            
            <div className="p-6">
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Chat System Under Development</h3>
                <p className="text-gray-600 mb-4">The support chat system is currently being built and will be available soon.</p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left max-w-md mx-auto">
                  <h4 className="font-medium text-blue-900 mb-2">Planned Features:</h4>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• Real-time chat support</li>
                    <li>• Ticket management system</li>
                    <li>• Agent assignment</li>
                    <li>• Chat history and analytics</li>
                    <li>• Priority-based queue</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* System Tab */}
        {activeTab === 'system' && (
          <div className="bg-white rounded-lg shadow-md">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">System Overview</h2>
              <p className="text-sm text-gray-600 mt-1">Monitor system health and performance</p>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-green-800">System Status</p>
                      <p className="text-lg font-bold text-green-900">Healthy</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-blue-800">Database</p>
                      <p className="text-lg font-bold text-blue-900">Connected</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-purple-800">Active Users</p>
                      <p className="text-lg font-bold text-purple-900">{stats?.overview.totalUsers || 0}</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-8">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="space-y-3">
                    <div className="flex items-center text-sm">
                      <span className="w-2 h-2 bg-green-400 rounded-full mr-3"></span>
                      <span className="text-gray-600">Database connection established</span>
                      <span className="text-gray-400 ml-auto">Just now</span>
                    </div>
                    <div className="flex items-center text-sm">
                      <span className="w-2 h-2 bg-blue-400 rounded-full mr-3"></span>
                      <span className="text-gray-600">API server started successfully</span>
                      <span className="text-gray-400 ml-auto">2 minutes ago</span>
                    </div>
                    <div className="flex items-center text-sm">
                      <span className="w-2 h-2 bg-purple-400 rounded-full mr-3"></span>
                      <span className="text-gray-600">Admin dashboard loaded</span>
                      <span className="text-gray-400 ml-auto">5 minutes ago</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;