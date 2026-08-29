import React from 'react';
import { useAnalytics, Shell, StatTile, Table, pct } from './analyticsShared';

// Occupancy reads v_occupancy_by_trip, which sums seats rather than booking
// rows. The seats/bookings split is shown side by side on purpose: when they
// differ, that is group bookings working correctly, not a discrepancy.

interface OccupancyRow {
  tripId: string;
  title: string;
  destination: string;
  startDate: string;
  status: string;
  capacity: number;
  seatsBooked: number;
  seatsRemaining: number;
  bookingCount: number;
  fillRatePct: number;
}

const AnalyticsOccupancy: React.FC = () => {
  const { data, error, loading } = useAnalytics<OccupancyRow[]>('/api/analytics/occupancy');
  const rows = data ?? [];

  const totalCapacity = rows.reduce((s, r) => s + r.capacity, 0);
  const totalSeats = rows.reduce((s, r) => s + r.seatsBooked, 0);
  const totalBookings = rows.reduce((s, r) => s + r.bookingCount, 0);

  return (
    <Shell
      title="Occupancy"
      subtitle="Seats sold against capacity, per trip"
      loading={loading}
      error={error}
      empty={rows.length === 0}
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatTile label="Trips" value={String(rows.length)} />
        <StatTile label="Capacity" value={String(totalCapacity)} hint="total seats offered" />
        <StatTile
          label="Seats booked"
          value={String(totalSeats)}
          hint={`across ${totalBookings} bookings`}
        />
        <StatTile
          label="Overall fill"
          value={totalCapacity > 0 ? pct((totalSeats / totalCapacity) * 100) : '—'}
        />
      </div>

      <Table
        head={['Trip', 'Destination', 'Starts', 'Status', 'Capacity', 'Seats', 'Bookings', 'Left', 'Fill']}
      >
        {rows.map((r) => (
          <tr key={r.tripId} className="hover:bg-gray-50">
            <td className="px-4 py-3 font-medium text-gray-900">{r.title}</td>
            <td className="px-4 py-3 text-gray-600">{r.destination}</td>
            <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
              {new Date(r.startDate).toLocaleDateString('en-IN')}
            </td>
            <td className="px-4 py-3 text-gray-600">{r.status}</td>
            <td className="px-4 py-3 tabular-nums">{r.capacity}</td>
            <td className="px-4 py-3 tabular-nums font-medium">{r.seatsBooked}</td>
            <td className="px-4 py-3 tabular-nums text-gray-500">{r.bookingCount}</td>
            <td className="px-4 py-3 tabular-nums">{r.seatsRemaining}</td>
            <td className="px-4 py-3 tabular-nums">{pct(r.fillRatePct)}</td>
          </tr>
        ))}
      </Table>
    </Shell>
  );
};

export default AnalyticsOccupancy;
