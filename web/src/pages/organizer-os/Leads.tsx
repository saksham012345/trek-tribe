import React from 'react';
import { useAnalytics, Shell, StatTile, Table } from './analyticsShared';

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
  const { data, error, loading } = useAnalytics<any>('/api/crm/leads');
  const rows: Lead[] = Array.isArray(data) ? data : data?.leads ?? data?.data ?? [];

  const count = (s: string) => rows.filter((r) => r.status === s).length;
  const converted = count('converted');
  const rate = rows.length > 0 ? Math.round((converted / rows.length) * 100) : 0;

  return (
    <Shell
      title="Leads"
      subtitle="People who enquired, and where each one got to"
      loading={loading}
      error={error}
      empty={rows.length === 0}
      emptyMessage="No leads yet. Leads arrive from enquiries and abandoned bookings, and can also be added by hand in the CRM."
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatTile label="Leads" value={String(rows.length)} />
        <StatTile label="Open" value={String(count('new') + count('contacted') + count('interested'))} />
        <StatTile label="Converted" value={String(converted)} />
        <StatTile label="Conversion" value={`${rate}%`} />
      </div>

      <Table head={['Lead', 'Source', 'Status', 'Came in']}>
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
