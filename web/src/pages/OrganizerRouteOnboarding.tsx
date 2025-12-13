import React, { useEffect, useState } from 'react';
import api from '../config/api';
import { useAuth } from '../contexts/AuthContext';

interface StatusResponse {
  onboarded: boolean;
  accountId?: string;
  status?: string;
  commissionRate?: number;
  kycStatus?: string;
}

const OrganizerRouteOnboarding: React.FC = () => {
  const { user } = useAuth();
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    legalBusinessName: '',
    businessType: 'proprietorship',
    accountNumber: '',
    ifscCode: '',
    accountHolderName: '',
    bankName: '',
  });

  useEffect(() => {
    fetchStatus();
  }, []);

  async function fetchStatus() {
    try {
      const { data } = await api.get('/api/marketplace/organizer/status');
      setStatus(data);
    } catch (error) {
      console.error('Failed to fetch onboarding status', error);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/api/marketplace/organizer/onboard', {
        legalBusinessName: form.legalBusinessName,
        businessType: form.businessType,
        bankAccount: {
          accountNumber: form.accountNumber,
          ifscCode: form.ifscCode,
          accountHolderName: form.accountHolderName,
          bankName: form.bankName,
        },
      });
      await fetchStatus();
      alert('Onboarding submitted. You can receive payouts after activation.');
    } catch (error: any) {
      alert(error.response?.data?.error || error.message);
    } finally {
      setLoading(false);
    }
  }

  if (!user) return <div className="p-8">Login required.</div>;

  return (
    <div className="max-w-3xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-4">Route Onboarding</h1>
      <p className="text-gray-600 mb-6">Connect your bank to receive automatic payouts after bookings.</p>

      {status && status.onboarded && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4">
          <p className="font-semibold text-green-800">✅ Onboarded</p>
          <p className="text-sm">Account: {status.accountId}</p>
          <p className="text-sm">Status: {status.status}</p>
          <p className="text-sm">Commission: {status.commissionRate || 5}%</p>
          <p className="text-sm">KYC: {status.kycStatus}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Legal Business Name</label>
          <input
            required
            className="w-full rounded border px-3 py-2"
            value={form.legalBusinessName}
            onChange={(e) => setForm({ ...form, legalBusinessName: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Business Type</label>
          <select
            className="w-full rounded border px-3 py-2"
            value={form.businessType}
            onChange={(e) => setForm({ ...form, businessType: e.target.value })}
          >
            <option value="proprietorship">Proprietorship</option>
            <option value="partnership">Partnership</option>
            <option value="llp">LLP</option>
            <option value="pvt_ltd">Private Limited</option>
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Account Number</label>
            <input
              required
              className="w-full rounded border px-3 py-2"
              value={form.accountNumber}
              onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">IFSC Code</label>
            <input
              required
              className="w-full rounded border px-3 py-2"
              value={form.ifscCode}
              onChange={(e) => setForm({ ...form, ifscCode: e.target.value })}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Account Holder Name</label>
            <input
              required
              className="w-full rounded border px-3 py-2"
              value={form.accountHolderName}
              onChange={(e) => setForm({ ...form, accountHolderName: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Bank Name (optional)</label>
            <input
              className="w-full rounded border px-3 py-2"
              value={form.bankName}
              onChange={(e) => setForm({ ...form, bankName: e.target.value })}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Submitting...' : 'Submit Onboarding'}
        </button>
      </form>
    </div>
  );
};

export default OrganizerRouteOnboarding;
