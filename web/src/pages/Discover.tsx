import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Search } from 'lucide-react';
import api from '../config/api';
import { User } from '../types';
import { GlassCard, GlassPanel, ScarcityBadge } from '../components/ui/Glass';

interface DiscoverTrip {
  _id: string;
  title: string;
  destination: string;
  price: number;
  startDate: string;
  endDate: string;
  coverImage?: string;
  images?: string[];
  categories?: string[];
  participants?: string[];
  capacity: number;
}

interface DiscoverProps {
  user: User | null;
}

const Discover: React.FC<DiscoverProps> = ({ user: _user }) => {
  const [trips, setTrips] = useState<DiscoverTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [mobileCols, setMobileCols] = useState(2);
  const [desktopCols, setDesktopCols] = useState(3);

  useEffect(() => {
    const load = async () => {
      try {
        const [tripsRes, settingsRes] = await Promise.all([
          api.get('/trips'),
          api.get('/api/site-settings/public')
        ]);

        const rawTrips = tripsRes.data;
        const list = Array.isArray(rawTrips?.data)
          ? rawTrips.data
          : Array.isArray(rawTrips)
            ? rawTrips
            : [];
        setTrips(list);

        const s = settingsRes?.data?.data?.home;
        if (s?.discoverColumnsMobile) {
          setMobileCols(Math.max(1, Math.min(3, s.discoverColumnsMobile)));
        }
        if (s?.discoverColumnsDesktop) {
          setDesktopCols(Math.max(2, Math.min(4, s.discoverColumnsDesktop)));
        }
      } catch (error) {
        console.error('Failed to load discover data', error);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return trips;
    return trips.filter((t) =>
      t.title.toLowerCase().includes(q) ||
      t.destination.toLowerCase().includes(q) ||
      (t.categories || []).some((c) => c.toLowerCase().includes(q))
    );
  }, [trips, search]);

  const mobileColsClass = mobileCols === 1 ? 'grid-cols-1' : mobileCols === 3 ? 'grid-cols-3' : 'grid-cols-2';
  const desktopColsClass = desktopCols === 2 ? 'lg:grid-cols-2' : desktopCols === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3';

  return (
    <div className="min-h-screen bg-gray-50">
      <Helmet>
        <title>Discover Trips | TrekTribe</title>
        <meta name="description" content="Explore upcoming adventure trips, compare dates, and book your next journey." />
      </Helmet>

      <div className="px-4 sm:px-6 py-6 space-y-6">
        <GlassPanel className="rounded-glass p-5">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Discover Adventures</h1>
          <div className="relative mt-4">
            <Search size={18} strokeWidth={2} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search destination, category, or trip..."
              className="w-full rounded-xl border border-gray-300 bg-white/70 pl-11 pr-4 py-3 outline-none focus:ring-2 focus:ring-forest-500 transition-all duration-300 ease-spring"
            />
          </div>
        </GlassPanel>

        {loading ? (
          <div className="text-center py-16 text-gray-500">Loading trips...</div>
        ) : filtered.length === 0 ? (
          <GlassPanel className="text-center py-16 rounded-glass text-gray-500">
            No trips found for this search.
          </GlassPanel>
        ) : (
          <div className={`grid ${mobileColsClass} ${desktopColsClass} gap-3 md:gap-5`}>
            {filtered.map((trip, index) => {
              const image = trip.coverImage || trip.images?.[0] || 'https://images.unsplash.com/photo-1464822759844-d150ad6d1f6d?q=80&w=1000&auto=format&fit=crop';
              const filled = trip.participants?.length || 0;
              const seatsLeft = Math.max(trip.capacity - filled, 0);
              return (
                <GlassCard key={trip._id} delayMs={Math.min(index, 8) * 40} className="overflow-hidden p-0">
                  <Link to={`/trip/${trip._id}`} className="block">
                    <img src={image} alt={trip.title} className="w-full h-28 md:h-40 object-cover" />
                    <div className="p-3 space-y-1">
                      <h3 className="font-semibold text-sm md:text-base text-gray-900 line-clamp-2">{trip.title}</h3>
                      <p className="text-xs md:text-sm text-gray-600">{trip.destination}</p>
                      <p className="text-xs text-gray-500">{new Date(trip.startDate).toLocaleDateString('en-IN')}</p>
                      <div className="flex items-center justify-between pt-1 gap-2">
                        <span className="text-sm font-bold text-forest-700 tabular-nums">INR {trip.price}</span>
                        <ScarcityBadge spotsLeft={seatsLeft} className="!py-0.5 !px-2 !text-[10px]" />
                      </div>
                    </div>
                  </Link>
                </GlassCard>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Discover;
