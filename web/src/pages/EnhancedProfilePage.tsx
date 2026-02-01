import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../config/api';
import { useAuth } from '../contexts/AuthContext';
import EnhancedProfileCard from '../components/EnhancedProfileCard';
import PostCreator from '../components/PostCreator';
import PostCard from '../components/PostCard';
import ProfilePhotoUpload from '../components/ProfilePhotoUpload';

interface RoleBasedData {
  portfolioVisible: boolean;
  postsVisible: boolean;
  followersVisible: boolean;
  statsVisible: boolean;
  canPost: boolean;
  showPastTrips: boolean;
  showWishlists: boolean;
}

interface ProfileUser {
  _id: string;
  name: string;
  username?: string;
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

interface EnhancedProfileResponse {
  user: ProfileUser;
  roleBasedData: RoleBasedData;
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
  const { user: currentUser, logout } = useAuth();
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(userId || currentUser?.id || null);
  const [isOwnProfile, setIsOwnProfile] = useState<boolean>(!userId || userId === currentUser?.id);

  const [profile, setProfile] = useState<ProfileUser | null>(null);
  const [roleBasedData, setRoleBasedData] = useState<RoleBasedData | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ type: 'not-found' | 'server-error' | 'private' | null; message: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const [showPostCreator, setShowPostCreator] = useState(false);
  const [activeTab, setActiveTab] = useState<'posts' | 'past-trips' | 'links'>('posts');
  const [pastTrips, setPastTrips] = useState<any[]>([]);
  const [userLinks, setUserLinks] = useState<any[]>([]);

  const [editForm, setEditForm] = useState({
    name: '',
    username: '',
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
  }, [userId]);

  useEffect(() => {
    if (!resolvedUserId) return;
    fetchPosts();
    if (isOwnProfile) {
      fetchPastTrips();
      fetchUserLinks();
    }
  }, [resolvedUserId, isOwnProfile]);

