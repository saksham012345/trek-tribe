import React from 'react';
import { apiClient } from '../../services/apiClient';
import { Shell, StatTile, Table } from './analyticsShared';

// Banner state comes from the window, not from a stored flag.
//
// Only "paused" can be set here, and that is the design rather than a missing
// feature: live, scheduled and expired are arithmetic on two dates. A control
// for them would store a second opinion about the same thing, and the stored
// one goes wrong at exactly the moment it matters — the minute the window
// closes, with nothing watching.

interface Banner {
  id: string;
  title: string;
  body_text: string | null;
  link_url: string | null;
  placement: string;
  starts_at: string;
  ends_at: string | null;
  is_paused: boolean;
  state: 'live' | 'scheduled' | 'expired' | 'paused';
}

const tone: Record<string, string> = {
  live: 'bg-green-100 text-green-800',
  scheduled: 'bg-blue-100 text-blue-800',
  expired: 'bg-gray-100 text-gray-600',
  paused: 'bg-amber-100 text-amber-800',
};

const Banners: React.FC = () => {
  const [rows, setRows] = React.useState<Banner[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({ title: '', startsAt: '', endsAt: '', linkUrl: '' });

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/api/marketing/banners');
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
    if (!form.title || !form.startsAt) return;
    setBusy('new');
    setError(null);
    try {
      await apiClient.post('/api/marketing/banners', {
        title: form.title,
        startsAt: form.startsAt,
        endsAt: form.endsAt || null,
        linkUrl: form.linkUrl || null,
      });
      setForm({ title: '', startsAt: '', endsAt: '', linkUrl: '' });
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Could not create the banner');
    } finally {
      setBusy(null);
    }
  };

  const togglePause = async (b: Banner) => {
    setBusy(b.id);
    setError(null);
    try {
      await apiClient.patch(`/api/marketing/banners/${b.id}/paused`, { isPaused: !b.is_paused });
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Could not change the banner');
    } finally {
      setBusy(null);
    }
  };

  const count = (s: string) => rows.filter((r) => r.state === s).length;

  return (
    <Shell title="Banners" subtitle="What shows, and when" loading={loading} error={error}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatTile label="Live now" value={String(count('live'))} />
        <StatTile label="Scheduled" value={String(count('scheduled'))} />
        <StatTile label="Expired" value={String(count('expired'))} />
        <StatTile label="Paused" value={String(count('paused'))} />
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 mb-6">
        <div className="font-medium text-gray-900 mb-3 text-sm">New banner</div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            placeholder="Title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
          <label className="text-xs text-gray-600">
            Starts
            <input
              type="datetime-local"
              value={form.startsAt}
              onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
              className="block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="text-xs text-gray-600">
            Ends (optional)
            <input
              type="datetime-local"
              value={form.endsAt}
              onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
              className="block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            />
          </label>
          <input
            placeholder="Link (optional)"
            value={form.linkUrl}
            onChange={(e) => setForm({ ...form, linkUrl: e.target.value })}
            className="rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
        </div>
        <button
          onClick={create}
          disabled={busy === 'new' || !form.title || !form.startsAt}
          className="mt-3 rounded bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700 disabled:opacity-50"
        >
          Create
        </button>
        <p className="text-xs text-gray-500 mt-2">
          An end before the start is refused — that is a typo, and it would make a banner that
          can never show with nothing to explain why.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="py-12 text-center text-gray-500 text-sm">No banners yet.</div>
      ) : (
        <Table head={['Banner', 'Placement', 'Window', 'State', '']}>
          {rows.map((b) => (
            <tr key={b.id} className="hover:bg-gray-50">
              <td className="px-4 py-3">
                <div className="font-medium text-gray-900">{b.title}</div>
                {b.link_url && <div className="text-xs text-gray-500">{b.link_url}</div>}
              </td>
              <td className="px-4 py-3 text-gray-600">{b.placement}</td>
              <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">
                {new Date(b.starts_at).toLocaleString('en-IN')}
                <br />
                {b.ends_at ? new Date(b.ends_at).toLocaleString('en-IN') : 'no end'}
              </td>
              <td className="px-4 py-3">
                <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${tone[b.state]}`}>
                  {b.state}
                </span>
              </td>
              <td className="px-4 py-3">
                <button
                  onClick={() => togglePause(b)}
                  disabled={busy === b.id}
                  className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-50"
                >
                  {b.is_paused ? 'Resume' : 'Pause'}
                </button>
              </td>
            </tr>
          ))}
        </Table>
      )}

      <p className="text-xs text-gray-500 mt-4">
        Pause is the only state you set. Live, scheduled and expired are worked out from the
        window every time this loads, so they cannot go stale.
      </p>
    </Shell>
  );
};

export default Banners;
