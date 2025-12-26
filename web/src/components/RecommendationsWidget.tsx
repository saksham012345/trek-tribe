import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import '../styles/Recommendations.css';

interface Trip {
  _id: string;
  title: string;
  description: string;
  categories: string[];
  price: number;
  rating?: number;
  joinedTravelersCount: number;
  images?: string[];
  duration?: number;
}

interface UserRecommendation {
  _id: string;
  name: string;
  profilePhoto?: string;
  role: string;
  organizerProfile?: {
    bio: string;
    yearsOfExperience: number;
  };
}

export const RecommendationsWidget: React.FC = () => {
  const { user } = useAuth();
  const [tripRecommendations, setTripRecommendations] = useState<Trip[]>([]);
  const [userRecommendations, setUserRecommendations] = useState<UserRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'trips' | 'users'>('trips');

  useEffect(() => {
    fetchRecommendations();
  }, [user]);

  const fetchRecommendations = async () => {
    try {
      setLoading(true);

      // Fetch both trip and user recommendations
      const [tripsRes, usersRes] = await Promise.all([
        api.get('/api/recommendations/trips?limit=5').catch(() => ({ data: { recommendations: [] } })),
        api.get('/api/recommendations/users?limit=5').catch(() => ({ data: { recommendations: [] } }))
      ]);

      setTripRecommendations(tripsRes.data.recommendations || []);
      setUserRecommendations(usersRes.data.recommendations || []);
    } catch (error) {
      console.error('Failed to fetch recommendations:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="recommendations-widget">
      <div className="recommendations-header">
        <h3>🎯 Recommended for You</h3>
        <div className="recommendations-tabs">
          <button
            className={`tab-btn ${activeTab === 'trips' ? 'active' : ''}`}
            onClick={() => setActiveTab('trips')}
          >
            Trips
          </button>
          <button
            className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            People
          </button>
        </div>
      </div>

      {loading ? (
        <div className="recommendations-loading">Loading recommendations...</div>
      ) : (
        <>
          {/* Trip Recommendations */}
          {activeTab === 'trips' && (
            <div className="recommendations-list">
              {tripRecommendations.length === 0 ? (
                <div className="empty-recommendations">
                  <p>No trip recommendations yet. Explore more trips to get personalized suggestions!</p>
                </div>
              ) : (
                tripRecommendations.map(trip => (
                  <div key={trip._id} className="recommendation-item trip-item">
                    {trip.images?.[0] && (
                      <div
                        className="item-image"
                        style={{ backgroundImage: `url(${trip.images[0]})` }}
                      />
                    )}

                    <div className="item-content">
                      <h4>{trip.title}</h4>

                      <div className="item-meta">
                        {trip.categories && (
                          <span className="category-tag">{trip.categories[0]}</span>
                        )}
                        {trip.rating && (
                          <span className="rating">⭐ {trip.rating.toFixed(1)}</span>
                        )}
                        {trip.price && (
                          <span className="price">₹{trip.price.toLocaleString()}</span>
                        )}
                      </div>

                      <p className="item-description">{trip.description.substring(0, 80)}...</p>

                      <div className="item-footer">
                        <span className="travelers">👥 {trip.joinedTravelersCount} joined</span>
                        <a href={`/trips/${trip._id}`} className="btn-view">
                          View Trip →
                        </a>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* User Recommendations */}
          {activeTab === 'users' && (
            <div className="recommendations-list">
              {userRecommendations.length === 0 ? (
                <div className="empty-recommendations">
                  <p>No user recommendations yet. Follow users with similar interests!</p>
                </div>
              ) : (
                userRecommendations.map(user => (
                  <div key={user._id} className="recommendation-item user-item">
                    {user.profilePhoto && (
                      <div
                        className="user-avatar"
                        style={{ backgroundImage: `url(${user.profilePhoto})` }}
                      />
                    )}

                    <div className="user-info">
                      <h4>{user.name}</h4>

                      <div className="user-role">
                        {user.role === 'organizer' ? '🎯 Organizer' : '🧗 Traveler'}
                      </div>

                      {user.organizerProfile && (
                        <p className="user-bio">{user.organizerProfile.bio}</p>
                      )}

                      <div className="user-actions">
                        <a href={`/profile/${user._id}`} className="btn-view">
                          View Profile →
                        </a>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}

      <div className="recommendations-footer">
        <p className="recommendations-note">
          💡 Our recommendations improve as you explore more trips and interact with content
        </p>
      </div>
    </div>
  );
};

export default RecommendationsWidget;
