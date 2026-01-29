import React, { useState, useRef, useEffect } from 'react';
import api from '../config/api';

interface SearchSuggestion {
  text: string;
  type: 'destination' | 'activity' | 'difficulty' | 'budget' | 'season';
  confidence: number;
}

interface SmartSearchResult {
  query: string;
  interpretedIntent: string;
  suggestions: SearchSuggestion[];
  filters: {
    destination?: string;
    category?: string;
    difficultyLevel?: string;
    priceRange?: { min: number; max: number };
    season?: string;
  };
  naturalLanguageResponse: string;
}

interface AISmartSearchProps {
  onSearch?: (query: string, filters: any) => void;
  onSuggestionsChange?: (suggestions: SearchSuggestion[]) => void;
  placeholder?: string;
  className?: string;
}

const AISmartSearch: React.FC<AISmartSearchProps> = ({
  onSearch,
  onSuggestionsChange,
  placeholder = "Ask me anything about trips... e.g., 'Find adventure trips under ₹10,000 in Himachal'",
  className = ''
}) => {
  const [query, setQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchResult, setSearchResult] = useState<SmartSearchResult | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const sampleQueries = [
    "Show me trekking trips in Himachal under ₹8,000",
    "I want adventure activities for beginners",
    "Find cultural tours in Rajasthan next month",
    "What are the best winter trips for families?",
    "Recommend challenging treks above 4000m altitude"
  ];

  useEffect(() => {
    if (query.length > 3) {
      // Debounce AI processing
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      searchTimeoutRef.current = setTimeout(() => {
        processSmartSearch(query);
      }, 800);
    } else {
      setSearchResult(null);
      setError('');
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query]);

  const processSmartSearch = async (searchQuery: string) => {
    try {
      setIsProcessing(true);
      setError('');

      const response = await api.post('/chat/smart-search', {
        query: searchQuery,
        context: {
          currentFilters: {},
          userPreferences: {}
        }
      });

      if ((response.data as any).success && (response.data as any).data) {
        const result: SmartSearchResult = (response.data as any).data;
        setSearchResult(result);

        if (onSuggestionsChange) {
          onSuggestionsChange(result.suggestions);
        }
      }
    } catch (error: any) {
      console.error('Error processing smart search:', error);
      setError('Unable to process your search query');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    if (searchResult && onSearch) {
      onSearch(query, searchResult.filters);
    } else if (onSearch) {
      // Fallback to regular search
      onSearch(query, {});
    }
  };

  const applySuggestion = (suggestion: SearchSuggestion) => {
    const newQuery = query + (query ? ' ' : '') + suggestion.text;
    setQuery(newQuery);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const applySampleQuery = (sampleQuery: string) => {
    setQuery(sampleQuery);
    setShowSuggestions(false);
    processSmartSearch(sampleQuery);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'destination': return '📍';
      case 'activity': return '🎯';
      case 'difficulty': return '⛰️';
      case 'budget': return '💰';
      case 'season': return '📅';
      default: return '🔍';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'destination': return 'bg-blue-100 text-blue-800';
      case 'activity': return 'bg-green-100 text-green-800';
      case 'difficulty': return 'bg-yellow-100 text-yellow-800';
      case 'budget': return 'bg-purple-100 text-purple-800';
      case 'season': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className={`relative ${className}`}>
      {/* Search Input */}
      <form onSubmit={handleSearch} className="relative">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <div className="flex items-center space-x-2">
              <span className="text-2xl">🤖</span>
              {isProcessing && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              )}
            </div>
          </div>

          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setShowSuggestions(true)}
            placeholder={placeholder}
            className="w-full pl-20 pr-12 py-4 text-gray-900 placeholder-gray-500 bg-white border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200"
          />

          <button
            type="submit"
            disabled={!query.trim() || isProcessing}
            className="absolute inset-y-0 right-0 pr-4 flex items-center disabled:opacity-50 hover:opacity-80 transition-opacity"
          >
            <span className="text-2xl">🔍</span>
          </button>
        </div>
      </form>

      {/* Error Message */}
      {error && (
        <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 text-sm flex items-center">
            <span className="mr-2">⚠️</span>
            {error}
          </p>
        </div>
      )}

      {/* AI Processing Result */}
      {searchResult && (
        <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-xl">
          <div className="flex items-center space-x-2 mb-3">
            <span className="text-lg">🧠</span>
            <h4 className="font-semibold text-blue-900">AI Understanding</h4>
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-600 mb-1">Intent:</p>
              <p className="text-blue-800 font-medium">{searchResult.interpretedIntent}</p>
            </div>

            {searchResult.naturalLanguageResponse && (
              <div>
                <p className="text-sm text-gray-600 mb-1">AI Response:</p>
                <p className="text-purple-800 text-sm">{searchResult.naturalLanguageResponse}</p>
              </div>
            )}

            {Array.isArray(searchResult.suggestions) && searchResult.suggestions.length > 0 && (
              <div>
                <p className="text-sm text-gray-600 mb-2">Smart Suggestions:</p>
                <div className="flex flex-wrap gap-2">
                  {searchResult.suggestions.slice(0, 6).map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => applySuggestion(suggestion)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors hover:opacity-80 ${getTypeColor(suggestion.type)}`}
                    >
                      {getTypeIcon(suggestion.type)} {suggestion.text}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Applied Filters */}
            {searchResult.filters && Object.keys(searchResult.filters).length > 0 && (
              <div>
                <p className="text-sm text-gray-600 mb-2">Applied Filters:</p>
                <div className="flex flex-wrap gap-2">
                  {searchResult.filters.destination && (
                    <span className="px-2 py-1 bg-blue-200 text-blue-800 rounded-lg text-xs">
                      📍 {searchResult.filters.destination}
                    </span>
                  )}
                  {searchResult.filters.category && (
                    <span className="px-2 py-1 bg-green-200 text-green-800 rounded-lg text-xs">
                      🎯 {searchResult.filters.category}
                    </span>
                  )}
                  {searchResult.filters.difficultyLevel && (
                    <span className="px-2 py-1 bg-yellow-200 text-yellow-800 rounded-lg text-xs">
                      ⛰️ {searchResult.filters.difficultyLevel}
                    </span>
                  )}
                  {searchResult.filters.priceRange && (
                    <span className="px-2 py-1 bg-purple-200 text-purple-800 rounded-lg text-xs">
                      💰 ₹{searchResult.filters.priceRange.min}-₹{searchResult.filters.priceRange.max}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sample Queries & Suggestions */}
      {showSuggestions && !searchResult && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg z-50">
          <div className="p-4">
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center">
                <span className="mr-2">💡</span>
                Try asking me:
              </h4>
              <div className="space-y-2">
                {sampleQueries.map((sample, index) => (
                  <button
                    key={index}
                    onClick={() => applySampleQuery(sample)}
                    className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    "{sample}"
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t pt-3">
              <p className="text-xs text-gray-500 text-center">
                🤖 Powered by AI • I understand natural language queries
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Click outside to close suggestions */}
      {showSuggestions && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowSuggestions(false)}
        />
      )}
    </div>
  );
};

export default AISmartSearch;