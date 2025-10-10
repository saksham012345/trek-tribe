import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

interface TravelAnalytics {
  totalBookings: number;
  totalSpent: number;
  averageSpent: number;
  preferredCategories: Array<{ category: string; count: number; percentage: number }>;
  preferredDestinations: Array<{ destination: string; count: number; percentage: number }>;
  bookingTrends: {
    monthlyBookings: Array<{ month: string; count: number }>;
    seasonalPreference: string;
  };
  difficultyPreference: {
    beginner: number;
    intermediate: number;
    advanced: number;
  };
  insights: string[];
  recommendations: string[];
  loyaltyLevel: string;
  lastBookingDate?: string;
}

interface AIAnalyticsDashboardProps {
  className?: string;
  compact?: boolean;
}

const AIAnalyticsDashboard: React.FC<AIAnalyticsDashboardProps> = ({ 
  className = '',
  compact = false
}) => {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<TravelAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      fetchAnalytics();
    } else {
      setLoading(false);
    }
  }, [user]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/chat/user-analytics', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.data.success && response.data.data.analytics) {
        setAnalytics(response.data.data.analytics);
      }
    } catch (error: any) {
      console.error('Error fetching analytics:', error);
      setError('Unable to load your travel analytics');
    } finally {
      setLoading(false);
    }
  };

  const getLoyaltyColor = (level: string) => {
    switch (level) {
      case 'Explorer': return 'bg-green-100 text-green-800 border-green-200';
      case 'Adventurer': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Wanderer': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'Legend': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getLoyaltyIcon = (level: string) => {
    switch (level) {
      case 'Explorer': return '🌱';
      case 'Adventurer': return '⭐';
      case 'Wanderer': return '🏆';
      case 'Legend': return '👑';
      default: return '🎯';
    }
  };

  if (!user) {
    return (
      <div className={`bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-200 p-6 ${className}`}>
        <div className="text-center">
          <div className="text-4xl mb-3">📊</div>
          <h3 className="text-lg font-semibold text-blue-900 mb-2">Travel Analytics</h3>
          <p className="text-blue-700 text-sm mb-4">
            Sign in to see your personalized travel insights and AI-powered analytics.
          </p>
          <a 
            href="/login"
            className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
          >
            Sign In to View Analytics
          </a>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`bg-white rounded-xl shadow-lg p-6 ${className}`}>
        <div className="flex items-center justify-center space-x-2 mb-4">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600"></div>
          <h3 className="text-lg font-semibold text-gray-800">🤖 AI is analyzing your travel patterns...</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
              <div className="h-8 bg-gray-200 rounded w-2/3"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div className={`bg-gradient-to-r from-red-50 to-orange-50 rounded-xl border border-red-200 p-6 ${className}`}>
        <div className="text-center">
          <div className="text-4xl mb-3">📊</div>
          <h3 className="text-lg font-semibold text-red-900 mb-2">Travel Analytics</h3>
          <p className="text-red-700 text-sm mb-4">
            {error || 'No travel data available yet. Book your first trip to see personalized insights!'}
          </p>
          <button 
            onClick={fetchAnalytics}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors"
          >
            🔄 Retry Loading
          </button>
        </div>
      </div>
    );
  }

  const compactView = compact || analytics.totalBookings === 0;

  if (compactView && analytics.totalBookings === 0) {
    return (
      <div className={`bg-gradient-to-r from-indigo-50 to-cyan-50 rounded-xl border border-indigo-200 p-6 ${className}`}>
        <div className="text-center">
          <div className="text-4xl mb-3">🚀</div>
          <h3 className="text-lg font-semibold text-indigo-900 mb-2">Start Your Adventure</h3>
          <p className="text-indigo-700 text-sm mb-4">
            Book your first trip to unlock AI-powered insights and personalized recommendations!
          </p>
          <a 
            href="/trips"
            className="inline-block px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition-colors"
          >
            Browse Trips
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 rounded-xl border border-purple-200 p-6 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <span className="text-3xl">🧠</span>
          <div>
            <h3 className="text-xl font-bold text-purple-900">AI Travel Analytics</h3>
            <p className="text-purple-700 text-sm">Insights powered by machine learning</p>
          </div>
        </div>
        <div className={`px-4 py-2 rounded-lg border-2 ${getLoyaltyColor(analytics.loyaltyLevel)}`}>
          <span className="text-sm font-semibold">
            {getLoyaltyIcon(analytics.loyaltyLevel)} {analytics.loyaltyLevel}
          </span>
        </div>
      </div>

      {/* Key Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg p-4 border border-purple-100">
          <div className="text-2xl font-bold text-purple-600">{analytics.totalBookings}</div>
          <div className="text-sm text-gray-600">Total Trips</div>
        </div>
        <div className="bg-white rounded-lg p-4 border border-purple-100">
          <div className="text-2xl font-bold text-green-600">₹{analytics.totalSpent.toLocaleString()}</div>
          <div className="text-sm text-gray-600">Total Spent</div>
        </div>
        <div className="bg-white rounded-lg p-4 border border-purple-100">
          <div className="text-2xl font-bold text-blue-600">₹{Math.round(analytics.averageSpent).toLocaleString()}</div>
          <div className="text-sm text-gray-600">Avg per Trip</div>
        </div>
        <div className="bg-white rounded-lg p-4 border border-purple-100">
          <div className="text-2xl font-bold text-orange-600">{analytics.bookingTrends.seasonalPreference}</div>
          <div className="text-sm text-gray-600">Fav Season</div>
        </div>
      </div>

      {!compact && (
        <>
          {/* Categories & Destinations */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="bg-white rounded-lg p-4 border border-purple-100">
              <h4 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                <span className="mr-2">🎯</span>
                Preferred Categories
              </h4>
              <div className="space-y-2">
                {analytics.preferredCategories.slice(0, 3).map((cat, index) => (
                  <div key={cat.category} className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">{cat.category}</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-16 h-2 bg-gray-200 rounded-full">
                        <div 
                          className="h-2 bg-purple-500 rounded-full" 
                          style={{ width: `${cat.percentage}%` }}
                        ></div>
                      </div>
                      <span className="text-xs text-gray-500">{cat.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 border border-purple-100">
              <h4 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                <span className="mr-2">📍</span>
                Top Destinations
              </h4>
              <div className="space-y-2">
                {analytics.preferredDestinations.slice(0, 3).map((dest, index) => (
                  <div key={dest.destination} className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">{dest.destination}</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-16 h-2 bg-gray-200 rounded-full">
                        <div 
                          className="h-2 bg-blue-500 rounded-full" 
                          style={{ width: `${dest.percentage}%` }}
                        ></div>
                      </div>
                      <span className="text-xs text-gray-500">{dest.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Difficulty Preference */}
          <div className="bg-white rounded-lg p-4 border border-purple-100 mb-6">
            <h4 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
              <span className="mr-2">⛰️</span>
              Difficulty Preference
            </h4>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{analytics.difficultyPreference.beginner}</div>
                <div className="text-sm text-gray-600">🟢 Beginner</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{analytics.difficultyPreference.intermediate}</div>
                <div className="text-sm text-gray-600">🟡 Intermediate</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{analytics.difficultyPreference.advanced}</div>
                <div className="text-sm text-gray-600">🔴 Advanced</div>
              </div>
            </div>
          </div>

          {/* AI Insights */}
          <div className="bg-gradient-to-r from-purple-100 to-blue-100 rounded-lg p-4 mb-6">
            <h4 className="text-lg font-semibold text-purple-900 mb-3 flex items-center">
              <span className="mr-2">💡</span>
              AI Insights
            </h4>
            <div className="space-y-2">
              {analytics.insights.slice(0, 3).map((insight, index) => (
                <div key={index} className="flex items-start space-x-2">
                  <span className="text-purple-600 mt-1">•</span>
                  <span className="text-sm text-purple-800">{insight}</span>
                </div>
              ))}
            </div>
          </div>

          {/* AI Recommendations */}
          <div className="bg-gradient-to-r from-indigo-100 to-purple-100 rounded-lg p-4">
            <h4 className="text-lg font-semibold text-indigo-900 mb-3 flex items-center">
              <span className="mr-2">🎯</span>
              AI Recommendations
            </h4>
            <div className="space-y-2">
              {analytics.recommendations.slice(0, 3).map((rec, index) => (
                <div key={index} className="flex items-start space-x-2">
                  <span className="text-indigo-600 mt-1">→</span>
                  <span className="text-sm text-indigo-800">{rec}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="mt-4 pt-4 border-t border-purple-200 text-center">
        <p className="text-xs text-purple-600">
          🤖 Analytics updated in real-time • Last updated: {analytics.lastBookingDate ? new Date(analytics.lastBookingDate).toLocaleDateString() : 'Never'}
        </p>
        <button 
          onClick={fetchAnalytics}
          className="mt-2 text-purple-600 hover:text-purple-800 text-xs transition-colors"
        >
          🔄 Refresh Analytics
        </button>
      </div>
    </div>
  );
};

export default AIAnalyticsDashboard;