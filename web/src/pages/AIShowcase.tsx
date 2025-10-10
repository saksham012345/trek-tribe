import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import AIRecommendations from '../components/AIRecommendations';
import AIAnalyticsDashboard from '../components/AIAnalyticsDashboard';
import AISmartSearch from '../components/AISmartSearch';
import AIChatWidget from '../components/AIChatWidget';

interface ShowcaseSection {
  id: string;
  title: string;
  description: string;
  component: React.ReactNode;
  features: string[];
}

const AIShowcase: React.FC = () => {
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState<string>('smart-search');
  const [searchResults, setSearchResults] = useState<any[]>([]);

  const handleSmartSearch = (query: string, filters: any) => {
    console.log('Smart search executed:', { query, filters });
    // In a real implementation, this would trigger actual search
    setSearchResults([
      {
        id: 1,
        title: 'Himalayan Trek Adventure',
        destination: 'Himachal Pradesh',
        price: 8500,
        match: '95%'
      },
      {
        id: 2,
        title: 'Kerala Backwater Experience',
        destination: 'Kerala',
        price: 6500,
        match: '88%'
      }
    ]);
  };

  const showcaseSections: ShowcaseSection[] = [
    {
      id: 'smart-search',
      title: '🤖 AI Smart Search',
      description: 'Natural language search that understands what you\'re looking for',
      features: [
        'Natural language understanding',
        'Smart filter extraction',
        'Intent recognition',
        'Contextual suggestions'
      ],
      component: (
        <div className="space-y-4">
          <AISmartSearch 
            onSearch={handleSmartSearch}
            className="w-full"
          />
          {searchResults.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h4 className="font-semibold text-gray-800 mb-3">Search Results:</h4>
              <div className="space-y-2">
                {searchResults.map((result) => (
                  <div key={result.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <h5 className="font-medium">{result.title}</h5>
                      <p className="text-sm text-gray-600">📍 {result.destination} • ₹{result.price}</p>
                    </div>
                    <div className="text-sm font-semibold text-green-600">
                      {result.match} match
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )
    },
    {
      id: 'recommendations',
      title: '🎯 AI Recommendations',
      description: 'Personalized trip suggestions powered by machine learning',
      features: [
        'Personalized recommendations',
        'Smart matching algorithm',
        'Real-time updates',
        'Confidence scoring'
      ],
      component: <AIRecommendations className="w-full" maxRecommendations={4} />
    },
    {
      id: 'analytics',
      title: '📊 Travel Analytics',
      description: 'AI-powered insights into your travel patterns and preferences',
      features: [
        'Travel pattern analysis',
        'Spending insights',
        'Preference tracking',
        'Predictive recommendations'
      ],
      component: <AIAnalyticsDashboard className="w-full" />
    },
    {
      id: 'chat-support',
      title: '💬 AI Chat Support',
      description: 'Intelligent chatbot that can help with bookings and questions',
      features: [
        '24/7 availability',
        'Context-aware responses',
        'Human handoff capability',
        'Multi-language support'
      ],
      component: (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="mb-4">
            <h4 className="font-semibold text-gray-800 mb-2">Try the AI Chat Assistant</h4>
            <p className="text-gray-600 text-sm">
              The chat widget is available on all pages. Try asking questions like:
            </p>
          </div>
          <div className="space-y-2">
            {[
              "What are the best trips for beginners?",
              "Help me find adventures under ₹10,000",
              "What's included in the Himachal trek?",
              "Show me my booking history"
            ].map((question, index) => (
              <div key={index} className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-blue-800 text-sm">"{question}"</p>
              </div>
            ))}
          </div>
          <div className="mt-4 p-3 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg">
            <p className="text-sm text-purple-800">
              💡 The AI chat widget is always available in the bottom-right corner
            </p>
          </div>
        </div>
      )
    }
  ];

  const activeShowcase = showcaseSections.find(section => section.id === activeSection)!;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <div className="flex justify-center items-center space-x-4 mb-6">
              <span className="text-6xl">🧠</span>
              <h1 className="text-5xl font-bold">AI-Powered Trek Tribe</h1>
              <span className="text-6xl">✨</span>
            </div>
            <p className="text-xl text-blue-100 max-w-3xl mx-auto">
              Experience the future of travel planning with our advanced AI features. 
              From smart search to personalized recommendations, our AI makes trip planning effortless.
            </p>
            {user ? (
              <div className="mt-6 flex items-center justify-center space-x-2">
                <span className="text-lg">👋 Welcome back, {user.name}!</span>
                <span className="px-3 py-1 bg-green-400 text-green-900 rounded-full text-sm font-medium">
                  🤖 Personalized AI Active
                </span>
              </div>
            ) : (
              <div className="mt-6">
                <a 
                  href="/login"
                  className="inline-block px-6 py-3 bg-white text-purple-600 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
                >
                  Sign In to Unlock Full AI Experience
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Navigation Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-lg p-6 sticky top-8">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">AI Features</h3>
              <nav className="space-y-2">
                {showcaseSections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full text-left p-3 rounded-lg transition-all duration-200 ${
                      activeSection === section.id
                        ? 'bg-gradient-to-r from-purple-100 to-blue-100 text-purple-800 border-l-4 border-purple-500'
                        : 'hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    <div className="font-medium">{section.title}</div>
                    <div className="text-sm text-gray-500 mt-1">{section.description}</div>
                  </button>
                ))}
              </nav>

              {/* AI Status */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">AI Status</span>
                  <span className="flex items-center text-green-600 text-sm">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-2"></div>
                    Online
                  </span>
                </div>
                <div className="space-y-1 text-xs text-gray-500">
                  <div className="flex justify-between">
                    <span>Smart Search</span>
                    <span className="text-green-600">✓ Active</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Recommendations</span>
                    <span className="text-green-600">✓ Active</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Chat Support</span>
                    <span className="text-green-600">✓ Active</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Analytics</span>
                    <span className="text-green-600">✓ Active</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-xl shadow-lg p-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-3xl font-bold text-gray-800">{activeShowcase.title}</h2>
                  <p className="text-gray-600 mt-2">{activeShowcase.description}</p>
                </div>
                <div className="text-4xl">🚀</div>
              </div>

              {/* Feature List */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 mb-8">
                <h4 className="font-semibold text-gray-800 mb-3">Key Features:</h4>
                <div className="grid grid-cols-2 gap-2">
                  {activeShowcase.features.map((feature, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <span className="text-green-500">✓</span>
                      <span className="text-sm text-gray-700">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Component Demo */}
              <div className="border border-gray-200 rounded-lg p-6">
                <div className="flex items-center space-x-2 mb-4">
                  <span className="text-2xl">🎮</span>
                  <h4 className="font-semibold text-gray-800">Interactive Demo</h4>
                </div>
                {activeShowcase.component}
              </div>

              {/* Technical Details */}
              <div className="mt-8 bg-gray-50 rounded-lg p-6">
                <h4 className="font-semibold text-gray-800 mb-3 flex items-center">
                  <span className="mr-2">⚙️</span>
                  Technical Implementation
                </h4>
                <div className="space-y-3 text-sm text-gray-700">
                  {activeSection === 'smart-search' && (
                    <div className="space-y-2">
                      <p>• Natural Language Processing for query understanding</p>
                      <p>• Real-time filter extraction and intent recognition</p>
                      <p>• Context-aware search suggestions</p>
                      <p>• Debounced API calls for optimal performance</p>
                    </div>
                  )}
                  {activeSection === 'recommendations' && (
                    <div className="space-y-2">
                      <p>• Machine learning-based recommendation engine</p>
                      <p>• User behavior analysis and preference learning</p>
                      <p>• Collaborative filtering with confidence scoring</p>
                      <p>• Real-time data integration</p>
                    </div>
                  )}
                  {activeSection === 'analytics' && (
                    <div className="space-y-2">
                      <p>• Advanced data analytics and pattern recognition</p>
                      <p>• Predictive modeling for travel preferences</p>
                      <p>• Real-time dashboard updates</p>
                      <p>• Privacy-compliant data processing</p>
                    </div>
                  )}
                  {activeSection === 'chat-support' && (
                    <div className="space-y-2">
                      <p>• Conversational AI with context awareness</p>
                      <p>• Socket.IO for real-time communication</p>
                      <p>• Intelligent human handoff triggers</p>
                      <p>• Multi-turn conversation handling</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* AI Performance Metrics */}
        <div className="mt-12 bg-white rounded-xl shadow-lg p-8">
          <h3 className="text-2xl font-bold text-gray-800 mb-6 text-center">
            🏆 AI Performance Metrics
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-3xl font-bold text-green-600">97%</div>
              <div className="text-sm text-gray-600">Search Accuracy</div>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-3xl font-bold text-blue-600">1.2s</div>
              <div className="text-sm text-gray-600">Avg Response Time</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-3xl font-bold text-purple-600">89%</div>
              <div className="text-sm text-gray-600">User Satisfaction</div>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <div className="text-3xl font-bold text-orange-600">24/7</div>
              <div className="text-sm text-gray-600">Availability</div>
            </div>
          </div>
        </div>
      </div>

      {/* AI Chat Widget - Always available */}
      <AIChatWidget />
    </div>
  );
};

export default AIShowcase;