  const fetchProfile = async () => {
    setError(null);
    try {
      const identifier = userId;
      const isHandle = identifier ? !/^[a-f0-9]{24}$/i.test(identifier) : false;

      // If no identifier and we have currentUser, use currentUser's ID
      // This ensures we always have a userId for the endpoint
      let endpoint: string;
      if (!identifier) {
        // No userId in URL - check if we have currentUser
        if (currentUser?.id) {
          endpoint = `/profile/enhanced/${currentUser.id}`;
        } else {
          // No user ID available - try the endpoint without ID (will fail if not authenticated)
          endpoint = '/profile/enhanced';
        }
      } else if (isHandle) {
        endpoint = `/public/${identifier}`;
      } else {
        endpoint = `/profile/enhanced/${identifier}`;
      }

      const response = await api.get(endpoint);

      let userData: ProfileUser;
      let roleData: RoleBasedData | null = null;

      if (endpoint.startsWith('/public/')) {
        const publicData = (response.data as any).data;
        userData = publicData.user as ProfileUser;
        roleData = {
          portfolioVisible: true,
          postsVisible: true,
          followersVisible: true,
          statsVisible: true,
          canPost: userData.role === 'organizer',
          showPastTrips: userData.role === 'traveller',
          showWishlists: userData.role === 'traveller'
        };
      } else {
        const responseData = response.data as { data: EnhancedProfileResponse };
        userData = responseData.data.user;
        roleData = responseData.data.roleBasedData || {
          portfolioVisible: true,
          postsVisible: true,
          followersVisible: true,
          statsVisible: true,
          canPost: userData.role === 'organizer',
          showPastTrips: userData.role === 'traveller',
          showWishlists: userData.role === 'traveller'
        };
      }

      setProfile(userData);
      setRoleBasedData(roleData);
      setResolvedUserId(userData._id || userData.email); // fall back to email if id missing
      const viewingOwnProfile = !!(currentUser && userData._id === currentUser.id);
      setIsOwnProfile(viewingOwnProfile || (!identifier && !!currentUser));

      if (viewingOwnProfile) {
        setEditForm({
          name: userData.name || '',
          username: userData.username || '',
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
    } catch (error: any) {
      const statusCode = error.response?.status;
      const errorMessage = error.response?.data?.message || error.message;

      console.error('Error fetching profile:', { statusCode, errorMessage, error });

      if (statusCode === 404) {
        setError({ type: 'not-found', message: 'Profile not found' });
      } else if (statusCode === 403) {
        setError({ type: 'private', message: 'This profile is private and you do not have access to view it.' });
      } else {
        setError({ type: 'server-error', message: 'Something went wrong. Please try again later.' });
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchPosts = async () => {
    try {
      if (!resolvedUserId) return;

      const response = await api.get(`/api/posts?authorId=${resolvedUserId}`);
      setPosts((response.data as any).posts);
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
      const completedTrips = (allTrips as any[]).filter((trip: any) => {
        const participants = Array.isArray(trip.participants) ? trip.participants : [];

        return trip.status === 'completed' &&
          (trip.organizerId === currentUser?.id || participants.includes(currentUser?.id));
      });

      setPastTrips(completedTrips);
    } catch (error) {
      console.error('Error fetching past trips:', error);
    }
  };

  const fetchUserLinks = async () => {
    try {
      // Fetch user's link posts
      const response = await api.get('/api/posts?type=link_share');
      const linkPosts = (response.data as any).posts.filter((post: any) =>
        post.authorId._id === currentUser?.id && post.links && post.links.length > 0
      );

      const extractedLinks = linkPosts.flatMap((post: any) =>
        post.links!.map((link: any) => ({
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
      const response = await api.put('/profile/enhanced', editForm);
      const userData = response.data as { data: { user: any } };
      setProfile(userData.data.user);
      setEditing(false);
      alert('Profile updated successfully!');
    } catch (error: any) {
      console.error('Profile update error:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to update profile';
      alert(`Failed to update profile: ${errorMessage}`);
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

  // Show error states
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          {error.type === 'not-found' && (
            <>
              <h2 className="text-2xl font-bold text-gray-900">Profile Not Found</h2>
              <p className="text-gray-600 mt-2">{error.message}</p>
              <p className="text-sm text-gray-500 mt-1">The profile you're looking for doesn't exist.</p>
            </>
          )}
          {error.type === 'private' && (
            <>
              <h2 className="text-2xl font-bold text-gray-900">Profile is Private</h2>
              <p className="text-gray-600 mt-2">{error.message}</p>
            </>
          )}
          {error.type === 'server-error' && (
            <>
              <h2 className="text-2xl font-bold text-gray-900">Server Error</h2>
              <p className="text-gray-600 mt-2">{error.message}</p>
              <p className="text-sm text-gray-500 mt-1">Please try again in a few moments.</p>
            </>
          )}
          <button
            onClick={() => navigate('/home')}
            className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go Home
          </button>
        </div>
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

  // All roles can have profiles now

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Decorative header background */}
      <div className="h-64 bg-gradient-to-r from-forest-800 to-nature-800 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "url('/patterns/topography.svg')" }}></div>
        <div className="absolute inset-0 bg-black/10"></div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-32 relative z-10 pb-12">
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
          <div className="flex flex-wrap gap-4 mb-8 justify-end">
            {/* Only allow post creation if roleBasedData allows it */}
            {roleBasedData?.canPost && (
              <button
                onClick={() => setShowPostCreator(true)}
                className="px-6 py-3 bg-forest-600 text-white rounded-xl hover:bg-forest-700 transition-all duration-200 flex items-center gap-2 shadow-lg shadow-forest-600/20 transform hover:-translate-y-0.5"
              >
                <span className="text-xl">✍️</span>
                <span className="font-semibold">Create Post</span>
              </button>
            )}
            <button
              onClick={() => setEditing(!editing)}
              className={`px-6 py-3 rounded-xl transition-all duration-200 flex items-center gap-2 border shadow-sm ${editing
                ? 'bg-neutral-800 text-white border-neutral-800 hover:bg-neutral-900'
                : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50 hover:border-neutral-300'
                }`}
            >
              <span className="text-xl">{editing ? '💾' : '✏️'}</span>
              <span className="font-semibold">{editing ? 'Save Changes' : 'Edit Profile'}</span>
            </button>
            {editing && (
              <button
                onClick={handleSave}
                className="px-6 py-3 bg-nature-600 text-white rounded-xl hover:bg-nature-700 transition-all duration-200 flex items-center gap-2 shadow-lg shadow-nature-600/20"
              >
                <span className="text-xl">✅</span>
                <span className="font-semibold">Save Profile</span>
              </button>
            )}
            {!editing && (
              <button
                onClick={() => {
                  if (window.confirm('Are you sure you want to logout?')) {
                    logout();
                    navigate('/login');
                  }
                }}
                className="px-6 py-3 bg-red-50 text-red-600 border border-red-100 rounded-xl hover:bg-red-100 transition-all duration-200 flex items-center gap-2"
              >
                <span className="text-xl">🚪</span>
                <span className="font-semibold">Logout</span>
              </button>
            )}
            <button
              onClick={() => navigate('/request-trip')}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all duration-200 flex items-center gap-2 shadow-lg shadow-blue-600/20"
            >
              <span className="text-xl">✨</span>
              <span className="font-semibold">Request Custom Trip</span>
            </button>
          </div>
        )}

        {/* Editing form */}
        {editing && (
          <div className="bg-white rounded-2xl shadow-xl border border-neutral-100 p-8 mb-8 animate-fade-in">
            <h3 className="text-2xl font-bold text-gray-900 mb-8 flex items-center gap-3">
              <span className="p-2 bg-forest-100 rounded-lg text-forest-600 text-xl">✏️</span>
              Edit Profile
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Profile Photo</label>
                  <ProfilePhotoUpload
                    currentPhoto={profile.profilePhoto}
                    onPhotoUpdate={handlePhotoUpdate}
                  />
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-forest-500 focus:border-forest-500 transition-all bg-gray-50 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
                  <input
                    type="text"
                    value={editForm.username}
                    onChange={(e) => setEditForm({ ...editForm, username: e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '') })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-forest-500 focus:border-forest-500 transition-all bg-gray-50 focus:bg-white"
                    placeholder="your-username"
                  />
                  <p className="text-xs text-gray-500 mt-2 font-mono">
                    {window.location.origin}/profile/{editForm.username || 'username'}
                  </p>
                </div>
              </div>

              <div className="md:col-span-2 space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Bio</label>
                  <textarea
                    value={editForm.bio}
                    onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-forest-500 focus:border-forest-500 transition-all bg-gray-50 focus:bg-white resize-none"
                    placeholder="Tell us about your next adventure..."
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                    <input
                      type="text"
                      value={editForm.location}
                      onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-forest-500 focus:border-forest-500 transition-all bg-gray-50 focus:bg-white"
                      placeholder="e.g. Mumbai, India"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                    <input
                      type="tel"
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-forest-500 focus:border-forest-500 transition-all bg-gray-50 focus:bg-white"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Social Links */}
            <div className="mt-10 pt-8 border-t border-gray-100">
              <h4 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                <span className="text-blue-500">🌐</span> Social Links
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {['instagram', 'website', 'facebook', 'twitter', 'linkedin'].map((social) => (
                  <div key={social} className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-400 text-sm capitalize">{social}</span>
                    </div>
                    <input
                      type="text"
                      placeholder={social === 'website' ? 'https://your-site.com' : 'username'}
                      value={(editForm.socialLinks as any)[social]}
                      onChange={(e) => setEditForm({
                        ...editForm,
                        socialLinks: { ...editForm.socialLinks, [social]: e.target.value }
                      })}
                      className="w-full pl-24 px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-forest-500 focus:border-forest-500 transition-all bg-gray-50 focus:bg-white"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Organizer Profile */}
            {profile.role === 'organizer' && (
              <div className="mt-10 pt-8 border-t border-gray-100">
                <h4 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <span className="text-nature-600">🏕️</span> Organizer Details
                </h4>
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Professional Bio</label>
                    <textarea
                      value={editForm.organizerProfile.bio}
                      onChange={(e) => setEditForm({
                        ...editForm,
                        organizerProfile: { ...editForm.organizerProfile, bio: e.target.value }
                      })}
                      rows={4}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-forest-500 focus:border-forest-500 transition-all bg-gray-50 focus:bg-white resize-none"
                      placeholder="Describe your organizing philosophy and experience..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Years of Experience</label>
                    <div className="relative max-w-xs">
                      <input
                        type="number"
                        min="0"
                        max="50"
                        value={editForm.organizerProfile.yearsOfExperience}
                        onChange={(e) => setEditForm({
                          ...editForm,
                          organizerProfile: { ...editForm.organizerProfile, yearsOfExperience: parseInt(e.target.value) || 0 }
                        })}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-forest-500 focus:border-forest-500 transition-all bg-gray-50 focus:bg-white"
                      />
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <span className="text-gray-500">Years</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Content tabs */}
        {roleBasedData && (roleBasedData.postsVisible || roleBasedData.showPastTrips || roleBasedData.showWishlists) ? (
          <div className="bg-white rounded-2xl shadow-xl shadow-neutral-200/50 border border-neutral-100 overflow-hidden">
            {/* Tab navigation */}
            <div className="border-b border-gray-100 bg-white">
              <nav className="flex space-x-8 px-8 overflow-x-auto scroolbar-hide">
                {[
                  { id: 'posts', label: 'Adventures', icon: '📝', count: posts?.length || 0, show: roleBasedData.postsVisible },
                  { id: 'past-trips', label: 'Past Trips', icon: '🏔️', count: pastTrips?.length || 0, show: roleBasedData.showPastTrips && isOwnProfile },
                  { id: 'links', label: 'Links', icon: '🔗', count: userLinks?.length || 0, show: roleBasedData.showWishlists && isOwnProfile }
                ].filter(tab => tab.show).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`py-6 px-1 border-b-2 font-medium text-sm transition-all duration-200 whitespace-nowrap ${activeTab === tab.id
                      ? 'border-forest-600 text-forest-700'
                      : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-200'
                      }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <span className="text-lg">{tab.icon}</span>
                      <span className="text-base">{tab.label}</span>
                      {tab.count > 0 && (
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${activeTab === tab.id ? 'bg-forest-100 text-forest-700' : 'bg-gray-100 text-gray-600'
                          }`}>
                          {tab.count}
                        </span>
                      )}
                    </span>
                  </button>
                ))}
              </nav>
            </div>

            {/* Tab content */}
            <div className="p-8 bg-gray-50/50 min-h-[400px]">
              {activeTab === 'posts' && (
                <div className="space-y-8 max-w-3xl mx-auto">
                  {(posts?.length || 0) === 0 ? (
                    <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
                      <div className="text-6xl mb-6 opacity-30">📝</div>
                      <h3 className="text-xl font-bold text-gray-900 mb-2">No adventures shared yet</h3>
                      <p className="text-gray-500 mb-8 max-w-md mx-auto">
                        {isOwnProfile ? (roleBasedData?.canPost ? 'Start documenting your journey and share it with the tribe!' : 'Posts are unavailable.') : 'This explorer hasn\'t posted anything yet.'}
                      </p>
                      {isOwnProfile && roleBasedData?.canPost && (
                        <button
                          onClick={() => setShowPostCreator(true)}
                          className="px-8 py-3 bg-forest-600 text-white rounded-xl hover:bg-forest-700 transition-colors font-medium shadow-lg shadow-forest-600/20"
                        >
                          Create Your First Post
                        </button>
                      )}
                    </div>
                  ) : (
                    <>
                      {isOwnProfile && roleBasedData?.canPost && (
                        <div className="flex justify-end mb-6">
                          <button
                            onClick={() => setShowPostCreator(true)}
                            className="px-6 py-2.5 bg-forest-600 text-white rounded-xl hover:bg-forest-700 transition-all duration-200 flex items-center gap-2 shadow-md shadow-forest-600/10"
                          >
                            <span className="text-lg">✍️</span>
                            <span className="font-semibold">New Adventure</span>
                          </button>
                        </div>
                      )}
                      {posts?.map((post) => (
                        <PostCard key={post._id} post={post} onLikeUpdate={fetchPosts} />
                      ))}
                    </>
                  )}
                </div>
              )}

              {activeTab === 'past-trips' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {(pastTrips?.length || 0) === 0 ? (
                    <div className="col-span-full text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
                      <div className="text-6xl mb-6 opacity-30">🏔️</div>
                      <h3 className="text-xl font-bold text-gray-900 mb-2">No past trips</h3>
                      <p className="text-gray-500">
                        {isOwnProfile ? 'Your completed expeditions will appear here.' : 'No completed trips found.'}
                      </p>
                    </div>
                  ) : (
                    pastTrips?.map((trip) => (
                      <div key={trip._id} className="bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-lg transition-all duration-300 group">
                        <div className="h-32 bg-gray-200 relative">
                          {/* Placeholder or trip image depending on data */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                          <div className="absolute bottom-4 left-4 text-white">
                            <h4 className="font-bold text-lg">{trip.title}</h4>
                            <p className="text-sm opacity-90">{trip.destination}</p>
                          </div>
                        </div>
                        <div className="p-5">
                          <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                            <span className="flex items-center gap-1">
                              📅 {new Date(trip.startDate).toLocaleDateString()}
                            </span>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${trip.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                              }`}>
                              {trip.status.toUpperCase()}
                            </span>
                          </div>

                          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                            <div className="text-xs text-gray-500">
                              {trip.participants?.length || 0} Travelers
                            </div>
                            <button className="text-forest-600 text-sm font-semibold hover:text-forest-700">View Details →</button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'links' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(userLinks?.length || 0) === 0 ? (
                    <div className="col-span-full text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
                      <div className="text-6xl mb-6 opacity-30">🔗</div>
                      <h3 className="text-xl font-bold text-gray-900 mb-2">No links shared</h3>
                      <p className="text-gray-500">
                        {isOwnProfile ? 'Share your resources and findings!' : 'No shared links.'}
                      </p>
                    </div>
                  ) : (
                    userLinks?.map((link, index) => (
                      <div key={index} className="bg-white rounded-xl p-5 border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all group">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 pr-4">
                            <h4 className="font-bold text-gray-900 mb-1 group-hover:text-blue-600 transition-colors">{link.title}</h4>
                            {link.description && (
                              <p className="text-gray-600 text-sm mb-3 line-clamp-2">{link.description}</p>
                            )}
                            <div className="flex items-center gap-2 text-xs text-gray-400">
                              <span>Via: {link.postTitle}</span>
                              <span>•</span>
                              <span>{new Date(link.createdAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-3 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-all"
                          >
                            ↗
                          </a>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Non-organizer profile - show basic info card */
          <div className="bg-white rounded-2xl shadow-xl p-12 text-center max-w-2xl mx-auto border border-neutral-100">
            <div className="w-24 h-24 mx-auto bg-forest-50 rounded-full flex items-center justify-center text-5xl mb-6">
              {profile.role === 'admin' ? '🛠️' : profile.role === 'agent' ? '🎧' : '🎒'}
            </div>
            <h3 className="text-3xl font-bold text-gray-900 mb-3 capitalize">
              {profile.name}
            </h3>
            <p className="text-forest-600 font-medium mb-6 uppercase tracking-wider text-sm">
              {profile.role === 'admin' ? 'Administrator' : profile.role === 'agent' ? 'Support Agent' : 'Explorer'}
            </p>

            <p className="text-gray-600 leading-relaxed mb-8 text-lg">
              {profile.bio || (profile.role === 'admin'
                ? 'Ensuring smooth operations for the entire tribe.'
                : profile.role === 'agent'
                  ? 'Helping you find your next great adventure.'
                  : 'Ready to explore the world, one trek at a time.')}
            </p>

            <div className="grid grid-cols-2 gap-4 max-w-xs mx-auto text-left bg-gray-50 p-6 rounded-xl">
              <div>
                <span className="block text-xs text-gray-400 uppercase font-bold">Location</span>
                <span className="text-gray-800">{profile.location || 'Earth'}</span>
              </div>
              <div>
                <span className="block text-xs text-gray-400 uppercase font-bold">Joined</span>
                <span className="text-gray-800">{new Date(profile.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
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
