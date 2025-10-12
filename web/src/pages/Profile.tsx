import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../config/api';
import { User } from '../types';
import AIAnalyticsDashboard from '../components/AIAnalyticsDashboard';
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
  organizerId: string;
  status: string;
}

interface ProfileProps {
  user: User;
}

const Profile: React.FC<ProfileProps> = ({ user: initialUser }) => {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [userTrips, setUserTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    location: user?.location || '',
    bio: user?.bio || ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const fetchUserTrips = async () => {
      try {
        const response = await api.get('/trips');
        const allTrips = response.data;
        
        // Filter trips based on user role
        if (user.role === 'organizer') {
          // Show trips created by the user
          const tripsData = allTrips as Trip[];
          setUserTrips(tripsData.filter((trip: Trip) => trip.organizerId === user.id));
        } else {
          // Show trips the user has joined
          const tripsData = allTrips as Trip[];
          setUserTrips(tripsData.filter((trip: Trip) => trip.participants.includes(user.id)));
        }
      } catch (error) {
        console.error('Error fetching user trips:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserTrips();
  }, [user]);

  // Update form data when user changes
  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        location: user.location || '',
        bio: user.bio || ''
      });
    }
  }, [user]);

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('photo', file);

      const response = await api.post('/files/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.success && updateUser) {
        // Update user context with new photo
        const updatedUser = {
          ...user,
          profilePhoto: response.data.photoUrl
        };
        updateUser(updatedUser);
        setSuccess('Profile photo updated successfully!');
        
        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err: any) {
      console.error('Photo upload error:', err);
      setError(err.response?.data?.error || 'Failed to upload photo');
    } finally {
      setUploading(false);
    }
  };

  const handleSaveProfile = async () => {
    setError('');
    setSuccess('');

    try {
      const response = await api.patch('/auth/profile', formData);
      
      if (updateUser) {
        const updatedUser = {
          ...user,
          ...response.data.user
        };
        updateUser(updatedUser);
      }

      setEditing(false);
      setSuccess('Profile updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      console.error('Profile update error:', err);
      setError(err.response?.data?.error || 'Failed to update profile');
    }
  };

  const handleCancelEdit = () => {
    setEditing(false);
    setError('');
    // Reset form data to original values
    if (user) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        location: user.location || '',
        bio: user.bio || ''
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-md p-8">
          <div className="mb-8 flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Profile</h1>
              <p className="text-gray-600">Manage your account and view your trips</p>
            </div>
            <div className="flex items-center gap-3">
              {editing ? (
                <>
                  <button
                    onClick={handleCancelEdit}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveProfile}
                    className="px-6 py-2 bg-forest-600 text-white rounded-lg hover:bg-forest-700 transition-colors flex items-center gap-2"
                  >
                    💾 Save Changes
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setEditing(true)}
                  className="px-6 py-2 bg-nature-600 text-white rounded-lg hover:bg-nature-700 transition-colors flex items-center gap-2"
                >
                  ✏️ Edit Profile
                </button>
              )}
            </div>
          </div>

          {/* Success/Error Messages */}
          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-800 flex items-center gap-2">
                <span className="text-green-600">✅</span>
                {success}
              </p>
            </div>
          )}
          
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 flex items-center gap-2">
                <span className="text-red-600">❌</span>
                {error}
              </p>
            </div>
          )}

          {/* User Info */}
          <div className="bg-gray-50 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-semibold mb-6">Account Information</h2>
            
            <div className="flex flex-col md:flex-row gap-6">
              {/* Profile Photo Section */}
              <div className="flex flex-col items-center">
                <div className="relative">
                  <div className="w-32 h-32 rounded-full overflow-hidden bg-gradient-to-br from-forest-400 to-nature-500 flex items-center justify-center">
                    {user?.profilePhoto ? (
                      <img 
                        src={user.profilePhoto} 
                        alt="Profile" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-4xl font-bold text-white">
                        {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                      </span>
                    )}
                  </div>
                  {uploading && (
                    <div className="absolute inset-0 rounded-full bg-black bg-opacity-50 flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                    </div>
                  )}
                </div>
                {editing && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="mt-3 px-4 py-2 bg-forest-600 text-white text-sm rounded-lg hover:bg-forest-700 transition-colors disabled:bg-gray-400 flex items-center gap-2"
                  >
                    {uploading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Uploading...
                      </>
                    ) : (
                      <>
                        📷 Upload Photo
                      </>
                    )}
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </div>

              {/* Form Fields */}
              <div className="flex-1 grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  {editing ? (
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500 focus:border-forest-500"
                    />
                  ) : (
                    <p className="mt-1 text-lg text-gray-900">{user?.name || 'Not provided'}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  {editing ? (
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500 focus:border-forest-500"
                    />
                  ) : (
                    <p className="mt-1 text-lg text-gray-900">{user?.email || 'Not provided'}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  {editing ? (
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500 focus:border-forest-500"
                      placeholder="Enter phone number"
                    />
                  ) : (
                    <p className="mt-1 text-lg text-gray-900">{user?.phone || 'Not provided'}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <p className="mt-1 text-lg text-gray-900 capitalize flex items-center gap-2">
                    {user?.role === 'admin' && '👑'}
                    {user?.role === 'organizer' && '🏕️'}
                    {user?.role === 'agent' && '🎯'}
                    {user?.role === 'traveler' && '🎒'}
                    {user?.role || 'Not specified'}
                  </p>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                  {editing ? (
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500 focus:border-forest-500"
                      placeholder="Enter your location"
                    />
                  ) : (
                    <p className="mt-1 text-lg text-gray-900">{user?.location || 'Not provided'}</p>
                  )}
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
                  {editing ? (
                    <textarea
                      value={formData.bio}
                      onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500 focus:border-forest-500"
                      placeholder="Tell us about yourself..."
                    />
                  ) : (
                    <p className="mt-1 text-lg text-gray-900">{user?.bio || 'No bio provided'}</p>
                  )}
                </div>
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
                        ₹{trip.price} per person
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
                        <button 
                          onClick={() => navigate(`/edit-trip/${trip._id}`)}
                          className="text-nature-600 hover:text-forest-700 text-sm font-medium flex items-center gap-1 transition-colors"
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
          
          {/* AI Travel Analytics */}
          <div className="mt-12">
            <h2 className="text-xl font-semibold mb-6">🧠 AI Travel Insights</h2>
            <AIAnalyticsDashboard className="w-full" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
