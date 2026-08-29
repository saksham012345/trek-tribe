import React from 'react';
import { useAnalytics, Shell, StatTile, Table, pct } from './analyticsShared';

interface Source {
  source: string;
  totalLeads: number;
  convertedLeads: number;
  lostLeads: number;
  openLeads: number;
  conversionRatePct: number;
}

interface Payload {
  sources: Source[];
  totals: { totalLeads: number; convertedLeads: number; conversionRatePct: number };
}

const AnalyticsMarketing: React.FC = () => {
  const { data, error, loading } = useAnalytics<Payload>('/api/analytics/marketing');
  const sources = data?.sources ?? [];
  const t = data?.totals;

  return (
    <Shell
      title="Marketing performance"
      subtitle="Lead volume and conversion, by source"
      loading={loading}
      error={error}
      empty={sources.length === 0}
    >
      {t && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <StatTile label="Leads" value={String(t.totalLeads)} />
          <StatTile label="Converted" value={String(t.convertedLeads)} />
          <StatTile label="Conversion" value={pct(t.conversionRatePct)} />
        </div>
      )}

      <Table head={['Source', 'Leads', 'Open', 'Converted', 'Lost', 'Conversion']}>
        {sources.map((r) => (
          <tr key={r.source} className="hover:bg-gray-50">
            <td className="px-4 py-3 font-medium text-gray-900">{r.source}</td>
            <td className="px-4 py-3 tabular-nums">{r.totalLeads}</td>
            <td className="px-4 py-3 tabular-nums text-gray-500">{r.openLeads}</td>
            <td className="px-4 py-3 tabular-nums">{r.convertedLeads}</td>
            <td className="px-4 py-3 tabular-nums text-gray-500">{r.lostLeads}</td>
            <td className="px-4 py-3 tabular-nums">{pct(r.conversionRatePct)}</td>
          </tr>
        ))}
      </Table>
    </Shell>
  );
};

export default AnalyticsMarketing;
