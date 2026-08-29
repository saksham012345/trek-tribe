import React from 'react';
import { useAnalytics, Shell, StatTile, Table, inr } from './analyticsShared';

// Money in and out per month, read from the payout ledger. The ledger is
// uniquely keyed per (source, reference, type), so an event a webhook delivered
// twice appears once here.
//
// Amounts arrive as paise. The conversion happens once, at the top of this file,
// rather than scattered through the JSX where one missed division shows a figure
// a hundred times too large and looks plausible.

interface Bucket {
  period: string;
  inflowPaise: number;
  outflowPaise: number;
  netPaise: number;
}

interface Report {
  buckets: Bucket[];
  totals: { inflowPaise: number; outflowPaise: number; netPaise: number };
}

const rupees = (paise: number) => inr(paise / 100);

const monthLabel = (period: string) => {
  const [y, m] = period.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-IN', {
    month: 'short',
    year: 'numeric',
  });
};

const CashFlow: React.FC = () => {
  const { data, error, loading } = useAnalytics<Report>('/api/finance/cash-flow');
  const buckets = data?.buckets ?? [];
  const t = data?.totals;

  // Bars are scaled against the largest single month in either direction, so
  // inflow and outflow stay comparable to each other rather than each being
  // scaled to its own maximum.
  const peak = Math.max(1, ...buckets.map((b) => Math.max(b.inflowPaise, b.outflowPaise)));

  return (
    <Shell
      title="Cash flow"
      subtitle="What came in and what went out, by month"
      loading={loading}
      error={error}
      empty={buckets.length === 0}
    >
      {t && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <StatTile label="In" value={rupees(t.inflowPaise)} />
          <StatTile label="Out" value={rupees(t.outflowPaise)} />
          <StatTile
            label="Net"
            value={rupees(t.netPaise)}
            hint={t.netPaise < 0 ? 'more went out than came in' : undefined}
          />
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white p-4 mb-6">
        <div className="space-y-3">
          {buckets.map((b) => (
            <div key={b.period}>
              <div className="flex justify-between text-xs text-gray-600 mb-1">
                <span>{monthLabel(b.period)}</span>
                <span className={b.netPaise < 0 ? 'text-red-600' : 'text-gray-700'}>
                  {rupees(b.netPaise)}
                </span>
              </div>
              <div className="flex gap-1 h-4">
                <div className="flex-1 bg-gray-100 rounded-sm overflow-hidden">
                  <div
                    className="h-full bg-green-500"
                    style={{ width: `${(b.inflowPaise / peak) * 100}%` }}
                    title={`In ${rupees(b.inflowPaise)}`}
                  />
                </div>
                <div className="flex-1 bg-gray-100 rounded-sm overflow-hidden">
                  <div
                    className="h-full bg-amber-500"
                    style={{ width: `${(b.outflowPaise / peak) * 100}%` }}
                    title={`Out ${rupees(b.outflowPaise)}`}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-4 mt-4 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 bg-green-500 rounded-sm" /> in
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 bg-amber-500 rounded-sm" /> out
          </span>
        </div>
      </div>

      <Table head={['Month', 'In', 'Out', 'Net']}>
        {buckets.map((b) => (
          <tr key={b.period} className="hover:bg-gray-50">
            <td className="px-4 py-3 font-medium text-gray-900">{monthLabel(b.period)}</td>
            <td className="px-4 py-3 tabular-nums">{rupees(b.inflowPaise)}</td>
            <td className="px-4 py-3 tabular-nums">{rupees(b.outflowPaise)}</td>
            <td
              className={
                'px-4 py-3 tabular-nums font-medium ' +
                (b.netPaise < 0 ? 'text-red-600' : 'text-gray-900')
              }
            >
              {rupees(b.netPaise)}
            </td>
          </tr>
        ))}
      </Table>
    </Shell>
  );
};

export default CashFlow;
