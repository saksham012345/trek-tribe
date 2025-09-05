import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

// Sample trips data for demonstration
const SAMPLE_TRIPS = [
  {
    _id: 'sample1',
    title: 'Himalayan Trek Adventure',
    description: 'Experience the breathtaking beauty of the Himalayas with expert guides and fellow adventurers.',
    destination: 'Nepal Himalayas',
    price: 1299,
    capacity: 12,
    participants: ['user1', 'user2', 'user3'],
    categories: ['Adventure', 'Mountain'],
    images: ['himalaya.jpg'],
    startDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    endDate: new Date(Date.now() + 37 * 24 * 60 * 60 * 1000).toISOString(),
    organizerId: 'org1',
    status: 'active'
  },
  {
    _id: 'sample2', 
    title: 'Amazon Rainforest Expedition',
    description: 'Discover the incredible biodiversity of the Amazon while supporting conservation efforts.',
    destination: 'Amazon Basin, Peru',
    price: 2199,
    capacity: 8,
    participants: ['user4', 'user5'],
    categories: ['Nature', 'Cultural'],
    images: ['amazon.jpg'],
    startDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
    endDate: new Date(Date.now() + 52 * 24 * 60 * 60 * 1000).toISOString(),
    organizerId: 'org2',
    status: 'active'
  },
  {
    _id: 'sample3',
    title: 'Northern Lights & Aurora Hunt',
    description: 'Chase the magical northern lights across Iceland\'s stunning winter landscapes.',
    destination: 'Reykjavik, Iceland',
    price: 1799,
    capacity: 15,
    participants: ['user6', 'user7', 'user8', 'user9'],
    categories: ['Adventure', 'Nature'],
    images: ['iceland.jpg'],
    startDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
    endDate: new Date(Date.now() + 67 * 24 * 60 * 60 * 1000).toISOString(),
    organizerId: 'org3',
    status: 'active'
  }
];

