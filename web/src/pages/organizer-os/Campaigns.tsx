import React from 'react';
import { apiClient } from '../../services/apiClient';
import { Shell, StatTile, Table } from './analyticsShared';

// Campaigns: what was sent, to how many, and when.
//
// sentAt is the only thing that says a campaign went out. There is no 'sent'
// status column to disagree with it, so a campaign cannot claim to have been
// delivered while carrying no timestamp for when.

interface Campaign {
  id: string;
  name: string;
  channel: string;
  subject: string | null;
  scheduledFor: string | null;
  sentAt: string | null;
  recipients: number;
  createdAt: string;
}

const stateOf = (c: Campaign) => {
  if (c.sentAt) return 'sent';
  if (c.scheduledFor && new Date(c.scheduledFor) > new Date()) return 'scheduled';
  if (c.scheduledFor) return 'due';
  return 'draft';
};

const tone: Record<string, string> = {
  sent: 'bg-green-100 text-green-800',
  scheduled: 'bg-blue-100 text-blue-800',
  due: 'bg-amber-100 text-amber-800',
  draft: 'bg-gray-100 text-gray-700',
};

const Campaigns: React.FC = () => {
  const [rows, setRows] = React.useState<Campaign[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [form, setForm] = React.useState({ name: '', channel: 'email', subject: '', scheduledFor: '' });

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/api/marketing/campaigns');
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
    if (!form.name) return;
    setBusy(true);
    setError(null);
    try {
      await apiClient.post('/api/marketing/campaigns', {
        name: form.name,
        channel: form.channel,
        subject: form.subject || null,
        scheduledFor: form.scheduledFor || null,
      });
      setForm({ name: '', channel: 'email', subject: '', scheduledFor: '' });
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Could not create the campaign');
    } finally {
      setBusy(false);
    }
  };

  const sent = rows.filter((r) => r.sentAt).length;

  return (
    <Shell title="Campaigns" subtitle="What you sent, and what is queued" loading={loading} error={error}>
      <div className="grid grid-cols-3 gap-3 mb-6">
        <StatTile label="Campaigns" value={String(rows.length)} />
        <StatTile label="Sent" value={String(sent)} />
        <StatTile
          label="Recipients reached"
          value={String(rows.reduce((s, r) => s + (r.sentAt ? r.recipients : 0), 0))}
          hint="sent campaigns only"
        />
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 mb-6">
        <div className="font-medium text-gray-900 mb-3 text-sm">New campaign</div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
          <select
            value={form.channel}
            onChange={(e) => setForm({ ...form, channel: e.target.value })}
            className="rounded border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="email">Email</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="sms">SMS</option>
          </select>
          <input
            placeholder="Subject (optional)"
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
            className="rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
          <label className="text-xs text-gray-600">
            Schedule (optional)
            <input
              type="datetime-local"
              value={form.scheduledFor}
              onChange={(e) => setForm({ ...form, scheduledFor: e.target.value })}
              className="block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            />
          </label>
        </div>
        <button
          onClick={create}
          disabled={busy || !form.name}
          className="mt-3 rounded bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700 disabled:opacity-50"
        >
          Create
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="py-12 text-center text-gray-500 text-sm">No campaigns yet.</div>
      ) : (
        <Table head={['Campaign', 'Channel', 'Scheduled', 'Sent', 'Recipients', 'State']}>
          {rows.map((c) => (
            <tr key={c.id} className="hover:bg-gray-50">
              <td className="px-4 py-3">
                <div className="font-medium text-gray-900">{c.name}</div>
                {c.subject && <div className="text-xs text-gray-500">{c.subject}</div>}
              </td>
              <td className="px-4 py-3 text-gray-600">{c.channel}</td>
              <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">
                {c.scheduledFor ? new Date(c.scheduledFor).toLocaleString('en-IN') : '—'}
              </td>
              <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">
                {c.sentAt ? new Date(c.sentAt).toLocaleString('en-IN') : '—'}
              </td>
              <td className="px-4 py-3 tabular-nums">{c.recipients}</td>
              <td className="px-4 py-3">
                <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${tone[stateOf(c)]}`}>
                  {stateOf(c)}
                </span>
              </td>
            </tr>
          ))}
        </Table>
      )}

      <p className="text-xs text-gray-500 mt-4">
        A campaign counts as sent only when it carries a sent time. There is no separate status
        to fall out of step with that.
      </p>
    </Shell>
  );
};

export default Campaigns;
