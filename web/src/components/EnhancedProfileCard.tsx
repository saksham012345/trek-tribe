import React, { useState, useEffect } from 'react';
import api from '../config/api';
import { useAuth } from '../contexts/AuthContext';

interface ProfileUser {
  _id: string;
  name: string;
  email?: string;
  role: string;
  phone?: string;
  bio?: string;
  profilePhoto?: string;
  location?: string;
  uniqueUrl?: string;
  socialLinks?: {
    instagram?: string;
    facebook?: string;
    twitter?: string;
    linkedin?: string;
    website?: string;
  };
  organizerProfile?: {
    bio?: string;
    experience?: string;
    specialties?: string[];
    languages?: string[];
    yearsOfExperience?: number;
  };
  socialStats?: {
    followersCount: number;
    followingCount: number;
    postsCount: number;
  };
  isVerified?: boolean;
  createdAt: string;
}

interface FollowStatus {
  isFollowing: boolean;
}

interface EnhancedProfileCardProps {
  profile: ProfileUser;
  isOwnProfile: boolean;
  onFollowUpdate?: () => void;
}

const EnhancedProfileCard: React.FC<EnhancedProfileCardProps> = ({
  profile,
  isOwnProfile,
  onFollowUpdate
}) => {
  const { user: currentUser } = useAuth();
  const [followStatus, setFollowStatus] = useState<FollowStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [showFollowers, setShowFollowers] = useState(false);
  const [showFollowing, setShowFollowing] = useState(false);

  useEffect(() => {
    if (!isOwnProfile && currentUser) {
      checkFollowStatus();
    }
  }, [profile._id, currentUser, isOwnProfile]);

  const checkFollowStatus = async () => {
    try {
      const response = await api.get(`/api/follow/${profile._id}/status`);
      setFollowStatus(response.data);
    } catch (error) {
      console.error('Error checking follow status:', error);
    }
  };

  const handleFollow = async () => {
    if (!currentUser || isOwnProfile) return;

    setLoading(true);
    try {
      if (followStatus?.isFollowing) {
        await api.delete(`/api/follow/${profile._id}`);
        setFollowStatus({ isFollowing: false });
      } else {
        await api.post(`/api/follow/${profile._id}`);
        setFollowStatus({ isFollowing: true });
      }
      onFollowUpdate?.();
    } catch (error) {
      console.error('Error updating follow status:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'organizer': return '🗺️';
      case 'admin': return '🛠️';
      case 'agent': return '🎧';
      default: return '🎒';
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'organizer': return 'from-blue-500 to-purple-600';
      case 'admin': return 'from-red-500 to-orange-600';
      case 'agent': return 'from-green-500 to-teal-600';
      default: return 'from-gray-500 to-blue-600';
    }
  };

  const handleShareProfile = async () => {
    try {
      const profileUrl = profile.uniqueUrl 
        ? `${window.location.origin}/profile/${profile.uniqueUrl}`
        : `${window.location.origin}/profile/${profile._id}`;
      
      if (navigator.share) {
        // Use native share API if available
        await navigator.share({
          title: `${profile.name}'s Profile - TrekTribe`,
          text: `Check out ${profile.name}'s profile on TrekTribe!`,
          url: profileUrl,
        });
      } else {
        // Fallback to clipboard
        await navigator.clipboard.writeText(profileUrl);
        alert('Profile link copied to clipboard!');
      }
    } catch (error) {
      console.error('Error sharing profile:', error);
      // Fallback to clipboard
      try {
        const profileUrl = profile.uniqueUrl 
          ? `${window.location.origin}/profile/${profile.uniqueUrl}`
          : `${window.location.origin}/profile/${profile._id}`;
        await navigator.clipboard.writeText(profileUrl);
        alert('Profile link copied to clipboard!');
      } catch (clipboardError) {
        alert('Unable to share profile link');
      }
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
      {/* Header with gradient background */}
      <div className={`bg-gradient-to-r ${getRoleColor(profile.role)} h-48 relative`}>
        <div className="absolute inset-0 bg-black bg-opacity-20"></div>
        
        {/* Profile photo and basic info */}
        <div className="absolute bottom-6 left-6 flex items-end gap-6">
          <div className="bg-white p-2 rounded-2xl shadow-lg">
            <div className="w-32 h-32 rounded-xl overflow-hidden bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
              {profile.profilePhoto ? (
                <img 
                  src={profile.profilePhoto} 
                  alt={profile.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-4xl">👤</span>
              )}
            </div>
          </div>
          
          <div className="text-white pb-4">
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
              {profile.name}
              {profile.isVerified && (
                <span className="text-2xl" title="Verified Profile">✅</span>
              )}
            </h1>
            <p className="text-white text-lg capitalize flex items-center gap-2 opacity-90">
              <span className="text-xl">{getRoleIcon(profile.role)}</span>
              {profile.role}
            </p>
            {profile.location && (
              <p className="text-white flex items-center gap-1 opacity-80">
                📍 {profile.location}
              </p>
            )}
          </div>
        </div>

        {/* Follow button for non-own profiles - only show for organizers */}
        {!isOwnProfile && currentUser && profile.role === 'organizer' && (
          <div className="absolute top-6 right-6">
            <button
              onClick={handleFollow}
              disabled={loading}
              className={`px-6 py-3 rounded-lg font-medium text-white transition-all duration-200 ${
                followStatus?.isFollowing
                  ? 'bg-gray-600 hover:bg-gray-700'
                  : 'bg-green-600 hover:bg-green-700'
              } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  {followStatus?.isFollowing ? 'Unfollowing...' : 'Following...'}
                </span>
              ) : followStatus?.isFollowing ? (
                <span className="flex items-center gap-2">
                  <span>✓</span>
                  Following
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <span>+</span>
                  Follow Organizer
                </span>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Stats section */}
      <div className="p-6">
        {profile.socialStats && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div 
              className="text-center p-4 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => setShowFollowers(true)}
            >
              <div className="text-2xl font-bold text-blue-600">
                {profile.socialStats.followersCount}
              </div>
              <div className="text-sm text-gray-600">Followers</div>
            </div>
            
            <div 
              className="text-center p-4 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => setShowFollowing(true)}
            >
              <div className="text-2xl font-bold text-green-600">
                {profile.socialStats.followingCount}
              </div>
              <div className="text-sm text-gray-600">Following</div>
            </div>
            
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {profile.socialStats.postsCount}
              </div>
              <div className="text-sm text-gray-600">Posts</div>
            </div>
          </div>
        )}

        {/* Bio */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">About</h3>
          <p className="text-gray-700 leading-relaxed">
            {profile.bio || 'No bio available yet.'}
          </p>
        </div>

        {/* Social Links */}
        {profile.socialLinks && Object.values(profile.socialLinks).some(Boolean) && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Connect</h3>
            <div className="flex flex-wrap gap-3">
              {profile.socialLinks.instagram && (
                <a
                  href={`https://instagram.com/${profile.socialLinks.instagram}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-pink-100 text-pink-700 px-3 py-2 rounded-full text-sm hover:bg-pink-200 transition-colors"
                >
                  📷 Instagram
                </a>
              )}
              {profile.socialLinks.website && (
                <a
                  href={profile.socialLinks.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-blue-100 text-blue-700 px-3 py-2 rounded-full text-sm hover:bg-blue-200 transition-colors"
                >
                  🌐 Website
                </a>
              )}
              {profile.socialLinks.facebook && (
                <a
                  href={`https://facebook.com/${profile.socialLinks.facebook}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-blue-100 text-blue-700 px-3 py-2 rounded-full text-sm hover:bg-blue-200 transition-colors"
                >
                  📘 Facebook
                </a>
              )}
              {profile.socialLinks.twitter && (
                <a
                  href={`https://twitter.com/${profile.socialLinks.twitter}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-sky-100 text-sky-700 px-3 py-2 rounded-full text-sm hover:bg-sky-200 transition-colors"
                >
                  🐦 Twitter
                </a>
              )}
              {profile.socialLinks.linkedin && (
                <a
                  href={`https://linkedin.com/in/${profile.socialLinks.linkedin}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-blue-100 text-blue-700 px-3 py-2 rounded-full text-sm hover:bg-blue-200 transition-colors"
                >
                  💼 LinkedIn
                </a>
              )}
            </div>
          </div>
        )}

        {/* Organizer Profile */}
        {profile.role === 'organizer' && profile.organizerProfile && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Organizer Experience</h3>
            <div className="space-y-3">
              {profile.organizerProfile.bio && (
                <p className="text-gray-700">{profile.organizerProfile.bio}</p>
              )}
              {profile.organizerProfile.yearsOfExperience && (
                <p className="text-sm text-gray-600">
                  🎖️ {profile.organizerProfile.yearsOfExperience} years of experience
                </p>
              )}
              {profile.organizerProfile.specialties && profile.organizerProfile.specialties.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-800 mb-2">Specialties:</h4>
                  <div className="flex flex-wrap gap-2">
                    {profile.organizerProfile.specialties.map((specialty, index) => (
                      <span key={index} className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs">
                        {specialty}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {profile.organizerProfile.languages && profile.organizerProfile.languages.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-800 mb-2">Languages:</h4>
                  <div className="flex flex-wrap gap-2">
                    {profile.organizerProfile.languages.map((language, index) => (
                      <span key={index} className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs">
                        {language}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Share Profile */}
        <div className="pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-gray-600">Share Profile</span>
              <p className="text-xs text-gray-500 mt-1">
                {profile.uniqueUrl 
                  ? `trektribe.com/profile/${profile.uniqueUrl}`
                  : `trektribe.com/profile/${profile._id}`
                }
              </p>
            </div>
            <button
              onClick={handleShareProfile}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1 px-3 py-2 rounded-lg hover:bg-blue-50 transition-colors"
            >
              📤 Share
            </button>
          </div>
        </div>

        {/* Member since */}
        <div className="pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            Member since {new Date(profile.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Followers Modal */}
      {showFollowers && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-96 overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Followers</h3>
              <button
                onClick={() => setShowFollowers(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <FollowersList userId={profile._id} />
          </div>
        </div>
      )}

      {/* Following Modal */}
      {showFollowing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-96 overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Following</h3>
              <button
                onClick={() => setShowFollowing(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <FollowingList userId={profile._id} />
          </div>
        </div>
      )}
    </div>
  );
};

// Followers List Component
const FollowersList: React.FC<{ userId: string }> = ({ userId }) => {
  const [followers, setFollowers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFollowers();
  }, [userId]);

  const fetchFollowers = async () => {
    try {
      const response = await api.get(`/api/follow/${userId}/followers`);
      setFollowers(response.data.followers);
    } catch (error) {
      console.error('Error fetching followers:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-4">Loading...</div>;
  }

  if (followers.length === 0) {
    return <div className="text-center py-4 text-gray-500">No followers yet</div>;
  }

  return (
    <div className="space-y-3">
      {followers.map((follower) => (
        <div key={follower._id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg">
          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
            {follower.profilePhoto ? (
              <img 
                src={follower.profilePhoto} 
                alt={follower.name}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <span>👤</span>
            )}
          </div>
          <div>
            <p className="font-medium text-gray-900">{follower.name}</p>
            <p className="text-sm text-gray-500 capitalize">{follower.role}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

// Following List Component
const FollowingList: React.FC<{ userId: string }> = ({ userId }) => {
  const [following, setFollowing] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFollowing();
  }, [userId]);

  const fetchFollowing = async () => {
    try {
      const response = await api.get(`/api/follow/${userId}/following`);
      setFollowing(response.data.following);
    } catch (error) {
      console.error('Error fetching following:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-4">Loading...</div>;
  }

  if (following.length === 0) {
    return <div className="text-center py-4 text-gray-500">Not following anyone yet</div>;
  }

  return (
    <div className="space-y-3">
      {following.map((user) => (
        <div key={user._id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg">
          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
            {user.profilePhoto ? (
              <img 
                src={user.profilePhoto} 
                alt={user.name}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <span>👤</span>
            )}
          </div>
          <div>
            <p className="font-medium text-gray-900">{user.name}</p>
            <p className="text-sm text-gray-500 capitalize">{user.role}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default EnhancedProfileCard;
