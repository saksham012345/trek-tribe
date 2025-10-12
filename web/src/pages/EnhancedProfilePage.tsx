import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../config/api';
import { useAuth } from '../contexts/AuthContext';
import EnhancedProfileCard from '../components/EnhancedProfileCard';
import PostCreator from '../components/PostCreator';
import PostCard from '../components/PostCard';
import ProfilePhotoUpload from '../components/ProfilePhotoUpload';

interface ProfileUser {
  _id: string;
  name: string;
  email?: string;
  role: string;
  phone?: string;
  bio?: string;
  profilePhoto?: string;
  location?: string;
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

interface Post {
  _id: string;
  type: 'trip_memory' | 'general_post' | 'link_share' | 'experience';
  title: string;
  content: string;
  images?: string[];
  links?: Array<{
    title: string;
    url: string;
    description?: string;
  }>;
  tripData?: {
    destination: string;
    startDate: string;
    endDate: string;
    participants?: number;
    highlights?: string[];
    rating?: number;
  };
  tags?: string[];
  likes: any[];
  comments: any[];
  isPublic: boolean;
  authorId: {
    _id: string;
    name: string;
    profilePhoto?: string;
    role: string;
  };
  createdAt: string;
  updatedAt: string;
}

const EnhancedProfilePage: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const isOwnProfile = !userId || userId === currentUser?.id;
  
