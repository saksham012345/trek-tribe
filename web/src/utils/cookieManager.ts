export interface CookieCategory {
  id: string;
  name: string;
  description: string;
  essential: boolean;
  cookies: CookieInfo[];
}

export interface CookieInfo {
  name: string;
  description: string;
  duration: string;
  provider: string;
  purpose: string;
}

export interface CookiePreferences {
  essential: boolean;
  analytics: boolean;
  marketing: boolean;
  functional: boolean;
  lastUpdated: number;
  version: string;
}

export const COOKIE_CATEGORIES: CookieCategory[] = [
  {
    id: 'essential',
    name: 'Essential Cookies',
    description: 'These cookies are necessary for the website to function and cannot be switched off.',
    essential: true,
    cookies: [
      {
        name: 'trek_session',
        description: 'Maintains user session and authentication',
        duration: 'Session',
        provider: 'Trek Tribe',
        purpose: 'Authentication and security'
      },
      {
        name: 'trek_token',
        description: 'Stores authentication token',
        duration: '30 days',
        provider: 'Trek Tribe',
        purpose: 'User login persistence'
      },
      {
        name: 'trek_consent',
        description: 'Remembers your cookie preferences',
        duration: '1 year',
        provider: 'Trek Tribe',
        purpose: 'Cookie consent management'
      }
    ]
  },
  {
    id: 'analytics',
    name: 'Analytics Cookies',
    description: 'Help us understand how visitors interact with our website by collecting anonymous information.',
    essential: false,
    cookies: [
      {
        name: '_ga',
        description: 'Google Analytics main cookie for tracking users',
        duration: '2 years',
        provider: 'Google',
        purpose: 'User behavior analytics'
      },
      {
        name: '_gid',
        description: 'Google Analytics session identifier',
        duration: '24 hours',
        provider: 'Google',
        purpose: 'Session tracking'
      },
      {
        name: 'trek_analytics',
        description: 'Internal analytics for trip recommendations',
        duration: '6 months',
        provider: 'Trek Tribe',
        purpose: 'Personalized content'
      }
    ]
  },
  {
    id: 'marketing',
    name: 'Marketing Cookies',
    description: 'Track visitors across websites to display relevant advertisements.',
    essential: false,
    cookies: [
      {
        name: 'fb_pixel',
        description: 'Facebook tracking pixel',
        duration: '3 months',
        provider: 'Facebook',
        purpose: 'Targeted advertising'
      },
      {
        name: 'google_ads',
        description: 'Google Ads conversion tracking',
        duration: '90 days',
        provider: 'Google',
        purpose: 'Ad performance measurement'
      }
    ]
  },
  {
    id: 'functional',
    name: 'Functional Cookies',
    description: 'Enable enhanced functionality and personalization features.',
    essential: false,
    cookies: [
      {
        name: 'trek_preferences',
        description: 'User interface preferences and settings',
        duration: '1 year',
        provider: 'Trek Tribe',
        purpose: 'Personalized user experience'
      },
      {
        name: 'trek_location',
        description: 'Remembers your location for trip suggestions',
        duration: '6 months',
        provider: 'Trek Tribe',
        purpose: 'Location-based recommendations'
      }
    ]
  }
];

export const DEFAULT_PREFERENCES: CookiePreferences = {
  essential: true,
  analytics: false,
  marketing: false,
  functional: false,
  lastUpdated: Date.now(),
  version: '1.0'
};

export class CookieManager {
  private static readonly CONSENT_COOKIE_NAME = 'trek_cookie_consent';
  private static readonly CONSENT_VERSION = '1.0';

  static getConsentStatus(): CookiePreferences | null {
    try {
      const consent = localStorage.getItem(this.CONSENT_COOKIE_NAME);
      if (!consent) return null;
      
      const parsed = JSON.parse(consent);
      // Check if consent is still valid (not older than 1 year)
      const oneYear = 365 * 24 * 60 * 60 * 1000;
      if (Date.now() - parsed.lastUpdated > oneYear) {
        this.clearConsent();
        return null;
      }
      
      return parsed;
    } catch (error) {
      console.error('Error reading cookie consent:', error);
      return null;
    }
  }

  static saveConsent(preferences: Partial<CookiePreferences>): void {
    const fullPreferences: CookiePreferences = {
      ...DEFAULT_PREFERENCES,
      ...preferences,
      lastUpdated: Date.now(),
      version: this.CONSENT_VERSION
    };

    try {
      localStorage.setItem(this.CONSENT_COOKIE_NAME, JSON.stringify(fullPreferences));
      this.applyCookiePreferences(fullPreferences);
    } catch (error) {
      console.error('Error saving cookie consent:', error);
    }
  }

  static clearConsent(): void {
    localStorage.removeItem(this.CONSENT_COOKIE_NAME);
    this.clearNonEssentialCookies();
  }

  private static applyCookiePreferences(preferences: CookiePreferences): void {
    // Remove non-essential cookies if not consented
    if (!preferences.analytics) {
      this.removeCookiesByCategory('analytics');
    }
    
    if (!preferences.marketing) {
      this.removeCookiesByCategory('marketing');
    }
    
    if (!preferences.functional) {
      this.removeCookiesByCategory('functional');
    }

    // Initialize analytics if consented
    if (preferences.analytics) {
      this.initializeAnalytics();
    }

    // Initialize marketing if consented
    if (preferences.marketing) {
      this.initializeMarketing();
    }
  }

  private static removeCookiesByCategory(categoryId: string): void {
    const category = COOKIE_CATEGORIES.find(cat => cat.id === categoryId);
    if (!category) return;

    category.cookies.forEach(cookie => {
      // Remove from document cookies
      document.cookie = `${cookie.name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
      document.cookie = `${cookie.name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=.${window.location.hostname}`;
      
      // Remove from localStorage
      localStorage.removeItem(cookie.name);
      
      // Remove from sessionStorage
      sessionStorage.removeItem(cookie.name);
    });
  }

  private static clearNonEssentialCookies(): void {
    COOKIE_CATEGORIES.forEach(category => {
      if (!category.essential) {
        this.removeCookiesByCategory(category.id);
      }
    });
  }

  private static initializeAnalytics(): void {
    // Initialize Google Analytics if needed
    if (typeof (window as any).gtag !== 'undefined') {
      (window as any).gtag('consent', 'update', {
        analytics_storage: 'granted'
      });
    }
    
    // Initialize other analytics tools here
    console.log('Analytics initialized');
  }

  private static initializeMarketing(): void {
    // Initialize marketing tools
    if (typeof (window as any).gtag !== 'undefined') {
      (window as any).gtag('consent', 'update', {
        ad_storage: 'granted',
        ad_user_data: 'granted',
        ad_personalization: 'granted'
      });
    }
    
    console.log('Marketing tools initialized');
  }

  static getCookieValue(name: string): string | null {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) === ' ') c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
  }

  static setCookie(name: string, value: string, days: number = 365): void {
    const expires = new Date();
    expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
    document.cookie = `${name}=${value}; expires=${expires.toUTCString()}; path=/; secure; samesite=strict`;
  }

  static hasConsented(): boolean {
    return this.getConsentStatus() !== null;
  }

  static getConsentSummary(): string {
    const consent = this.getConsentStatus();
    if (!consent) return 'No consent given';
    
    const categories = [];
    if (consent.analytics) categories.push('Analytics');
    if (consent.marketing) categories.push('Marketing');
    if (consent.functional) categories.push('Functional');
    
    return categories.length > 0 
      ? `Essential + ${categories.join(', ')}` 
      : 'Essential only';
  }
}