import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import api from '../config/api';
import { User } from '../types';

interface Trip {
  _id: string;
  title: string;
  description: string;
  destination: string;
  price: number;
  capacity: number;
  participants: string[];
  categories: string[];
  startDate: string;
  endDate: string;
  status: 'active' | 'cancelled' | 'completed';
  images?: string[];
  organizerId: {
    name: string;
    email: string;
    phone: string;
  };
  averageRating?: number;
  reviewCount?: number;
}

interface AIRecommendation {
  tripId: string;
  title: string;
  destination: string;
  price: number;
  startDate: string;
  endDate: string;
  matchScore: number;
  reasons: string[];
  categories: string[];
}

interface CustomerQuery {
  _id: string;
  customerName: string;
  customerEmail: string;
  query: string;
  status: 'open' | 'in_progress' | 'resolved';
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
  lastResponse?: string;
}

interface AgentDashboardProps {
  user: User;
}

const EnhancedAgentDashboard: React.FC<AgentDashboardProps> = ({ user }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [trips, setTrips] = useState<Trip[]>([]);
  const [customerQueries, setCustomerQueries] = useState<CustomerQuery[]>([]);
  const [aiRecommendations, setAiRecommendations] = useState<AIRecommendation[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [socket, setSocket] = useState<any | null>(null);
  const [notifications, setNotifications] = useState<Array<{ id: string; message: string; type: 'success' | 'info' | 'error'; timestamp: Date }>>([]);
  
  // Search and filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [priceRange, setPriceRange] = useState({ min: 0, max: 100000 });

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
    });

    newSocket.on('connect', () => {
      console.log('🔌 Agent dashboard connected to real-time updates');
    });

    newSocket.on('agent_dashboard_update', (data) => {
      console.log('📊 Agent dashboard update received:', data);
      addNotification(`New ${data.type.replace('_', ' ')}: ${data.data.title || data.data.customerName || 'Update'}`, 'info');
      fetchDashboardData(); // Refresh data
    });

    // New ticket notifications (from support system)
    newSocket.on('new_ticket', (data) => {
      console.log('🆕 New ticket notification received:', data);
      addNotification(`New ticket: ${data.subject || data.ticketId}`, 'info');
      fetchDashboardData();
    });

    newSocket.on('trip_update', (data) => {
      if (data.type === 'created') {
        addNotification(`New trip available: ${data.trip.title}`, 'success');
        fetchDashboardData();
      }
    });

    newSocket.on('error', (error) => {
      console.error('Agent socket error:', error);
    });

    setSocket(newSocket);
  };

  const fetchDashboardData = async () => {
    try {
      const [tripsResponse, queriesResponse, aiResponse] = await Promise.all([
        api.get('/trips'),
        api.get('/agent/queries'),
        api.get('/agent/ai-recommendations')
      ]);
      
      setTrips((tripsResponse.data as any) || []);
      setCustomerQueries((queriesResponse.data as any).queries || []);
      setAiRecommendations((aiResponse.data as any).recommendations || []);
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

  const handleViewDetails = async (tripId: string) => {
    try {
      console.log('🔍 Fetching trip details for ID:', tripId);
      
      if (!tripId) {
        throw new Error('Trip ID is required');
      }

      const response = await api.get(`/trips/${tripId}`);
      const tripData = response.data as any;
      
      if (!tripData) {
        throw new Error('Trip not found');
      }

      // Create a complete trip object with fallbacks for missing data
      const completeTripData: Trip = {
        _id: tripData._id || tripId,
        title: tripData.title || 'Trip Title Not Available',
        description: tripData.description || 'No description provided',
        destination: tripData.destination || 'Destination not specified',
        price: tripData.price || 0,
        capacity: tripData.capacity || 0,
        participants: tripData.participants || [],
        categories: tripData.categories || [],
        startDate: tripData.startDate || new Date().toISOString(),
        endDate: tripData.endDate || new Date().toISOString(),
        status: tripData.status || 'active',
        images: tripData.images || [],
        organizerId: {
          name: tripData.organizerId?.name || 'Organizer Name Not Available',
          email: tripData.organizerId?.email || 'Email not available',
          phone: tripData.organizerId?.phone || 'Phone not available'
        },
        averageRating: tripData.averageRating || 0,
        reviewCount: tripData.reviewCount || 0
      };

      setSelectedTrip(completeTripData);
      setActiveTab('tripDetails');
      
    } catch (error: any) {
      console.error('❌ Error fetching trip details:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to fetch trip details';
      setError(errorMessage);
      addNotification(`Error: ${errorMessage}`, 'error');
      
      // Still show what data we have
      const fallbackTrip: Trip = {
        _id: tripId,
        title: 'Unable to load trip details',
        description: 'There was an error loading the complete trip information.',
        destination: 'Unknown',
        price: 0,
        capacity: 0,
        participants: [],
        categories: [],
        startDate: new Date().toISOString(),
        endDate: new Date().toISOString(),
        status: 'active',
        organizerId: {
          name: 'Unknown Organizer',
          email: 'Not available',
          phone: 'Not available'
        }
      };
      
      setSelectedTrip(fallbackTrip);
      setActiveTab('tripDetails');
    }
  };

  const generateAIRecommendations = async () => {
    try {
      setLoading(true);
      const response = await api.post('/agent/generate-recommendations', {
        preferences: {
          categories: categoryFilter !== 'all' ? [categoryFilter] : [],
          priceRange: priceRange,
          searchQuery: searchQuery
        }
      });
      
      setAiRecommendations((response.data as any).recommendations || []);
      addNotification('AI recommendations updated!', 'success');
    } catch (error: any) {
      console.error('Error generating AI recommendations:', error);
      addNotification('Failed to generate AI recommendations', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filteredTrips = trips.filter(trip => {
    const matchesSearch = searchQuery === '' || 
      trip.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      trip.destination.toLowerCase().includes(searchQuery.toLowerCase());

    const categories = Array.isArray(trip.categories) ? trip.categories : [];
    const matchesCategory = categoryFilter === 'all' || categories.includes(categoryFilter);
    const matchesPrice = trip.price >= priceRange.min && trip.price <= priceRange.max;
    
    return matchesSearch && matchesCategory && matchesPrice;
  });

  if (loading && trips.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-forest-50 to-nature-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-nature-600 mx-auto mb-4"></div>
          <p className="text-forest-600">Loading agent dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-forest-50 to-nature-50">
      {/* Header */}
      <div className="bg-white shadow-lg">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-forest-800 to-nature-600 bg-clip-text text-transparent">
            🎯 Agent Dashboard
          </h1>
          <p className="text-forest-600 mt-1">
            Welcome, <span className="font-semibold">{user.name}</span>! Assist customers and manage AI recommendations.
          </p>
        </div>
      </div>

      {/* Real-time Notifications */}
      {notifications.length > 0 && (
        <div className="max-w-7xl mx-auto px-6 mt-4">
          <div className="space-y-2">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-3 rounded-lg shadow-lg border-l-4 ${
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
        <div className="max-w-7xl mx-auto px-6 mt-4">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between">
            <span className="text-sm">{error}</span>
            <button onClick={() => setError('')} className="text-red-500 hover:text-red-700">
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-6 mt-6">
        <div className="bg-white rounded-xl shadow-lg p-1">
          <nav className="flex space-x-1">
            {[
              { id: 'overview', label: '📊 Overview', icon: '📊' },
              { id: 'trips', label: '🎯 All Trips', icon: '🎯' },
              { id: 'ai', label: '🤖 AI Recommendations', icon: '🤖' },
              { id: 'queries', label: '💬 Customer Queries', icon: '💬' },
              ...(selectedTrip ? [{ id: 'tripDetails', label: `🔍 ${selectedTrip.title}`, icon: '🔍' }] : [])
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-forest-600 to-nature-600 text-white shadow-lg'
                    : 'text-forest-600 hover:bg-forest-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Stats Cards */}
            <div className="lg:col-span-2 grid md:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-forest-600">Total Trips</p>
                    <p className="text-3xl font-bold text-forest-800">{trips.length}</p>
                  </div>
                  <div className="bg-forest-100 p-3 rounded-full">
                    <span className="text-2xl">🎯</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-forest-600">Customer Queries</p>
                    <p className="text-3xl font-bold text-forest-800">{customerQueries.length}</p>
                  </div>
                  <div className="bg-blue-100 p-3 rounded-full">
                    <span className="text-2xl">💬</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-forest-600">AI Recommendations</p>
                    <p className="text-3xl font-bold text-forest-800">{aiRecommendations.length}</p>
                  </div>
                  <div className="bg-purple-100 p-3 rounded-full">
                    <span className="text-2xl">🤖</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-forest-600">Active Trips</p>
                    <p className="text-3xl font-bold text-forest-800">
                      {trips.filter(t => t.status === 'active').length}
                    </p>
                  </div>
                  <div className="bg-green-100 p-3 rounded-full">
                    <span className="text-2xl">✅</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-bold text-forest-800 mb-4">🚀 Quick Actions</h3>
              <div className="space-y-3">
                <button 
                  onClick={generateAIRecommendations}
                  className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg hover:from-purple-700 hover:to-purple-800 transition-all duration-200"
                >
                  🤖 Generate AI Recommendations
                </button>
                <button 
                  onClick={() => setActiveTab('trips')}
                  className="w-full px-4 py-3 bg-gradient-to-r from-forest-600 to-nature-600 text-white rounded-lg hover:from-forest-700 hover:to-nature-700 transition-all duration-200"
                >
                  🎯 Browse All Trips
                </button>
                <button 
                  onClick={() => setActiveTab('queries')}
                  className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200"
                >
                  💬 Check Customer Queries
                </button>
                <button 
                  onClick={fetchDashboardData}
                  className="w-full px-4 py-3 border-2 border-forest-300 text-forest-700 rounded-lg hover:bg-forest-50 transition-all duration-200"
                >
                  🔄 Refresh Data
                </button>
              </div>
            </div>
          </div>
        )}

        {/* All Trips Tab */}
        {activeTab === 'trips' && (
          <div className="space-y-6">
            {/* Search and Filters */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-bold text-forest-800 mb-4">🔍 Search & Filter Trips</h3>
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-forest-700 mb-2">Search</label>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search trips..."
                    className="w-full px-3 py-2 border border-forest-200 rounded-lg focus:ring-2 focus:ring-nature-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-forest-700 mb-2">Category</label>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-forest-200 rounded-lg focus:ring-2 focus:ring-nature-500"
                  >
                    <option value="all">All Categories</option>
                    <option value="Adventure">Adventure</option>
                    <option value="Cultural">Cultural</option>
                    <option value="Beach">Beach</option>
                    <option value="Mountain">Mountain</option>
                    <option value="Nature">Nature</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-forest-700 mb-2">Max Price</label>
                  <input
                    type="number"
                    value={priceRange.max}
                    onChange={(e) => setPriceRange(prev => ({ ...prev, max: parseInt(e.target.value) || 100000 }))}
                    placeholder="Max price"
                    className="w-full px-3 py-2 border border-forest-200 rounded-lg focus:ring-2 focus:ring-nature-500"
                  />
                </div>
              </div>
            </div>

            {/* Trips Grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTrips.map((trip) => (
                <div key={trip._id} className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-200">
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="text-lg font-bold text-forest-800 line-clamp-1">{trip.title}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        trip.status === 'active' ? 'bg-green-100 text-green-800' :
                        trip.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {trip.status}
                      </span>
                    </div>
                    
                    <p className="text-forest-600 text-sm mb-3">📍 {trip.destination}</p>
                    <p className="text-forest-700 text-sm mb-4 line-clamp-2">{trip.description}</p>
                    
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-2xl font-bold text-nature-600">₹{trip.price.toLocaleString()}</span>
                      <span className="text-sm text-forest-600">
                        {trip.participants.length}/{trip.capacity} joined
                      </span>
                    </div>
                    
                    <div className="flex gap-2 mb-4">
                      {trip.categories.slice(0, 2).map((category) => (
                        <span key={category} className="px-2 py-1 bg-forest-100 text-forest-700 rounded-full text-xs">
                          {category}
                        </span>
                      ))}
                    </div>
                    
                    <button
                      onClick={() => handleViewDetails(trip._id)}
                      className="w-full px-4 py-2 bg-gradient-to-r from-forest-600 to-nature-600 text-white rounded-lg hover:from-forest-700 hover:to-nature-700 transition-all duration-200"
                    >
                      🔍 View Details
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {filteredTrips.length === 0 && (
              <div className="bg-white rounded-xl shadow-lg p-12 text-center">
                <div className="text-6xl mb-4">🔍</div>
                <h3 className="text-xl font-bold text-forest-800 mb-2">No trips found</h3>
                <p className="text-forest-600">Try adjusting your search criteria.</p>
              </div>
            )}
          </div>
        )}

        {/* AI Recommendations Tab */}
        {activeTab === 'ai' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-forest-800">🤖 AI Trip Recommendations</h3>
                <button
                  onClick={generateAIRecommendations}
                  className="px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg hover:from-purple-700 hover:to-purple-800 transition-all duration-200"
                >
                  ♻️ Regenerate
                </button>
              </div>

              {aiRecommendations.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">🤖</div>
                  <h3 className="text-xl font-bold text-forest-800 mb-2">No AI recommendations yet</h3>
                  <p className="text-forest-600 mb-4">Click "Generate AI Recommendations" to get started.</p>
                  <button
                    onClick={generateAIRecommendations}
                    className="px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg hover:from-purple-700 hover:to-purple-800 transition-all duration-200"
                  >
                    🤖 Generate Recommendations
                  </button>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-6">
                  {aiRecommendations.map((rec, index) => (
                    <div key={`${rec.tripId}-${index}`} className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-6 border border-purple-200">
                      <div className="flex justify-between items-start mb-3">
                        <h4 className="text-lg font-bold text-forest-800">{rec.title}</h4>
                        <div className="flex items-center gap-1">
                          <span className="text-yellow-500">⭐</span>
                          <span className="text-sm font-semibold text-forest-700">
                            {(rec.matchScore * 100).toFixed(0)}% match
                          </span>
                        </div>
                      </div>
                      
                      <p className="text-forest-600 text-sm mb-2">📍 {rec.destination}</p>
                      <p className="text-2xl font-bold text-nature-600 mb-3">₹{rec.price.toLocaleString()}</p>
                      
                      <div className="mb-3">
                        <p className="text-sm font-medium text-forest-700 mb-1">Why recommended:</p>
                        <ul className="text-sm text-forest-600 list-disc list-inside space-y-1">
                          {rec.reasons.map((reason, idx) => (
                            <li key={idx}>{reason}</li>
                          ))}
                        </ul>
                      </div>
                      
                      <div className="flex gap-2 mb-4">
                        {rec.categories.slice(0, 3).map((category) => (
                          <span key={category} className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs">
                            {category}
                          </span>
                        ))}
                      </div>
                      
                      <button
                        onClick={() => handleViewDetails(rec.tripId)}
                        className="w-full px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg hover:from-purple-700 hover:to-purple-800 transition-all duration-200"
                      >
                        🔍 View Details
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Trip Details Tab */}
        {activeTab === 'tripDetails' && selectedTrip && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="mb-6">
              <button
                onClick={() => setActiveTab('trips')}
                className="text-forest-600 hover:text-forest-800 flex items-center gap-2 mb-4"
              >
                ← Back to Trips
              </button>
              
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-3xl font-bold text-forest-800 mb-2">{selectedTrip.title}</h2>
                  <p className="text-forest-600 text-lg">📍 {selectedTrip.destination}</p>
                </div>
                <span className={`px-4 py-2 rounded-full text-sm font-semibold ${
                  selectedTrip.status === 'active' ? 'bg-green-100 text-green-800' :
                  selectedTrip.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {selectedTrip.status.charAt(0).toUpperCase() + selectedTrip.status.slice(1)}
                </span>
              </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
              {/* Main Details */}
              <div className="lg:col-span-2 space-y-6">
                <div>
                  <h3 className="text-xl font-bold text-forest-800 mb-3">📝 Description</h3>
                  <p className="text-forest-700 leading-relaxed">{selectedTrip.description}</p>
                </div>

                <div>
                  <h3 className="text-xl font-bold text-forest-800 mb-3">🗓️ Trip Dates</h3>
                  <div className="bg-forest-50 rounded-lg p-4">
                    <div className="flex justify-between">
                      <div>
                        <p className="text-sm text-forest-600">Start Date</p>
                        <p className="font-bold text-forest-800">{new Date(selectedTrip.startDate).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <p className="text-sm text-forest-600">End Date</p>
                        <p className="font-bold text-forest-800">{new Date(selectedTrip.endDate).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-xl font-bold text-forest-800 mb-3">🏷️ Categories</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedTrip.categories.map((category) => (
                      <span key={category} className="px-3 py-1 bg-nature-100 text-nature-700 rounded-full text-sm font-medium">
                        {category}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                <div className="bg-gradient-to-r from-nature-50 to-forest-50 rounded-xl p-6">
                  <h3 className="text-lg font-bold text-forest-800 mb-4">💰 Pricing & Availability</h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-forest-600">Price per person</p>
                      <p className="text-3xl font-bold text-nature-600">₹{selectedTrip.price.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-forest-600">Availability</p>
                      <p className="font-bold text-forest-800">
                        {selectedTrip.participants.length}/{selectedTrip.capacity} spots filled
                      </p>
                      <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                        <div 
                          className="bg-nature-600 h-2 rounded-full" 
                          style={{
                            width: `${(selectedTrip.participants.length / selectedTrip.capacity) * 100}%`
                          }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 rounded-xl p-6">
                  <h3 className="text-lg font-bold text-forest-800 mb-4">👨‍💼 Organizer</h3>
                  <div className="space-y-2">
                    <div>
                      <p className="text-sm text-forest-600">Name</p>
                      <p className="font-medium text-forest-800">{selectedTrip.organizerId.name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-forest-600">Email</p>
                      <p className="font-medium text-forest-800">{selectedTrip.organizerId.email}</p>
                    </div>
                    <div>
                      <p className="text-sm text-forest-600">Phone</p>
                      <p className="font-medium text-forest-800">{selectedTrip.organizerId.phone}</p>
                    </div>
                  </div>
                </div>

                {selectedTrip.averageRating !== undefined && selectedTrip.averageRating > 0 && (
                  <div className="bg-yellow-50 rounded-xl p-6">
                    <h3 className="text-lg font-bold text-forest-800 mb-4">⭐ Reviews</h3>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-yellow-600 mb-2">
                        {selectedTrip.averageRating.toFixed(1)}
                      </div>
                      <div className="flex justify-center mb-2">
                        {[...Array(5)].map((_, i) => (
                          <span key={i} className={i < Math.floor(selectedTrip.averageRating!) ? 'text-yellow-500' : 'text-gray-300'}>
                            ⭐
                          </span>
                        ))}
                      </div>
                      <p className="text-sm text-forest-600">
                        Based on {selectedTrip.reviewCount} reviews
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Customer Queries Tab */}
        {activeTab === 'queries' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-2xl font-bold text-forest-800 mb-6">💬 Customer Queries</h3>
            
            {customerQueries.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">💬</div>
                <h3 className="text-xl font-bold text-forest-800 mb-2">No customer queries</h3>
                <p className="text-forest-600">All queries are resolved or no new queries yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {customerQueries.map((query) => (
                  <div key={query._id} className="bg-forest-50 rounded-lg p-4 border border-forest-200">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-bold text-forest-800">{query.customerName}</h4>
                        <p className="text-sm text-forest-600">{query.customerEmail}</p>
                      </div>
                      <div className="text-right">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          query.status === 'open' ? 'bg-red-100 text-red-800' :
                          query.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {query.status.replace('_', ' ')}
                        </span>
                        <p className="text-xs text-forest-500 mt-1">
                          {new Date(query.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <p className="text-forest-700 mb-2">{query.query}</p>
                    {query.lastResponse && (
                      <div className="bg-white rounded-lg p-3 mt-2">
                        <p className="text-sm text-forest-600">Last Response:</p>
                        <p className="text-forest-700">{query.lastResponse}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default EnhancedAgentDashboard;