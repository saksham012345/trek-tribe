import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../config/api';
import { useAuth } from '../contexts/AuthContext';

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

interface ProfileSearchProps {
  onClose?: () => void;
  placeholder?: string;
  showSuggestions?: boolean;
}

const ProfileSearch: React.FC<ProfileSearchProps> = ({ 
  onClose, 
  placeholder = "Search organizers...",
  showSuggestions = true 
}) => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProfileSearchResult[]>([]);
  const [suggestions, setSuggestions] = useState<ProfileSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load suggestions on mount
  useEffect(() => {
    if (showSuggestions) {
      loadSuggestions();
    }
  }, [showSuggestions]);

  const loadSuggestions = async () => {
    try {
      const response = await api.get('/api/search/suggestions?limit=6&role=organizer');
      setSuggestions(response.data.suggestions);
    } catch (error) {
      console.error('Error loading suggestions:', error);
    }
  };

  // Handle click outside to close results
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadSuggestions = async () => {
    try {
      const response = await api.get('/api/search/suggestions?limit=6');
      setSuggestions(response.data.suggestions);
    } catch (error) {
      console.error('Error loading suggestions:', error);
    }
  };

  const searchProfiles = async (searchQuery: string) => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }

    setLoading(true);
    try {
      const response = await api.get(`/api/search/profiles?q=${encodeURIComponent(searchQuery)}&limit=8&role=organizer`);
      setResults(response.data.profiles);
      setShowResults(true);
      setSelectedIndex(-1);
    } catch (error) {
      console.error('Error searching profiles:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    
    if (value.trim().length >= 2) {
      searchProfiles(value);
    } else {
      setResults([]);
      setShowResults(value.trim().length > 0);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const allItems = query.trim().length >= 2 ? results : suggestions;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < allItems.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < allItems.length) {
          handleProfileSelect(allItems[selectedIndex]);
        } else if (query.trim().length >= 2 && results.length > 0) {
          handleProfileSelect(results[0]);
        }
        break;
      case 'Escape':
        setShowResults(false);
        setSelectedIndex(-1);
        break;
    }
  };

  const handleProfileSelect = (profile: ProfileSearchResult) => {
    setShowResults(false);
    setQuery('');
    setSelectedIndex(-1);
    
    if (onClose) {
      onClose();
    }
    
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
      case 'organizer': return 'text-blue-600 bg-blue-100';
      case 'admin': return 'text-red-600 bg-red-100';
      case 'agent': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const displayItems = query.trim().length >= 2 ? results : suggestions;

  return (
    <div className="relative" ref={searchRef}>
      {/* Search Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowResults(true)}
          placeholder={placeholder}
          className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
        />
        {loading && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          </div>
        )}
      </div>

      {/* Search Results / Suggestions */}
      {showResults && displayItems.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white shadow-lg max-h-96 overflow-auto rounded-lg border border-gray-200">
          {query.trim().length >= 2 && (
            <div className="px-4 py-2 text-sm text-gray-500 border-b border-gray-100">
              {results.length > 0 ? `${results.length} organizer(s) found` : 'No organizers found'}
            </div>
          )}
          
          {query.trim().length < 2 && showSuggestions && (
            <div className="px-4 py-2 text-sm text-gray-500 border-b border-gray-100">
              Popular organizers
            </div>
          )}

          <div className="py-1">
            {displayItems.map((profile, index) => (
              <div
                key={profile._id}
                onClick={() => handleProfileSelect(profile)}
                className={`px-4 py-3 cursor-pointer transition-colors ${
                  selectedIndex === index
                    ? 'bg-blue-50 border-l-4 border-blue-500'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center space-x-3">
                  {/* Profile Photo */}
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                      {profile.profilePhoto ? (
                        <img
                          src={profile.profilePhoto}
                          alt={profile.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-lg">👤</span>
                      )}
                    </div>
                  </div>

                  {/* Profile Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {profile.name}
                      </p>
                      {profile.isVerified && (
                        <span className="text-blue-500" title="Verified">✅</span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(profile.role)}`}>
                        <span className="mr-1">{getRoleIcon(profile.role)}</span>
                        {profile.role}
                      </span>
                      
                      {profile.location && (
                        <span className="text-xs text-gray-500">
                          📍 {profile.location}
                        </span>
                      )}
                    </div>

                    {/* Social Stats */}
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      <span>{profile.socialStats.followersCount} followers</span>
                      <span>{profile.socialStats.postsCount} posts</span>
                    </div>

                    {/* Bio Preview */}
                    {profile.bio && (
                      <p className="text-xs text-gray-600 mt-1 truncate max-w-full">
                        {profile.bio.length > 60 ? `${profile.bio.substring(0, 60)}...` : profile.bio}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          {query.trim().length >= 2 && results.length > 0 && (
            <div className="px-4 py-2 text-xs text-gray-500 border-t border-gray-100 bg-gray-50">
              Press Enter to select, ↑↓ to navigate, Esc to close
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProfileSearch;
