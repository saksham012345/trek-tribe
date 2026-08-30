import React from 'react';
import { apiClient } from '../../services/apiClient';
import { Shell, StatTile, Table } from './analyticsShared';

// expiryState comes from the server, derived from the date in one place. This
// screen never computes "expired" itself — if it did, that would be a second
// opinion that disagrees with the API the first time a timezone is involved.

interface Certification {
  id: string;
  name: string;
  issuingBody: string | null;
  referenceCode: string | null;
  issuedOn: string | null;
  expiresOn: string | null;
  documentUrl: string | null;
  verifiedAt: string | null;
  expiryState: 'expired' | 'expiring_soon' | 'valid' | 'no_expiry';
}

const tone: Record<string, string> = {
  expired: 'bg-red-100 text-red-800',
  expiring_soon: 'bg-amber-100 text-amber-800',
  valid: 'bg-green-100 text-green-800',
  no_expiry: 'bg-gray-100 text-gray-600',
};

const Certifications: React.FC = () => {
  const [rows, setRows] = React.useState<Certification[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [creating, setCreating] = React.useState(false);
  const [form, setForm] = React.useState({
    name: '', issuingBody: '', referenceCode: '', issuedOn: '', expiresOn: '',
  });

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/api/ops/certifications');
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
    setCreating(true);
    setError(null);
    try {
      await apiClient.post('/api/ops/certifications', {
        name: form.name.trim(),
        issuingBody: form.issuingBody.trim() || undefined,
        referenceCode: form.referenceCode.trim() || undefined,
        issuedOn: form.issuedOn || undefined,
        expiresOn: form.expiresOn || undefined,
      });
      setForm({ name: '', issuingBody: '', referenceCode: '', issuedOn: '', expiresOn: '' });
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Could not add the certification');
    } finally {
      setCreating(false);
    }
  };

  const expired = rows.filter((r) => r.expiryState === 'expired').length;
  const soon = rows.filter((r) => r.expiryState === 'expiring_soon').length;

  return (
    <Shell
      title="Certifications"
      subtitle="Your organisation's credentials and when they lapse"
      loading={loading}
      error={error}
    >
      {/* Adding a certification.

          POST /api/ops/certifications existed; nothing called it. The screen
          tracked expiries for records it gave you no way to enter, and the
          Shell's empty gate hid the whole body while there were none — so the
          state that needed the form was the state without it. */}
      <section className="rounded-lg border border-gray-200 bg-white p-4 mb-6">
        <h2 className="font-medium text-gray-900 mb-1">Add a certification</h2>
        <p className="text-xs text-gray-500 mb-3">
          An expiry date is what makes this useful — leave it blank only for a qualification
          that does not lapse.
        </p>
        <div className="flex flex-wrap gap-2 items-start">
          <input className="rounded border border-gray-300 px-3 py-2 text-sm" placeholder="e.g. Wilderness First Aid"
            value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="rounded border border-gray-300 px-3 py-2 text-sm" placeholder="Issued by"
            value={form.issuingBody} onChange={(e) => setForm({ ...form, issuingBody: e.target.value })} />
          <input className="rounded border border-gray-300 px-3 py-2 text-sm w-40" placeholder="Reference no."
            value={form.referenceCode} onChange={(e) => setForm({ ...form, referenceCode: e.target.value })} />
          <input type="date" title="Issued on" className="rounded border border-gray-300 px-3 py-2 text-sm"
            value={form.issuedOn} onChange={(e) => setForm({ ...form, issuedOn: e.target.value })} />
          <input type="date" title="Expires on" className="rounded border border-gray-300 px-3 py-2 text-sm"
            value={form.expiresOn} onChange={(e) => setForm({ ...form, expiresOn: e.target.value })} />
          <button onClick={create} disabled={creating || !form.name.trim()}
            className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40">
            Add certification
          </button>
        </div>
      </section>

      {rows.length === 0 && (
        <div className="py-12 text-center text-gray-500 text-sm">
          Nothing recorded yet. Add the qualifications your leaders hold — first aid,
          mountaineering, licences — so expiries can be tracked.
        </div>
      )}

      <div className="grid grid-cols-3 gap-3 mb-6">
        <StatTile label="Certifications" value={String(rows.length)} />
        <StatTile label="Expired" value={String(expired)} hint={expired > 0 ? 'needs attention' : undefined} />
        <StatTile label="Expiring soon" value={String(soon)} hint="within 30 days" />
      </div>

      <Table head={['Certification', 'Issued by', 'Reference', 'Expires', 'State', '']}>
        {rows.map((c) => (
          <tr key={c.id} className="hover:bg-gray-50">
            <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
            <td className="px-4 py-3 text-gray-600">{c.issuingBody ?? '—'}</td>
            <td className="px-4 py-3 text-gray-600">{c.referenceCode ?? '—'}</td>
            <td className="px-4 py-3 whitespace-nowrap">
              {c.expiresOn ? new Date(c.expiresOn).toLocaleDateString('en-IN') : '—'}
            </td>
            <td className="px-4 py-3">
              <span
                className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                  tone[c.expiryState] ?? tone.no_expiry
                }`}
              >
                {c.expiryState.replace(/_/g, ' ')}
              </span>
            </td>
            <td className="px-4 py-3">
              {c.documentUrl && (
                <a
                  href={c.documentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-green-700 hover:underline"
                >
                  View
                </a>
              )}
            </td>
          </tr>
        ))}
      </Table>
    </Shell>
  );
};

export default Certifications;
