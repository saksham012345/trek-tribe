import React, { useState, useEffect } from 'react';
import { Shield, Settings, Check, X, Info } from 'lucide-react';

interface CookiePreferences {
  necessary: boolean;
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
}

const CookieSettings: React.FC = () => {
  const [preferences, setPreferences] = useState<CookiePreferences>({
    necessary: true,
    functional: false,
    analytics: false,
    marketing: false
  });

  const [showSaved, setShowSaved] = useState(false);
  const [consentDate, setConsentDate] = useState<string | null>(null);

  useEffect(() => {
    // Load saved preferences
    const savedPreferences = localStorage.getItem('trek-tribe-cookie-consent');
    const savedDate = localStorage.getItem('trek-tribe-cookie-consent-date');
    
    if (savedPreferences) {
      try {
        setPreferences(JSON.parse(savedPreferences));
      } catch (error) {
        console.error('Error parsing saved cookie preferences:', error);
      }
    }
    
    if (savedDate) {
      setConsentDate(new Date(savedDate).toLocaleDateString());
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

  const savePreferences = () => {
    localStorage.setItem('trek-tribe-cookie-consent', JSON.stringify(preferences));
    localStorage.setItem('trek-tribe-cookie-consent-date', new Date().toISOString());
    applyCookieSettings(preferences);
    
    setConsentDate(new Date().toLocaleDateString());
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 3000);
  };

  const updatePreference = (key: keyof CookiePreferences, value: boolean) => {
    if (key === 'necessary') return; // Can't disable necessary cookies
    setPreferences(prev => ({ ...prev, [key]: value }));
  };

  const resetToDefaults = () => {
    setPreferences({
      necessary: true,
      functional: false,
      analytics: false,
      marketing: false
    });
  };

  const acceptAll = () => {
    setPreferences({
      necessary: true,
      functional: true,
      analytics: true,
      marketing: true
    });
  };

  const cookieTypes = [
    {
      key: 'necessary' as keyof CookiePreferences,
      title: 'Necessary Cookies',
      description: 'Essential for the website to function properly. These cookies enable basic features like security, network management, and accessibility.',
      examples: 'Authentication tokens, security settings, language preferences',
      required: true,
      icon: '🔒'
    },
    {
      key: 'functional' as keyof CookiePreferences,
      title: 'Functional Cookies',
      description: 'Help us provide enhanced features and personalized experience based on your usage patterns.',
      examples: 'Chat widget state, trip recommendations, saved filters',
      required: false,
      icon: '⚙️'
    },
    {
      key: 'analytics' as keyof CookiePreferences,
      title: 'Analytics Cookies',
      description: 'Help us understand how visitors interact with our website to improve user experience and optimize our services.',
      examples: 'Google Analytics, page views, user behavior tracking',
      required: false,
      icon: '📊'
    },
    {
      key: 'marketing' as keyof CookiePreferences,
      title: 'Marketing Cookies',
      description: 'Used to track visitors across websites to display relevant advertisements and measure campaign effectiveness.',
      examples: 'Facebook Pixel, advertising networks, retargeting pixels',
      required: false,
      icon: '🎯'
    }
  ];

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-forest-600 to-nature-600 px-8 py-6">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-8 h-8 text-white" />
            <h1 className="text-3xl font-bold text-white">Cookie Settings</h1>
          </div>
          <p className="text-forest-100 text-lg">
            Manage your cookie preferences and control how we use your data
          </p>
          {consentDate && (
            <p className="text-forest-200 text-sm mt-2">
              Last updated: {consentDate}
            </p>
          )}
        </div>

        {/* Success Message */}
        {showSaved && (
          <div className="bg-green-50 border-l-4 border-green-400 p-4 m-6 rounded-r-lg">
            <div className="flex items-center">
              <Check className="w-5 h-5 text-green-600 mr-2" />
              <p className="text-green-800 font-medium">
                Cookie preferences saved successfully!
              </p>
            </div>
          </div>
        )}

        <div className="p-8">
          
          {/* Information Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-8">
            <div className="flex items-start gap-3">
              <Info className="w-6 h-6 text-blue-600 mt-1 flex-shrink-0" />
              <div>
                <h3 className="text-blue-900 font-semibold mb-2">About Cookies</h3>
                <p className="text-blue-800 text-sm leading-relaxed">
                  Cookies are small text files stored on your device that help websites remember your preferences 
                  and provide better user experiences. You can control which types of cookies you're comfortable with below.
                </p>
              </div>
            </div>
          </div>

          {/* Cookie Types */}
          <div className="space-y-6 mb-8">
            {cookieTypes.map((type) => (
              <div key={type.key} className="border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1 mr-4">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-2xl">{type.icon}</span>
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                          {type.title}
                          {type.required && (
                            <span className="px-3 py-1 bg-red-100 text-red-700 text-xs rounded-full font-medium">
                              Required
                            </span>
                          )}
                        </h3>
                      </div>
                    </div>
                    
                    <p className="text-gray-600 leading-relaxed mb-3">
                      {type.description}
                    </p>
                    
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <p className="text-gray-500 text-sm">
                        <strong>Examples:</strong> {type.examples}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex-shrink-0">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={preferences[type.key]}
                        onChange={(e) => updatePreference(type.key, e.target.checked)}
                        disabled={type.required}
                        className="sr-only"
                      />
                      <div className={`w-14 h-8 rounded-full transition-colors duration-200 ${
                        preferences[type.key] 
                          ? 'bg-forest-600' 
                          : 'bg-gray-300'
                      } ${type.required ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                        <div className={`w-6 h-6 bg-white rounded-full shadow-md transform transition-transform duration-200 ${
                          preferences[type.key] ? 'translate-x-7' : 'translate-x-1'
                        } mt-1`} />
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-gray-200">
            <button
              onClick={savePreferences}
              className="flex-1 bg-forest-600 hover:bg-forest-700 text-white px-8 py-3 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <Check className="w-5 h-5" />
              Save Preferences
            </button>
            
            <button
              onClick={acceptAll}
              className="flex-1 bg-nature-600 hover:bg-nature-700 text-white px-8 py-3 rounded-xl font-semibold transition-colors"
            >
              Accept All Cookies
            </button>
            
            <button
              onClick={resetToDefaults}
              className="flex-1 border-2 border-gray-300 hover:border-gray-400 text-gray-700 hover:text-gray-900 px-8 py-3 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <X className="w-5 h-5" />
              Reset to Defaults
            </button>
          </div>

          {/* Additional Information */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="bg-gray-50 p-6 rounded-xl">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Need More Information?</h3>
              <p className="text-gray-600 mb-4">
                For detailed information about how we collect and use your data, please read our privacy policy.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <a
                  href="/privacy-policy"
                  className="inline-flex items-center gap-2 text-forest-600 hover:text-forest-700 font-medium"
                >
                  <Shield className="w-4 h-4" />
                  Privacy Policy
                </a>
                <a
                  href="/terms-conditions"
                  className="inline-flex items-center gap-2 text-forest-600 hover:text-forest-700 font-medium"
                >
                  <Settings className="w-4 h-4" />
                  Terms & Conditions
                </a>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default CookieSettings;