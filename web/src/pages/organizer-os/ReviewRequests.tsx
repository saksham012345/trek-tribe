import React from 'react';
import { apiClient } from '../../services/apiClient';
import { Shell, StatTile, Table } from './analyticsShared';

// Who was asked for a review, and who answered.
//
// Asking is idempotent on the booking: pressing the button again does not send
// a second first-email, it records a reminder against the one request that
// exists. The database holds that with a unique index, so it stays true even
// when two tabs are open.
//
// "Waiting" versus "answered" is the presence of a review id, not a status
// somebody set. A request cannot claim to be answered while unable to say by
// what.

interface ReviewRequest {
  id: string;
  bookingId: string;
  tripId: string;
  sentAt: string;
  remindedAt: string | null;
  reminderCount: number;
  reviewId: string | null;
  respondedAt: string | null;
  state: 'waiting' | 'answered';
}

const ReviewRequests: React.FC = () => {
  const [rows, setRows] = React.useState<ReviewRequest[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [bookingId, setBookingId] = React.useState('');

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/api/marketing/review-requests');
      setRows(res.data ?? []);
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Request failed');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const ask = async (id: string) => {
    setBusy(id);
    setError(null);
    try {
      await apiClient.post('/api/marketing/review-requests', { bookingId: id });
      setBookingId('');
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Could not send the request');
    } finally {
      setBusy(null);
    }
  };

  const answered = rows.filter((r) => r.state === 'answered').length;
  const rate = rows.length > 0 ? Math.round((answered / rows.length) * 100) : 0;

  return (
    <Shell
      title="Review requests"
      subtitle="Who was asked, and who wrote back"
      loading={loading}
      error={error}
    >
      <div className="grid grid-cols-3 gap-3 mb-6">
        <StatTile label="Asked" value={String(rows.length)} />
        <StatTile label="Answered" value={String(answered)} />
        <StatTile label="Response rate" value={`${rate}%`} />
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 mb-6">
        <div className="font-medium text-gray-900 mb-3 text-sm">Ask for a review</div>
        <div className="flex flex-wrap gap-3 items-center">
          <input
            placeholder="Booking id"
            value={bookingId}
            onChange={(e) => setBookingId(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1.5 text-sm font-mono w-72"
          />
          <button
            onClick={() => ask(bookingId)}
            disabled={busy !== null || !bookingId.trim()}
            className="rounded bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700 disabled:opacity-50"
          >
            Send
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Asking twice does not send a second first-email — it records a reminder against the
          request that already exists.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="py-12 text-center text-gray-500 text-sm">Nobody has been asked yet.</div>
      ) : (
        <Table head={['Booking', 'Asked', 'Reminders', 'Answered', 'State', '']}>
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 font-mono text-xs text-gray-600">
                {r.bookingId.slice(0, 12)}…
              </td>
              <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">
                {new Date(r.sentAt).toLocaleDateString('en-IN')}
              </td>
              <td className="px-4 py-3 tabular-nums">
                {r.reminderCount}
                {r.remindedAt && (
                  <div className="text-xs text-gray-400">
                    {new Date(r.remindedAt).toLocaleDateString('en-IN')}
                  </div>
                )}
              </td>
              <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">
                {r.respondedAt ? new Date(r.respondedAt).toLocaleDateString('en-IN') : '—'}
              </td>
              <td className="px-4 py-3">
                <span
                  className={
                    'inline-block rounded px-2 py-0.5 text-xs font-medium ' +
                    (r.state === 'answered'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-700')
                  }
                >
                  {r.state}
                </span>
              </td>
              <td className="px-4 py-3">
                {r.state === 'waiting' && (
                  <button
                    onClick={() => ask(r.bookingId)}
                    disabled={busy === r.bookingId}
                    className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-50"
                  >
                    Remind
                  </button>
                )}
              </td>
            </tr>
          ))}
        </Table>
      )}
    </Shell>
  );
};

export default ReviewRequests;
