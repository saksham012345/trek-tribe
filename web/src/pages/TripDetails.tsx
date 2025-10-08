import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../config/api';
import JoinTripModal from '../components/JoinTripModal';
import ReviewModal from '../components/ReviewModal';
import ReviewsList from '../components/ReviewsList';
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
  coverImage?: string;
  organizerId: string;
  status: string;
  startDate: string;
  endDate: string;
  itinerary?: string;
  schedule?: Array<{
    day: number;
    title: string;
    activities: string[];
  }>;
  difficultyLevel?: string;
  includedItems?: string[];
  requirements?: string[];
  location?: {
    coordinates: [number, number];
  };
}

interface TripDetailsProps {
  user: User | null;
}

const TripDetails: React.FC<TripDetailsProps> = ({ user }) => {
  const { id } = useParams<{ id: string }>();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  useEffect(() => {
    const fetchTrip = async () => {
      if (!id) return;
      
      try {
        const response = await api.get(`/trips/${id}`);
        const tripData = response.data as Trip;
        setTrip(tripData);
      } catch (error: any) {
        console.error('Error fetching trip:', error);
        setError('Failed to load trip details');
      } finally {
        setLoading(false);
      }
    };

    fetchTrip();
  }, [id]);

  const handleJoinSuccess = async () => {
    // Refresh trip data
    if (id) {
      const response = await api.get(`/trips/${id}`);
      const tripData = response.data as Trip;
      setTrip(tripData);
    }
  };

  const handleReviewSuccess = () => {
    // Reviews will refresh automatically via ReviewsList component
    alert('Thank you for your review!');
  };

  const isParticipant = trip && user && trip.participants.includes(user.id);
  const isOrganizer = trip && user && trip.organizerId === user.id;
  const canJoin = trip && user && !isParticipant && !isOrganizer && trip.participants.length < trip.capacity;
  const canReview = isParticipant && !isOrganizer; // Only participants who are not organizers can review

  const getDifficultyColor = (level?: string) => {
    switch (level) {
      case 'beginner': return 'text-green-600 bg-green-100';
      case 'intermediate': return 'text-yellow-600 bg-yellow-100';
      case 'advanced': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getDifficultyIcon = (level?: string) => {
    switch (level) {
      case 'beginner': return '🟢';
      case 'intermediate': return '🟡';
      case 'advanced': return '🔴';
      default: return '⚪';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getDaysDifference = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-forest-50 to-nature-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse space-y-8">
            <div className="h-96 bg-gray-200 rounded-2xl"></div>
            <div className="grid lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <div className="h-8 bg-gray-200 rounded w-3/4"></div>
                <div className="h-32 bg-gray-200 rounded"></div>
              </div>
              <div className="space-y-4">
                <div className="h-64 bg-gray-200 rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-forest-50 to-nature-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🏔️</div>
          <h2 className="text-2xl font-bold text-forest-800 mb-4">Trip Not Found</h2>
          <p className="text-forest-600 mb-6">{error || 'This adventure seems to have gone missing!'}</p>
          <Link
            to="/trips"
            className="px-6 py-3 bg-gradient-to-r from-forest-600 to-nature-600 text-white rounded-xl font-semibold hover:from-forest-700 hover:to-nature-700 transition-all duration-300"
          >
            Browse Other Adventures
          </Link>
        </div>
      </div>
    );
  }

  const tripImages = trip.images && trip.images.length > 0 ? trip.images : [];
  const duration = getDaysDifference(trip.startDate, trip.endDate);

  return (
    <div className="min-h-screen bg-gradient-to-br from-forest-50 to-nature-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Image Gallery */}
        <div className="mb-8">
          {tripImages.length > 0 ? (
            <div className="space-y-4">
              <div className="relative h-96 rounded-2xl overflow-hidden shadow-2xl">
                <img
                  src={trip.coverImage || tripImages[selectedImageIndex]}
                  alt={trip.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = `https://images.unsplash.com/photo-1441974231531-c6227db76b6e?q=80&w=2071&h=600&fit=crop`;
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
                <div className="absolute bottom-6 left-6 text-white">
                  <div className="flex items-center space-x-2 mb-2">
                    {trip.categories.map((category, index) => (
                      <span key={index} className="px-2 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs font-medium">
                        {category}
                      </span>
                    ))}
                  </div>
                  <h1 className="text-4xl font-bold mb-2">{trip.title}</h1>
                  <p className="text-xl opacity-90">📍 {trip.destination}</p>
                </div>
              </div>
              
              {tripImages.length > 1 && (
                <div className="flex space-x-2 overflow-x-auto pb-2">
                  {tripImages.map((image, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedImageIndex(index)}
                      className={`flex-shrink-0 w-24 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                        selectedImageIndex === index ? 'border-nature-500 ring-2 ring-nature-200' : 'border-gray-200'
                      }`}
                    >
                      <img
                        src={image}
                        alt={`${trip.title} ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="h-96 bg-gradient-to-br from-forest-400 to-nature-500 rounded-2xl flex items-center justify-center text-white shadow-2xl">
              <div className="text-center">
                <div className="text-8xl mb-4">🏔️</div>
                <h1 className="text-4xl font-bold mb-2">{trip.title}</h1>
                <p className="text-xl">📍 {trip.destination}</p>
              </div>
            </div>
          )}
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Trip Info */}
            <div className="bg-white rounded-2xl p-8 shadow-lg border border-forest-200">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-4">
                  <h2 className="text-2xl font-bold text-forest-800">Adventure Details</h2>
                  {trip.difficultyLevel && (
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getDifficultyColor(trip.difficultyLevel)}`}>
                      {getDifficultyIcon(trip.difficultyLevel)} {trip.difficultyLevel.charAt(0).toUpperCase() + trip.difficultyLevel.slice(1)}
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-nature-600">₹{trip.price.toLocaleString()}</div>
                  <div className="text-sm text-forest-600">per person</div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <div className="space-y-3">
                  <div className="flex items-center text-forest-700">
                    <span className="mr-3 text-xl">📅</span>
                    <div>
                      <div className="font-semibold">Duration</div>
                      <div className="text-sm text-forest-600">{duration} days, {duration - 1} nights</div>
                    </div>
                  </div>
                  <div className="flex items-center text-forest-700">
                    <span className="mr-3 text-xl">🗓️</span>
                    <div>
                      <div className="font-semibold">Start Date</div>
                      <div className="text-sm text-forest-600">{formatDate(trip.startDate)}</div>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center text-forest-700">
                    <span className="mr-3 text-xl">👥</span>
                    <div>
                      <div className="font-semibold">Group Size</div>
                      <div className="text-sm text-forest-600">{trip.participants.length}/{trip.capacity} adventurers</div>
                    </div>
                  </div>
                  <div className="flex items-center text-forest-700">
                    <span className="mr-3 text-xl">🏁</span>
                    <div>
                      <div className="font-semibold">End Date</div>
                      <div className="text-sm text-forest-600">{formatDate(trip.endDate)}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-forest-100 pt-6">
                <h3 className="text-lg font-semibold text-forest-800 mb-3">About This Adventure</h3>
                <p className="text-forest-700 leading-relaxed">{trip.description}</p>
              </div>
            </div>

            {/* What's Included & Requirements */}
            {(trip.includedItems || trip.requirements) && (
              <div className="bg-white rounded-2xl p-8 shadow-lg border border-forest-200">
                <div className="grid md:grid-cols-2 gap-8">
                  {trip.includedItems && trip.includedItems.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-forest-800 mb-4 flex items-center">
                        <span className="mr-2">✅</span>
                        What's Included
                      </h3>
                      <ul className="space-y-2">
                        {trip.includedItems.map((item, index) => (
                          <li key={index} className="flex items-center text-forest-700">
                            <span className="mr-2 text-nature-500">•</span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {trip.requirements && trip.requirements.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-forest-800 mb-4 flex items-center">
                        <span className="mr-2">📋</span>
                        Requirements
                      </h3>
                      <ul className="space-y-2">
                        {trip.requirements.map((req, index) => (
                          <li key={index} className="flex items-center text-forest-700">
                            <span className="mr-2 text-amber-500">•</span>
                            {req}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Itinerary & Schedule */}
            {(trip.itinerary || (trip.schedule && trip.schedule.length > 0)) && (
              <div className="bg-white rounded-2xl p-8 shadow-lg border border-forest-200">
                <h3 className="text-lg font-semibold text-forest-800 mb-6 flex items-center">
                  <span className="mr-2">🗺️</span>
                  Adventure Itinerary
                </h3>
                
                {trip.schedule && trip.schedule.length > 0 ? (
                  <div className="space-y-6">
                    {trip.schedule.map((day, index) => (
                      <div key={index} className="flex space-x-4">
                        <div className="flex-shrink-0">
                          <div className="w-10 h-10 bg-gradient-to-br from-nature-500 to-forest-600 rounded-full flex items-center justify-center text-white font-bold">
                            {day.day}
                          </div>
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-forest-800 mb-2">{day.title}</h4>
                          {day.activities && day.activities.length > 0 && (
                            <ul className="space-y-1">
                              {day.activities.map((activity, actIndex) => (
                                <li key={actIndex} className="text-forest-600 text-sm flex items-start">
                                  <span className="mr-2 text-nature-500 mt-1">→</span>
                                  {activity}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-forest-700 leading-relaxed whitespace-pre-line">
                    {trip.itinerary}
                  </div>
                )}
              </div>
            )}

            {/* Reviews Section */}
            <div className="bg-white rounded-2xl p-8 shadow-lg border border-forest-200">
              <ReviewsList
                tripId={trip._id}
                allowReview={!!canReview}
                currentUserId={user?.email}
                onWriteReview={() => setShowReviewModal(true)}
              />
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Booking Card */}
            <div className="bg-white rounded-2xl p-6 shadow-lg border border-forest-200 sticky top-4">
              <div className="text-center mb-6">
                <div className="text-3xl font-bold text-nature-600 mb-1">₹{trip.price.toLocaleString()}</div>
                <div className="text-sm text-forest-600">per adventurer</div>
              </div>

              <div className="space-y-4 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-forest-600">Available spots:</span>
                  <span className="font-semibold text-forest-800">{trip.capacity - trip.participants.length}/{trip.capacity}</span>
                </div>
                <div className="w-full bg-forest-100 rounded-full h-2">
                  <div
                    className="bg-nature-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${(trip.participants.length / trip.capacity) * 100}%` }}
                  ></div>
                </div>
              </div>

              <div className="space-y-3">
                {canJoin ? (
                  <button
                    onClick={() => setShowJoinModal(true)}
                    className="w-full bg-gradient-to-r from-forest-600 to-nature-600 hover:from-forest-700 hover:to-nature-700 text-white py-4 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg"
                  >
                    🌟 Join This Adventure
                  </button>
                ) : isParticipant ? (
                  <div className="text-center py-4">
                    <div className="text-nature-600 font-semibold mb-2">✅ You're signed up!</div>
                    <div className="text-sm text-forest-600">Get ready for an amazing adventure</div>
                  </div>
                ) : isOrganizer ? (
                  <div className="text-center py-4">
                    <div className="text-forest-600 font-semibold mb-2">🗺️ You're organizing this trip</div>
                    <Link
                      to={`/edit-trip/${trip._id}`}
                      className="inline-block px-4 py-2 bg-forest-600 text-white rounded-lg hover:bg-forest-700 transition-colors"
                    >
                      Edit Trip
                    </Link>
                  </div>
                ) : trip.participants.length >= trip.capacity ? (
                  <div className="text-center py-4 text-amber-600 font-semibold">
                    🎆 This adventure is fully booked
                  </div>
                ) : !user ? (
                  <div className="text-center">
                    <Link
                      to="/login"
                      className="w-full inline-block bg-gradient-to-r from-forest-600 to-nature-600 hover:from-forest-700 hover:to-nature-700 text-white py-4 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg text-center"
                    >
                      Login to Join Adventure
                    </Link>
                  </div>
                ) : (
                  <div className="text-center py-4 text-forest-600">
                    Unable to join this adventure
                  </div>
                )}

                <div className="text-center text-xs text-forest-500 pt-2">
                  Free cancellation up to 7 days before start date
                </div>
              </div>
            </div>

            {/* Organizer Info */}
            <div className="bg-white rounded-2xl p-6 shadow-lg border border-forest-200">
              <h3 className="text-lg font-semibold text-forest-800 mb-4">Adventure Guide</h3>
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-br from-forest-400 to-nature-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                  O
                </div>
                <div>
                  <div className="font-semibold text-forest-800">Trek Organizer</div>
                  <div className="text-sm text-forest-600">Adventure Leader</div>
                </div>
              </div>
              <div className="mt-4 text-sm text-forest-600">
                Experienced guide with multiple successful expeditions
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {trip && showJoinModal && user && (
        <JoinTripModal
          trip={trip}
          user={user}
          isOpen={showJoinModal}
          onClose={() => setShowJoinModal(false)}
          onSuccess={handleJoinSuccess}
        />
      )}

      {trip && showReviewModal && user && (
        <ReviewModal
          tripId={trip._id}
          tripTitle={trip.title}
          user={user}
          isOpen={showReviewModal}
          onClose={() => setShowReviewModal(false)}
          onSuccess={handleReviewSuccess}
        />
      )}
    </div>
  );
};

export default TripDetails;