import React from 'react';
import { useAnalytics, Shell, StatTile, Table, inr, pct } from './analyticsShared';

// Revenue here is money received, not booked value. Both columns are shown so
// the gap between them - confirmed bookings that have not paid - stays visible
// rather than being averaged away into a single "revenue" figure.

interface Trip {
  tripId: string;
  title: string;
  destination: string;
  startDate: string;
  status: string;
  bookedValue: number;
  revenueReceived: number;
  discountsGiven: number;
  seatsSold: number;
  totalExpenses: number;
  netProfit: number;
  marginPct: number;
}

interface Payload {
  trips: Trip[];
  totals: {
    bookedValue: number;
    revenueReceived: number;
    totalExpenses: number;
    netProfit: number;
  };
}

const AnalyticsProfitability: React.FC = () => {
  const { data, error, loading } = useAnalytics<Payload>('/api/analytics/profitability');
  const trips = data?.trips ?? [];
  const t = data?.totals;

  return (
    <Shell
      title="Profitability"
      subtitle="Revenue received less recorded expenses, per trip"
      loading={loading}
      error={error}
      empty={trips.length === 0}
    >
      {t && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatTile label="Booked value" value={inr(t.bookedValue)} hint="incl. unpaid" />
          <StatTile label="Revenue received" value={inr(t.revenueReceived)} />
          <StatTile label="Expenses" value={inr(t.totalExpenses)} />
          <StatTile
            label="Net profit"
            value={inr(t.netProfit)}
            hint={
              t.revenueReceived > 0
                ? pct((t.netProfit / t.revenueReceived) * 100) + ' margin'
                : undefined
            }
          />
        </div>
      )}

      <Table
        head={['Trip', 'Starts', 'Seats', 'Booked', 'Received', 'Discounts', 'Expenses', 'Net', 'Margin']}
      >
        {trips.map((r) => (
          <tr key={r.tripId} className="hover:bg-gray-50">
            <td className="px-4 py-3 font-medium text-gray-900">{r.title}</td>
            <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
              {new Date(r.startDate).toLocaleDateString('en-IN')}
            </td>
            <td className="px-4 py-3 tabular-nums">{r.seatsSold}</td>
            <td className="px-4 py-3 tabular-nums text-gray-500">{inr(r.bookedValue)}</td>
            <td className="px-4 py-3 tabular-nums">{inr(r.revenueReceived)}</td>
            <td className="px-4 py-3 tabular-nums text-gray-500">{inr(r.discountsGiven)}</td>
            <td className="px-4 py-3 tabular-nums">{inr(r.totalExpenses)}</td>
            <td
              className={
                'px-4 py-3 tabular-nums font-medium ' +
                (r.netProfit < 0 ? 'text-red-600' : 'text-gray-900')
              }
            >
              {inr(r.netProfit)}
            </td>
            <td className="px-4 py-3 tabular-nums">{pct(r.marginPct)}</td>
          </tr>
        ))}
      </Table>
    </Shell>
  );
};

export default AnalyticsProfitability;
