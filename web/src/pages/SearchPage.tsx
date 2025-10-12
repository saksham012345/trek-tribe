import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ProfileSearch from '../components/ProfileSearch';
import api from '../config/api';

interface ProfileSearchResult {
  _id: string;
  name: string;
  email: string;
  profilePhoto?: string;
  role: string;
  location?: string;
  bio?: string;
  socialStats: {
    followersCount: number;
    followingCount: number;
    postsCount: number;
  };
  isVerified: boolean;
}

const SearchPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [results, setResults] = useState<ProfileSearchResult[]>([]);
  const [suggestions, setSuggestions] = useState<ProfileSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    loadSuggestions();
    // If there's a query parameter, perform search on mount
    if (searchQuery) {
      searchProfiles(searchQuery);
    }
  }, []);

  const loadSuggestions = async () => {
    try {
      const response = await api.get('/api/search/suggestions?limit=12');
      setSuggestions(response.data.suggestions);
    } catch (error) {
      console.error('Error loading suggestions:', error);
    }
  };

  const searchProfiles = async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams({
        q: query,
        limit: '20'
      });
      
      if (selectedRole) {
        params.append('role', selectedRole);
      }

      const response = await api.get(`/api/search/profiles?${params.toString()}`);
      setResults(response.data.profiles);
      setHasSearched(true);
    } catch (error) {
      console.error('Error searching profiles:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    searchProfiles(searchQuery);
  };

  const handleProfileClick = (profile: ProfileSearchResult) => {
    navigate(`/profile/${profile._id}`);
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
      case 'organizer': return 'text-blue-600 bg-blue-100 border-blue-200';
      case 'admin': return 'text-red-600 bg-red-100 border-red-200';
      case 'agent': return 'text-green-600 bg-green-100 border-green-200';
      default: return 'text-gray-600 bg-gray-100 border-gray-200';
    }
  };

  const renderProfileCard = (profile: ProfileSearchResult) => (
    <div
      key={profile._id}
      onClick={() => handleProfileClick(profile)}
      className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer border border-gray-200 hover:border-gray-300"
    >
      <div className="flex items-start space-x-4">
        {/* Profile Photo */}
        <div className="flex-shrink-0">
          <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
            {profile.profilePhoto ? (
              <img
                src={profile.profilePhoto}
                alt={profile.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-2xl">👤</span>
            )}
          </div>
        </div>

        {/* Profile Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-lg font-semibold text-gray-900 truncate">
              {profile.name}
            </h3>
            {profile.isVerified && (
              <span className="text-blue-500" title="Verified Profile">✅</span>
            )}
          </div>

          <div className="flex items-center gap-2 mb-3">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getRoleColor(profile.role)}`}>
              <span className="mr-1">{getRoleIcon(profile.role)}</span>
              {profile.role}
            </span>
            
            {profile.location && (
              <span className="text-sm text-gray-500 flex items-center">
                📍 {profile.location}
              </span>
            )}
          </div>

          {/* Social Stats */}
          <div className="flex items-center gap-4 mb-3 text-sm text-gray-600">
            <span className="flex items-center gap-1">
              <span className="font-medium text-blue-600">{profile.socialStats.followersCount}</span>
              <span>followers</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="font-medium text-green-600">{profile.socialStats.followingCount}</span>
              <span>following</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="font-medium text-purple-600">{profile.socialStats.postsCount}</span>
              <span>posts</span>
            </span>
          </div>

          {/* Bio */}
          {profile.bio && (
            <p className="text-sm text-gray-700 line-clamp-2">
              {profile.bio}
            </p>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Search Profiles</h1>
          <p className="text-gray-600">Discover amazing travelers and organizers in the TrekTribe community</p>
        </div>

        {/* Search Form */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-8">
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <ProfileSearch
                  placeholder="Search by name, location, or bio..."
                  showSuggestions={false}
                />
              </div>
              
              <div className="w-48">
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Roles</option>
                  <option value="traveler">Travelers</option>
                  <option value="organizer">Organizers</option>
                  <option value="agent">Agents</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={loading || searchQuery.trim().length < 2}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Searching...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    Search
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Results */}
        {hasSearched ? (
          <div>
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900">
                {loading ? 'Searching...' : `Search Results (${results.length})`}
              </h2>
              {searchQuery && (
                <p className="text-gray-600">
                  Results for "{searchQuery}"
                  {selectedRole && ` in ${selectedRole}s`}
                </p>
              )}
            </div>

            {results.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {results.map(renderProfileCard)}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🔍</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No profiles found</h3>
                <p className="text-gray-600">
                  Try adjusting your search terms or browse our suggestions below.
                </p>
              </div>
            )}
          </div>
        ) : (
          /* Suggestions */
          <div>
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Popular Profiles</h2>
              <p className="text-gray-600">Discover some of our most active community members</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {suggestions.map(renderProfileCard)}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="mt-12 text-center">
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Can't find what you're looking for?</h3>
            <div className="flex flex-wrap justify-center gap-4">
              <button
                onClick={() => navigate('/trips')}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
              >
                🌿 Browse Trips
              </button>
              <button
                onClick={() => navigate('/ai-showcase')}
                className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
              >
                🤖 AI Features
              </button>
              <button
                onClick={() => navigate('/my-profile')}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                👤 My Profile
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SearchPage;