interface User {
  id: string;
  email: string;
  name: string;
  role: 'traveler' | 'organizer' | 'admin';
}

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
  const [featuredTrips, setFeaturedTrips] = useState<Trip[]>(SAMPLE_TRIPS);
  const [loading] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Background images for hero carousel
  const heroImages = [
    'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?q=80&w=2071',
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?q=80&w=2070', 
    'https://images.unsplash.com/photo-1469474968028-56623f02e42e?q=80&w=2069'
  ];

  useEffect(() => {
    // Try to fetch real trips, fall back to sample data
    const fetchTrips = async () => {
      try {
        const response = await axios.get('/trips?limit=6');
        if (response.data && response.data.length > 0) {
          setFeaturedTrips(response.data);
        }
      } catch (error: any) {
        console.error('Using sample data:', error.message || error);
        // Keep using sample trips
      }
    };
    fetchTrips();
    
    // Hero image carousel
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % heroImages.length);
    }, 5000);
    
    return () => clearInterval(interval);
  }, [heroImages.length]);

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
          <div className="grid grid-cols-3 gap-8 mb-12 max-w-2xl mx-auto">
            <div className="text-center">
              <div className="text-3xl font-bold text-nature-400 animate-bounce-slow">127+</div>
              <div className="text-forest-200 text-sm">Adventures</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-nature-400 animate-bounce-slow" style={{animationDelay: '1s'}}>2.4k+</div>
              <div className="text-forest-200 text-sm">Explorers</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-nature-400 animate-bounce-slow" style={{animationDelay: '2s'}}>47</div>
              <div className="text-forest-200 text-sm">Countries</div>
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
              <div className="mt-4 text-nature-600 font-semibold text-sm">23 Adventures Available</div>
            </div>
            
            <div className="group bg-gradient-to-br from-nature-100 to-nature-200 rounded-2xl p-8 text-center hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-3">
              <div className="text-6xl mb-4 group-hover:scale-110 transition-transform duration-300">🌲</div>
              <h3 className="text-xl font-bold text-forest-800 mb-3">Forest Treks</h3>
              <p className="text-forest-600 text-sm leading-relaxed">Immerse yourself in ancient forests and discover hidden trails through pristine wilderness.</p>
              <div className="mt-4 text-nature-600 font-semibold text-sm">31 Adventures Available</div>
            </div>
            
            <div className="group bg-gradient-to-br from-earth-100 to-earth-200 rounded-2xl p-8 text-center hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-3">
              <div className="text-6xl mb-4 group-hover:scale-110 transition-transform duration-300">🌊</div>
              <h3 className="text-xl font-bold text-forest-800 mb-3">Water Adventures</h3>
              <p className="text-forest-600 text-sm leading-relaxed">Navigate crystal-clear rivers, pristine lakes, and explore coastal wilderness areas.</p>
              <div className="mt-4 text-nature-600 font-semibold text-sm">18 Adventures Available</div>
            </div>
            
            <div className="group bg-gradient-to-br from-purple-100 to-purple-200 rounded-2xl p-8 text-center hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-3">
              <div className="text-6xl mb-4 group-hover:scale-110 transition-transform duration-300">🌌</div>
              <h3 className="text-xl font-bold text-forest-800 mb-3">Aurora Watching</h3>
              <p className="text-forest-600 text-sm leading-relaxed">Chase the northern lights across Arctic landscapes and witness nature's most magical display.</p>
              <div className="mt-4 text-nature-600 font-semibold text-sm">12 Adventures Available</div>
            </div>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mt-8">
            <div className="group bg-gradient-to-br from-orange-100 to-orange-200 rounded-2xl p-8 text-center hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-3">
              <div className="text-6xl mb-4 group-hover:scale-110 transition-transform duration-300">🏜️</div>
              <h3 className="text-xl font-bold text-forest-800 mb-3">Desert Expeditions</h3>
              <p className="text-forest-600 text-sm leading-relaxed">Explore vast desert landscapes, ancient dunes, and oasis hidden in the wilderness.</p>
              <div className="mt-4 text-nature-600 font-semibold text-sm">9 Adventures Available</div>
            </div>
            
            <div className="group bg-gradient-to-br from-blue-100 to-blue-200 rounded-2xl p-8 text-center hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-3">
              <div className="text-6xl mb-4 group-hover:scale-110 transition-transform duration-300">❄️</div>
              <h3 className="text-xl font-bold text-forest-800 mb-3">Arctic Adventures</h3>
              <p className="text-forest-600 text-sm leading-relaxed">Venture into the pristine Arctic wilderness and experience life at the edge of the world.</p>
              <div className="mt-4 text-nature-600 font-semibold text-sm">7 Adventures Available</div>
            </div>
            
            <div className="group bg-gradient-to-br from-green-100 to-green-200 rounded-2xl p-8 text-center hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-3">
              <div className="text-6xl mb-4 group-hover:scale-110 transition-transform duration-300">🌿</div>
              <h3 className="text-xl font-bold text-forest-800 mb-3">Wildlife Safaris</h3>
              <p className="text-forest-600 text-sm leading-relaxed">Observe magnificent wildlife in their natural habitats across protected wilderness areas.</p>
              <div className="mt-4 text-nature-600 font-semibold text-sm">25 Adventures Available</div>
            </div>
            
            <div className="group bg-gradient-to-br from-pink-100 to-pink-200 rounded-2xl p-8 text-center hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-3">
              <div className="text-6xl mb-4 group-hover:scale-110 transition-transform duration-300">🌸</div>
              <h3 className="text-xl font-bold text-forest-800 mb-3">Botanical Expeditions</h3>
              <p className="text-forest-600 text-sm leading-relaxed">Discover rare plants, ancient trees, and botanical wonders in remote natural gardens.</p>
              <div className="mt-4 text-nature-600 font-semibold text-sm">14 Adventures Available</div>
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

      {/* Statistics Section */}
      <section className="py-20 bg-gradient-to-br from-forest-800 to-nature-800 text-white relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-10 left-10 text-9xl opacity-10">🌲</div>
          <div className="absolute bottom-10 right-10 text-9xl opacity-10">🏔️</div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-8xl opacity-5">🌍</div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Trekk Tribe by the 
              <span className="text-nature-400">Numbers</span>
            </h2>
            <p className="text-xl text-forest-100 max-w-3xl mx-auto leading-relaxed">
              Join a growing community of wilderness enthusiasts from around the globe
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-5xl md:text-6xl font-bold text-nature-400 mb-2 animate-pulse-slow">2,847</div>
              <div className="text-forest-200 text-lg font-medium mb-2">Active Adventurers</div>
              <div className="text-forest-300 text-sm">Exploring wilderness worldwide</div>
            </div>
            
            <div className="text-center">
              <div className="text-5xl md:text-6xl font-bold text-nature-400 mb-2 animate-pulse-slow">186</div>
              <div className="text-forest-200 text-lg font-medium mb-2">Epic Adventures</div>
              <div className="text-forest-300 text-sm">Across 47 countries</div>
            </div>
            
            <div className="text-center">
              <div className="text-5xl md:text-6xl font-bold text-nature-400 mb-2 animate-pulse-slow">98.4%</div>
              <div className="text-forest-200 text-lg font-medium mb-2">Satisfaction Rate</div>
              <div className="text-forest-300 text-sm">Life-changing experiences</div>
            </div>
            
            <div className="text-center">
              <div className="text-5xl md:text-6xl font-bold text-nature-400 mb-2 animate-pulse-slow">47</div>
              <div className="text-forest-200 text-lg font-medium mb-2">Countries Explored</div>
              <div className="text-forest-300 text-sm">From Arctic to Tropics</div>
            </div>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 mt-16">
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-bold text-nature-400 mb-2">1.2M+</div>
              <div className="text-forest-200 text-lg font-medium mb-2">Miles Trekked</div>
              <div className="text-forest-300 text-sm">Steps taken in nature</div>
            </div>
            
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-bold text-nature-400 mb-2">435</div>
              <div className="text-forest-200 text-lg font-medium mb-2">Expert Guides</div>
              <div className="text-forest-300 text-sm">Certified wilderness professionals</div>
            </div>
            
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-bold text-nature-400 mb-2">12K+</div>
              <div className="text-forest-200 text-lg font-medium mb-2">Photos Shared</div>
              <div className="text-forest-300 text-sm">Memories captured forever</div>
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

      {/* Testimonials Section */}
      <section className="py-20 bg-gradient-to-br from-nature-50 to-forest-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-forest-800 mb-6">
              What 
              <span className="text-nature-600">Adventurers</span>
              <span className="text-forest-700"> Say</span>
            </h2>
            <p className="text-xl text-forest-600 max-w-3xl mx-auto leading-relaxed">
              Real stories from real adventurers who found their perfect wilderness experience
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2">
              <div className="flex items-center mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-forest-400 to-nature-500 rounded-full flex items-center justify-center text-white font-bold text-xl mr-4">
                  S
                </div>
                <div>
                  <div className="font-bold text-forest-800">Sarah Chen</div>
                  <div className="text-forest-500 text-sm">Himalayan Trek Adventurer</div>
                </div>
              </div>
              <div className="text-yellow-400 mb-4 text-xl">★★★★★</div>
              <p className="text-forest-600 leading-relaxed italic">"The Himalayan trek was absolutely life-changing! The group was amazing, the guide was knowledgeable, and the views were breathtaking. I've made friends for life and can't wait for my next adventure with Trekk Tribe!"</p>
            </div>
            
            <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2">
              <div className="flex items-center mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-earth-400 to-orange-500 rounded-full flex items-center justify-center text-white font-bold text-xl mr-4">
                  M
                </div>
                <div>
                  <div className="font-bold text-forest-800">Marcus Johnson</div>
                  <div className="text-forest-500 text-sm">Amazon Expedition Explorer</div>
                </div>
              </div>
              <div className="text-yellow-400 mb-4 text-xl">★★★★★</div>
              <p className="text-forest-600 leading-relaxed italic">"As a solo traveler, I was nervous about joining a group expedition. But the Amazon trip exceeded all expectations! The community aspect made it so much richer. Highly recommend!"</p>
            </div>
            
            <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2">
              <div className="flex items-center mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-400 to-blue-500 rounded-full flex items-center justify-center text-white font-bold text-xl mr-4">
                  E
                </div>
                <div>
                  <div className="font-bold text-forest-800">Emma Rodriguez</div>
                  <div className="text-forest-500 text-sm">Northern Lights Chaser</div>
                </div>
              </div>
              <div className="text-yellow-400 mb-4 text-xl">★★★★★</div>
              <p className="text-forest-600 leading-relaxed italic">"Seeing the Aurora Borealis with this incredible group was magical beyond words. The organizer thought of every detail, and the experience was seamless from start to finish!"</p>
            </div>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8 mt-8">
            <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2">
              <div className="flex items-center mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-forest-500 rounded-full flex items-center justify-center text-white font-bold text-xl mr-4">
                  A
                </div>
                <div>
                  <div className="font-bold text-forest-800">Alex Thompson</div>
                  <div className="text-forest-500 text-sm">Wildlife Safari Enthusiast</div>
                </div>
              </div>
              <div className="text-yellow-400 mb-4 text-xl">★★★★★</div>
              <p className="text-forest-600 leading-relaxed italic">"I've been on many wildlife expeditions, but this one stands out. The respect for nature, the small group size, and the expert knowledge of our guide made for an unforgettable experience. The elephants we encountered were just incredible!"</p>
            </div>
            
            <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2">
              <div className="flex items-center mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-pink-400 to-red-500 rounded-full flex items-center justify-center text-white font-bold text-xl mr-4">
                  L
                </div>
                <div>
                  <div className="font-bold text-forest-800">Luna Park</div>
                  <div className="text-forest-500 text-sm">Desert Expedition Adventurer</div>
                </div>
              </div>
              <div className="text-yellow-400 mb-4 text-xl">★★★★★</div>
              <p className="text-forest-600 leading-relaxed italic">"The desert expedition was transformative. Sleeping under the stars, experiencing the silence of the dunes, and sharing stories around the campfire with fellow adventurers - pure magic! Already planning my next trip."</p>
            </div>
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
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gradient-to-br from-forest-100 to-forest-200 rounded-2xl p-6 text-center">
                <div className="text-4xl mb-3">🏅</div>
                <div className="text-2xl font-bold text-forest-800 mb-1">100%</div>
                <div className="text-forest-600 text-sm">Safety Record</div>
              </div>
              <div className="bg-gradient-to-br from-nature-100 to-nature-200 rounded-2xl p-6 text-center">
                <div className="text-4xl mb-3">🌳</div>
                <div className="text-2xl font-bold text-forest-800 mb-1">50K+</div>
                <div className="text-forest-600 text-sm">Trees Planted</div>
              </div>
              <div className="bg-gradient-to-br from-earth-100 to-earth-200 rounded-2xl p-6 text-center">
                <div className="text-4xl mb-3">🏠</div>
                <div className="text-2xl font-bold text-forest-800 mb-1">127</div>
                <div className="text-forest-600 text-sm">Communities Supported</div>
              </div>
              <div className="bg-gradient-to-br from-green-100 to-green-200 rounded-2xl p-6 text-center">
                <div className="text-4xl mb-3">♾️</div>
                <div className="text-2xl font-bold text-forest-800 mb-1">Zero</div>
                <div className="text-forest-600 text-sm">Carbon Footprint</div>
              </div>
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
