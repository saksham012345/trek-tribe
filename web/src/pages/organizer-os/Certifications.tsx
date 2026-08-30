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

  React.useEffect(() => {
    let alive = true;
    apiClient
      .get('/api/ops/certifications')
      .then((res) => {
        if (alive) setRows(res.data ?? []);
      })
      .catch((e: any) => {
        if (alive) setError(e?.response?.data?.error || e?.message || 'Request failed');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const expired = rows.filter((r) => r.expiryState === 'expired').length;
  const soon = rows.filter((r) => r.expiryState === 'expiring_soon').length;

  return (
    <Shell
      title="Certifications"
      subtitle="Your organisation's credentials and when they lapse"
      loading={loading}
      error={error}
      empty={rows.length === 0}
      emptyMessage="No certifications recorded. Add the qualifications your leaders hold — first aid, mountaineering, licences — so expiries can be tracked."
    >
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
