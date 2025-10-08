import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../config/api';
import JoinTripModal from '../components/JoinTripModal';
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
          
          {/* Search and Filter */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-forest-200 mb-8">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-forest-500">🔍</span>
                  <input
                    type="text"
                    placeholder="Search wilderness adventures..."
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
                <div className="h-48 bg-gray-200 flex items-center justify-center">
                  <span className="text-gray-500">Trip Image</span>
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
                  <button className="bg-forest-600 hover:bg-forest-700 text-white px-4 py-2 rounded-lg text-sm transition-colors">
                    Contact Support
                  </button>
                </div>
              )}
            </div>
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
