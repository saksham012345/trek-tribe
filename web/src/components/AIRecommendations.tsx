import React, { useState, useEffect } from 'react';
import api from '../config/api';
import { useAuth } from '../contexts/AuthContext';

interface Trip {
  _id: string;
  title: string;
  destination: string;
  price: number;
  categories: string[];
  difficultyLevel: string;
  organizerId: any;
}

interface TripRecommendation {
  trip: Trip;
  score: number;
  reason: string;
  matchingFactors: string[];
}

interface AIRecommendationsProps {
  className?: string;
  maxRecommendations?: number;
  showPersonalized?: boolean;
}

const AIRecommendations: React.FC<AIRecommendationsProps> = ({ 
  className = '',
  maxRecommendations = 3,
  showPersonalized = true
}) => {
  const { user } = useAuth();
  const [recommendations, setRecommendations] = useState<TripRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchRecommendations();
  }, [user]);

  const fetchRecommendations = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Check if user is authenticated for personalized recommendations
      if (!user) {
        // For non-authenticated users, get popular trips instead
        const response = await api.get('/trips?limit=6&sort=rating');
        if (response.data) {
          const trips = Array.isArray(response.data) ? response.data : (response.data as any).trips || [];
          const mappedRecommendations = trips.slice(0, maxRecommendations).map((trip: any) => ({
            trip: {
              _id: trip._id,
              title: trip.title,
              destination: trip.destination,
              price: trip.price,
              categories: trip.categories || ['Adventure'],
              difficultyLevel: trip.difficultyLevel || 'intermediate',
              organizerId: trip.organizerId
            },
            score: 80,
            reason: 'Popular choice among travelers',
            matchingFactors: ['Highly rated', 'Popular destination']
          }));
          setRecommendations(mappedRecommendations);
        }
      } else {
        // For authenticated users, get AI-powered recommendations
        const response = await api.get(`/api/ai/recommendations?limit=${maxRecommendations}`);
        
        if ((response.data as any).success && (response.data as any).recommendations) {
          // Map backend response to component format
          const mappedRecommendations = (response.data as any).recommendations.map((rec: any) => ({
            trip: {
              _id: rec._id,
              title: rec.title,
              destination: rec.destination,
              price: rec.price,
              categories: rec.categories || ['Adventure'],
              difficultyLevel: rec.difficultyLevel || 'intermediate',
              organizerId: rec.organizerId
            },
            score: rec.recommendationScore || 75,
            reason: rec.aiInsights?.reason || 'Recommended for you',
            matchingFactors: rec.aiInsights?.matchedPreferences || []
          }));
          setRecommendations(mappedRecommendations);
        }
      }
    } catch (error: any) {
      console.error('Error fetching AI recommendations:', error);
      console.error('Error details:', error.response?.data);
      
      // Fallback: Try to get some trips to display
      try {
        const fallbackResponse = await api.get('/trips?limit=3');
        const trips = Array.isArray(fallbackResponse.data) ? fallbackResponse.data : (fallbackResponse.data as any).trips || [];
        if (trips.length > 0) {
          const mappedRecommendations = trips.slice(0, maxRecommendations).map((trip: any) => ({
            trip: {
              _id: trip._id,
              title: trip.title,
              destination: trip.destination,
              price: trip.price,
              categories: trip.categories || ['Adventure'],
              difficultyLevel: trip.difficultyLevel || 'intermediate',
              organizerId: trip.organizerId
            },
            score: 70,
            reason: 'Featured adventure',
            matchingFactors: ['Available now']
          }));
          setRecommendations(mappedRecommendations);
        } else {
          setError('No trips available at the moment');
        }
      } catch (fallbackError) {
        setError('Unable to load recommendations');
      }
    } finally {
      setLoading(false);
    }
  };

  const getDifficultyColor = (level: string) => {
    switch (level) {
      case 'beginner': return 'bg-green-100 text-green-800';
      case 'intermediate': return 'bg-yellow-100 text-yellow-800';
      case 'advanced': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getDifficultyIcon = (level: string) => {
    switch (level) {
      case 'beginner': return '🟢';
      case 'intermediate': return '🟡';
      case 'advanced': return '🔴';
      default: return '⚪';
    }
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-xl shadow-lg p-6 ${className}`}>
        <div className="flex items-center justify-center space-x-2 mb-4">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
          <h3 className="text-lg font-semibold text-gray-800">🤖 AI is curating recommendations...</h3>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || recommendations.length === 0) {
    return (
      <div className={`bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-200 p-6 ${className}`}>
        <div className="text-center">
          <div className="text-4xl mb-3">🤖</div>
          <h3 className="text-lg font-semibold text-blue-900 mb-2">AI Recommendations</h3>
          <p className="text-blue-700 text-sm">
            {error || 'AI recommendations will appear here based on your preferences and booking history.'}
          </p>
          <button 
            onClick={fetchRecommendations}
            className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
          >
            🔄 Get Recommendations
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl border border-purple-200 p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <span className="text-2xl">🤖</span>
          <div>
            <h3 className="text-lg font-semibold text-purple-900">
              {showPersonalized && user ? 'Personalized for You' : 'AI Recommendations'}
            </h3>
            <p className="text-purple-700 text-sm">Smart suggestions based on trends and preferences</p>
          </div>
        </div>
        <button 
          onClick={fetchRecommendations}
          className="text-purple-600 hover:text-purple-800 transition-colors"
          title="Refresh recommendations"
        >
          🔄
        </button>
      </div>

      <div className="space-y-4">
        {recommendations.map((rec, index) => (
          <div key={rec.trip._id} className="bg-white rounded-lg border border-purple-100 p-4 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-2">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-1">
                  <span className="text-lg font-semibold text-purple-900">
                    {index + 1}. {rec.trip.title}
                  </span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(rec.trip.difficultyLevel)}`}>
                    {getDifficultyIcon(rec.trip.difficultyLevel)} {rec.trip.difficultyLevel}
                  </span>
                </div>
                <div className="flex items-center space-x-4 text-sm text-gray-600 mb-2">
                  <span>📍 {rec.trip.destination}</span>
                  <span className="font-semibold text-purple-600">₹{rec.trip.price.toLocaleString()}</span>
                </div>
                <div className="flex flex-wrap gap-1 mb-2">
                  {rec.trip.categories && rec.trip.categories.length > 0 ? rec.trip.categories.slice(0, 3).map((category) => (
                    <span key={category} className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs">
                      {category}
                    </span>
                  )) : (
                    <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs">
                      Adventure
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-3 mb-3">
              <p className="text-sm text-purple-800 font-medium">
                🎯 {rec.reason}
              </p>
              {rec.matchingFactors && rec.matchingFactors.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {rec.matchingFactors.map((factor, i) => (
                    <span key={i} className="px-2 py-1 bg-purple-200 text-purple-800 rounded-full text-xs">
                      ✓ {factor}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-between items-center">
              <div className="text-xs text-gray-500">
                AI Match Score: {Math.round(rec.score)}%
              </div>
              <a
                href={`/trip/${rec.trip._id}`}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 transition-colors flex items-center space-x-1"
              >
                <span>View Details</span>
                <span>→</span>
              </a>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-purple-200">
        <p className="text-xs text-purple-600 text-center">
          🧠 Powered by Trek Tribe AI • Recommendations update based on your activity
        </p>
      </div>
    </div>
  );
};

export default AIRecommendations;