  const [profile, setProfile] = useState<ProfileUser | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [showPostCreator, setShowPostCreator] = useState(false);
  const [activeTab, setActiveTab] = useState<'posts' | 'past-trips' | 'links'>('posts');
  const [pastTrips, setPastTrips] = useState<any[]>([]);
  const [userLinks, setUserLinks] = useState<any[]>([]);

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
    fetchPosts();
    if (isOwnProfile) {
      fetchPastTrips();
      fetchUserLinks();
    }
  }, [userId, isOwnProfile]);

  const fetchProfile = async () => {
    try {
      const endpoint = isOwnProfile ? '/profile/me' : `/profile/${userId}`;
      const response = await api.get(endpoint);
      
      const responseData = response.data as { user?: any; profile?: any };
      const userData = isOwnProfile ? responseData.user : responseData.profile;
      setProfile(userData);
      
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

  const fetchPosts = async () => {
    try {
      const targetUserId = userId || currentUser?.id;
      if (!targetUserId) return;

      const response = await api.get(`/api/posts?authorId=${targetUserId}`);
      setPosts(response.data.posts);
    } catch (error) {
      console.error('Error fetching posts:', error);
    }
  };

  const fetchPastTrips = async () => {
    try {
      // This would fetch past trips from the trips API
      const response = await api.get('/trips');
      const allTrips = response.data;
      
      // Filter for completed trips where user participated
      const completedTrips = allTrips.filter((trip: any) => 
        trip.status === 'completed' && 
        (trip.organizerId === currentUser?.id || trip.participants.includes(currentUser?.id))
      );
      
      setPastTrips(completedTrips);
    } catch (error) {
      console.error('Error fetching past trips:', error);
    }
  };

  const fetchUserLinks = async () => {
    try {
      // Fetch user's link posts
      const response = await api.get('/api/posts?type=link_share');
      const linkPosts = response.data.posts.filter((post: Post) => 
        post.authorId._id === currentUser?.id && post.links && post.links.length > 0
      );
      
      const extractedLinks = linkPosts.flatMap(post => 
        post.links!.map(link => ({
          ...link,
          postId: post._id,
          postTitle: post.title,
          createdAt: post.createdAt
        }))
      );
      
      setUserLinks(extractedLinks);
    } catch (error) {
      console.error('Error fetching user links:', error);
    }
  };

  const handleSave = async () => {
    try {
      const response = await api.put('/profile/me', editForm);
      const userData = response.data as { user: any };
      setProfile(userData.user);
      setEditing(false);
    } catch (error: any) {
      console.error('Profile update error:', error);
      alert('Failed to update profile');
    }
  };

  const handlePostCreated = () => {
    fetchPosts();
    if (isOwnProfile) {
      fetchUserLinks();
      // Refresh profile to update post count
      fetchProfile();
    }
  };

  const handleFollowUpdate = () => {
    fetchProfile();
  };

  const handlePhotoUpdate = (photoUrl: string) => {
    if (profile) {
      setProfile({ ...profile, profilePhoto: photoUrl });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Profile not found</h2>
          <p className="text-gray-600 mt-2">The profile you're looking for doesn't exist.</p>
          <button
            onClick={() => navigate('/home')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header with enhanced profile card */}
        <div className="mb-8">
          <EnhancedProfileCard
            profile={profile}
            isOwnProfile={isOwnProfile}
            onFollowUpdate={handleFollowUpdate}
          />
        </div>

        {/* Action buttons for own profile */}
        {isOwnProfile && (
          <div className="flex gap-4 mb-6">
            <button
              onClick={() => setShowPostCreator(true)}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 flex items-center gap-2 shadow-lg"
            >
              <span className="text-xl">✍️</span>
              Create Post
            </button>
            <button
              onClick={() => setEditing(!editing)}
              className={`px-6 py-3 rounded-lg transition-all duration-200 flex items-center gap-2 ${
                editing
                  ? 'bg-gray-600 text-white hover:bg-gray-700'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              <span className="text-xl">{editing ? '💾' : '✏️'}</span>
              {editing ? 'Save Changes' : 'Edit Profile'}
            </button>
            {editing && (
              <button
                onClick={handleSave}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all duration-200 flex items-center gap-2"
              >
                <span className="text-xl">✅</span>
                Save Profile
              </button>
            )}
          </div>
        )}

        {/* Editing form */}
        {editing && (
          <div className="bg-white rounded-2xl shadow-xl p-6 mb-8">
            <h3 className="text-xl font-bold text-gray-900 mb-6">Edit Profile</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Name *
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone
                </label>
                <input
                  type="tel"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Bio
                </label>
                <textarea
                  value={editForm.bio}
                  onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Tell us about yourself..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Location
                </label>
                <input
                  type="text"
                  value={editForm.location}
                  onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Your city, country"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Profile Photo
                </label>
                <ProfilePhotoUpload
                  currentPhoto={profile.profilePhoto}
                  onPhotoUpdate={handlePhotoUpdate}
                />
              </div>
            </div>

            {/* Social Links */}
            <div className="mt-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">Social Links</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="Instagram handle"
                  value={editForm.socialLinks.instagram}
                  onChange={(e) => setEditForm({
                    ...editForm,
                    socialLinks: { ...editForm.socialLinks, instagram: e.target.value }
                  })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="url"
                  placeholder="Website URL"
                  value={editForm.socialLinks.website}
                  onChange={(e) => setEditForm({
                    ...editForm,
                    socialLinks: { ...editForm.socialLinks, website: e.target.value }
                  })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="Facebook handle"
                  value={editForm.socialLinks.facebook}
                  onChange={(e) => setEditForm({
                    ...editForm,
                    socialLinks: { ...editForm.socialLinks, facebook: e.target.value }
                  })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="Twitter handle"
                  value={editForm.socialLinks.twitter}
                  onChange={(e) => setEditForm({
                    ...editForm,
                    socialLinks: { ...editForm.socialLinks, twitter: e.target.value }
                  })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="LinkedIn handle"
                  value={editForm.socialLinks.linkedin}
                  onChange={(e) => setEditForm({
                    ...editForm,
                    socialLinks: { ...editForm.socialLinks, linkedin: e.target.value }
                  })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Organizer Profile */}
            {profile.role === 'organizer' && (
              <div className="mt-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Organizer Profile</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Organizer Bio
                    </label>
                    <textarea
                      value={editForm.organizerProfile.bio}
                      onChange={(e) => setEditForm({
                        ...editForm,
                        organizerProfile: { ...editForm.organizerProfile, bio: e.target.value }
                      })}
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Tell us about your organizing experience..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Years of Experience
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="50"
                      value={editForm.organizerProfile.yearsOfExperience}
                      onChange={(e) => setEditForm({
                        ...editForm,
                        organizerProfile: { ...editForm.organizerProfile, yearsOfExperience: parseInt(e.target.value) || 0 }
                      })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Content tabs */}
        <div className="bg-white rounded-2xl shadow-xl">
          {/* Tab navigation */}
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              {[
                { id: 'posts', label: 'Posts', icon: '📝', count: posts.length },
                { id: 'past-trips', label: 'Past Trips', icon: '🏔️', count: pastTrips.length },
                { id: 'links', label: 'Links', icon: '🔗', count: userLinks.length }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span>{tab.icon}</span>
                    {tab.label}
                    <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-xs">
                      {tab.count}
                    </span>
                  </span>
                </button>
              ))}
            </nav>
          </div>

          {/* Tab content */}
          <div className="p-6">
            {activeTab === 'posts' && (
              <div className="space-y-6">
                {posts.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">📝</div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">No posts yet</h3>
                    <p className="text-gray-600 mb-6">
                      {isOwnProfile ? 'Start sharing your adventures with the community!' : 'This user hasn\'t posted anything yet.'}
                    </p>
                    {isOwnProfile && (
                      <button
                        onClick={() => setShowPostCreator(true)}
                        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Create Your First Post
                      </button>
                    )}
                  </div>
                ) : (
                  posts.map((post) => (
                    <PostCard key={post._id} post={post} onLikeUpdate={fetchPosts} />
                  ))
                )}
              </div>
            )}

            {activeTab === 'past-trips' && (
              <div className="space-y-4">
                {pastTrips.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">🏔️</div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">No past trips</h3>
                    <p className="text-gray-600">
                      {isOwnProfile ? 'Your completed trips will appear here.' : 'This user hasn\'t completed any trips yet.'}
                    </p>
                  </div>
                ) : (
                  pastTrips.map((trip) => (
                    <div key={trip._id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-semibold text-gray-900">{trip.title}</h4>
                          <p className="text-gray-600">{trip.destination}</p>
                          <p className="text-sm text-gray-500">
                            {new Date(trip.startDate).toLocaleDateString()} - {new Date(trip.endDate).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-500">Status: {trip.status}</p>
                          <p className="text-sm text-gray-500">{trip.participants?.length || 0} participants</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'links' && (
              <div className="space-y-4">
                {userLinks.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">🔗</div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">No links shared</h3>
                    <p className="text-gray-600">
                      {isOwnProfile ? 'Share useful links with the community!' : 'This user hasn\'t shared any links yet.'}
                    </p>
                  </div>
                ) : (
                  userLinks.map((link, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900">{link.title}</h4>
                          {link.description && (
                            <p className="text-gray-600 text-sm">{link.description}</p>
                          )}
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 text-sm"
                          >
                            {link.url}
                          </a>
                          <p className="text-xs text-gray-500 mt-1">
                            From post: {link.postTitle}
                          </p>
                        </div>
                        <div className="ml-4">
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            Visit
                          </a>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Post Creator Modal */}
      {showPostCreator && (
        <PostCreator
          onPostCreated={handlePostCreated}
          onClose={() => setShowPostCreator(false)}
        />
      )}
    </div>
  );
};

export default EnhancedProfilePage;
