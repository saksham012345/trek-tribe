import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Trash2, Tag, Calendar, MapPin, Users, DollarSign, Filter } from 'lucide-react';
import api from '../config/api';
import { useAuth } from '../contexts/AuthContext';

interface WishlistItem {
  _id: string;
  tripId: {
    _id: string;
    title: string;
    description: string;
    destination: string;
    price: number;
    startDate: string;
    endDate: string;
    capacity: number;
    images: string[];
    coverImage?: string;
    categories: string[];
  };
  notes?: string;
  priority: 'low' | 'medium' | 'high';
  tags: string[];
  createdAt: string;
}

const Wishlist: React.FC = () => {
  const { user } = useAuth();
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [stats, setStats] = useState({
    totalItems: 0,
    priorityBreakdown: { low: 0, medium: 0, high: 0 },
    popularTags: [] as Array<{ tag: string; count: number }>
  });

  useEffect(() => {
    if (user) {
      fetchWishlist();
      fetchStats();
    }
  }, [user, filterPriority, sortBy]);

  const fetchWishlist = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterPriority !== 'all') {
        params.append('priority', filterPriority);
      }
      params.append('sortBy', sortBy);
      params.append('sortOrder', 'desc');
      
      const response = await api.get(`/wishlist?${params.toString()}`);
      const data = (response.data as any);
      setWishlistItems(data.wishlistItems || []);
    } catch (error) {
      console.error('Error fetching wishlist:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get('/wishlist/stats');
      setStats((response.data as any));
    } catch (error) {
      console.error('Error fetching wishlist stats:', error);
    }
  };

  const handleRemove = async (wishlistId: string) => {
    if (!window.confirm('Remove this trip from your wishlist?')) return;

    try {
      await api.delete(`/wishlist/${wishlistId}`);
      setWishlistItems(items => items.filter(item => item._id !== wishlistId));
      fetchStats();
    } catch (error) {
      console.error('Error removing from wishlist:', error);
      alert('Failed to remove from wishlist');
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 border-red-300';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-forest-50 to-nature-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-forest-800 mb-2">Login Required</h2>
          <p className="text-forest-600 mb-6">Please login to view your wishlist</p>
          <Link
            to="/login"
            className="inline-block bg-gradient-to-r from-forest-600 to-nature-600 text-white px-6 py-3 rounded-xl font-medium hover:from-forest-700 hover:to-nature-700 transition-all"
          >
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-forest-50 to-nature-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-forest-800 mb-2 flex items-center gap-3">
            <Heart className="w-10 h-10 text-red-500 fill-current" />
            My Wishlist
          </h1>
          <p className="text-forest-600">Trips you've saved for later</p>
        </div>

        {/* Stats */}
        {stats.totalItems > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-forest-800">{stats.totalItems}</div>
                <div className="text-sm text-forest-600">Total Saved</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-red-600">{stats.priorityBreakdown.high}</div>
                <div className="text-sm text-forest-600">High Priority</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-yellow-600">{stats.priorityBreakdown.medium}</div>
                <div className="text-sm text-forest-600">Medium</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">{stats.priorityBreakdown.low}</div>
                <div className="text-sm text-forest-600">Low</div>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-forest-600" />
              <span className="font-medium text-forest-700">Filter:</span>
            </div>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="px-4 py-2 border-2 border-forest-200 rounded-lg focus:ring-2 focus:ring-nature-500 focus:border-nature-500"
            >
              <option value="all">All Priorities</option>
              <option value="high">High Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="low">Low Priority</option>
            </select>
            <div className="flex items-center gap-2 ml-auto">
              <span className="font-medium text-forest-700">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-4 py-2 border-2 border-forest-200 rounded-lg focus:ring-2 focus:ring-nature-500 focus:border-nature-500"
              >
                <option value="createdAt">Recently Added</option>
                <option value="priority">Priority</option>
                <option value="trip.startDate">Trip Date</option>
                <option value="trip.price">Price</option>
              </select>
            </div>
          </div>
        </div>

        {/* Wishlist Items */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-nature-600"></div>
          </div>
        ) : wishlistItems.length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <Heart className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-forest-800 mb-2">Your Wishlist is Empty</h3>
            <p className="text-forest-600 mb-6">Start saving trips you love to your wishlist</p>
            <Link
              to="/trips"
              className="inline-block bg-gradient-to-r from-forest-600 to-nature-600 text-white px-6 py-3 rounded-xl font-medium hover:from-forest-700 hover:to-nature-700 transition-all"
            >
              Explore Trips
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {wishlistItems?.map((item) => (
              <div key={item._id} className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
                <div className="relative h-48">
                  {item.tripId.coverImage || (item.tripId.images && item.tripId.images.length > 0) ? (
                    <img
                      src={item.tripId.coverImage || item.tripId.images[0]}
                      alt={item.tripId.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-forest-400 to-nature-500 flex items-center justify-center">
                      <span className="text-6xl">🏔️</span>
                    </div>
                  )}
                  <div className="absolute top-4 right-4 flex gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getPriorityColor(item.priority)}`}>
                      {item.priority}
                    </span>
                  </div>
                  <div className="absolute top-4 left-4">
                    <div className="bg-white/90 backdrop-blur-sm rounded-full px-3 py-1 text-forest-800 text-sm font-semibold">
                      ₹{item.tripId.price.toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-bold text-forest-800 mb-2">{item.tripId.title}</h3>
                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">{item.tripId.description}</p>
                  
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center text-sm text-gray-600">
                      <MapPin className="w-4 h-4 mr-2" />
                      {item.tripId.destination}
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <Calendar className="w-4 h-4 mr-2" />
                      {new Date(item.tripId.startDate).toLocaleDateString()} - {new Date(item.tripId.endDate).toLocaleDateString()}
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <Users className="w-4 h-4 mr-2" />
                      Up to {item.tripId.capacity} travelers
                    </div>
                  </div>

                  {(item.tags?.length || 0) > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {item.tags?.map((tag, idx) => (
                        <span key={idx} className="px-2 py-1 bg-forest-100 text-forest-700 text-xs rounded-full flex items-center gap-1">
                          <Tag className="w-3 h-3" />
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {item.notes && (
                    <div className="bg-forest-50 rounded-lg p-3 mb-4">
                      <p className="text-sm text-forest-700 italic">"{item.notes}"</p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Link
                      to={`/trip/${item.tripId._id}`}
                      className="flex-1 bg-gradient-to-r from-forest-600 to-nature-600 text-white px-4 py-2 rounded-lg font-medium text-center hover:from-forest-700 hover:to-nature-700 transition-all"
                    >
                      View Details
                    </Link>
                    <button
                      onClick={() => handleRemove(item._id)}
                      className="bg-red-100 text-red-600 hover:bg-red-200 px-4 py-2 rounded-lg transition-colors"
                      title="Remove from wishlist"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Wishlist;

