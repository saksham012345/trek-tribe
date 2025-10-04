import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { User } from '../types';

interface AgentDashboardProps {
  user: User;
}

interface AgentStats {
  overview: {
    pendingQueries: number;
    myAssignedQueries: number;
    activeSosAlerts: number;
    pendingDisputes: number;
    myAssignedDisputes: number;
    activeFraudReports: number;
    tripsAwaitingApproval: number;
  };
  recentActivity: {
    queries: any[];
    sosAlerts: any[];
  };
  workload: {
    totalAssigned: number;
    urgentItems: number;
  };
}

const AgentDashboard: React.FC<AgentDashboardProps> = ({ user }) => {
  const [stats, setStats] = useState<AgentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [queries, setQueries] = useState<any[]>([]);
  const [pendingTrips, setPendingTrips] = useState<any[]>([]);
  const [sosAlerts, setSosAlerts] = useState<any[]>([]);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [fraudReports, setFraudReports] = useState<any[]>([]);

  useEffect(() => {
    if (user.role !== 'agent' && user.role !== 'admin') {
      setError('Access denied. Agent privileges required.');
      setLoading(false);
      return;
    }

    fetchAgentStats();
  }, [user]);

  const fetchAgentStats = async () => {
    try {
      const response = await axios.get('/agent/dashboard');
      if (response.data?.success) {
        setStats(response.data.data);
      }
    } catch (error: any) {
      console.error('Error fetching agent stats:', error);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const fetchQueries = async (filter: string = 'unassigned') => {
    try {
      const response = await axios.get(`/agent/queries?assigned=${filter}&limit=50`);
      if (response.data?.success) {
        setQueries(response.data.data.queries);
      }
    } catch (error: any) {
      console.error('Error fetching queries:', error);
    }
  };

  const fetchPendingTrips = async () => {
    try {
      const response = await axios.get('/agent/trips/pending');
      if (response.data?.success) {
        setPendingTrips(response.data.data.trips);
      }
    } catch (error: any) {
      console.error('Error fetching pending trips:', error);
    }
  };

  const fetchSosAlerts = async (filter: string = 'unassigned') => {
    try {
      const response = await axios.get(`/agent/sos-alerts?assigned=${filter}`);
      if (response.data?.success) {
        setSosAlerts(response.data.data.alerts);
      }
    } catch (error: any) {
      console.error('Error fetching SOS alerts:', error);
    }
  };

  const assignQueryToSelf = async (queryId: string) => {
    try {
      await axios.put(`/agent/queries/${queryId}/assign`);
      fetchQueries(); // Refresh the list
      fetchAgentStats(); // Update stats
      alert('Query assigned successfully!');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to assign query');
    }
  };

  const acknowledgeAlert = async (alertId: string) => {
    try {
      await axios.put(`/agent/sos-alerts/${alertId}/acknowledge`);
      fetchSosAlerts(); // Refresh the list
      fetchAgentStats(); // Update stats
      alert('SOS alert acknowledged successfully!');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to acknowledge alert');
    }
  };

  const moderateTrip = async (tripId: string, action: 'approve' | 'reject', reason?: string) => {
    try {
      await axios.put(`/agent/trips/${tripId}/moderate`, { action, reason });
      fetchPendingTrips(); // Refresh the list
      fetchAgentStats(); // Update stats
      alert(`Trip ${action === 'approve' ? 'approved' : 'rejected'} successfully!`);
    } catch (error: any) {
      alert(error.response?.data?.error || `Failed to ${action} trip`);
    }
  };

  if (user.role !== 'agent' && user.role !== 'admin') {
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
            <p className="text-gray-600">You don't have permission to access the agent dashboard.</p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-green-600"></div>
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
              className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors"
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
                <span className="text-white font-bold">🛠️</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Agent Portal</h1>
                <p className="text-sm text-gray-500">Welcome, Agent {user.name}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-sm text-gray-600">Online</span>
              </div>
              <a 
                href="/agent/chat" 
                className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
              >
                💬 Chat Dashboard
              </a>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Agent
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
              { id: 'queries', name: 'Support Queries', icon: '💬', badge: stats?.overview.pendingQueries },
              { id: 'trips', name: 'Trip Moderation', icon: '🏔️', badge: stats?.overview.tripsAwaitingApproval },
              { id: 'sos', name: 'SOS Alerts', icon: '🚨', badge: stats?.overview.activeSosAlerts },
              { id: 'disputes', name: 'Disputes', icon: '⚖️', badge: stats?.overview.pendingDisputes },
              { id: 'fraud', name: 'Fraud Reports', icon: '🛡️', badge: stats?.overview.activeFraudReports }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  if (tab.id === 'queries') fetchQueries();
                  else if (tab.id === 'trips') fetchPendingTrips();
                  else if (tab.id === 'sos') fetchSosAlerts();
                }}
                className={`py-4 px-1 border-b-2 font-medium text-sm relative ${
                  activeTab === tab.id
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.name}
                {tab.badge && tab.badge > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full text-xs w-5 h-5 flex items-center justify-center">
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'dashboard' && stats && (
          <div className="space-y-6">
            {/* Workload Summary */}
            <div className="bg-gradient-to-r from-green-500 to-blue-600 rounded-lg p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">My Workload</h2>
                  <p className="text-green-100">Current assigned tasks and priorities</p>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold">{stats.workload.totalAssigned}</div>
                  <div className="text-sm text-green-100">Total Assigned</div>
                </div>
              </div>
              <div className="mt-4 flex items-center space-x-6">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-red-400 rounded-full mr-2"></div>
                  <span className="text-sm">{stats.workload.urgentItems} Urgent Items</span>
                </div>
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-blue-500">
                <div className="flex items-center">
                  <div className="p-3 rounded-md bg-blue-100">
                    <span className="text-2xl">💬</span>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Pending Queries</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.overview.pendingQueries}</p>
                  </div>
                </div>
                <div className="mt-2">
                  <p className="text-xs text-gray-500">My assigned: {stats.overview.myAssignedQueries}</p>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-red-500">
                <div className="flex items-center">
                  <div className="p-3 rounded-md bg-red-100">
                    <span className="text-2xl">🚨</span>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">SOS Alerts</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.overview.activeSosAlerts}</p>
                  </div>
                </div>
                <div className="mt-2">
                  <p className="text-xs text-red-600">Requires immediate attention</p>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-yellow-500">
                <div className="flex items-center">
                  <div className="p-3 rounded-md bg-yellow-100">
                    <span className="text-2xl">🏔️</span>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Trip Approvals</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.overview.tripsAwaitingApproval}</p>
                  </div>
                </div>
                <div className="mt-2">
                  <p className="text-xs text-gray-500">Waiting for moderation</p>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-purple-500">
                <div className="flex items-center">
                  <div className="p-3 rounded-md bg-purple-100">
                    <span className="text-2xl">⚖️</span>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Disputes</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.overview.pendingDisputes}</p>
                  </div>
                </div>
                <div className="mt-2">
                  <p className="text-xs text-gray-500">My assigned: {stats.overview.myAssignedDisputes}</p>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Queries */}
              <div className="bg-white p-6 rounded-lg shadow-md">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Queries</h3>
                <div className="space-y-3">
                  {stats.recentActivity.queries.length > 0 ? (
                    stats.recentActivity.queries.map((query, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{query.subject}</p>
                          <div className="flex items-center space-x-2 mt-1">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              query.priority === 'urgent' ? 'bg-red-100 text-red-800' :
                              query.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                              'bg-blue-100 text-blue-800'
                            }`}>
                              {query.priority}
                            </span>
                            <span className="text-xs text-gray-500">{query.category}</span>
                          </div>
                        </div>
                        <div className={`w-3 h-3 rounded-full ${
                          query.status === 'resolved' ? 'bg-green-400' :
                          query.status === 'in_progress' ? 'bg-yellow-400' :
                          'bg-gray-300'
                        }`}></div>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-center py-4">No recent queries</p>
                  )}
                </div>
              </div>

              {/* Recent SOS Alerts */}
              <div className="bg-white p-6 rounded-lg shadow-md">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Recent SOS Alerts</h3>
                <div className="space-y-3">
                  {stats.recentActivity.sosAlerts.length > 0 ? (
                    stats.recentActivity.sosAlerts.map((alert, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-red-50 rounded-md">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{alert.type.replace('_', ' ').toUpperCase()}</p>
                          <p className="text-xs text-gray-600">{alert.message}</p>
                          <div className="flex items-center space-x-2 mt-1">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              alert.priority === 'critical' ? 'bg-red-100 text-red-800' :
                              alert.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                              {alert.priority}
                            </span>
                          </div>
                        </div>
                        <div className={`w-3 h-3 rounded-full ${
                          alert.status === 'resolved' ? 'bg-green-400' :
                          alert.status === 'acknowledged' ? 'bg-yellow-400' :
                          'bg-red-400 animate-pulse'
                        }`}></div>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-center py-4">No recent SOS alerts</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Support Queries Tab */}
        {activeTab === 'queries' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-md">
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Support Queries</h2>
                  <p className="text-sm text-gray-600 mt-1">Manage and respond to user support queries</p>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => fetchQueries('unassigned')}
                    className="px-4 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
                  >
                    Unassigned
                  </button>
                  <button
                    onClick={() => fetchQueries('me')}
                    className="px-4 py-2 bg-green-100 text-green-700 rounded-md hover:bg-green-200 transition-colors"
                  >
                    My Queries
                  </button>
                  <button
                    onClick={() => fetchQueries('all')}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                  >
                    All Queries
                  </button>
                </div>
              </div>
              
              <div className="p-6">
                <div className="space-y-4">
                  {queries.map((query) => (
                    <div key={query._id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h3 className="text-lg font-medium text-gray-900">{query.subject}</h3>
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              query.priority === 'urgent' ? 'bg-red-100 text-red-800' :
                              query.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                              query.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {query.priority.toUpperCase()}
                            </span>
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {query.category}
                            </span>
                          </div>
                          <p className="text-gray-600 mb-2">{query.description}</p>
                          <div className="flex items-center space-x-4 text-sm text-gray-500">
                            <span>👤 {query.userId?.name || 'Unknown User'}</span>
                            <span>📧 {query.userId?.email}</span>
                            <span>📅 {new Date(query.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <div className="ml-4 flex flex-col space-y-2">
                          {!query.assignedAgentId && (
                            <button
                              onClick={() => assignQueryToSelf(query._id)}
                              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm"
                            >
                              Assign to Me
                            </button>
                          )}
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            query.status === 'resolved' ? 'bg-green-100 text-green-800' :
                            query.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                            query.status === 'assigned' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {query.status.replace('_', ' ').toUpperCase()}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {queries.length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-gray-500">No queries found</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Trip Moderation Tab */}
        {activeTab === 'trips' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-md">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">Trip Moderation</h2>
                <p className="text-sm text-gray-600 mt-1">Review and approve/reject trip listings</p>
              </div>
              
              <div className="p-6">
                <div className="space-y-6">
                  {pendingTrips.map((trip) => (
                    <div key={trip._id} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                      <div className="flex justify-between">
                        <div className="flex-1">
                          <h3 className="text-xl font-semibold text-gray-900 mb-2">{trip.title}</h3>
                          <p className="text-gray-600 mb-4">{trip.description}</p>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="font-medium text-gray-700">Destination:</span>
                              <p className="text-gray-600">{trip.destination}</p>
                            </div>
                            <div>
                              <span className="font-medium text-gray-700">Price:</span>
                              <p className="text-gray-600">₹{trip.price?.toLocaleString()}</p>
                            </div>
                            <div>
                              <span className="font-medium text-gray-700">Duration:</span>
                              <p className="text-gray-600">{trip.duration} days</p>
                            </div>
                            <div>
                              <span className="font-medium text-gray-700">Capacity:</span>
                              <p className="text-gray-600">{trip.capacity} people</p>
                            </div>
                          </div>
                          <div className="mt-4">
                            <span className="font-medium text-gray-700">Organizer:</span>
                            <p className="text-gray-600">{trip.organizerId?.name} ({trip.organizerId?.email})</p>
                          </div>
                        </div>
                        <div className="ml-6 flex flex-col space-y-2">
                          <button
                            onClick={() => moderateTrip(trip._id, 'approve')}
                            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                          >
                            ✅ Approve
                          </button>
                          <button
                            onClick={() => {
                              const reason = prompt('Reason for rejection (optional):');
                              moderateTrip(trip._id, 'reject', reason || undefined);
                            }}
                            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                          >
                            ❌ Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {pendingTrips.length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-gray-500">No trips pending approval</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SOS Alerts Tab */}
        {activeTab === 'sos' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-md">
              <div className="px-6 py-4 border-b border-gray-200 bg-red-50">
                <h2 className="text-xl font-semibold text-red-900">🚨 Emergency SOS Alerts</h2>
                <p className="text-sm text-red-600 mt-1">Critical alerts requiring immediate attention</p>
              </div>
              
              <div className="p-6">
                <div className="space-y-4">
                  {sosAlerts.map((alert) => (
                    <div key={alert._id} className={`border-2 rounded-lg p-4 ${
                      alert.priority === 'critical' ? 'border-red-500 bg-red-50' :
                      alert.priority === 'high' ? 'border-orange-500 bg-orange-50' :
                      'border-yellow-500 bg-yellow-50'
                    }`}>
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h3 className="text-lg font-semibold text-gray-900">{alert.type.replace('_', ' ').toUpperCase()}</h3>
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              alert.priority === 'critical' ? 'bg-red-100 text-red-800' :
                              alert.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                              {alert.priority.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-gray-700 mb-3">{alert.message}</p>
                          <div className="flex items-center space-x-4 text-sm text-gray-600">
                            <span>👤 {alert.userId?.name}</span>
                            <span>📞 {alert.userId?.phone}</span>
                            <span>📅 {new Date(alert.createdAt).toLocaleString()}</span>
                          </div>
                          {alert.location && (
                            <div className="mt-2 text-sm text-gray-600">
                              📍 Location: {alert.location.address || `${alert.location.coordinates[1]}, ${alert.location.coordinates[0]}`}
                            </div>
                          )}
                        </div>
                        <div className="ml-4 flex flex-col space-y-2">
                          {!alert.assignedAgentId && (
                            <button
                              onClick={() => acknowledgeAlert(alert._id)}
                              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm"
                            >
                              🚨 Acknowledge
                            </button>
                          )}
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            alert.status === 'resolved' ? 'bg-green-100 text-green-800' :
                            alert.status === 'acknowledged' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {alert.status.toUpperCase()}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {sosAlerts.length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-gray-500">No active SOS alerts</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Other tabs can be implemented similarly */}
        {activeTab === 'disputes' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Dispute Resolution</h2>
            <p className="text-gray-600">Feature coming soon...</p>
          </div>
        )}

        {activeTab === 'fraud' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Fraud Reports</h2>
            <p className="text-gray-600">Feature coming soon...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AgentDashboard;