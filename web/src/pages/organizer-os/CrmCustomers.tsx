import React from 'react';
import { useAnalytics, Shell, StatTile, Table, inr } from './analyticsShared';

// The customer list, built from bookings rather than from a customer table.
//
// Anyone who has booked is a customer, whether or not somebody got around to
// creating a profile for them. Those rows are the point of this screen, not an
// edge case — a list that quietly dropped them would look complete and be
// wrong, and nobody would notice because the missing rows leave no gap.
//
// So a customer with no profile appears with whatever the booking knows, and is
// labelled rather than hidden.

interface Customer {
  customerId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  profileMissing: boolean;
  bookings: number;
  seats: number;
  lifetimeSpend: number;
  firstBookedAt: string;
  lastBookedAt: string;
}

const CrmCustomers: React.FC = () => {
  const { data, error, loading } = useAnalytics<Customer[]>('/api/marketing/customers');
  const rows = data ?? [];

  const withoutProfile = rows.filter((r) => r.profileMissing).length;
  const spend = rows.reduce((s, r) => s + r.lifetimeSpend, 0);

  return (
    <Shell
      title="Customers"
      subtitle="Everyone who has booked — derived from bookings, not a separate list"
      loading={loading}
      error={error}
      empty={rows.length === 0}
      emptyMessage="No customers yet. Someone becomes a customer here once their first booking is confirmed."
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatTile label="Customers" value={String(rows.length)} />
        <StatTile
          label="Without a profile"
          value={String(withoutProfile)}
          hint={withoutProfile > 0 ? 'still listed' : undefined}
        />
        <StatTile label="Seats sold" value={String(rows.reduce((s, r) => s + r.seats, 0))} />
        <StatTile label="Lifetime spend" value={inr(spend)} />
      </div>

      <Table head={['Customer', 'Bookings', 'Seats', 'Lifetime spend', 'First', 'Last']}>
        {rows.map((r) => (
          <tr key={r.customerId} className="hover:bg-gray-50">
            <td className="px-4 py-3">
              {r.profileMissing ? (
                <>
                  <span className="font-mono text-xs text-gray-600">
                    {r.customerId.slice(0, 12)}…
                  </span>
                  <div className="text-xs text-amber-700 mt-0.5">
                    no profile — known only from their bookings
                  </div>
                </>
              ) : (
                <>
                  <div className="font-medium text-gray-900">{r.name ?? '—'}</div>
                  <div className="text-xs text-gray-500">{r.email ?? r.phone ?? ''}</div>
                </>
              )}
            </td>
            <td className="px-4 py-3 tabular-nums">{r.bookings}</td>
            <td className="px-4 py-3 tabular-nums">{r.seats}</td>
            <td className="px-4 py-3 tabular-nums font-medium">{inr(r.lifetimeSpend)}</td>
            <td className="px-4 py-3 whitespace-nowrap text-gray-500">
              {new Date(r.firstBookedAt).toLocaleDateString('en-IN')}
            </td>
            <td className="px-4 py-3 whitespace-nowrap text-gray-500">
              {new Date(r.lastBookedAt).toLocaleDateString('en-IN')}
            </td>
          </tr>
        ))}
      </Table>

      <p className="text-xs text-gray-500 mt-4">
        Seats come from the bookings themselves — a group booking of four counts as four.
      </p>
    </Shell>
  );
};

export default CrmCustomers;
