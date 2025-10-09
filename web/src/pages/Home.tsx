import React, { useState, useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import axios from 'axios';
import { User } from '../types';
import { useAuth } from '../contexts/AuthContext';


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

interface HomeProps {
  user: User | null;
}

const Home: React.FC<HomeProps> = ({ user }) => {
  const { user: currentUser } = useAuth();
  const [featuredTrips, setFeaturedTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalTrips: 0,
    totalUsers: 0,
    totalOrganizers: 0,
    totalBookings: 0,
    countries: 0
  });
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Background images for hero carousel
  const heroImages = [
    'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?q=80&w=2071',
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?q=80&w=2070', 
    'https://images.unsplash.com/photo-1469474968028-56623f02e42e?q=80&w=2069'
  ];

  useEffect(() => {
    // Only fetch data if user is authenticated
    if (!currentUser) {
      setLoading(false);
      return;
    }

    // Fetch real data from the API
    const fetchData = async () => {
      try {
        setLoading(true);
        const [tripsRes, statsRes] = await Promise.all([
          axios.get('/trips?limit=6'),
          axios.get('/admin/stats')
        ]);
        
        const tripsData = tripsRes.data as Trip[];
        setFeaturedTrips(tripsData || []);
        
        const statsData = statsRes.data as { trips?: { total?: number; totalBookings?: number }; users?: { total?: number; organizers?: number } };
        if (statsData) {
          setStats({
            totalTrips: statsData.trips?.total || 0,
            totalUsers: statsData.users?.total || 0,
            totalOrganizers: statsData.users?.organizers || 0,
            totalBookings: statsData.trips?.totalBookings || 0,
            countries: 15 // This could be calculated from trip destinations
          });
        }
      } catch (error: any) {
        console.error('Error fetching data:', error.message || error);
        // Set minimal default values on error
        setStats({ totalTrips: 0, totalUsers: 0, totalOrganizers: 0, totalBookings: 0, countries: 0 });
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
    
    // Hero image carousel
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % heroImages.length);
    }, 5000);
    
    return () => clearInterval(interval);
  }, [heroImages.length, currentUser]);

  // Require authentication to access home page
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-forest-50">
      {/* Hero Section with Dynamic Background */}
      <section 
        className="relative min-h-screen flex items-center justify-center overflow-hidden"
        style={{
          backgroundImage: `linear-gradient(rgba(5, 46, 22, 0.7), rgba(20, 83, 45, 0.7)), url('${heroImages[currentImageIndex]}')`
        }}
      >
        <div className="absolute inset-0 bg-forest-gradient opacity-80"></div>
        
        {/* Floating Elements */}
        <div className="absolute top-20 left-10 animate-float">
          <div className="text-forest-200 text-6xl opacity-20">🌲</div>
        </div>
        <div className="absolute top-40 right-20 animate-float" style={{animationDelay: '2s'}}>
          <div className="text-forest-200 text-4xl opacity-30">🦋</div>
        </div>
        <div className="absolute bottom-32 left-20 animate-float" style={{animationDelay: '4s'}}>
          <div className="text-forest-200 text-5xl opacity-25">🍃</div>
        </div>
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
          <div className="mb-8">
            <h1 className="text-5xl md:text-7xl font-bold mb-6 text-white leading-tight">
              Discover Nature's
              <br />
              <span className="text-nature-400 animate-pulse-slow">Hidden Wonders</span>
            </h1>
            <p className="text-xl md:text-2xl mb-8 text-forest-100 max-w-3xl mx-auto leading-relaxed">
              Join a community of eco-conscious adventurers. Explore pristine forests, majestic mountains, 
              and untouched wilderness while making lifelong connections.
            </p>
          </div>
          
          {/* Interactive Stats */}
          <div className="grid grid-cols-3 gap-6 mb-12 max-w-2xl mx-auto">
            <div className="text-center">
              <div className="text-3xl font-bold text-nature-400 animate-bounce-slow">{stats.totalTrips || 0}</div>
              <div className="text-forest-200 text-sm">Adventures</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-nature-400 animate-bounce-slow" style={{animationDelay: '1s'}}>{stats.totalUsers || 0}</div>
              <div className="text-forest-200 text-sm">Explorers</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-nature-400 animate-bounce-slow" style={{animationDelay: '2s'}}>{stats.totalOrganizers || 0}</div>
              <div className="text-forest-200 text-sm">Organizers</div>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            <Link
              to="/trips"
              className="group relative px-10 py-4 bg-nature-600 hover:bg-nature-700 text-white rounded-full text-lg font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
            >
              <span className="flex items-center justify-center gap-2">
                🌿 Explore Adventures
                <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </span>
            </Link>
            {!user && (
              <Link
                to="/register"
                className="group px-10 py-4 border-2 border-forest-200 hover:bg-forest-200 hover:text-forest-900 text-forest-100 rounded-full text-lg font-semibold transition-all duration-300 transform hover:scale-105 backdrop-blur-sm"
              >
                <span className="flex items-center justify-center gap-2">
                  🏕️ Join Community
                </span>
              </Link>
            )}
          </div>
        </div>
        
        {/* Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 border-2 border-forest-200 rounded-full flex justify-center">
            <div className="w-1 h-3 bg-forest-200 rounded-full mt-2 animate-pulse"></div>
          </div>
        </div>
      </section>

      {/* Adventure Categories Section */}
      <section className="py-20 bg-white relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-forest-50/30 to-nature-50/30"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-forest-800 mb-6">
              Choose Your 
              <span className="text-nature-600">Adventure Style</span>
            </h2>
            <p className="text-xl text-forest-600 max-w-3xl mx-auto leading-relaxed">
              From serene forest walks to adrenaline-pumping mountain climbs, find your perfect wilderness experience
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="group bg-gradient-to-br from-forest-100 to-forest-200 rounded-2xl p-8 text-center hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-3">
              <div className="text-6xl mb-4 group-hover:scale-110 transition-transform duration-300">🏔️</div>
              <h3 className="text-xl font-bold text-forest-800 mb-3">Mountain Expeditions</h3>
              <p className="text-forest-600 text-sm leading-relaxed">Conquer majestic peaks and witness breathtaking views from the world's highest mountains.</p>
            </div>
            
            <div className="group bg-gradient-to-br from-nature-100 to-nature-200 rounded-2xl p-8 text-center hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-3">
              <div className="text-6xl mb-4 group-hover:scale-110 transition-transform duration-300">🌲</div>
              <h3 className="text-xl font-bold text-forest-800 mb-3">Forest Treks</h3>
              <p className="text-forest-600 text-sm leading-relaxed">Immerse yourself in ancient forests and discover hidden trails through pristine wilderness.</p>
            </div>
            
            <div className="group bg-gradient-to-br from-earth-100 to-earth-200 rounded-2xl p-8 text-center hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-3">
              <div className="text-6xl mb-4 group-hover:scale-110 transition-transform duration-300">🌊</div>
              <h3 className="text-xl font-bold text-forest-800 mb-3">Water Adventures</h3>
              <p className="text-forest-600 text-sm leading-relaxed">Navigate crystal-clear rivers, pristine lakes, and explore coastal wilderness areas.</p>
            </div>
            
            <div className="group bg-gradient-to-br from-purple-100 to-purple-200 rounded-2xl p-8 text-center hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-3">
              <div className="text-6xl mb-4 group-hover:scale-110 transition-transform duration-300">🌌</div>
              <h3 className="text-xl font-bold text-forest-800 mb-3">Aurora Watching</h3>
              <p className="text-forest-600 text-sm leading-relaxed">Chase the northern lights across Arctic landscapes and witness nature's most magical display.</p>
            </div>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mt-8">
            <div className="group bg-gradient-to-br from-orange-100 to-orange-200 rounded-2xl p-8 text-center hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-3">
              <div className="text-6xl mb-4 group-hover:scale-110 transition-transform duration-300">🏜️</div>
              <h3 className="text-xl font-bold text-forest-800 mb-3">Desert Expeditions</h3>
              <p className="text-forest-600 text-sm leading-relaxed">Explore vast desert landscapes, ancient dunes, and oasis hidden in the wilderness.</p>
            </div>
            
            <div className="group bg-gradient-to-br from-blue-100 to-blue-200 rounded-2xl p-8 text-center hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-3">
              <div className="text-6xl mb-4 group-hover:scale-110 transition-transform duration-300">❄️</div>
              <h3 className="text-xl font-bold text-forest-800 mb-3">Arctic Adventures</h3>
              <p className="text-forest-600 text-sm leading-relaxed">Venture into the pristine Arctic wilderness and experience life at the edge of the world.</p>
            </div>
            
            <div className="group bg-gradient-to-br from-green-100 to-green-200 rounded-2xl p-8 text-center hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-3">
              <div className="text-6xl mb-4 group-hover:scale-110 transition-transform duration-300">🌿</div>
              <h3 className="text-xl font-bold text-forest-800 mb-3">Wildlife Safaris</h3>
              <p className="text-forest-600 text-sm leading-relaxed">Observe magnificent wildlife in their natural habitats across protected wilderness areas.</p>
            </div>
            
            <div className="group bg-gradient-to-br from-pink-100 to-pink-200 rounded-2xl p-8 text-center hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-3">
              <div className="text-6xl mb-4 group-hover:scale-110 transition-transform duration-300">🌸</div>
              <h3 className="text-xl font-bold text-forest-800 mb-3">Botanical Expeditions</h3>
              <p className="text-forest-600 text-sm leading-relaxed">Discover rare plants, ancient trees, and botanical wonders in remote natural gardens.</p>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="py-20 bg-gradient-to-br from-forest-50 to-nature-50 relative">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-10 left-10 text-9xl text-forest-600">🌲</div>
          <div className="absolute top-20 right-20 text-7xl text-nature-600">🌿</div>
          <div className="absolute bottom-10 left-1/4 text-8xl text-forest-500">🍃</div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-forest-800 mb-6">
              Why Choose 
              <span className="text-nature-600">Trekk Tribe?</span>
            </h2>
            <p className="text-xl text-forest-600 max-w-3xl mx-auto leading-relaxed">
              Experience sustainable travel like never before with our eco-conscious community platform
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-10">
            <div className="group text-center hover:transform hover:scale-105 transition-all duration-300">
              <div className="w-20 h-20 bg-gradient-to-br from-forest-400 to-forest-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg group-hover:shadow-xl transition-shadow">
                <span className="text-3xl text-white">🌍</span>
              </div>
              <h3 className="text-2xl font-bold mb-4 text-forest-800">Eco-Friendly Adventures</h3>
              <p className="text-forest-600 leading-relaxed">
                Discover breathtaking destinations while supporting conservation efforts and sustainable tourism practices
              </p>
            </div>
            
            <div className="group text-center hover:transform hover:scale-105 transition-all duration-300">
              <div className="w-20 h-20 bg-gradient-to-br from-nature-400 to-nature-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg group-hover:shadow-xl transition-shadow">
                <span className="text-3xl text-white">👥</span>
              </div>
              <h3 className="text-2xl font-bold mb-4 text-forest-800">Nature-Loving Community</h3>
              <p className="text-forest-600 leading-relaxed">
                Connect with passionate eco-adventurers, conservationists, and nature enthusiasts from around the globe
              </p>
            </div>
            
            <div className="group text-center hover:transform hover:scale-105 transition-all duration-300">
              <div className="w-20 h-20 bg-gradient-to-br from-earth-400 to-earth-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg group-hover:shadow-xl transition-shadow">
                <span className="text-3xl text-white">🌱</span>
              </div>
              <h3 className="text-2xl font-bold mb-4 text-forest-800">Carbon-Conscious Travel</h3>
              <p className="text-forest-600 leading-relaxed">
                Offset your carbon footprint, support local communities, and make every adventure count for the planet
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-forest-800 mb-6">
              How 
              <span className="text-nature-600">Adventure</span>
              <span className="text-forest-700"> Works</span>
            </h2>
            <p className="text-xl text-forest-600 max-w-3xl mx-auto leading-relaxed">
              Join thousands of nature lovers in just 4 simple steps. Your next wilderness adventure is closer than you think!
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center group">
              <div className="relative mb-6">
                <div className="w-20 h-20 bg-gradient-to-br from-forest-500 to-nature-500 rounded-full flex items-center justify-center mx-auto shadow-lg group-hover:shadow-xl transition-all duration-300 transform group-hover:scale-110">
                  <span className="text-3xl text-white">👤</span>
                </div>
                <div className="absolute -top-2 -right-2 w-8 h-8 bg-nature-400 rounded-full flex items-center justify-center text-white font-bold text-sm">1</div>
              </div>
              <h3 className="text-xl font-bold text-forest-800 mb-3">Create Account</h3>
              <p className="text-forest-600 leading-relaxed">Sign up in seconds and choose whether you want to explore adventures or organize your own expeditions.</p>
            </div>
            
            <div className="text-center group">
              <div className="relative mb-6">
                <div className="w-20 h-20 bg-gradient-to-br from-forest-500 to-nature-500 rounded-full flex items-center justify-center mx-auto shadow-lg group-hover:shadow-xl transition-all duration-300 transform group-hover:scale-110">
                  <span className="text-3xl text-white">🔍</span>
                </div>
                <div className="absolute -top-2 -right-2 w-8 h-8 bg-nature-400 rounded-full flex items-center justify-center text-white font-bold text-sm">2</div>
              </div>
              <h3 className="text-xl font-bold text-forest-800 mb-3">Find Adventure</h3>
              <p className="text-forest-600 leading-relaxed">Browse through hundreds of curated wilderness experiences. Filter by location, difficulty, and adventure type.</p>
            </div>
            
            <div className="text-center group">
              <div className="relative mb-6">
                <div className="w-20 h-20 bg-gradient-to-br from-forest-500 to-nature-500 rounded-full flex items-center justify-center mx-auto shadow-lg group-hover:shadow-xl transition-all duration-300 transform group-hover:scale-110">
                  <span className="text-3xl text-white">🤝</span>
                </div>
                <div className="absolute -top-2 -right-2 w-8 h-8 bg-nature-400 rounded-full flex items-center justify-center text-white font-bold text-sm">3</div>
              </div>
              <h3 className="text-xl font-bold text-forest-800 mb-3">Join & Connect</h3>
              <p className="text-forest-600 leading-relaxed">Book your spot and connect with fellow adventurers. Share excitement and plan together before the journey.</p>
            </div>
            
            <div className="text-center group">
              <div className="relative mb-6">
                <div className="w-20 h-20 bg-gradient-to-br from-forest-500 to-nature-500 rounded-full flex items-center justify-center mx-auto shadow-lg group-hover:shadow-xl transition-all duration-300 transform group-hover:scale-110">
                  <span className="text-3xl text-white">🏕️</span>
                </div>
                <div className="absolute -top-2 -right-2 w-8 h-8 bg-nature-400 rounded-full flex items-center justify-center text-white font-bold text-sm">4</div>
              </div>
              <h3 className="text-xl font-bold text-forest-800 mb-3">Experience Magic</h3>
              <p className="text-forest-600 leading-relaxed">Embark on your wilderness adventure, create lasting memories, and form friendships that last a lifetime.</p>
            </div>
          </div>
        </div>
      </section>


      {/* Featured Trips Section */}
      <section className="py-20 bg-white relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-nature-50/30 to-forest-50/30"></div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-forest-800 mb-6">
              Epic 
              <span className="text-nature-600">Adventures</span>
              <span className="text-forest-700"> Await</span>
            </h2>
            <p className="text-xl text-forest-600 max-w-2xl mx-auto leading-relaxed">
              Embark on extraordinary journeys that will connect you with nature and fellow adventurers
            </p>
          </div>

          {loading ? (
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-forest-200 border-t-forest-600"></div>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {featuredTrips.map((trip, index) => (
                <div 
                  key={trip._id} 
                  className="group bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2"
                  style={{animationDelay: `${index * 0.1}s`}}
                >
                  <div className="relative h-52 bg-gradient-to-br from-forest-400 to-nature-500 overflow-hidden">
                    <div className="absolute inset-0 bg-black/20"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center text-white">
                        <div className="text-6xl mb-2">
                          {trip.categories.includes('Mountain') ? '🏔️' : 
                           trip.categories.includes('Nature') ? '🌲' : '🌍'}
                        </div>
                        <p className="text-sm opacity-90 font-medium">{trip.categories.join(' • ')}</p>
                      </div>
                    </div>
                    <div className="absolute top-4 right-4">
                      <div className="bg-white/90 backdrop-blur-sm rounded-full px-3 py-1 text-forest-800 text-sm font-semibold">
                        ₹{trip.price}
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-6">
                    <h3 className="text-xl font-bold mb-3 text-forest-800 group-hover:text-nature-600 transition-colors">
                      {trip.title}
                    </h3>
                    <p className="text-forest-600 mb-4 line-clamp-2 leading-relaxed">
                      {trip.description}
                    </p>
                    
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center text-forest-500">
                        <span className="mr-2">📍</span>
                        <span className="text-sm font-medium">{trip.destination}</span>
                      </div>
                      <div className="flex items-center text-forest-500">
                        <span className="mr-2">👥</span>
                        <span className="text-sm">{trip.participants.length}/{trip.capacity} adventurers</span>
                        <div className="flex-1"></div>
                        <div className="w-16 bg-forest-100 rounded-full h-2">
                          <div 
                            className="bg-nature-500 h-2 rounded-full transition-all duration-500"
                            style={{width: `${(trip.participants.length / trip.capacity) * 100}%`}}
                          ></div>
                        </div>
                      </div>
                      <div className="flex items-center text-forest-500">
                        <span className="mr-2">📅</span>
                        <span className="text-sm">{new Date(trip.startDate).toLocaleDateString()}</span>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-2 mb-4">
                      {trip.categories.map((category, catIndex) => (
                        <span key={catIndex} className="px-2 py-1 bg-forest-100 text-forest-700 text-xs rounded-full font-medium">
                          {category}
                        </span>
                      ))}
                    </div>
                    
                    <button className="w-full bg-gradient-to-r from-forest-600 to-nature-600 hover:from-forest-700 hover:to-nature-700 text-white py-3 rounded-xl font-semibold transition-all duration-300 transform group-hover:scale-105">
                      Join Adventure 🌿
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="text-center mt-16">
            <Link
              to="/trips"
              className="inline-flex items-center gap-3 bg-gradient-to-r from-nature-600 to-forest-600 hover:from-nature-700 hover:to-forest-700 text-white px-10 py-4 rounded-full text-lg font-bold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
            >
              <span>🌲</span>
              Discover All Adventures
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </Link>
          </div>
        </div>
      </section>


      {/* Safety & Sustainability Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-forest-800 mb-6">
              Safety First, 
              <span className="text-nature-600">Planet Always</span>
            </h2>
            <p className="text-xl text-forest-600 max-w-3xl mx-auto leading-relaxed">
              We're committed to responsible adventure tourism that protects both our adventurers and the precious wilderness we explore
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="space-y-8">
                <div className="flex items-start">
                  <div className="w-12 h-12 bg-gradient-to-br from-forest-500 to-nature-500 rounded-full flex items-center justify-center mr-4 flex-shrink-0">
                    <span className="text-white text-xl">🛡️</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-forest-800 mb-2">Certified Safety Protocols</h3>
                    <p className="text-forest-600 leading-relaxed">All our guides are certified wilderness professionals with first aid training. We maintain the highest safety standards and carry emergency equipment on every expedition.</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <div className="w-12 h-12 bg-gradient-to-br from-forest-500 to-nature-500 rounded-full flex items-center justify-center mr-4 flex-shrink-0">
                    <span className="text-white text-xl">🌱</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-forest-800 mb-2">Carbon Neutral Adventures</h3>
                    <p className="text-forest-600 leading-relaxed">We offset 100% of our carbon footprint through verified reforestation projects. Every adventure contributes to protecting the wilderness we love to explore.</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <div className="w-12 h-12 bg-gradient-to-br from-forest-500 to-nature-500 rounded-full flex items-center justify-center mr-4 flex-shrink-0">
                    <span className="text-white text-xl">🌍</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-forest-800 mb-2">Local Community Support</h3>
                    <p className="text-forest-600 leading-relaxed">We partner with local communities and indigenous guides, ensuring tourism benefits the people who call these wilderness areas home.</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <div className="w-12 h-12 bg-gradient-to-br from-forest-500 to-nature-500 rounded-full flex items-center justify-center mr-4 flex-shrink-0">
                    <span className="text-white text-xl">🐾</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-forest-800 mb-2">Wildlife Protection</h3>
                    <p className="text-forest-600 leading-relaxed">We follow strict Leave No Trace principles and contribute to wildlife conservation efforts. Our presence helps fund protection of endangered species and habitats.</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="text-center">
              <p className="text-lg text-forest-600">
                Our commitment to sustainable adventure travel ensures every journey contributes positively to conservation and local communities.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Equipment & Preparation Section */}
      <section className="py-20 bg-gradient-to-br from-forest-50 to-nature-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-forest-800 mb-6">
              Gear Up for 
              <span className="text-nature-600">Adventure</span>
            </h2>
            <p className="text-xl text-forest-600 max-w-3xl mx-auto leading-relaxed">
              We provide all essential equipment and guide you through preparation for your wilderness experience
            </p>
          </div>
          
          <div className="grid lg:grid-cols-3 gap-12">
            <div className="bg-white rounded-2xl p-8 shadow-lg">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-forest-500 to-nature-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-white text-2xl">🎒</span>
                </div>
                <h3 className="text-2xl font-bold text-forest-800">Essential Gear Provided</h3>
              </div>
              <ul className="space-y-3 text-forest-600">
                <li className="flex items-center"><span className="mr-3 text-nature-500">✓</span>Professional hiking backpacks</li>
                <li className="flex items-center"><span className="mr-3 text-nature-500">✓</span>Weather-appropriate clothing</li>
                <li className="flex items-center"><span className="mr-3 text-nature-500">✓</span>High-quality camping equipment</li>
                <li className="flex items-center"><span className="mr-3 text-nature-500">✓</span>Navigation and safety gear</li>
                <li className="flex items-center"><span className="mr-3 text-nature-500">✓</span>First aid and emergency supplies</li>
                <li className="flex items-center"><span className="mr-3 text-nature-500">✓</span>Cooking and water purification</li>
              </ul>
            </div>
            
            <div className="bg-white rounded-2xl p-8 shadow-lg">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-earth-500 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-white text-2xl">📚</span>
                </div>
                <h3 className="text-2xl font-bold text-forest-800">Pre-Trip Preparation</h3>
              </div>
              <ul className="space-y-3 text-forest-600">
                <li className="flex items-center"><span className="mr-3 text-nature-500">✓</span>Detailed packing checklists</li>
                <li className="flex items-center"><span className="mr-3 text-nature-500">✓</span>Fitness preparation guides</li>
                <li className="flex items-center"><span className="mr-3 text-nature-500">✓</span>Weather and terrain briefings</li>
                <li className="flex items-center"><span className="mr-3 text-nature-500">✓</span>Cultural sensitivity training</li>
                <li className="flex items-center"><span className="mr-3 text-nature-500">✓</span>Emergency contact protocols</li>
                <li className="flex items-center"><span className="mr-3 text-nature-500">✓</span>Group introduction sessions</li>
              </ul>
            </div>
            
            <div className="bg-white rounded-2xl p-8 shadow-lg">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-white text-2xl">🧗‍♀️</span>
                </div>
                <h3 className="text-2xl font-bold text-forest-800">Expert Guidance</h3>
              </div>
              <ul className="space-y-3 text-forest-600">
                <li className="flex items-center"><span className="mr-3 text-nature-500">✓</span>Certified wilderness guides</li>
                <li className="flex items-center"><span className="mr-3 text-nature-500">✓</span>Local expert knowledge</li>
                <li className="flex items-center"><span className="mr-3 text-nature-500">✓</span>Wildlife identification training</li>
                <li className="flex items-center"><span className="mr-3 text-nature-500">✓</span>Photography tips and techniques</li>
                <li className="flex items-center"><span className="mr-3 text-nature-500">✓</span>Survival skills workshops</li>
                <li className="flex items-center"><span className="mr-3 text-nature-500">✓</span>24/7 support during trips</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action Section */}
      <section className="py-20 bg-gradient-to-br from-forest-800 to-nature-800 text-white relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-0 left-0 w-full h-full bg-black opacity-20"></div>
          <div className="absolute -top-10 -left-10 w-40 h-40 bg-nature-400 rounded-full opacity-10 animate-pulse"></div>
          <div className="absolute -bottom-10 -right-10 w-60 h-60 bg-forest-400 rounded-full opacity-10 animate-pulse" style={{animationDelay: '2s'}}></div>
        </div>
        
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <h2 className="text-4xl md:text-6xl font-bold mb-6">
            Your Next 
            <span className="text-nature-400">Adventure</span>
            <br />Starts Here
          </h2>
          <p className="text-xl md:text-2xl text-forest-100 mb-12 leading-relaxed">
            Join thousands of nature lovers who have discovered their wild side. 
            <br />Create memories that will last a lifetime in Earth's most beautiful places.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            <Link
              to="/register"
              className="group relative px-12 py-6 bg-nature-500 hover:bg-nature-600 text-white rounded-full text-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-2xl hover:shadow-3xl"
            >
              <span className="flex items-center justify-center gap-3">
                🌱 Start Your Journey
                <svg className="w-6 h-6 group-hover:translate-x-2 transition-transform" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </span>
            </Link>
            
            <Link
              to="/trips"
              className="group px-12 py-6 border-2 border-forest-200 hover:bg-forest-200 hover:text-forest-900 text-forest-100 rounded-full text-xl font-bold transition-all duration-300 transform hover:scale-105 backdrop-blur-sm"
            >
              <span className="flex items-center justify-center gap-3">
                🔍 Explore Adventures
              </span>
            </Link>
          </div>
          
          <div className="mt-16 grid md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-3xl font-bold text-nature-400 mb-2">Join Today</div>
              <div className="text-forest-200">Start your first adventure</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-nature-400 mb-2">Connect</div>
              <div className="text-forest-200">Meet fellow adventurers</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-nature-400 mb-2">Explore</div>
              <div className="text-forest-200">Discover wild places</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
