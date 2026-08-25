import { prisma } from '../lib/prisma';
import { upsertRacingSafely } from '../lib/upsert';
import { logger } from '../utils/logger';

/**
 * Site settings live in Postgres (D10/D11, wave 3), as one row keyed 'global'.
 *
 * The Mongoose document was nested - settings.home.heroImages,
 * settings.notifications.tripReminderHours - and callers all over the codebase
 * read it that way. The table is flat columns instead, so that a query like
 * "is SMS on" is a column read rather than a JSON dig.
 *
 * The nested shape is this module's API, so it is rebuilt on the way out and
 * flattened on the way in. Nothing outside this file changes.
 */

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

/** Flat row -> the nested shape every caller expects. */
function toNested(row: any) {
  return {
    key: row.key,
    home: {
      heroImages: row.homeHeroImages,
      overlayStyle: row.homeOverlayStyle,
      fontFamily: row.homeFontFamily,
      discoverColumnsDesktop: row.homeDiscoverColumnsDesktop,
      discoverColumnsMobile: row.homeDiscoverColumnsMobile
    },
    contact: {
      supportEmail: row.contactSupportEmail,
      otpFromEmail: row.contactOtpFromEmail,
      bookingFromEmail: row.contactBookingFromEmail
    },
    notifications: {
      emailEnabled: row.notificationsEmailEnabled,
      smsEnabled: row.notificationsSmsEnabled,
      sendFollowerTripAlerts: row.notificationsSendFollowerAlerts,
      tripReminderHours: row.notificationsTripReminderHours
    },
    integrations: {
      paymentProvider: row.integrationsPaymentProvider,
      emailProvider: row.integrationsEmailProvider,
      smsProvider: row.integrationsSmsProvider,
      twilioFromNumber: row.integrationsTwilioFromNumber
    },
    updatedBy: row.updatedBy ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

/** Nested shape -> the flat columns. Only keys actually present are returned. */
function toColumns(nested: any) {
  const out: Record<string, any> = {};
  const set = (col: string, value: any) => {
    if (value !== undefined) out[col] = value;
  };

  set('homeHeroImages', nested.home?.heroImages);
  set('homeOverlayStyle', nested.home?.overlayStyle);
  set('homeFontFamily', nested.home?.fontFamily);
  set('homeDiscoverColumnsDesktop', nested.home?.discoverColumnsDesktop);
  set('homeDiscoverColumnsMobile', nested.home?.discoverColumnsMobile);

  set('contactSupportEmail', nested.contact?.supportEmail);
  set('contactOtpFromEmail', nested.contact?.otpFromEmail);
  set('contactBookingFromEmail', nested.contact?.bookingFromEmail);

  set('notificationsEmailEnabled', nested.notifications?.emailEnabled);
  set('notificationsSmsEnabled', nested.notifications?.smsEnabled);
  set('notificationsSendFollowerAlerts', nested.notifications?.sendFollowerTripAlerts);
  set('notificationsTripReminderHours', nested.notifications?.tripReminderHours);

  set('integrationsPaymentProvider', nested.integrations?.paymentProvider);
  set('integrationsEmailProvider', nested.integrations?.emailProvider);
  set('integrationsSmsProvider', nested.integrations?.smsProvider);
  set('integrationsTwilioFromNumber', nested.integrations?.twilioFromNumber);

  return out;
}

async function ensureSiteSettingsRow() {
  // `key` is unique, so two callers racing to create the first row cannot both
  // win - the second gets the row the first made.
  const existing = await prisma.siteSettings.findUnique({ where: { key: 'global' } });
  if (existing) return existing;

  const created = await upsertRacingSafely(() => prisma.siteSettings.upsert({
    where: { key: 'global' },
    create: { key: 'global', ...toColumns(DEFAULT_SITE_SETTINGS) },
    update: {}
  }));
  logger.info('Created default site settings');
  return created;
}

export async function getSiteSettings(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedSettings && now - cacheUpdatedAt < CACHE_TTL_MS) {
    return cachedSettings;
  }

  const row = await ensureSiteSettingsRow();
  const settings = toNested(row);
  cachedSettings = settings;
  cacheUpdatedAt = now;
  return settings;
}

export async function updateSiteSettings(patch: Record<string, any>, updatedBy?: string) {
  const row = await ensureSiteSettingsRow();
  const merged = deepMerge(toNested(row), patch);

  const updated = await prisma.siteSettings.update({
    where: { key: 'global' },
    data: { ...toColumns(merged), ...(updatedBy ? { updatedBy } : {}) }
  });

  cachedSettings = toNested(updated);
  cacheUpdatedAt = Date.now();
  return cachedSettings;
}

export async function resetSiteSettings(updatedBy?: string) {
  await ensureSiteSettingsRow();

  const updated = await prisma.siteSettings.update({
    where: { key: 'global' },
    data: { ...toColumns(DEFAULT_SITE_SETTINGS), ...(updatedBy ? { updatedBy } : {}) }
  });

  cachedSettings = toNested(updated);
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
