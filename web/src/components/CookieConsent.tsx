import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CookieManager, CookiePreferences, DEFAULT_PREFERENCES } from '../utils/cookieManager';

const CookieConsent: React.FC = () => {
  const [showBanner, setShowBanner] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>(DEFAULT_PREFERENCES);

  useEffect(() => {
    // Check if user has already made a choice using CookieManager
    const existingPreferences = CookieManager.getConsentStatus();
    if (!existingPreferences) {
      // Show banner after a short delay
      const timer = setTimeout(() => setShowBanner(true), 1000);
      return () => clearTimeout(timer);
    } else {
      // Load saved preferences
      setPreferences(existingPreferences);
    }
  }, []);

  // Remove applyCookieSettings as it's now handled by CookieManager

  const handleAcceptAll = () => {
    const allAccepted = {
      essential: true,
      analytics: true,
      marketing: true,
      functional: true,
      lastUpdated: Date.now(),
      version: '1.0'
    };
    setPreferences(allAccepted);
    CookieManager.saveConsent(allAccepted);
    setShowBanner(false);
  };

  const handleRejectAll = () => {
    setPreferences(DEFAULT_PREFERENCES);
    CookieManager.saveConsent(DEFAULT_PREFERENCES);
    setShowBanner(false);
  };

  const handleSavePreferences = () => {
    CookieManager.saveConsent(preferences);
    setShowBanner(false);
    setShowPreferences(false);
  };

  const handlePreferenceChange = (category: keyof CookiePreferences) => {
    if (category === 'essential') return; // Essential cookies cannot be disabled
    
    setPreferences(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  if (!showBanner) return null;

  return (
    <>
      {/* Cookie Consent Banner */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t-2 border-nature-500 shadow-2xl">
        <div className="max-w-6xl mx-auto p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3 flex-1">
              <div className="text-2xl">🍪</div>
              <div>
                <h3 className="text-lg font-semibold text-forest-800 mb-1">
                  We Value Your Privacy
                </h3>
                <p className="text-sm text-forest-600 leading-relaxed">
                  We use cookies to enhance your browsing experience, provide personalized content, 
                  and analyze our traffic. By clicking "Accept All", you consent to our use of cookies. 
                  You can manage your preferences or learn more in our{' '}
                  <Link to="/privacy" className="text-nature-600 hover:underline font-medium">
                    Privacy Policy
                  </Link>.
                </p>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2 sm:ml-4">
              <button
                onClick={() => setShowPreferences(true)}
                className="px-4 py-2 text-sm border-2 border-forest-300 text-forest-700 rounded-lg hover:bg-forest-50 transition-colors"
              >
                Cookie Settings
              </button>
              <button
                onClick={handleRejectAll}
                className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Reject All
              </button>
              <button
                onClick={handleAcceptAll}
                className="px-6 py-2 text-sm bg-nature-600 text-white rounded-lg hover:bg-nature-700 transition-colors font-medium"
              >
                Accept All
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Cookie Preferences Modal */}
      {showPreferences && (
        <div className="fixed inset-0 z-60 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-forest-800">Cookie Preferences</h2>
                <button
                  onClick={() => setShowPreferences(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="space-y-6">
                <div className="text-sm text-forest-600 mb-6">
                  Choose which cookies you allow us to use. You can change these settings at any time. 
                  However, this can result in some functions no longer being available.
                </div>

                {/* Essential Cookies */}
                <div className="border border-forest-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-forest-800">Essential Cookies</h3>
                    <div className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                      Always Active
                    </div>
                  </div>
                  <p className="text-sm text-forest-600">
                    These cookies are necessary for the website to function and cannot be switched off. 
                    They enable core functionality such as security, network management, and accessibility.
                  </p>
                </div>

                {/* Analytics Cookies */}
                <div className="border border-forest-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-forest-800">Analytics Cookies</h3>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={preferences.analytics}
                        onChange={() => handlePreferenceChange('analytics')}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-nature-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-nature-600"></div>
                    </label>
                  </div>
                  <p className="text-sm text-forest-600">
                    These cookies help us understand how visitors interact with our website by collecting 
                    and reporting information anonymously. This helps us improve our services.
                  </p>
                </div>

                {/* Marketing Cookies */}
                <div className="border border-forest-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-forest-800">Marketing Cookies</h3>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={preferences.marketing}
                        onChange={() => handlePreferenceChange('marketing')}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-nature-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-nature-600"></div>
                    </label>
                  </div>
                  <p className="text-sm text-forest-600">
                    These cookies are used to deliver personalized advertisements and measure the effectiveness 
                    of advertising campaigns. They may be set by us or third-party providers.
                  </p>
                </div>

                {/* Functional Cookies */}
                <div className="border border-forest-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-forest-800">Functional Cookies</h3>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={preferences.functional}
                        onChange={() => handlePreferenceChange('functional')}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-nature-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-nature-600"></div>
                    </label>
                  </div>
                  <p className="text-sm text-forest-600">
                    These cookies enable enhanced functionality and personalization, such as live chat, 
                    social media features, and content recommendations.
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-forest-200">
                <button
                  onClick={() => setShowPreferences(false)}
                  className="px-4 py-2 text-forest-700 border border-forest-300 rounded-lg hover:bg-forest-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSavePreferences}
                  className="px-6 py-2 bg-nature-600 text-white rounded-lg hover:bg-nature-700 transition-colors font-medium"
                >
                  Save Preferences
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CookieConsent;