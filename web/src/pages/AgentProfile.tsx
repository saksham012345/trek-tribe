import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { User } from '../types';

interface AgentStats {
  totalChats: number;
  activeChats: number;
  resolvedTickets: number;
  averageResponseTime: number;
  customerSatisfaction: number;
  hoursWorked: number;
  performance: {
    rating: number;
    responseTime: 'Excellent' | 'Good' | 'Average' | 'Needs Improvement';
    resolution: 'Excellent' | 'Good' | 'Average' | 'Needs Improvement';
  };
}

interface ChatSession {
  id: string;
  userId: string;
  userName: string;
  status: 'active' | 'waiting' | 'resolved';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  subject: string;
  lastMessage: string;
  startTime: string;
  waitTime?: number;
}

interface Notification {
  id: string;
  type: 'chat_request' | 'priority_escalation' | 'system_alert' | 'performance_update';
  message: string;
  timestamp: string;
  read: boolean;
  urgent: boolean;
}

interface AgentProfileProps {
  user: User;
}

const AgentProfile: React.FC<AgentProfileProps> = ({ user }) => {
  const [stats, setStats] = useState<AgentStats>({
    totalChats: 0,
    activeChats: 0,
    resolvedTickets: 0,
    averageResponseTime: 0,
    customerSatisfaction: 0,
    hoursWorked: 0,
    performance: {
      rating: 0,
      responseTime: 'Average',
      resolution: 'Average'
    }
  });
  
  const [activeChatSessions, setActiveChatSessions] = useState<ChatSession[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [agentStatus, setAgentStatus] = useState<'online' | 'busy' | 'away' | 'offline'>('online');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAgentData = async () => {
      try {
        // Fetch agent statistics
        const statsResponse = await axios.get('/agent/statistics', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        
        // Fetch active chat sessions
        const chatsResponse = await axios.get('/agent/active-chats', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        
        // Fetch notifications
        const notificationsResponse = await axios.get('/agent/notifications', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });

        if (statsResponse.data.success) {
          setStats(statsResponse.data.data);
        }
        
        if (chatsResponse.data.success) {
          setActiveChatSessions(chatsResponse.data.chats);
        }
        
        if (notificationsResponse.data.success) {
          setNotifications(notificationsResponse.data.notifications);
        }
      } catch (error) {
        console.error('Error fetching agent data:', error);
        // Set mock data for development
        setStats({
          totalChats: 156,
          activeChats: 3,
          resolvedTickets: 142,
          averageResponseTime: 2.5,
          customerSatisfaction: 4.7,
          hoursWorked: 38.5,
          performance: {
            rating: 4.8,
            responseTime: 'Excellent',
            resolution: 'Good'
          }
        });
        
        setActiveChatSessions([
          {
            id: '1',
            userId: 'user123',
            userName: 'Sarah Johnson',
            status: 'active',
            priority: 'medium',
            subject: 'Trip booking assistance',
            lastMessage: 'Can you help me with the payment process?',
            startTime: new Date(Date.now() - 300000).toISOString()
          },
          {
            id: '2',
            userId: 'user456',
            userName: 'Mike Chen',
            status: 'waiting',
            priority: 'high',
            subject: 'Emergency cancellation',
            lastMessage: 'I need to cancel my trip urgently',
            startTime: new Date(Date.now() - 120000).toISOString(),
            waitTime: 2
          }
        ]);
        
        setNotifications([
          {
            id: '1',
            type: 'chat_request',
            message: 'New chat request from premium user',
            timestamp: new Date().toISOString(),
            read: false,
            urgent: true
          },
          {
            id: '2',
            type: 'performance_update',
            message: 'Monthly performance report available',
            timestamp: new Date().toISOString(),
            read: false,
            urgent: false
          }
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchAgentData();
  }, []);

  const handleStatusChange = async (newStatus: typeof agentStatus) => {
    try {
      await axios.post('/agent/status', { status: newStatus }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setAgentStatus(newStatus);
    } catch (error) {
      console.error('Error updating agent status:', error);
      setAgentStatus(newStatus); // Update locally for demo
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'busy': return 'bg-red-500';
      case 'away': return 'bg-yellow-500';
      case 'offline': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const formatTime = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes.toFixed(1)}m`;
    }
    return `${(minutes / 60).toFixed(1)}h`;
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
        <div className="bg-gradient-to-r from-blue-700 to-indigo-700 rounded-2xl shadow-xl p-8 text-white mb-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-2xl">🛡️</span>
                </div>
                <div>
                  <h1 className="text-3xl font-bold">Support Agent Dashboard</h1>
                  <p className="text-blue-100">Welcome back, {user.name}</p>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-blue-200 mb-2">Current Status</div>
              <div className="flex items-center justify-end gap-2">
                <div className={`w-3 h-3 ${getStatusColor(agentStatus)} rounded-full`}></div>
                <select
                  value={agentStatus}
                  onChange={(e) => handleStatusChange(e.target.value as typeof agentStatus)}
                  className="bg-white/20 text-white rounded-lg px-3 py-1 text-sm border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50"
                >
                  <option value="online" className="text-gray-900">Online</option>
                  <option value="busy" className="text-gray-900">Busy</option>
                  <option value="away" className="text-gray-900">Away</option>
                  <option value="offline" className="text-gray-900">Offline</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="grid lg:grid-cols-4 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Chats</p>
                <p className="text-3xl font-bold text-gray-900">{stats.totalChats}</p>
                <p className="text-sm text-blue-600">This month</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <span className="text-2xl">💬</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Chats</p>
                <p className="text-3xl font-bold text-gray-900">{stats.activeChats}</p>
                <p className="text-sm text-green-600">Currently handling</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <span className="text-2xl">⚡</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-purple-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Response</p>
                <p className="text-3xl font-bold text-gray-900">{formatTime(stats.averageResponseTime)}</p>
                <p className="text-sm text-purple-600">{stats.performance.responseTime}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <span className="text-2xl">⏱️</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-yellow-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Satisfaction</p>
                <p className="text-3xl font-bold text-gray-900">{stats.customerSatisfaction.toFixed(1)}/5</p>
                <div className="flex text-yellow-400">
                  {[...Array(5)].map((_, i) => (
                    <span key={i} className={i < Math.floor(stats.customerSatisfaction) ? '' : 'opacity-30'}>
                      ⭐
                    </span>
                  ))}
                </div>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <span className="text-2xl">😊</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8 mb-8">
          {/* Active Chat Sessions */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <span>💬</span> Active Chat Sessions
              </h2>
              <Link
                to="/agent/chat"
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Open Chat Dashboard
              </Link>
            </div>
            
            <div className="space-y-4">
              {activeChatSessions.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <span className="text-4xl mb-4 block">💤</span>
                  <p className="text-lg font-medium">No active chats</p>
                  <p>You're all caught up! New chats will appear here.</p>
                </div>
              ) : (
                activeChatSessions.map((chat) => (
                  <div key={chat.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-blue-600">
                            {chat.userName.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{chat.userName}</p>
                          <p className="text-sm text-gray-500">{chat.subject}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(chat.priority)}`}>
                          {chat.priority}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          chat.status === 'active' ? 'bg-green-100 text-green-800' :
                          chat.status === 'waiting' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {chat.status}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">"{chat.lastMessage}"</p>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>Started: {new Date(chat.startTime).toLocaleTimeString()}</span>
                      {chat.waitTime && (
                        <span className="text-orange-600">Waiting: {chat.waitTime}m</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Notifications & Quick Actions */}
          <div className="space-y-6">
            {/* Notifications */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <span>🔔</span> Notifications
                {notifications.filter(n => !n.read).length > 0 && (
                  <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                    {notifications.filter(n => !n.read).length}
                  </span>
                )}
              </h2>
              <div className="space-y-3">
                {notifications.slice(0, 4).map((notification) => (
                  <div key={notification.id} className={`p-3 rounded-lg border-l-4 ${
                    notification.urgent ? 'bg-red-50 border-red-400' : 'bg-blue-50 border-blue-400'
                  } ${!notification.read ? 'font-medium' : 'opacity-75'}`}>
                    <p className="text-sm text-gray-900">{notification.message}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(notification.timestamp).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <span>⚡</span> Quick Actions
              </h2>
              <div className="space-y-3">
                <Link
                  to="/agent/chat"
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-blue-50 transition-colors group w-full text-left"
                >
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200">
                    <span className="text-lg">💬</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Live Chat</p>
                    <p className="text-sm text-gray-500">Handle customer inquiries</p>
                  </div>
                </Link>

                <Link
                  to="/agent/knowledge-base"
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-green-50 transition-colors group w-full text-left"
                >
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-200">
                    <span className="text-lg">📚</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Knowledge Base</p>
                    <p className="text-sm text-gray-500">Access help articles</p>
                  </div>
                </Link>

                <Link
                  to="/agent/reports"
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-purple-50 transition-colors group w-full text-left"
                >
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center group-hover:bg-purple-200">
                    <span className="text-lg">📊</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">My Reports</p>
                    <p className="text-sm text-gray-500">View performance metrics</p>
                  </div>
                </Link>

                <Link
                  to="/agent/escalations"
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-orange-50 transition-colors group w-full text-left"
                >
                  <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center group-hover:bg-orange-200">
                    <span className="text-lg">🚨</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Escalations</p>
                    <p className="text-sm text-gray-500">Handle complex issues</p>
                  </div>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Account & Performance */}
        <div className="grid lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <span>👤</span> Agent Information
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
                <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                  Support Agent
                </span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-gray-100">
                <span className="text-gray-600">Shift Hours</span>
                <span className="font-medium text-gray-900">{stats.hoursWorked}h this week</span>
              </div>
              <div className="flex justify-between items-center py-3">
                <span className="text-gray-600">Agent Status</span>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 ${getStatusColor(agentStatus)} rounded-full`}></div>
                  <span className="font-medium text-gray-900 capitalize">{agentStatus}</span>
                </div>
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

          {/* Performance Overview */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <span>📈</span> Performance Overview
            </h2>
            <div className="space-y-6">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600">Overall Rating</span>
                  <span className="font-bold text-lg text-gray-900">{stats.performance.rating}/5</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full"
                    style={{ width: `${(stats.performance.rating / 5) * 100}%` }}
                  ></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600">Response Time</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    stats.performance.responseTime === 'Excellent' ? 'bg-green-100 text-green-800' :
                    stats.performance.responseTime === 'Good' ? 'bg-blue-100 text-blue-800' :
                    stats.performance.responseTime === 'Average' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {stats.performance.responseTime}
                  </span>
                </div>
                <p className="text-sm text-gray-500">Average: {formatTime(stats.averageResponseTime)}</p>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600">Resolution Quality</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    stats.performance.resolution === 'Excellent' ? 'bg-green-100 text-green-800' :
                    stats.performance.resolution === 'Good' ? 'bg-blue-100 text-blue-800' :
                    stats.performance.resolution === 'Average' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {stats.performance.resolution}
                  </span>
                </div>
                <p className="text-sm text-gray-500">{stats.resolvedTickets} tickets resolved</p>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600">Customer Satisfaction</span>
                  <div className="flex text-yellow-400">
                    {[...Array(5)].map((_, i) => (
                      <span key={i} className={i < Math.floor(stats.customerSatisfaction) ? '' : 'opacity-30'}>
                        ⭐
                      </span>
                    ))}
                  </div>
                </div>
                <p className="text-sm text-gray-500">{stats.customerSatisfaction}/5 average rating</p>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-100">
              <Link
                to="/agent/performance"
                className="w-full bg-blue-100 hover:bg-blue-200 text-blue-800 py-2 px-4 rounded-lg font-medium text-center transition-colors block"
              >
                View Detailed Performance
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentProfile;