import React from 'react';
import { apiClient } from '../../services/apiClient';
import { Shell, StatTile, Table } from './analyticsShared';

// Referral codes, and what came of them.
//
// A referral is only worth anything once it produces a booking, so "rewarded"
// is the presence of a reward timestamp, and "converted" is the presence of a
// booking. Both are facts on the row rather than a status column that could
// claim either without the evidence.
//
// The database also refuses a self-referral outright — nobody collects a reward
// for referring themselves.

interface Referral {
  id: string;
  code: string;
  referrerId: string;
  referredId: string | null;
  bookingId: string | null;
  rewardedAt: string | null;
  createdAt: string;
}

const stateOf = (r: Referral) => {
  if (r.rewardedAt) return 'rewarded';
  if (r.bookingId) return 'converted';
  if (r.referredId) return 'signed up';
  return 'shared';
};

const tone: Record<string, string> = {
  rewarded: 'bg-green-100 text-green-800',
  converted: 'bg-blue-100 text-blue-800',
  'signed up': 'bg-amber-100 text-amber-800',
  shared: 'bg-gray-100 text-gray-700',
};

const Referrals: React.FC = () => {
  const [rows, setRows] = React.useState<Referral[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [form, setForm] = React.useState({ code: '', referrerId: '' });

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/api/marketing/referrals');
      setRows(res.data ?? []);
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Request failed');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    if (!form.code || !form.referrerId) return;
    setBusy(true);
    setError(null);
    try {
      await apiClient.post('/api/marketing/referrals', {
        code: form.code.trim().toUpperCase(),
        referrerId: form.referrerId.trim(),
      });
      setForm({ code: '', referrerId: '' });
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Could not create the referral code');
    } finally {
      setBusy(false);
    }
  };

  const converted = rows.filter((r) => r.bookingId).length;
  const rewarded = rows.filter((r) => r.rewardedAt).length;

  return (
    <Shell title="Referrals" subtitle="Codes handed out, and what they turned into" loading={loading} error={error}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatTile label="Codes" value={String(rows.length)} />
        <StatTile label="Signed up" value={String(rows.filter((r) => r.referredId).length)} />
        <StatTile label="Booked" value={String(converted)} />
        <StatTile label="Rewarded" value={String(rewarded)} />
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 mb-6">
        <div className="font-medium text-gray-900 mb-3 text-sm">New referral code</div>
        <div className="flex flex-wrap gap-3 items-center">
          <input
            placeholder="CODE"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
            className="rounded border border-gray-300 px-2 py-1.5 text-sm font-mono w-40"
          />
          <input
            placeholder="Referrer user id"
            value={form.referrerId}
            onChange={(e) => setForm({ ...form, referrerId: e.target.value })}
            className="rounded border border-gray-300 px-2 py-1.5 text-sm font-mono w-72"
          />
          <button
            onClick={create}
            disabled={busy || !form.code || !form.referrerId}
            className="rounded bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700 disabled:opacity-50"
          >
            Create
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Codes are unique across the platform, and a self-referral is refused by the database.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="py-12 text-center text-gray-500 text-sm">No referral codes yet.</div>
      ) : (
        <Table head={['Code', 'Referrer', 'Referred', 'Booking', 'State', 'Created']}>
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 font-mono font-medium text-gray-900">{r.code}</td>
              <td className="px-4 py-3 font-mono text-xs text-gray-600">
                {r.referrerId.slice(0, 10)}…
              </td>
              <td className="px-4 py-3 font-mono text-xs text-gray-600">
                {r.referredId ? `${r.referredId.slice(0, 10)}…` : '—'}
              </td>
              <td className="px-4 py-3 font-mono text-xs text-gray-600">
                {r.bookingId ? `${r.bookingId.slice(0, 10)}…` : '—'}
              </td>
              <td className="px-4 py-3">
                <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${tone[stateOf(r)]}`}>
                  {stateOf(r)}
                </span>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-gray-500 text-xs">
                {new Date(r.createdAt).toLocaleDateString('en-IN')}
              </td>
            </tr>
          ))}
        </Table>
      )}
    </Shell>
  );
};

export default Referrals;
