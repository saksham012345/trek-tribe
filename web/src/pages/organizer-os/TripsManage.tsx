import React from 'react';
import { apiClient } from '../../services/apiClient';
import { Shell, StatTile, Table, inr, pct } from './analyticsShared';

// The organizer's own trip list — distinct from Trips.tsx, which is the public
// browse page. This one shows draft and scheduled trips, which the public page
// must never show, and carries the lifecycle actions.
//
// fillPct and confirmedSeats come from the API derived from bookings. They are
// deliberately not stored on the trip: a stored counter is a second source of
// truth that drifts the first time a booking is cancelled by a path that
// forgets to decrement it.

interface Trip {
  id: string;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  capacity: number;
  price: number;
  publicationStatus: 'draft' | 'scheduled' | 'published' | 'archived';
  publishAt: string | null;
  effectiveStatus: string;
  sellState: 'not_for_sale' | 'on_sale' | 'sold_out' | 'closed';
  confirmedSeats: number;
  fillPct: number;
  duplicatedFromTripId: string | null;
}

const statusTone: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  scheduled: 'bg-amber-100 text-amber-800',
  published: 'bg-green-100 text-green-800',
  running: 'bg-blue-100 text-blue-800',
  archived: 'bg-gray-100 text-gray-500',
  cancelled: 'bg-red-100 text-red-700',
  completed: 'bg-gray-100 text-gray-600',
};

const sellTone: Record<string, string> = {
  on_sale: 'text-green-700',
  sold_out: 'text-amber-700',
  closed: 'text-gray-500',
  not_for_sale: 'text-gray-400',
};

const Badge: React.FC<{ label: string; tone: string }> = ({ label, tone }) => (
  <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${tone}`}>{label}</span>
);

const TripsManage: React.FC = () => {
  const [trips, setTrips] = React.useState<Trip[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/trips?mine=true&includeUnpublished=true');
      setTrips(Array.isArray(res.data) ? res.data : res.data?.trips ?? []);
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Request failed');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const act = async (id: string, fn: () => Promise<unknown>) => {
    setBusyId(id);
    setError(null);
    try {
      await fn();
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Action failed');
    } finally {
      setBusyId(null);
    }
  };

  const publish = (t: Trip) =>
    act(t.id, () =>
      apiClient.post(`/trips/${t.id}/publication`, { publicationStatus: 'published' })
    );

  const unpublish = (t: Trip) =>
    act(t.id, () => apiClient.post(`/trips/${t.id}/publication`, { publicationStatus: 'draft' }));

  const duplicate = (t: Trip) => act(t.id, () => apiClient.post(`/trips/${t.id}/duplicate`));

  const live = trips.filter((t) => t.effectiveStatus === 'published' || t.effectiveStatus === 'running');
  const seats = trips.reduce((s, t) => s + t.confirmedSeats, 0);
  const capacity = trips.reduce((s, t) => s + t.capacity, 0);

  return (
    <Shell
      title="Trips"
      subtitle="Your trips, including drafts the public cannot see"
      loading={loading}
      error={error}
      empty={trips.length === 0}
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatTile label="Trips" value={String(trips.length)} />
        <StatTile label="Live" value={String(live.length)} hint="visible to the public" />
        <StatTile label="Seats sold" value={String(seats)} hint={`of ${capacity} offered`} />
        <StatTile
          label="Overall fill"
          value={capacity > 0 ? pct((seats / capacity) * 100) : '—'}
        />
      </div>

      <Table head={['Trip', 'Starts', 'Status', 'Selling', 'Seats', 'Fill', 'Price', '']}>
        {trips.map((t) => (
          <tr key={t.id} className="hover:bg-gray-50">
            <td className="px-4 py-3">
              <div className="font-medium text-gray-900">{t.title}</div>
              <div className="text-xs text-gray-500">
                {t.destination}
                {t.duplicatedFromTripId && ' · duplicate'}
              </div>
            </td>
            <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
              {new Date(t.startDate).toLocaleDateString('en-IN')}
            </td>
            <td className="px-4 py-3">
              <Badge
                label={t.effectiveStatus}
                tone={statusTone[t.effectiveStatus] ?? 'bg-gray-100 text-gray-700'}
              />
              {t.effectiveStatus === 'scheduled' && t.publishAt && (
                <div className="text-xs text-gray-500 mt-1">
                  goes live {new Date(t.publishAt).toLocaleString('en-IN')}
                </div>
              )}
            </td>
            <td className={`px-4 py-3 text-xs ${sellTone[t.sellState] ?? ''}`}>
              {t.sellState.replace(/_/g, ' ')}
            </td>
            <td className="px-4 py-3 tabular-nums">
              {t.confirmedSeats}/{t.capacity}
            </td>
            <td className="px-4 py-3 tabular-nums">{pct(t.fillPct)}</td>
            <td className="px-4 py-3 tabular-nums">{inr(t.price)}</td>
            <td className="px-4 py-3 whitespace-nowrap">
              <div className="flex gap-2">
                {t.publicationStatus === 'published' ? (
                  <button
                    onClick={() => unpublish(t)}
                    disabled={busyId === t.id}
                    className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-50"
                  >
                    Unpublish
                  </button>
                ) : (
                  <button
                    onClick={() => publish(t)}
                    disabled={busyId === t.id}
                    className="text-xs px-2 py-1 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    Publish
                  </button>
                )}
                <button
                  onClick={() => duplicate(t)}
                  disabled={busyId === t.id}
                  className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-50"
                >
                  Duplicate
                </button>
              </div>
            </td>
          </tr>
        ))}
      </Table>

      <p className="text-xs text-gray-500 mt-4">
        A duplicate is created as a draft at 0% fill and inherits no bookings, reviews or
        verification from the original.
      </p>
    </Shell>
  );
};

export default TripsManage;
