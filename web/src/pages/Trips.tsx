import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../config/api';
import JoinTripModal from '../components/JoinTripModal';
import AISmartSearch from '../components/AISmartSearch';
import AIRecommendations from '../components/AIRecommendations';
import { User } from '../types';
import { getTripShareUrl } from '../utils/config';

interface Trip {
  _id: string;
  title: string;
  description: string;
  destination: string;
  price: number;
  capacity: number;
  participants: string[];
  categories: string[];
  images: string[];
  organizerId: string;
  status: string;
  startDate: string;
  endDate: string;
}

interface TripsProps {
  user: User | null;
}

const Trips: React.FC<TripsProps> = ({ user }) => {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [copySuccess, setCopySuccess] = useState<{[key: string]: boolean}>({});

  const categories = ['Adventure', 'Cultural', 'Beach', 'Mountain', 'City', 'Nature'];

  useEffect(() => {
    const fetchTrips = async () => {
      try {
        const params = new URLSearchParams();
        if (searchTerm) params.append('search', searchTerm);
        if (selectedCategory) params.append('category', selectedCategory);
        
        const response = await api.get(`/trips?${params.toString()}`);
        const tripsData = response.data as Trip[];
        setTrips(tripsData);
      } catch (error) {
        console.error('Error fetching trips:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTrips();
  }, [searchTerm, selectedCategory]);

  const handleJoinTrip = (trip: Trip) => {
    if (!user) {
      alert('Please login to join trips');
      return;
    }
    setSelectedTrip(trip);
    setShowJoinModal(true);
  };

  const handleLeaveTrip = async (tripId: string) => {
    if (!user) return;
    
    if (window.confirm('Are you sure you want to leave this trip? This action cannot be undone.')) {
      try {
        await api.post(`/trips/${tripId}/leave`);
        // Refresh trips list
        const response = await api.get('/trips');
        const tripsData = response.data as Trip[];
        setTrips(tripsData);
        alert('Successfully left the trip!');
      } catch (error: any) {
        alert(error.response?.data?.error || 'Failed to leave trip');
      }
    }
  };

  const handleJoinSuccess = async () => {
    // Refresh trips list
    const response = await api.get('/trips');
    const tripsData = response.data as Trip[];
    setTrips(tripsData);
    alert('Successfully joined the trip!');
  };

  const handleShareTrip = async (tripId: string) => {
    const shareUrl = getTripShareUrl(tripId);
    
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopySuccess(prev => ({ ...prev, [tripId]: true }));
      setTimeout(() => {
        setCopySuccess(prev => ({ ...prev, [tripId]: false }));
      }, 2000);
    } catch (err) {
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = shareUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopySuccess(prev => ({ ...prev, [tripId]: true }));
      setTimeout(() => {
        setCopySuccess(prev => ({ ...prev, [tripId]: false }));
      }, 2000);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-forest-50 to-nature-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-forest-800 mb-4">
            Discover Epic 
            <span className="text-nature-600">Adventures</span>
          </h1>
          <p className="text-xl text-forest-600 max-w-2xl mx-auto">
            Find your next wilderness adventure and connect with fellow nature lovers
          </p>
          
          {/* AI Smart Search */}
          <div className="mb-8">
            <AISmartSearch 
              onSearch={(query, filters) => {
                console.log('AI Search:', { query, filters });
                // Apply filters from AI search
                if (filters.destination) setSearchTerm(filters.destination);
                if (filters.category) setSelectedCategory(filters.category);
                if (!filters.destination && !filters.category) setSearchTerm(query);
              }}
              placeholder="Ask me to find your perfect adventure... e.g., 'Show me trekking trips under ₹10,000'"
              className="mb-6"
            />
          </div>
          
          {/* Traditional Search and Filter - Backup */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-forest-200 mb-8">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-forest-500">🔍</span>
                  <input
                    type="text"
                    placeholder="Or use traditional search..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border-2 border-forest-200 rounded-xl focus:ring-2 focus:ring-nature-500 focus:border-nature-500 transition-all duration-300 bg-forest-50/50"
                  />
                </div>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-forest-500">🎯</span>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="pl-10 pr-8 py-3 border-2 border-forest-200 rounded-xl focus:ring-2 focus:ring-nature-500 focus:border-nature-500 transition-all duration-300 bg-forest-50/50 appearance-none min-w-[200px]"
                >
                  <option value="">All Adventures</option>
                  {categories.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {trips.map((trip) => (
              <div key={trip._id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
                <div className="relative h-48 overflow-hidden">
                  {trip.images && trip.images.length > 0 ? (
                    <img
                      src={trip.images[0]}
                      alt={trip.title}
                      className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const fallback = target.nextElementSibling as HTMLElement;
                        if (fallback) fallback.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div className={`absolute inset-0 bg-gradient-to-br from-forest-400 to-nature-500 flex items-center justify-center ${trip.images && trip.images.length > 0 ? 'hidden' : 'flex'}`}>
                    <div className="text-center text-white">
                      <div className="text-6xl mb-2">
                        {(trip.categories && trip.categories.includes('Mountain')) ? '🏔️' : 
                         (trip.categories && trip.categories.includes('Nature')) ? '🌲' : 
                         (trip.categories && trip.categories.includes('Beach')) ? '🏖️' : 
                         (trip.categories && trip.categories.includes('Cultural')) ? '🏛️' : 
                         (trip.categories && trip.categories.includes('Adventure')) ? '🎒' : '🌍'}
                      </div>
                      <p className="text-sm opacity-90 font-medium">{trip.categories && trip.categories.length > 0 ? trip.categories[0] : 'Adventure'}</p>
                    </div>
                  </div>
                  <div className="absolute top-4 right-4">
                    <div className="bg-white/90 backdrop-blur-sm rounded-full px-3 py-1 text-forest-800 text-sm font-semibold">
                      ₹{trip.price.toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-semibold mb-2">{trip.title}</h3>
                  <p className="text-gray-600 mb-4 line-clamp-3">{trip.description}</p>
                  
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center text-sm text-gray-500">
                      <span className="mr-2">📍</span>
                      {trip.destination}
                    </div>
                    <div className="flex items-center text-sm text-gray-500">
                      <span className="mr-2">📅</span>
                      {new Date(trip.startDate).toLocaleDateString()} - {new Date(trip.endDate).toLocaleDateString()}
                    </div>
                    <div className="flex items-center text-sm text-gray-500">
                      <span className="mr-2">👥</span>
                      {trip.participants.length}/{trip.capacity} spots filled
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-4">
                    {trip.categories.map((category, index) => (
                      <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                        {category}
                      </span>
                    ))}
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-2xl font-bold text-nature-600">₹{trip.price}</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleShareTrip(trip._id)}
                        className="bg-forest-50 hover:bg-forest-100 text-forest-600 p-2 rounded-lg font-medium text-sm transition-all duration-300 border border-forest-200"
                        title="Share this adventure"
                      >
                        {copySuccess[trip._id] ? (
                          <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
                          </svg>
                        )}
                      </button>
                      <Link
                        to={`/trip/${trip._id}`}
                        className="bg-forest-100 hover:bg-forest-200 text-forest-700 px-3 py-2 rounded-lg font-medium text-sm transition-all duration-300 border border-forest-200"
                      >
                        👁️ View Details
                      </Link>
                      {trip.participants.includes(user?.id || '') ? (
                        <button
                          onClick={() => handleLeaveTrip(trip._id)}
                          className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-4 py-2 rounded-xl font-medium transition-all duration-300 transform hover:scale-105 text-sm"
                        >
                          🚪 Leave Trip
                        </button>
                      ) : trip.participants.length >= trip.capacity ? (
                        <button
                          disabled
                          className="bg-gray-400 cursor-not-allowed text-white px-4 py-2 rounded-xl font-medium text-sm"
                        >
                          🎆 Full
                        </button>
                      ) : (
                        <button
                          onClick={() => handleJoinTrip(trip)}
                          className="bg-gradient-to-r from-forest-600 to-nature-600 hover:from-forest-700 hover:to-nature-700 text-white px-4 py-2 rounded-xl font-medium transition-all duration-300 transform hover:scale-105"
                        >
                          🌟 Join Adventure
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {trips.length === 0 && !loading && (
          <div className="text-center py-16">
            <div className="max-w-md mx-auto">
              <div className="text-6xl mb-6">🏔️</div>
              <h3 className="text-2xl font-bold text-forest-800 mb-4">
                {searchTerm || selectedCategory ? 'No matching adventures found' : 'No adventures yet'}
              </h3>
              <p className="text-forest-600 mb-6">
                {searchTerm || selectedCategory 
                  ? 'Try adjusting your search criteria or check back later' 
                  : 'Be the first to create an epic adventure for fellow explorers!'}
              </p>
              {user?.role === 'organizer' && !searchTerm && !selectedCategory && (
                <div className="space-y-4">
                  <button
                    onClick={() => window.location.href = '/create-trip'}
                    className="bg-gradient-to-r from-forest-600 to-nature-600 hover:from-forest-700 hover:to-nature-700 text-white px-6 py-3 rounded-xl font-medium transition-all duration-300 transform hover:scale-105 inline-flex items-center gap-2"
                  >
                    ✨ Create First Adventure
                  </button>
                  <p className="text-sm text-forest-500">
                    Share your passion for adventure and connect with like-minded travelers
                  </p>
                </div>
              )}
              {(!user || user.role === 'traveler') && !searchTerm && !selectedCategory && (
                <div className="bg-forest-50/50 border border-forest-200 rounded-xl p-6 mt-6">
                  <h4 className="font-semibold text-forest-800 mb-2">Want to organize adventures?</h4>
                  <p className="text-sm text-forest-600 mb-4">
                    Upgrade to an organizer account to create and lead amazing trips!
                  </p>
                  <button 
                    onClick={() => {
                      // Open AI chat widget or redirect to support
                      const chatWidget = document.querySelector('[data-testid="ai-chat-widget"]') as HTMLButtonElement;
                      if (chatWidget) {
                        chatWidget.click();
                      } else {
                        // Fallback: scroll to bottom and show contact info
                        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                        alert('💬 Chat support will be available soon. For immediate help, please contact us at support@trekkingapp.com');
                      }
                    }}
                    className="bg-forest-600 hover:bg-forest-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
                  >
                    💬 Contact Support
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* AI Recommendations Section */}
        {!loading && trips.length > 0 && (
          <div className="mt-16 bg-gradient-to-br from-purple-50 to-blue-50 rounded-2xl p-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-800 mb-4">
                🤖 AI Recommended Just for You
              </h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                Based on your preferences and browsing history, here are some personalized adventure recommendations
              </p>
            </div>
            <AIRecommendations className="w-full" maxRecommendations={6} showPersonalized={true} />
          </div>
        )}

        {/* Join Trip Modal */}
        {selectedTrip && (
          <JoinTripModal
            trip={selectedTrip}
            user={user!}
            isOpen={showJoinModal}
            onClose={() => {
              setShowJoinModal(false);
              setSelectedTrip(null);
            }}
            onSuccess={handleJoinSuccess}
          />
        )}
      </div>
    </div>
  );
};

export default Trips;
