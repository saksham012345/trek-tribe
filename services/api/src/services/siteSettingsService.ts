import { SiteSettings } from '../models/SiteSettings';
import { logger } from '../utils/logger';

const DEFAULT_SITE_SETTINGS = {
  key: 'global' as const,
  home: {
    heroImages: [
      'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=1600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1469474968028-56623f02e42e?q=80&w=1600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1500534314209-a26db0f5b361?q=80&w=1600&auto=format&fit=crop'
    ],
    overlayStyle: 'light' as const,
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
    discoverColumnsDesktop: 3,
    discoverColumnsMobile: 2
  },
  contact: {
    supportEmail: 'support@trektribe.com',
    otpFromEmail: 'support@trektribe.com',
    bookingFromEmail: 'support@trektribe.com'
  },
  notifications: {
    emailEnabled: true,
    smsEnabled: false,
    sendFollowerTripAlerts: true,
    tripReminderHours: 24
  },
  integrations: {
    paymentProvider: 'razorpay' as const,
    emailProvider: 'sendgrid' as const,
    smsProvider: 'disabled' as const,
    twilioFromNumber: ''
  }
};

let cachedSettings: any | null = null;
let cacheUpdatedAt = 0;
const CACHE_TTL_MS = 60 * 1000;

function deepMerge(target: any, patch: any): any {
  if (!patch || typeof patch !== 'object') {
    return target;
  }

  const result = { ...target };
  Object.keys(patch).forEach((key) => {
    const value = patch[key];
    if (Array.isArray(value)) {
      result[key] = value.slice();
    } else if (value && typeof value === 'object') {
      result[key] = deepMerge(result[key] || {}, value);
    } else if (value !== undefined) {
      result[key] = value;
    }
  });
  return result;
}

async function ensureSiteSettingsDoc() {
  let doc = await SiteSettings.findOne({ key: 'global' });
  if (!doc) {
    doc = new SiteSettings(DEFAULT_SITE_SETTINGS);
    await doc.save();
    logger.info('Created default site settings');
  }
  return doc;
}

export async function getSiteSettings(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedSettings && now - cacheUpdatedAt < CACHE_TTL_MS) {
    return cachedSettings;
  }

  const doc = await ensureSiteSettingsDoc();
  const settings = doc.toObject();
  cachedSettings = settings;
  cacheUpdatedAt = now;
  return settings;
}

export async function updateSiteSettings(patch: Record<string, any>, updatedBy?: string) {
  const doc = await ensureSiteSettingsDoc();
  const merged = deepMerge(doc.toObject(), patch);
  doc.set(merged);
  if (updatedBy) {
    (doc as any).updatedBy = updatedBy;
  }
  await doc.save();
  cachedSettings = doc.toObject();
  cacheUpdatedAt = Date.now();
  return cachedSettings;
}

export async function resetSiteSettings(updatedBy?: string) {
  const doc = await ensureSiteSettingsDoc();
  doc.set(DEFAULT_SITE_SETTINGS as any);
  if (updatedBy) {
    (doc as any).updatedBy = updatedBy;
  }
  await doc.save();
  cachedSettings = doc.toObject();
  cacheUpdatedAt = Date.now();
  return cachedSettings;
}

export function getPublicSiteSettings(settings: any) {
  return {
    home: settings.home,
    contact: {
      supportEmail: settings.contact?.supportEmail || DEFAULT_SITE_SETTINGS.contact.supportEmail
    },
    notifications: {
      tripReminderHours: settings.notifications?.tripReminderHours || 24
    }
  };
}

export { DEFAULT_SITE_SETTINGS };

