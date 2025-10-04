import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CookieManager, COOKIE_CATEGORIES, CookiePreferences, DEFAULT_PREFERENCES } from '../utils/cookieManager';

const CookieSettings: React.FC = () => {
  const [preferences, setPreferences] = useState<CookiePreferences>(DEFAULT_PREFERENCES);
  const [savedMessage, setSavedMessage] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  useEffect(() => {
    const currentPreferences = CookieManager.getConsentStatus();
    if (currentPreferences) {
      setPreferences(currentPreferences);
    }
  }, []);

  const handleToggle = (category: keyof CookiePreferences) => {
    if (category === 'essential') return; // Essential cookies cannot be disabled

    setPreferences(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const handleSave = () => {
    CookieManager.saveConsent(preferences);
    setSavedMessage(true);
    setTimeout(() => setSavedMessage(false), 3000);
  };

  const handleAcceptAll = () => {
    const allAccepted: CookiePreferences = {
      essential: true,
      analytics: true,
      marketing: true,
      functional: true,
      lastUpdated: Date.now(),
      version: '1.0'
    };
    setPreferences(allAccepted);
    CookieManager.saveConsent(allAccepted);
    setSavedMessage(true);
    setTimeout(() => setSavedMessage(false), 3000);
  };

  const handleRejectAll = () => {
    setPreferences(DEFAULT_PREFERENCES);
    CookieManager.saveConsent(DEFAULT_PREFERENCES);
    setSavedMessage(true);
    setTimeout(() => setSavedMessage(false), 3000);
  };

  const toggleCategoryDetails = (categoryId: string) => {
    setExpandedCategory(expandedCategory === categoryId ? null : categoryId);
  };

  return (
    <div className="min-h-screen bg-forest-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden mb-8">
          <div className="bg-gradient-to-r from-forest-600 to-nature-600 px-8 py-12 text-white">
            <h1 className="text-4xl font-bold mb-4">🍪 Cookie Settings</h1>
            <p className="text-xl text-forest-100">
              Manage your cookie preferences and control how we use cookies on Trek Tribe
            </p>
          </div>
        </div>

        {/* Current Status */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-forest-800 mb-2">Current Status</h2>
              <p className="text-forest-600">{CookieManager.getConsentSummary()}</p>
              <p className="text-sm text-forest-500 mt-1">
                Last updated: {new Date(preferences.lastUpdated).toLocaleDateString()}
              </p>
            </div>
            {savedMessage && (
              <div className="bg-green-100 border border-green-300 text-green-800 px-4 py-2 rounded-lg">
                ✅ Preferences saved successfully!
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold text-forest-800 mb-4">Quick Actions</h2>
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={handleAcceptAll}
              className="flex-1 bg-nature-600 hover:bg-nature-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors duration-200"
            >
              Accept All Cookies
            </button>
            <button
              onClick={handleRejectAll}
              className="flex-1 bg-forest-600 hover:bg-forest-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors duration-200"
            >
              Reject Non-Essential
            </button>
            <button
              onClick={handleSave}
              className="flex-1 bg-earth-600 hover:bg-earth-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors duration-200"
            >
              Save Custom Settings
            </button>
          </div>
        </div>

        {/* Cookie Categories */}
        <div className="space-y-6">
          {COOKIE_CATEGORIES.map((category) => (
            <div key={category.id} className="bg-white rounded-xl shadow-md overflow-hidden">
              {/* Category Header */}
              <div className="p-6 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold text-forest-800">
                        {category.name}
                      </h3>
                      {category.essential && (
                        <span className="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded-full font-medium">
                          Required
                        </span>
                      )}
                    </div>
                    <p className="text-forest-600">{category.description}</p>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    {/* Toggle Switch */}
                    <div className="flex items-center">
                      <button
                        onClick={() => handleToggle(category.id as keyof CookiePreferences)}
                        disabled={category.essential}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
                          preferences[category.id as keyof CookiePreferences]
                            ? 'bg-nature-600'
                            : 'bg-gray-300'
                        } ${category.essential ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'}`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                            preferences[category.id as keyof CookiePreferences]
                              ? 'translate-x-6'
                              : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Expand Button */}
                    <button
                      onClick={() => toggleCategoryDetails(category.id)}
                      className="text-forest-500 hover:text-forest-700 transition-colors"
                    >
                      <svg
                        className={`w-5 h-5 transition-transform ${
                          expandedCategory === category.id ? 'rotate-180' : ''
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* Category Details */}
              {expandedCategory === category.id && (
                <div className="p-6 bg-gray-50">
                  <h4 className="text-lg font-semibold text-forest-800 mb-4">
                    Cookies in this category:
                  </h4>
                  <div className="space-y-4">
                    {category.cookies.map((cookie, index) => (
                      <div
                        key={index}
                        className="bg-white rounded-lg p-4 border border-gray-200"
                      >
                        <div className="grid md:grid-cols-2 gap-4">
                          <div>
                            <h5 className="font-semibold text-forest-800 mb-1">
                              {cookie.name}
                            </h5>
                            <p className="text-sm text-forest-600 mb-2">
                              {cookie.description}
                            </p>
                            <p className="text-xs text-forest-500">
                              <strong>Purpose:</strong> {cookie.purpose}
                            </p>
                          </div>
                          <div className="text-sm">
                            <p className="text-forest-600 mb-1">
                              <strong>Provider:</strong> {cookie.provider}
                            </p>
                            <p className="text-forest-600">
                              <strong>Duration:</strong> {cookie.duration}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Information Section */}
        <div className="bg-white rounded-xl shadow-md p-6 mt-8">
          <h2 className="text-xl font-semibold text-forest-800 mb-4">
            About Cookie Management
          </h2>
          <div className="space-y-4 text-forest-600">
            <p>
              Cookies are small text files that are stored on your device when you visit our website. 
              They help us provide you with a better experience and allow certain features to work.
            </p>
            <p>
              <strong>Essential cookies</strong> are necessary for the website to function properly and cannot be disabled. 
              All other cookies require your consent and can be managed through these settings.
            </p>
            <p>
              You can change your preferences at any time by returning to this page. Your choices will be 
              remembered for one year, after which we'll ask for your consent again.
            </p>
            <div className="flex flex-wrap gap-4 pt-4">
              <Link
                to="/privacy"
                className="text-nature-600 hover:text-nature-700 font-medium transition-colors"
              >
                📋 Privacy Policy →
              </Link>
              <Link
                to="/terms"
                className="text-nature-600 hover:text-nature-700 font-medium transition-colors"
              >
                📜 Terms & Conditions →
              </Link>
            </div>
          </div>
        </div>

        {/* Back Navigation */}
        <div className="text-center mt-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-forest-600 hover:text-forest-800 font-medium transition-colors"
          >
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
};

export default CookieSettings;