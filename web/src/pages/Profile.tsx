import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import EmergencyContacts from '../components/EmergencyContacts';
import AdminProfile from './AdminProfile';
import AgentProfile from './AgentProfile';
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
  organizerId: string;
  status: string;
}

interface ProfileProps {
  user: User;
}

const Profile: React.FC<ProfileProps> = ({ user }) => {
  const navigate = useNavigate();
  const [userTrips, setUserTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserTrips = async () => {
      try {
        const response = await axios.get('/trips');
        const allTrips = response.data;
        
        // Filter trips based on user role
        if (user.role === 'organizer') {
          // Show trips created by the user
          setUserTrips(allTrips.filter((trip: Trip) => trip.organizerId === user.id));
        } else {
          // Show trips the user has joined
          setUserTrips(allTrips.filter((trip: Trip) => trip.participants.includes(user.id)));
        }
      } catch (error) {
        console.error('Error fetching user trips:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserTrips();
  }, [user]);

  // Render professional profiles for admin and agent users
  if (user.role === 'admin') {
    return <AdminProfile user={user} />;
  }
  
  if (user.role === 'agent') {
    return <AgentProfile user={user} />;
  }

  return (
    <div className="min-h-screen bg-forest-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-nature-600 to-forest-600 rounded-2xl shadow-xl p-8 text-white mb-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                  <span className="text-3xl">
                    {user.role === 'organizer' ? '🏔️' : '🎒'}
                  </span>
                </div>
                <div>
                  <h1 className="text-3xl font-bold mb-1">
                    {user.role === 'organizer' ? 'Organizer Profile' : 'Traveler Profile'}
                  </h1>
                  <p className="text-nature-100">Welcome, {user.name}!</p>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-nature-200 mb-1">Member since</div>
              <div className="text-lg font-medium">{new Date().getFullYear()}</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-8">

          {/* User Info */}
          <div className="bg-forest-50 rounded-xl p-6 mb-8">
            <h2 className="text-2xl font-bold text-forest-800 mb-6 flex items-center gap-2">
              <span>👤</span> Account Information
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex justify-between items-center py-3 border-b border-forest-200">
                  <span className="text-forest-600 font-medium">Full Name</span>
                  <span className="font-semibold text-forest-900">{user.name}</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-forest-200">
                  <span className="text-forest-600 font-medium">Email Address</span>
                  <span className="font-semibold text-forest-900">{user.email}</span>
                </div>
                <div className="flex justify-between items-center py-3">
                  <span className="text-forest-600 font-medium">Account Type</span>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    user.role === 'organizer' 
                      ? 'bg-nature-100 text-nature-800' 
                      : 'bg-earth-100 text-earth-800'
                  }`}>
                    {user.role === 'organizer' ? 'Trip Organizer' : 'Traveler'}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-center">
                <div className="text-center">
                  <div className="w-20 h-20 bg-gradient-to-br from-nature-400 to-forest-500 rounded-full flex items-center justify-center mb-4">
                    <span className="text-3xl text-white">
                      {user.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <p className="text-forest-600 font-medium">Profile Avatar</p>
                </div>
              </div>
            </div>
            
            <div className="mt-6 pt-6 border-t border-forest-200">
              <div className="flex gap-3">
                <button className="flex-1 bg-nature-600 hover:bg-nature-700 text-white py-2 px-4 rounded-lg font-medium text-center transition-colors">
                  Edit Profile
                </button>
                <a 
                  href="/data-management" 
                  className="flex-1 bg-forest-600 hover:bg-forest-700 text-white py-2 px-4 rounded-lg font-medium text-center transition-colors"
                >
                  Privacy Settings
                </a>
              </div>
            </div>
          </div>

          {/* Emergency Contacts */}
          <div className="mb-8">
            <EmergencyContacts />
          </div>

          {/* User Trips */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-forest-800 mb-6 flex items-center gap-2">
              <span>{user.role === 'organizer' ? '🏔️' : '🎒'}</span>
              {user.role === 'organizer' ? 'My Created Trips' : 'My Adventure History'}
            </h2>
            
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-forest-200 border-t-forest-600"></div>
              </div>
            ) : userTrips.length === 0 ? (
              <div className="text-center py-16 bg-forest-50 rounded-xl">
                <div className="text-6xl mb-4">
                  {user.role === 'organizer' ? '🏕️' : '🗺️'}
                </div>
                <div className="text-forest-700 text-xl font-semibold mb-2">
                  {user.role === 'organizer' ? 'No trips created yet' : 'No adventures yet'}
                </div>
                <p className="text-forest-500 mb-6">
                  {user.role === 'organizer' 
                    ? 'Share your passion for adventure and create your first trip!' 
                    : 'Explore amazing trips and start your adventure journey!'
                  }
                </p>
                {user.role === 'organizer' ? (
                  <button 
                    onClick={() => navigate('/create-trip')}
                    className="bg-nature-600 hover:bg-nature-700 text-white px-8 py-3 rounded-lg font-semibold transition-colors"
                  >
                    Create Your First Trip
                  </button>
                ) : (
                  <button 
                    onClick={() => navigate('/trips')}
                    className="bg-earth-600 hover:bg-earth-700 text-white px-8 py-3 rounded-lg font-semibold transition-colors"
                  >
                    Explore Trips
                  </button>
                )}
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-6">
                {userTrips.map((trip) => (
                  <div key={trip._id} className="bg-white border border-forest-200 rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-xl font-bold text-forest-800 flex-1">{trip.title}</h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        trip.status === 'active' 
                          ? 'bg-green-100 text-green-800' 
                          : trip.status === 'published'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {trip.status}
                      </span>
                    </div>
                    
                    <p className="text-forest-600 mb-4 line-clamp-2">{trip.description}</p>
                    
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center text-sm text-forest-500">
                        <span className="mr-3 text-lg">📍</span>
                        <span className="font-medium">{trip.destination}</span>
                      </div>
                      <div className="flex items-center text-sm text-forest-500">
                        <span className="mr-3 text-lg">👥</span>
                        <span>{trip.participants.length}/{trip.capacity} adventurers</span>
                        <div className="flex-1 ml-3">
                          <div className="w-full bg-forest-100 rounded-full h-2">
                            <div 
                              className="bg-nature-500 h-2 rounded-full transition-all duration-500"
                              style={{width: `${(trip.participants.length / trip.capacity) * 100}%`}}
                            ></div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center text-sm text-forest-500">
                        <span className="mr-3 text-lg">💰</span>
                        <span className="font-semibold text-forest-700">₹{trip.price.toLocaleString()}</span>
                        <span className="ml-1">per person</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 mb-4">
                      {trip.categories.map((category, index) => (
                        <span key={index} className="px-2 py-1 bg-nature-100 text-nature-700 text-xs rounded-full font-medium">
                          {category}
                        </span>
                      ))}
                    </div>

                    <div className="flex justify-between items-center pt-4 border-t border-forest-100">
                      <div className="text-sm text-forest-500">
                        {user.role === 'organizer' ? 'Created by you' : 'Joined adventure'}
                      </div>
                      {user.role === 'organizer' && (
                        <button 
                          onClick={() => navigate(`/edit-trip/${trip._id}`)}
                          className="bg-forest-100 hover:bg-forest-200 text-forest-700 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                        >
                          ✏️ Edit Trip
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
