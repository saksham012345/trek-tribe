import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useParams } from 'react-router-dom';
import { Filter, Calendar, MapPin, DollarSign, ArrowUpDown } from 'lucide-react';
import api from '../config/api';
import JoinTripModal from '../components/JoinTripModal';
import AISmartSearch from '../components/AISmartSearch';
import AIRecommendations from '../components/AIRecommendations';
import { User } from '../types';
import { ConsumerLayout } from '../layout/ConsumerLayout';
import { TripCard } from '../components/features/TripCard';

interface Trip {
  _id: string; title: string; description: string; destination: string;
  price: number; capacity: number; participants: string[]; categories: string[];
  images: string[]; coverImage?: string; organizerId: string; status: string;
  startDate: string; endDate: string;
}
interface TripsProps { user: User | null; }

const Trips: React.FC<TripsProps> = ({ user }) => {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [filteredTrips, setFilteredTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const { category, destination: destinationParam } = useParams<{ category: string; destination: string }>();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(category || '');
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 100000]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [destination, setDestination] = useState(destinationParam || '');
  const [sortBy, setSortBy] = useState<'price' | 'date' | 'popularity' | 'newest'>('newest');
  const categories = ['Adventure', 'Cultural', 'Beach', 'Mountain', 'City', 'Nature'];

  useEffect(() => {
    const fetchTrips = async () => {
      try {
        const params = new URLSearchParams();
        if (searchTerm) params.append('q', searchTerm);
        if (selectedCategory) params.append('category', selectedCategory);
        const response = await api.get(`/trips?${params.toString()}`);
        const raw = response.data as any;
        const tripsData: Trip[] = Array.isArray(raw?.data) ? raw.data : Array.isArray(raw) ? raw : [];
        setTrips(tripsData);
        if (tripsData.length > 0) {
          const maxPrice = Math.max(...tripsData.map((t) => t.price));
          setPriceRange([0, Math.ceil(maxPrice / 1000) * 1000]);
        }
      } catch (err: any) { console.error('Error fetching trips:', err); }
      finally { setLoading(false); }
    };
    fetchTrips();
  }, [searchTerm, selectedCategory]);

  useEffect(() => {
    let filtered = [...trips].filter((t) => t.price >= priceRange[0] && t.price <= priceRange[1]);
    if (startDate) filtered = filtered.filter((t) => new Date(t.startDate) >= new Date(startDate));
    if (endDate) filtered = filtered.filter((t) => new Date(t.endDate) <= new Date(endDate));
    if (destination) filtered = filtered.filter((t) => t.destination.toLowerCase().includes(destination.toLowerCase()));
    filtered.sort((a, b) => {
      if (sortBy === 'price') return a.price - b.price;
      if (sortBy === 'date') return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
      if (sortBy === 'popularity') return (b.participants?.length || 0) - (a.participants?.length || 0);
      return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
    });
    setFilteredTrips(filtered);
  }, [trips, priceRange, startDate, endDate, destination, sortBy]);

  const handleJoinTrip = (trip: Trip) => {
    if (!user) { alert('Please login to join trips'); return; }
    setSelectedTrip(trip); setShowJoinModal(true);
  };
  const handleLeaveTrip = async (tripId: string) => {
    if (!user || !window.confirm('Leave this trip?')) return;
    try {
      await api.post(`/trips/${tripId}/leave`);
      const r = await api.get('/trips'); const raw = r.data as any;
      setTrips(Array.isArray(raw?.data) ? raw.data : Array.isArray(raw) ? raw : []);
    } catch (err: any) { alert(err.response?.data?.error || 'Failed to leave trip'); }
  };
  const handleJoinSuccess = async () => {
    const r = await api.get('/trips'); const raw = r.data as any;
    setTrips(Array.isArray(raw?.data) ? raw.data : Array.isArray(raw) ? raw : []);
  };
  const tripEmoji = (cats: string[]) => {
    if (cats?.includes('Mountain')) return '🏔️';
    if (cats?.includes('Nature')) return '🌲';
    if (cats?.includes('Beach')) return '🏖️';
    if (cats?.includes('Cultural')) return '🏛️';
    return '🌍';
  };

  return (
    <ConsumerLayout user={user}>
      <Helmet>
        <title>{selectedCategory ? `${selectedCategory} Trips` : 'Explore Adventures'} | TrekTribe</title>
        <meta name="description" content="Discover adventure trips and connect with fellow travelers." />
      </Helmet>
      
      <div className="px-4 sm:px-6 space-y-8 pt-4 pb-10">
        
        {/* Header Section */}
        <div className="text-center px-2 pt-2 md:pt-4">
          <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-forest-900 to-nature-600 mb-3 tracking-tight">
            Discover Your Next <br className="md:hidden" /><span className="text-[#b4d4b4]">Adventure</span>
          </h1>
        </div>

        {/* Global Floating Search */}
        <div className="sticky top-0 z-40 -mx-4 px-4 py-2 transition-all duration-300">
          <div className="relative group max-w-3xl mx-auto shadow-sm rounded-2xl overflow-hidden bg-white/90 backdrop-blur-xl border border-gray-200">
            <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
              <span className="text-gray-400 group-focus-within:text-forest-600 transition-colors text-xl">🔍</span>
            </div>
            <input type="text" placeholder="Where to?" value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-14 pr-4 py-4 border-none bg-transparent focus:ring-2 focus:ring-forest-500/20 text-lg font-medium text-gray-800 placeholder-gray-400 transition-all outline-none" />
          </div>
        </div>

        {/* Category Chips - Horizontal Scroll */}
        <div className="chips-scroll flex gap-2 overflow-x-auto pb-4 pt-2 -mx-4 px-4 scrollbar-hide snap-x">
          {['', ...categories].map((cat) => (
            <button key={cat || 'all'} onClick={() => setSelectedCategory(cat)}
              className={`snap-start flex-shrink-0 px-5 py-2.5 rounded-full text-sm font-bold transition-all duration-300 min-h-[44px] shadow-sm transform active:scale-95 border ${selectedCategory === cat ? 'bg-forest-600 text-[#b4d4b4] border-transparent' : 'bg-white text-gray-600 border-gray-200 hover:bg-forest-50'}`}>
              {cat ? `${tripEmoji([cat])} ${cat}` : '🧭 All'}
            </button>
          ))}
        </div>

        {/* Content Rest Omitted for brevity of testing ConsumerLayout (but re-implementing below) */}

        {/* Advanced Filters Toggle */}
        <button onClick={() => setShowFilters(!showFilters)}
            className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200 rounded-2xl font-bold text-sm min-h-[44px] transition-all active:scale-[0.98]">
            <Filter className="w-5 h-5" />{showFilters ? 'Hide Filters' : 'Advanced Filters'}
        </button>

        {showFilters && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Max Price</label>
                <input type="range" min={0} max={priceRange[1]} step={1000} value={priceRange[1]} onChange={(e) => setPriceRange([0, parseInt(e.target.value)])} className="w-full accent-forest-600" />
                <div className="text-sm font-bold text-forest-700 mt-2">Up to Rs. {priceRange[1].toLocaleString()}</div>
              </div>
            </div>
        )}

        {/* Loading / Results */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 px-4">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-100 border-b-forest-600 mb-4"></div>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {filteredTrips.map((trip) => (
              <TripCard 
                key={trip._id} 
                trip={trip} 
                user={user} 
                onJoinClick={handleJoinTrip} 
                onLeaveClick={handleLeaveTrip} 
              />
            ))}
          </div>
        )}

        {/* Empty State */}
        {filteredTrips.length === 0 && !loading && (
          <div className="text-center py-20 px-4 bg-white rounded-3xl border border-gray-100 shadow-sm">
            <div className="text-6xl mb-6 opacity-80">⛺</div>
            <h3 className="text-xl font-extrabold text-gray-900 mb-2">No adventures found</h3>
            <button onClick={() => { setSearchTerm(''); setSelectedCategory(''); setShowFilters(false); }}
              className="mt-6 px-6 py-2 bg-gray-100 text-gray-700 rounded-2xl font-bold active:scale-[0.98]">
              Clear filters
            </button>
          </div>
        )}

        {selectedTrip && (
          <JoinTripModal trip={selectedTrip} user={user!} isOpen={showJoinModal}
            onClose={() => { setShowJoinModal(false); setSelectedTrip(null); }}
            onSuccess={handleJoinSuccess} />
        )}
      </div>
    </ConsumerLayout>
  );
};

export default Trips;