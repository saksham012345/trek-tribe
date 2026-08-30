import React from 'react';
import { Shell, StatTile, Table } from './analyticsShared';
import { apiClient } from '../../services/apiClient';

// Leads, read from the CRM.
//
// Conversion is counted from the lead's own status rather than recomputed here,
// so this screen and the marketing analytics view cannot disagree about the
// same week — they are reading the same field.

interface Lead {
  _id?: string;
  id?: string;
  name?: string;
  email?: string;
  phone?: string;
  source: string;
  status: string;
  pipelineStage?: string;
  createdAt: string;
}

const tone: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800',
  contacted: 'bg-amber-100 text-amber-800',
  interested: 'bg-green-100 text-green-800',
  converted: 'bg-green-100 text-green-800',
  not_interested: 'bg-gray-100 text-gray-600',
  lost: 'bg-gray-100 text-gray-600',
};

const Leads: React.FC = () => {
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [form, setForm] = React.useState({ name: '', email: '', phone: '', source: 'inquiry' });

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/api/crm/leads');
      setData(res.data);
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Request failed');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const rows: Lead[] = Array.isArray(data) ? data : data?.leads ?? data?.data ?? [];

  // Adding one by hand.
  //
  // Leads arrive on their own from enquiries and abandoned bookings, and this
  // screen could only watch them arrive. POST /api/crm/leads existed and
  // nothing called it, so a name taken down over the phone had nowhere to go.
  const addLead = async () => {
    setBusy(true);
    setError(null);
    try {
      await apiClient.post('/api/crm/leads', {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim() || undefined,
        source: form.source,
      });
      setForm({ ...form, name: '', email: '', phone: '' });
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.response?.data?.message || 'Could not add the lead');
    } finally {
      setBusy(false);
    }
  };

  const setStage = async (id: string, stage: string) => {
    setBusy(true);
    setError(null);
    try {
      await apiClient.patch(`/api/crm/leads/${id}/pipeline-stage`, { pipelineStage: stage });
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Could not move the lead');
    } finally {
      setBusy(false);
    }
  };

  const count = (s: string) => rows.filter((r) => r.status === s).length;
  const converted = count('converted');
  const rate = rows.length > 0 ? Math.round((converted / rows.length) * 100) : 0;

  return (
    <Shell
      title="Leads"
      subtitle="People who enquired, and where each one got to"
      loading={loading}
      error={error}
    >
      <section className="rounded-lg border border-gray-200 bg-white p-4 mb-6">
        <h2 className="font-medium text-gray-900 mb-1">Add a lead</h2>
        <p className="text-xs text-gray-500 mb-3">
          For the ones that arrive by phone or in person. Enquiries and abandoned bookings
          land here on their own.
        </p>
        <div className="flex flex-wrap gap-2 items-start">
          <input className="rounded border border-gray-300 px-3 py-2 text-sm" placeholder="Name"
            value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="rounded border border-gray-300 px-3 py-2 text-sm" placeholder="Email"
            value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className="rounded border border-gray-300 px-3 py-2 text-sm" placeholder="Phone (optional)"
            value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <select className="rounded border border-gray-300 px-3 py-2 text-sm"
            value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
            {/* These are the values the column accepts. The first draft of this
                offered "manual", "phone", "referral" and "walk_in", none of
                which are in the enum, so every add answered 500. */}
            <option value="inquiry">Enquiry</option>
            <option value="chat">Chat</option>
            <option value="form">Form</option>
            <option value="other">Other</option>
          </select>
          <button onClick={addLead} disabled={busy || !form.name.trim() || !form.email.trim()}
            className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40">
            Add lead
          </button>
        </div>
      </section>

      {rows.length === 0 && (
        <div className="py-12 text-center text-gray-500 text-sm">
          No leads yet. They arrive from enquiries and abandoned bookings, or you can add one above.
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatTile label="Leads" value={String(rows.length)} />
        <StatTile label="Open" value={String(count('new') + count('contacted') + count('interested'))} />
        <StatTile label="Converted" value={String(converted)} />
        <StatTile label="Conversion" value={`${rate}%`} />
      </div>

      <Table head={['Lead', 'Source', 'Status', 'Stage', 'Came in']}>
        {rows.map((l) => {
          const id = l._id ?? l.id ?? '';
          return (
            <tr key={id} className="hover:bg-gray-50">
              <td className="px-4 py-3">
                <div className="font-medium text-gray-900">{l.name ?? '—'}</div>
                <div className="text-xs text-gray-500">{l.email ?? l.phone ?? ''}</div>
              </td>
              <td className="px-4 py-3 text-gray-600">{l.source}</td>
              <td className="px-4 py-3">
                <span
                  className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                    tone[l.status] ?? 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {l.status.replace(/_/g, ' ')}
                </span>
              </td>
              <td className="px-4 py-3">
                {/* Moving a lead along. PATCH /api/crm/leads/:id/pipeline-stage
                    existed and nothing called it, so the pipeline could be read
                    and never advanced. */}
                <select
                  value={l.pipelineStage ?? 'new'}
                  disabled={busy}
                  onChange={(e) => setStage(id, e.target.value)}
                  className="rounded border border-gray-300 px-2 py-1 text-xs disabled:opacity-50"
                >
                  {['new', 'contacted', 'interested', 'negotiating', 'booked', 'lost'].map((st) => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-gray-500 text-xs">
                {l.createdAt ? new Date(l.createdAt).toLocaleDateString('en-IN') : '—'}
              </td>
            </tr>
          );
        })}
      </Table>

      <p className="text-xs text-gray-500 mt-4">
        Conversion is read from each lead's own status, the same field the marketing analytics
        view groups by — so the two cannot disagree about the same week.
      </p>
    </Shell>
  );
};

export default Leads;
