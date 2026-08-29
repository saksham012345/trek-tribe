import React from 'react';
import { useAnalytics, Shell, StatTile, Table, inr } from './analyticsShared';

// The gate for this screen is a reconciliation: placed revenue plus unplaced
// revenue must equal total lifetime spend, exactly. Trips without coordinates
// cannot be mapped but their money is still real, so they get their own
// section instead of being dropped. The check is rendered rather than trusted.

interface Row {
  destination: string;
  isPlaced: boolean;
  latitude: number | null;
  longitude: number | null;
  customerCount: number;
  bookingCount: number;
  seats: number;
  lifetimeSpend: number;
}

interface Payload {
  placed: Row[];
  unplaced: Row[];
  totals: {
    placedSpend: number;
    unplacedSpend: number;
    totalLifetimeSpend: number;
  };
}

const rowsOf = (rows: Row[]) =>
  rows.map((r) => (
    <tr key={`${r.destination}-${r.isPlaced}`} className="hover:bg-gray-50">
      <td className="px-4 py-3 font-medium text-gray-900">{r.destination}</td>
      <td className="px-4 py-3 tabular-nums">{r.customerCount}</td>
      <td className="px-4 py-3 tabular-nums text-gray-500">{r.bookingCount}</td>
      <td className="px-4 py-3 tabular-nums">{r.seats}</td>
      <td className="px-4 py-3 tabular-nums font-medium">{inr(r.lifetimeSpend)}</td>
    </tr>
  ));

const AnalyticsCustomers: React.FC = () => {
  const { data, error, loading } = useAnalytics<Payload>('/analytics/customers');
  const placed = data?.placed ?? [];
  const unplaced = data?.unplaced ?? [];
  const t = data?.totals;

  // Float addition can drift by fractions of a paisa; anything under a rupee
  // is rounding, anything above it is a real hole in the data.
  const reconciles =
    t !== undefined &&
    Math.abs(t.placedSpend + t.unplacedSpend - t.totalLifetimeSpend) < 1;

  return (
    <Shell
      title="Customers by geography"
      subtitle="Where customers book from, and what they have spent"
      loading={loading}
      error={error}
      empty={placed.length === 0 && unplaced.length === 0}
    >
      {t && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <StatTile label="Placed revenue" value={inr(t.placedSpend)} hint="has coordinates" />
            <StatTile
              label="Unplaced revenue"
              value={inr(t.unplacedSpend)}
              hint="no coordinates on the trip"
            />
            <StatTile label="Total lifetime spend" value={inr(t.totalLifetimeSpend)} />
          </div>

          <div
            className={
              'mb-6 rounded border px-4 py-2 text-sm ' +
              (reconciles
                ? 'border-green-200 bg-green-50 text-green-800'
                : 'border-red-200 bg-red-50 text-red-800')
            }
          >
            {reconciles
              ? 'Reconciled — placed + unplaced equals total lifetime spend.'
              : `Does not reconcile — ${inr(
                  t.placedSpend + t.unplacedSpend
                )} of parts against ${inr(t.totalLifetimeSpend)} total.`}
          </div>
        </>
      )}

      <h2 className="text-sm font-medium text-gray-700 mb-2">Placed on the map</h2>
      <Table head={['Destination', 'Customers', 'Bookings', 'Seats', 'Lifetime spend']}>
        {rowsOf(placed)}
      </Table>

      {unplaced.length > 0 && (
        <>
          <h2 className="text-sm font-medium text-gray-700 mt-6 mb-2">
            Not placed — no coordinates recorded
          </h2>
          <Table head={['Destination', 'Customers', 'Bookings', 'Seats', 'Lifetime spend']}>
            {rowsOf(unplaced)}
          </Table>
        </>
      )}
    </Shell>
  );
};

export default AnalyticsCustomers;
