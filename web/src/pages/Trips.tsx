import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useParams } from 'react-router-dom';
import { Sliders, Filter, Calendar, MapPin, DollarSign, ArrowUpDown } from 'lucide-react';
import api from '../config/api';
import JoinTripModal from '../components/JoinTripModal';
import AISmartSearch from '../components/AISmartSearch';
import AIRecommendations from '../components/AIRecommendations';
import SaveTripButton from '../components/SaveTripButton';
import SocialShareButtons from '../components/SocialShareButtons';
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
  coverImage?: string;
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
  const [filteredTrips, setFilteredTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const { category, destination: destinationParam } = useParams<{ category: string; destination: string }>();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(category || '');
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [copySuccess, setCopySuccess] = useState<{ [key: string]: boolean }>({});
  const [showFilters, setShowFilters] = useState(false);

  // Advanced Filters
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 100000]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [destination, setDestination] = useState(destinationParam || '');
  const [sortBy, setSortBy] = useState<'price' | 'date' | 'popularity' | 'newest'>('newest');
  const [difficulty, setDifficulty] = useState<string>('');

  const categories = ['Adventure', 'Cultural', 'Beach', 'Mountain', 'City', 'Nature'];
  const difficulties = ['Easy', 'Moderate', 'Difficult', 'Extreme'];

  useEffect(() => {
    const fetchTrips = async () => {
      try {
        const params = new URLSearchParams();
        if (searchTerm) params.append('q', searchTerm);
        if (selectedCategory) params.append('category', selectedCategory);

        console.log('🔍 Fetching trips with params:', params.toString());

        const response = await api.get(`/trips?${params.toString()}`);
        const raw = response.data as any;
        const tripsData: Trip[] = Array.isArray(raw?.data)
          ? (raw.data as Trip[])
          : Array.isArray(raw)
            ? (raw as Trip[])
            : [];

        console.log(`✅ Received ${tripsData.length} trips from API:`, tripsData.map(t => ({ id: t._id, title: t.title })));

        setTrips(tripsData);

        // Calculate price range
        if (tripsData.length > 0) {
          const prices = tripsData.map(t => t.price);
          const maxPrice = Math.max(...prices);
          setPriceRange([0, Math.ceil(maxPrice / 1000) * 1000]);
        }
      } catch (error: any) {
        console.error('❌ Error fetching trips:', error);
        console.error('Error details:', error.response?.data || error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchTrips();
  }, [searchTerm, selectedCategory]);

  // Apply filters and sorting
  useEffect(() => {
    let filtered = [...trips];

    // Price filter
    filtered = filtered.filter(trip =>
      trip.price >= priceRange[0] && trip.price <= priceRange[1]
    );

    // Date filter
    if (startDate) {
      filtered = filtered.filter(trip =>
        new Date(trip.startDate) >= new Date(startDate)
      );
    }
    if (endDate) {
      filtered = filtered.filter(trip =>
        new Date(trip.endDate) <= new Date(endDate)
      );
    }

    // Destination filter
    if (destination) {
      filtered = filtered.filter(trip =>
        trip.destination.toLowerCase().includes(destination.toLowerCase())
      );
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'price':
          return a.price - b.price;
        case 'date':
          return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
        case 'popularity':
          return (b.participants?.length || 0) - (a.participants?.length || 0);
        case 'newest':
        default:
          return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
      }
    });

    setFilteredTrips(filtered);
  }, [trips, priceRange, startDate, endDate, destination, sortBy]);

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
        const raw = response.data as any;
        const tripsData: Trip[] = Array.isArray(raw?.data)
          ? (raw.data as Trip[])
          : Array.isArray(raw)
            ? (raw as Trip[])
            : [];
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

          {/* SEO Helmet */}
          <Helmet>
            <title>{selectedCategory ? `${selectedCategory} Trips` : destination ? `Trips to ${destination}` : 'Explore Adventure Trips'} | TrekTribe</title>
            <meta name="description" content={`Discover the best ${selectedCategory || 'adventure'} trips${destination ? ` in ${destination}` : ''}. Join our community of eco-conscious travelers.`} />
          </Helmet>

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
            <div className="flex flex-col gap-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-forest-500">🔍</span>
                    <input
                      type="text"
                      placeholder="Search trips..."
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
                    <option value="">All Categories</option>
                    {categories.map(category => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center gap-2 px-4 py-3 bg-nature-600 text-white rounded-xl hover:bg-nature-700 transition-colors font-medium"
                >
                  <Filter className="w-5 h-5" />
                  <span>Filters</span>
                </button>
              </div>

              {/* Advanced Filters Panel */}
              {showFilters && (
                <div className="border-t border-forest-200 pt-4 mt-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Price Range */}
                    <div>
                      <label className="block text-sm font-semibold text-forest-700 mb-2 flex items-center gap-2">
                        <DollarSign className="w-4 h-4" />
                        Price Range
                      </label>
                      <div className="space-y-2">
                        <input
                          type="range"
                          min={0}
                          max={priceRange[1]}
                          step={1000}
                          value={priceRange[1]}
                          onChange={(e) => setPriceRange([priceRange[0], parseInt(e.target.value)])}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-gray-600">
                          <span>₹{priceRange[0].toLocaleString()}</span>
                          <span>₹{priceRange[1].toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* Start Date */}
                    <div>
                      <label className="block text-sm font-semibold text-forest-700 mb-2 flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full px-3 py-2 border-2 border-forest-200 rounded-lg focus:ring-2 focus:ring-nature-500 focus:border-nature-500"
                      />
                    </div>

                    {/* End Date */}
                    <div>
                      <label className="block text-sm font-semibold text-forest-700 mb-2 flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        End Date
                      </label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full px-3 py-2 border-2 border-forest-200 rounded-lg focus:ring-2 focus:ring-nature-500 focus:border-nature-500"
                      />
                    </div>

                    {/* Destination */}
                    <div>
                      <label className="block text-sm font-semibold text-forest-700 mb-2 flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        Destination
                      </label>
                      <input
                        type="text"
                        placeholder="Location..."
                        value={destination}
                        onChange={(e) => setDestination(e.target.value)}
                        className="w-full px-3 py-2 border-2 border-forest-200 rounded-lg focus:ring-2 focus:ring-nature-500 focus:border-nature-500"
                      />
                    </div>
                  </div>

                  {/* Sort By */}
                  <div className="flex items-center gap-4">
                    <label className="text-sm font-semibold text-forest-700 flex items-center gap-2">
                      <ArrowUpDown className="w-4 h-4" />
                      Sort By:
                    </label>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="px-4 py-2 border-2 border-forest-200 rounded-lg focus:ring-2 focus:ring-nature-500 focus:border-nature-500"
                    >
                      <option value="newest">Newest First</option>
                      <option value="price">Price: Low to High</option>
                      <option value="date">Date: Soonest First</option>
                      <option value="popularity">Most Popular</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTrips.map((trip) => (
              <div key={trip._id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
                <div className="relative h-48 overflow-hidden">
                  {/* Try to display organizer uploaded images first */}
                  {(trip.coverImage || (trip.images && trip.images.length > 0)) ? (
                    <img
                      src={trip.coverImage || trip.images[0]}
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
                  <div className={`absolute inset-0 bg-gradient-to-br from-forest-400 to-nature-500 flex items-center justify-center ${(trip.coverImage || (trip.images && trip.images.length > 0)) ? 'hidden' : 'flex'}`}>
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
                  <div className="absolute top-4 right-4 flex gap-2">
                    <SaveTripButton tripId={trip._id} size="md" className="z-10" />
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
                      {trip.participants?.length || 0}/{trip.capacity} spots filled
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-4">
                    {trip.categories?.map((category, index) => (
                      <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                        {category}
                      </span>
                    ))}
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-2xl font-bold text-nature-600">₹{trip.price}</span>
                      <SocialShareButtons
                        tripId={trip._id}
                        tripTitle={trip.title}
                        tripDescription={trip.description}
                        variant="icon-only"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Link
                        to={`/trip/${trip._id}`}
                        className="flex-1 bg-forest-100 hover:bg-forest-200 text-forest-700 px-3 py-2 rounded-lg font-medium text-sm transition-all duration-300 border border-forest-200 text-center relative z-10"
                      >
                        👁️ View Details
                      </Link>
                      {trip.participants?.includes(user?.id || '') ? (
                        <button
                          onClick={() => handleLeaveTrip(trip._id)}
                          className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-4 py-2 rounded-xl font-medium transition-all duration-300 transform hover:scale-105 text-sm relative z-10"
                        >
                          🚪 Leave Trip
                        </button>
                      ) : (trip.participants?.length || 0) >= trip.capacity ? (
                        <button
                          disabled
                          className="bg-gray-400 cursor-not-allowed text-white px-4 py-2 rounded-xl font-medium text-sm"
                        >
                          🎆 Full
                        </button>
                      ) : (
                        <button
                          onClick={() => handleJoinTrip(trip)}
                          className="bg-gradient-to-r from-forest-600 to-nature-600 hover:from-forest-700 hover:to-nature-700 text-white px-4 py-2 rounded-xl font-medium transition-all duration-300 transform hover:scale-105 relative z-10"
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

        {filteredTrips.length === 0 && !loading && (
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
                        alert('💬 Chat support will be available soon. For immediate help, please contact us at trektribeagent@gmail.com or call 9876177839');
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
        {!loading && filteredTrips.length > 0 && (
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
