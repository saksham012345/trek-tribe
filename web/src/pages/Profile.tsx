import React, { useState, useEffect } from 'react';
import axios from 'axios';

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
  organizerId: string;
  status: string;
}

interface ProfileProps {
  user: User;
}

const Profile: React.FC<ProfileProps> = ({ user }) => {
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

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-md p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Profile</h1>
            <p className="text-gray-600">Manage your account and view your trips</p>
          </div>

          {/* User Info */}
          <div className="bg-gray-50 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">Account Information</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <p className="mt-1 text-lg text-gray-900">{user.name}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <p className="mt-1 text-lg text-gray-900">{user.email}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Role</label>
                <p className="mt-1 text-lg text-gray-900 capitalize">{user.role}</p>
              </div>
            </div>
          </div>

          {/* User Trips */}
          <div>
            <h2 className="text-xl font-semibold mb-4">
              {user.role === 'organizer' ? 'My Created Trips' : 'My Joined Trips'}
            </h2>
            
            {loading ? (
              <div className="flex justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : userTrips.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-gray-500 text-lg mb-2">
                  {user.role === 'organizer' ? 'No trips created yet' : 'No trips joined yet'}
                </div>
                <p className="text-gray-400">
                  {user.role === 'organizer' 
                    ? 'Create your first trip to get started!' 
                    : 'Join some trips to see them here'
                  }
                </p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-6">
                {userTrips.map((trip) => (
                  <div key={trip._id} className="border border-gray-200 rounded-lg p-6">
                    <h3 className="text-lg font-semibold mb-2">{trip.title}</h3>
                    <p className="text-gray-600 mb-4 line-clamp-2">{trip.description}</p>
                    
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center text-sm text-gray-500">
                        <span className="mr-2">📍</span>
                        {trip.destination}
                      </div>
                      <div className="flex items-center text-sm text-gray-500">
                        <span className="mr-2">👥</span>
                        {trip.participants.length}/{trip.capacity} participants
                      </div>
                      <div className="flex items-center text-sm text-gray-500">
                        <span className="mr-2">💰</span>
                        ${trip.price} per person
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
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        trip.status === 'active' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {trip.status}
                      </span>
                      {user.role === 'organizer' && (
                        <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                          Edit Trip
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
