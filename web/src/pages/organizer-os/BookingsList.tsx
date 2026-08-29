import React from 'react';
import { useAnalytics, Shell, StatTile, Table, inr } from './analyticsShared';

// Bookings across every trip.
//
// The amount shown is the booking's own finalAmount, which was locked when it
// was made. It is deliberately not the trip's current price: those are
// different numbers the moment an organizer edits a price, and showing the
// current one against an old booking is how a customer gets told they owe
// something they never agreed to.

interface Booking {
  _id?: string;
  id?: string;
  tripTitle?: string;
  tripId?: string;
  numberOfGuests: number;
  finalAmount?: number;
  totalAmount?: number;
  paidAmount?: number;
  bookingStatus: string;
  paymentStatus: string;
  createdAt: string;
}

const bookingTone: Record<string, string> = {
  confirmed: 'bg-green-100 text-green-800',
  completed: 'bg-blue-100 text-blue-800',
  pending: 'bg-amber-100 text-amber-800',
  cancelled: 'bg-red-100 text-red-700',
};

const payTone: Record<string, string> = {
  completed: 'text-green-700',
  partial: 'text-amber-700',
  pending: 'text-gray-500',
  failed: 'text-red-600',
  refunded: 'text-gray-500',
};

const BookingsList: React.FC = () => {
  const { data, error, loading } = useAnalytics<any>('/bookings');
  const rows: Booking[] = Array.isArray(data) ? data : data?.bookings ?? [];

  const seats = rows.reduce((s, r) => s + (r.numberOfGuests ?? 0), 0);
  const value = rows.reduce((s, r) => s + (r.finalAmount ?? r.totalAmount ?? 0), 0);
  const paid = rows.reduce((s, r) => s + (r.paidAmount ?? 0), 0);

  return (
    <Shell
      title="Bookings"
      subtitle="Every booking across your trips"
      loading={loading}
      error={error}
      empty={rows.length === 0}
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatTile label="Bookings" value={String(rows.length)} />
        <StatTile label="Seats" value={String(seats)} hint="guests, not rows" />
        <StatTile label="Booked value" value={inr(value)} />
        <StatTile
          label="Received"
          value={inr(paid)}
          hint={value > paid ? `${inr(value - paid)} outstanding` : undefined}
        />
      </div>

      <Table head={['Trip', 'Guests', 'Value', 'Paid', 'Booking', 'Payment', 'Made']}>
        {rows.map((b) => {
          const id = b._id ?? b.id ?? '';
          const amount = b.finalAmount ?? b.totalAmount ?? 0;
          return (
            <tr key={id} className="hover:bg-gray-50">
              <td className="px-4 py-3">
                <div className="font-medium text-gray-900">{b.tripTitle ?? '—'}</div>
                <div className="text-xs text-gray-400 font-mono">{id.slice(0, 10)}…</div>
              </td>
              <td className="px-4 py-3 tabular-nums">{b.numberOfGuests}</td>
              <td className="px-4 py-3 tabular-nums">{inr(amount)}</td>
              <td className="px-4 py-3 tabular-nums">{inr(b.paidAmount ?? 0)}</td>
              <td className="px-4 py-3">
                <span
                  className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                    bookingTone[b.bookingStatus] ?? 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {b.bookingStatus}
                </span>
              </td>
              <td className={`px-4 py-3 text-xs ${payTone[b.paymentStatus] ?? ''}`}>
                {b.paymentStatus}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-gray-500 text-xs">
                {b.createdAt ? new Date(b.createdAt).toLocaleDateString('en-IN') : '—'}
              </td>
            </tr>
          );
        })}
      </Table>

      <p className="text-xs text-gray-500 mt-4">
        Amounts are what each booking locked in when it was made, not the trip's current price.
        Changing a trip's price never changes a booking that already exists.
      </p>
    </Shell>
  );
};

export default BookingsList;
