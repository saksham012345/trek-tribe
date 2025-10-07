import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

interface ProfileStats {
  memberSince: string;
  profileCompleteness: number;
  tripsOrganized?: number;
  totalParticipants?: number;
  organizerRating?: number;
  tripsJoined?: number;
}

interface SocialLinks {
  instagram?: string;
  facebook?: string;
  twitter?: string;
  linkedin?: string;
  website?: string;
}

interface OrganizerProfile {
  bio?: string;
  experience?: string;
  specialties?: string[];
  certifications?: string[];
  languages?: string[];
  yearsOfExperience?: number;
  achievements?: string[];
}

interface ProfileUser {
  _id: string;
  name: string;
  email?: string;
  role: string;
  phone?: string;
  bio?: string;
  profilePhoto?: string;
  location?: string;
  dateOfBirth?: string;
  socialLinks?: SocialLinks;
  organizerProfile?: OrganizerProfile;
  isVerified?: boolean;
  createdAt: string;
}

const EnhancedProfile: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const { user: currentUser } = useAuth();
  const isOwnProfile = !userId || userId === currentUser?.id;
  
  const [profile, setProfile] = useState<ProfileUser | null>(null);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [shareableLink, setShareableLink] = useState('');

  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    bio: '',
    location: '',
    socialLinks: {
      instagram: '',
      facebook: '',
      twitter: '',
      linkedin: '',
      website: ''
    },
    organizerProfile: {
      bio: '',
      experience: '',
      specialties: [] as string[],
      languages: [] as string[],
      yearsOfExperience: 0
    }
  });

  useEffect(() => {
    fetchProfile();
    if (isOwnProfile) {
      fetchStats();
    }
  }, [userId, isOwnProfile]);

  const fetchProfile = async () => {
    try {
      const endpoint = isOwnProfile ? '/profile/me' : `/profile/${userId}`;
      const response = await axios.get(endpoint);
      
      const userData = isOwnProfile ? response.data.user : response.data.profile;
      setProfile(userData);
      
      // Initialize edit form
      if (isOwnProfile) {
        setEditForm({
          name: userData.name || '',
          phone: userData.phone || '',
          bio: userData.bio || '',
          location: userData.location || '',
          socialLinks: {
            instagram: userData.socialLinks?.instagram || '',
            facebook: userData.socialLinks?.facebook || '',
            twitter: userData.socialLinks?.twitter || '',
            linkedin: userData.socialLinks?.linkedin || '',
            website: userData.socialLinks?.website || ''
          },
          organizerProfile: {
            bio: userData.organizerProfile?.bio || '',
            experience: userData.organizerProfile?.experience || '',
            specialties: userData.organizerProfile?.specialties || [],
            languages: userData.organizerProfile?.languages || [],
            yearsOfExperience: userData.organizerProfile?.yearsOfExperience || 0
          }
        });
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get('/profile/me/stats');
      setStats(response.data.stats);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const generateShareableLink = async () => {
    try {
      const response = await axios.post('/profile/me/share');
      setShareableLink(response.data.shareableLink);
    } catch (error) {
      console.error('Error generating shareable link:', error);
    }
  };

  const handleEdit = () => {
    setEditing(true);
  };

  const handleSave = async () => {
    try {
      const response = await axios.put('/profile/me', editForm);
      setProfile(response.data.user);
      setEditing(false);
      alert('Profile updated successfully!');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update profile');
    }
  };

  const handleCancel = () => {
    setEditing(false);
    // Reset form to current profile data
    if (profile) {
      setEditForm({
        name: profile.name || '',
        phone: profile.phone || '',
        bio: profile.bio || '',
        location: profile.location || '',
        socialLinks: {
          instagram: profile.socialLinks?.instagram || '',
          facebook: profile.socialLinks?.facebook || '',
          twitter: profile.socialLinks?.twitter || '',
          linkedin: profile.socialLinks?.linkedin || '',
          website: profile.socialLinks?.website || ''
        },
        organizerProfile: {
          bio: profile.organizerProfile?.bio || '',
          experience: profile.organizerProfile?.experience || '',
          specialties: profile.organizerProfile?.specialties || [],
          languages: profile.organizerProfile?.languages || [],
          yearsOfExperience: profile.organizerProfile?.yearsOfExperience || 0
        }
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Link copied to clipboard!');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-forest-600"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Profile not found</h2>
          <p className="text-gray-600 mt-2">The profile you're looking for doesn't exist.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-forest-50 to-nature-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Profile Header */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden mb-8">
          <div className="bg-gradient-to-r from-forest-600 to-nature-600 h-48 relative">
            <div className="absolute inset-0 bg-black bg-opacity-20"></div>
            <div className="absolute bottom-6 left-6 flex items-end gap-6">
              <div className="w-32 h-32 rounded-2xl bg-white p-1 shadow-lg">
                {profile.profilePhoto ? (
                  <img 
                    src={profile.profilePhoto} 
                    alt={profile.name}
                    className="w-full h-full object-cover rounded-xl"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-200 rounded-xl flex items-center justify-center">
                    <span className="text-4xl">👤</span>
                  </div>
                )}
              </div>
              <div className="text-white pb-4">
                <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
                  {profile.name}
                  {profile.isVerified && (
                    <span className="text-2xl" title="Verified Profile">✅</span>
                  )}
                </h1>
                <p className="text-forest-100 text-lg capitalize flex items-center gap-2">
                  <span className="text-xl">
                    {profile.role === 'organizer' ? '🗺️' : 
                     profile.role === 'admin' ? '🛠️' : 
                     profile.role === 'agent' ? '🎧' : '🎒'}
                  </span>
                  {profile.role}
                </p>
                {profile.location && (
                  <p className="text-forest-200 flex items-center gap-1">
                    📍 {profile.location}
                  </p>
                )}
              </div>
            </div>
            
            {isOwnProfile && (
              <div className="absolute top-6 right-6">
                {editing ? (
                  <div className="flex gap-2">
                    <button
                      onClick={handleSave}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
                    >
                      💾 Save
                    </button>
                    <button
                      onClick={handleCancel}
                      className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
                    >
                      ❌ Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleEdit}
                    className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-4 py-2 rounded-lg text-sm font-medium backdrop-blur-sm"
                  >
                    ✏️ Edit Profile
                  </button>
                )}
              </div>
            )}
          </div>
          
          <div className="p-6">
            {/* Profile Stats */}
            {isOwnProfile && stats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-forest-600">{stats.profileCompleteness}%</div>
                  <div className="text-sm text-gray-600">Profile Complete</div>
                </div>
                {profile.role === 'organizer' ? (
                  <>
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-nature-600">{stats.tripsOrganized || 0}</div>
                      <div className="text-sm text-gray-600">Trips Organized</div>
                    </div>
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">{stats.totalParticipants || 0}</div>
                      <div className="text-sm text-gray-600">Total Participants</div>
                    </div>
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-yellow-600">⭐ {stats.organizerRating || 0}</div>
                      <div className="text-sm text-gray-600">Rating</div>
                    </div>
                  </>
                ) : (
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-nature-600">{stats.tripsJoined || 0}</div>
                    <div className="text-sm text-gray-600">Adventures Joined</div>
                  </div>
                )}
              </div>
            )}
            
            {/* Bio */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">About</h3>
              {editing ? (
                <textarea
                  value={editForm.bio}
                  onChange={(e) => setEditForm({...editForm, bio: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nature-500"
                  rows={3}
                  placeholder="Tell us about yourself..."
                />
              ) : (
                <p className="text-gray-700 leading-relaxed">
                  {profile.bio || 'No bio available yet.'}
                </p>
              )}
            </div>
            
            {/* Contact Info */}
            {(isOwnProfile || (profile.socialLinks && Object.values(profile.socialLinks).some(Boolean))) && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Connect</h3>
                {editing ? (
                  <div className="space-y-3">
                    <input
                      type="text"
                      placeholder="Instagram handle"
                      value={editForm.socialLinks.instagram}
                      onChange={(e) => setEditForm({
                        ...editForm,
                        socialLinks: {...editForm.socialLinks, instagram: e.target.value}
                      })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                    <input
                      type="text"
                      placeholder="Website URL"
                      value={editForm.socialLinks.website}
                      onChange={(e) => setEditForm({
                        ...editForm,
                        socialLinks: {...editForm.socialLinks, website: e.target.value}
                      })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-3">
                    {profile.socialLinks?.instagram && (
                      <a
                        href={`https://instagram.com/${profile.socialLinks.instagram}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 bg-pink-100 text-pink-700 px-3 py-1 rounded-full text-sm hover:bg-pink-200"
                      >
                        📷 Instagram
                      </a>
                    )}
                    {profile.socialLinks?.website && (
                      <a
                        href={profile.socialLinks.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm hover:bg-blue-200"
                      >
                        🌐 Website
                      </a>
                    )}
                  </div>
                )}
              </div>
            )}
            
            {/* Organizer Profile */}
            {profile.role === 'organizer' && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Organizer Experience</h3>
                {editing ? (
                  <div className="space-y-3">
                    <textarea
                      placeholder="Organizer bio"
                      value={editForm.organizerProfile.bio}
                      onChange={(e) => setEditForm({
                        ...editForm,
                        organizerProfile: {...editForm.organizerProfile, bio: e.target.value}
                      })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      rows={3}
                    />
                    <input
                      type="number"
                      placeholder="Years of experience"
                      value={editForm.organizerProfile.yearsOfExperience}
                      onChange={(e) => setEditForm({
                        ...editForm,
                        organizerProfile: {...editForm.organizerProfile, yearsOfExperience: parseInt(e.target.value) || 0}
                      })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                ) : (
                  <div className="space-y-3">
                    {profile.organizerProfile?.bio && (
                      <p className="text-gray-700">{profile.organizerProfile.bio}</p>
                    )}
                    {profile.organizerProfile?.yearsOfExperience && (
                      <p className="text-sm text-gray-600">
                        🎖️ {profile.organizerProfile.yearsOfExperience} years of experience
                      </p>
                    )}
                    {profile.organizerProfile?.specialties && profile.organizerProfile.specialties.length > 0 && (
                      <div>
                        <h4 className="font-medium text-gray-800 mb-2">Specialties:</h4>
                        <div className="flex flex-wrap gap-2">
                          {profile.organizerProfile.specialties.map((specialty, index) => (
                            <span key={index} className="bg-nature-100 text-nature-700 px-2 py-1 rounded-full text-xs">
                              {specialty}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            
            {/* Share Profile */}
            {isOwnProfile && (
              <div className="pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Share your profile</span>
                  <button
                    onClick={generateShareableLink}
                    className="bg-nature-600 hover:bg-nature-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
                  >
                    🔗 Generate Link
                  </button>
                </div>
                {shareableLink && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={shareableLink}
                        readOnly
                        className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded text-sm"
                      />
                      <button
                        onClick={() => copyToClipboard(shareableLink)}
                        className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-2 rounded text-sm"
                      >
                        📋 Copy
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        
        {/* Recent Activity or Trips could go here */}
      </div>
    </div>
  );
};

export default EnhancedProfile;