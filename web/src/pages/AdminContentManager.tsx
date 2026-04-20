import React, { useEffect, useState } from 'react';
import api from '../config/api';

interface SiteSettingsShape {
  home: {
    heroImages: string[];
    overlayStyle: 'light' | 'dark';
    fontFamily: string;
    discoverColumnsDesktop: number;
    discoverColumnsMobile: number;
  };
  contact: {
    supportEmail: string;
    otpFromEmail: string;
    bookingFromEmail: string;
  };
  notifications: {
    emailEnabled: boolean;
    smsEnabled: boolean;
    sendFollowerTripAlerts: boolean;
    tripReminderHours: number;
  };
  integrations: {
    paymentProvider: 'razorpay' | 'manual' | 'stripe';
    emailProvider: 'sendgrid' | 'disabled';
    smsProvider: 'twilio' | 'disabled';
    twilioFromNumber?: string;
  };
}

const AdminContentManager: React.FC = () => {
  const [data, setData] = useState<SiteSettingsShape | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/api/site-settings/admin');
        setData(res.data?.data || null);
      } catch (error) {
        console.error('Failed to load site settings', error);
        setMessage('Failed to load settings');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const update = (path: string, value: any) => {
    if (!data) return;
    const [root, key] = path.split('.');
    setData({
      ...data,
      [root]: {
        ...(data as any)[root],
        [key]: value
      }
    } as SiteSettingsShape);
  };

  const updateHeroImage = (idx: number, value: string) => {
    if (!data) return;
    const next = [...(data.home.heroImages || [])];
    next[idx] = value;
    setData({ ...data, home: { ...data.home, heroImages: next } });
  };

  const save = async () => {
    if (!data) return;
    setSaving(true);
    setMessage('');
    try {
      await api.put('/api/site-settings/admin', data);
      setMessage('Settings saved');
    } catch (error: any) {
      setMessage(error?.response?.data?.error || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const resetDefaults = async () => {
    if (!window.confirm('Reset all site settings to defaults?')) return;
    setSaving(true);
    setMessage('');
    try {
      const res = await api.post('/api/site-settings/admin/reset');
      setData(res.data?.data || null);
      setMessage('Settings reset to defaults');
    } catch {
      setMessage('Failed to reset settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !data) {
    return <div className="min-h-screen bg-gray-50 text-center py-16 text-gray-500">Loading content settings...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h1 className="text-2xl font-bold text-gray-900">Admin Content & Integrations</h1>
          <p className="text-sm text-gray-600 mt-1">
            Manage homepage content, theme style, email sender, SMS reminders, and payment provider mode.
          </p>
          {message && <p className="text-sm mt-3 text-forest-700">{message}</p>}
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
            <h2 className="font-semibold text-gray-900">Homepage Theme & Discover</h2>

            <label className="text-sm text-gray-700">Overlay Style</label>
            <select
              value={data.home.overlayStyle}
              onChange={(e) => update('home.overlayStyle', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>

            <label className="text-sm text-gray-700">Font Family</label>
            <input
              value={data.home.fontFamily}
              onChange={(e) => update('home.fontFamily', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-gray-700">Discover Desktop Columns</label>
                <input
                  type="number"
                  min={2}
                  max={4}
                  value={data.home.discoverColumnsDesktop}
                  onChange={(e) => update('home.discoverColumnsDesktop', Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="text-sm text-gray-700">Discover Mobile Columns</label>
                <input
                  type="number"
                  min={1}
                  max={3}
                  value={data.home.discoverColumnsMobile}
                  onChange={(e) => update('home.discoverColumnsMobile', Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
            </div>

            {[0, 1, 2].map((idx) => (
              <div key={idx}>
                <label className="text-sm text-gray-700">Hero Image {idx + 1}</label>
                <input
                  value={data.home.heroImages[idx] || ''}
                  onChange={(e) => updateHeroImage(idx, e.target.value)}
                  placeholder="https://..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
            <h2 className="font-semibold text-gray-900">Email, SMS, Payment Controls</h2>

            <label className="text-sm text-gray-700">Support Email</label>
            <input
              value={data.contact.supportEmail}
              onChange={(e) => update('contact.supportEmail', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />

            <label className="text-sm text-gray-700">OTP/Reset From Email</label>
            <input
              value={data.contact.otpFromEmail}
              onChange={(e) => update('contact.otpFromEmail', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />

            <label className="text-sm text-gray-700">Booking From Email</label>
            <input
              value={data.contact.bookingFromEmail}
              onChange={(e) => update('contact.bookingFromEmail', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-gray-700">Payment Provider</label>
                <select
                  value={data.integrations.paymentProvider}
                  onChange={(e) => update('integrations.paymentProvider', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="razorpay">Razorpay</option>
                  <option value="manual">Manual</option>
                  <option value="stripe">Stripe</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-700">SMS Provider</label>
                <select
                  value={data.integrations.smsProvider}
                  onChange={(e) => update('integrations.smsProvider', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="disabled">Disabled</option>
                  <option value="twilio">Twilio</option>
                </select>
              </div>
            </div>

            <label className="text-sm text-gray-700">Twilio From Number</label>
            <input
              value={data.integrations.twilioFromNumber || ''}
              onChange={(e) => update('integrations.twilioFromNumber', e.target.value)}
              placeholder="+1XXXXXXXXXX"
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />

            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={data.notifications.emailEnabled}
                  onChange={(e) => update('notifications.emailEnabled', e.target.checked)}
                />
                Email Enabled
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={data.notifications.smsEnabled}
                  onChange={(e) => update('notifications.smsEnabled', e.target.checked)}
                />
                SMS Enabled
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 col-span-2">
                <input
                  type="checkbox"
                  checked={data.notifications.sendFollowerTripAlerts}
                  onChange={(e) => update('notifications.sendFollowerTripAlerts', e.target.checked)}
                />
                Notify followers when organizer publishes a new trip
              </label>
            </div>

            <label className="text-sm text-gray-700">Trip Reminder Hours (default 24)</label>
            <input
              type="number"
              min={1}
              max={72}
              value={data.notifications.tripReminderHours}
              onChange={(e) => update('notifications.tripReminderHours', Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />

            <p className="text-xs text-gray-500">
              Note: Twilio SID/Auth Token and SendGrid API keys stay in server env for security. Here you configure behavior and sender profile.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="px-5 py-2.5 rounded-lg bg-forest-700 text-white hover:bg-forest-800 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
          <button
            onClick={resetDefaults}
            disabled={saving}
            className="px-5 py-2.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50"
          >
            Reset to Defaults
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminContentManager;

