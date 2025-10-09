import React, { useState, useEffect } from 'react';
import { X, Shield, Settings, Check } from 'lucide-react';

interface CookiePreferences {
  necessary: boolean;
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
}

const CookieConsent: React.FC = () => {
  const [showBanner, setShowBanner] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>({
    necessary: true, // Always required
    functional: false,
    analytics: false,
    marketing: false
  });

  useEffect(() => {
    // Check if user has already made a choice
    const cookieConsent = localStorage.getItem('trek-tribe-cookie-consent');
    if (!cookieConsent) {
      // Show banner after a short delay for better UX
      setTimeout(() => setShowBanner(true), 1000);
    } else {
      // Load saved preferences
      try {
        const savedPreferences = JSON.parse(cookieConsent);
        setPreferences(savedPreferences);
        applyCookieSettings(savedPreferences);
      } catch (error) {
        console.error('Error parsing cookie preferences:', error);
      }
    }
  }, []);

  const applyCookieSettings = (prefs: CookiePreferences) => {
    // Apply cookie settings based on preferences
    if (!prefs.analytics) {
      // Disable analytics cookies
      document.cookie = "_ga=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      document.cookie = "_gid=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      document.cookie = "_gat=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    }

    if (!prefs.marketing) {
      // Disable marketing cookies
      document.cookie = "_fbp=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      document.cookie = "_fbc=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    }

    // Trigger custom event for other parts of the app
    window.dispatchEvent(new CustomEvent('cookiePreferencesUpdated', { 
      detail: prefs 
    }));
  };

  const savePreferences = (prefs: CookiePreferences) => {
    localStorage.setItem('trek-tribe-cookie-consent', JSON.stringify(prefs));
    localStorage.setItem('trek-tribe-cookie-consent-date', new Date().toISOString());
    applyCookieSettings(prefs);
    setPreferences(prefs);
    setShowBanner(false);
    setShowSettings(false);
  };

  const acceptAll = () => {
    const allAccepted = {
      necessary: true,
      functional: true,
      analytics: true,
      marketing: true
    };
    savePreferences(allAccepted);
  };

  const acceptSelected = () => {
    savePreferences(preferences);
  };

  const rejectAll = () => {
    const onlyNecessary = {
      necessary: true,
      functional: false,
      analytics: false,
      marketing: false
    };
    savePreferences(onlyNecessary);
  };

  const updatePreference = (key: keyof CookiePreferences, value: boolean) => {
    if (key === 'necessary') return; // Can't disable necessary cookies
    setPreferences(prev => ({ ...prev, [key]: value }));
  };

  const cookieTypes = [
    {
      key: 'necessary' as keyof CookiePreferences,
      title: 'Necessary Cookies',
      description: 'Essential for the website to function properly. These cookies enable basic features like security, network management, and accessibility.',
      examples: 'Authentication, security, preferences',
      required: true
    },
    {
      key: 'functional' as keyof CookiePreferences,
      title: 'Functional Cookies',
      description: 'Help us provide enhanced features and personalized experience.',
      examples: 'Chat widget, language preferences, trip recommendations',
      required: false
    },
    {
      key: 'analytics' as keyof CookiePreferences,
      title: 'Analytics Cookies',
      description: 'Help us understand how visitors interact with our website to improve user experience.',
      examples: 'Google Analytics, page views, user behavior',
      required: false
    },
    {
      key: 'marketing' as keyof CookiePreferences,
      title: 'Marketing Cookies',
      description: 'Used to track visitors across websites to display relevant advertisements.',
      examples: 'Facebook Pixel, advertising networks, retargeting',
      required: false
    }
  ];

  if (!showBanner) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end justify-center p-4">
        
        {/* Cookie Settings Modal */}
        {showSettings && (
          <div className="fixed inset-0 flex items-center justify-center p-4 z-60">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <Settings className="w-6 h-6 text-forest-600" />
                    <h2 className="text-2xl font-bold text-gray-900">Cookie Preferences</h2>
                  </div>
                  <button
                    onClick={() => setShowSettings(false)}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="mb-6">
                  <p className="text-gray-600 leading-relaxed">
                    We use cookies to enhance your experience on Trek Tribe. You can choose which types of cookies you're comfortable with. 
                    Your privacy matters to us, and you can change these settings at any time.
                  </p>
                </div>

                <div className="space-y-6">
                  {cookieTypes.map((type) => (
                    <div key={type.key} className="border border-gray-200 rounded-xl p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="text-lg font-semibold text-gray-900">{type.title}</h3>
                            {type.required && (
                              <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full font-medium">
                                Required
                              </span>
                            )}
                          </div>
                          <p className="text-gray-600 text-sm mb-2">{type.description}</p>
                          <p className="text-gray-500 text-xs">
                            <strong>Examples:</strong> {type.examples}
                          </p>
                        </div>
                        <div className="ml-4">
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={preferences[type.key]}
                              onChange={(e) => updatePreference(type.key, e.target.checked)}
                              disabled={type.required}
                              className="sr-only"
                            />
                            <div className={`w-11 h-6 rounded-full transition-colors ${
                              preferences[type.key] 
                                ? 'bg-forest-600' 
                                : 'bg-gray-300'
                            } ${type.required ? 'opacity-50' : ''}`}>
                              <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform ${
                                preferences[type.key] ? 'translate-x-6' : 'translate-x-1'
                              } mt-1`} />
                            </div>
                          </label>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row gap-3 mt-8">
                  <button
                    onClick={acceptSelected}
                    className="flex-1 bg-forest-600 hover:bg-forest-700 text-white px-6 py-3 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    Save Preferences
                  </button>
                  <button
                    onClick={acceptAll}
                    className="flex-1 bg-nature-600 hover:bg-nature-700 text-white px-6 py-3 rounded-xl font-semibold transition-colors"
                  >
                    Accept All
                  </button>
                  <button
                    onClick={rejectAll}
                    className="flex-1 border-2 border-gray-300 hover:border-gray-400 text-gray-700 px-6 py-3 rounded-xl font-semibold transition-colors"
                  >
                    Only Necessary
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Cookie Banner */}
        {!showSettings && (
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full">
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-forest-100 rounded-full flex-shrink-0">
                  <Shield className="w-6 h-6 text-forest-600" />
                </div>
                
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-gray-900 mb-2">
                    🍪 We Value Your Privacy
                  </h2>
                  <p className="text-gray-600 mb-4 leading-relaxed">
                    Trek Tribe uses cookies to enhance your experience, provide personalized content, and analyze our traffic. 
                    By clicking "Accept All", you consent to our use of cookies.
                  </p>
                  
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={acceptAll}
                      className="bg-forest-600 hover:bg-forest-700 text-white px-6 py-2.5 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
                    >
                      <Check className="w-4 h-4" />
                      Accept All
                    </button>
                    <button
                      onClick={() => setShowSettings(true)}
                      className="border-2 border-forest-300 hover:border-forest-400 text-forest-700 px-6 py-2.5 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
                    >
                      <Settings className="w-4 h-4" />
                      Customize
                    </button>
                    <button
                      onClick={rejectAll}
                      className="text-gray-600 hover:text-gray-800 px-6 py-2.5 font-semibold transition-colors"
                    >
                      Only Necessary
                    </button>
                  </div>
                  
                  <p className="text-xs text-gray-500 mt-3">
                    By using our website, you agree to our{' '}
                    <a href="/privacy-policy" className="text-forest-600 hover:underline">
                      Privacy Policy
                    </a>{' '}
                    and{' '}
                    <a href="/terms-conditions" className="text-forest-600 hover:underline">
                      Terms of Service
                    </a>.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default CookieConsent;