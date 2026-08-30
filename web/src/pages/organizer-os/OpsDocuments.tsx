import React from 'react';
import { apiClient } from '../../services/apiClient';
import { Shell, StatTile, Table } from './analyticsShared';

// A document belongs to exactly one of a trip, a booking or a participant. The
// database enforces it with a CHECK; the form below offers one subject picker
// rather than three checkboxes, so the invalid states are not reachable from
// here in the first place.

type Subject = 'trip' | 'booking' | 'participant';

interface Doc {
  id: string;
  title: string;
  category: string | null;
  fileUrl: string;
  fileName: string | null;
  tripId: string | null;
  bookingId: string | null;
  participantId: string | null;
  createdAt: string;
}

const subjectOf = (d: Doc): { kind: Subject; id: string } => {
  if (d.tripId) return { kind: 'trip', id: d.tripId };
  if (d.bookingId) return { kind: 'booking', id: d.bookingId };
  return { kind: 'participant', id: d.participantId ?? '' };
};

const OpsDocuments: React.FC = () => {
  const [docs, setDocs] = React.useState<Doc[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const [form, setForm] = React.useState({
    title: '',
    fileUrl: '',
    category: '',
    subject: 'trip' as Subject,
    subjectId: '',
  });

  // The organizer's own trips, so a document can be attached by picking one.
  const [trips, setTrips] = React.useState<{ id: string; title: string }[]>([]);
  React.useEffect(() => {
    apiClient.get('/trips/mine').then((r) => setTrips(r.data ?? [])).catch(() => {});
  }, []);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/api/ops/documents');
      setDocs(res.data ?? []);
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Request failed');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    if (!form.title || !form.fileUrl || !form.subjectId) return;
    setBusy(true);
    setError(null);
    try {
      // Exactly one subject key is sent. The other two are absent, not null,
      // which is what the CHECK on the table is counting.
      const key =
        form.subject === 'trip' ? 'tripId' : form.subject === 'booking' ? 'bookingId' : 'participantId';
      await apiClient.post('/api/ops/documents', {
        title: form.title,
        fileUrl: form.fileUrl,
        category: form.category || undefined,
        [key]: form.subjectId,
      });
      setForm({ title: '', fileUrl: '', category: '', subject: 'trip', subjectId: '' });
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Could not add document');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (d: Doc) => {
    setBusy(true);
    setError(null);
    try {
      await apiClient.delete(`/api/ops/documents/${d.id}`);
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Could not delete');
    } finally {
      setBusy(false);
    }
  };

  const byKind = (k: Subject) => docs.filter((d) => subjectOf(d).kind === k).length;

  return (
    <Shell title="Documents" subtitle="Files attached to a trip, a booking or a person" loading={loading} error={error}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatTile label="Documents" value={String(docs.length)} />
        <StatTile label="On trips" value={String(byKind('trip'))} />
        <StatTile label="On bookings" value={String(byKind('booking'))} />
        <StatTile label="On people" value={String(byKind('participant'))} />
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 mb-6">
        <div className="font-medium text-gray-900 mb-3 text-sm">Add a document</div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <input
            placeholder="Title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
          <input
            placeholder="File URL"
            value={form.fileUrl}
            onChange={(e) => setForm({ ...form, fileUrl: e.target.value })}
            className="rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
          <input
            placeholder="Category (optional)"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
          <select
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value as Subject })}
            className="rounded border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="trip">Belongs to a trip</option>
            <option value="booking">Belongs to a booking</option>
            <option value="participant">Belongs to a person</option>
          </select>
          {/* Pick the trip; do not ask anyone to type a uuid.

              This was a text box labelled "trip id", and Add stayed disabled
              until something was in it — so attaching a document meant finding a
              trip's uuid somewhere else and pasting it in. Bookings and people
              keep the box for now: there is no list endpoint here to fill a
              picker from, and inventing one is a larger change than this. */}
          {form.subject === 'trip' ? (
            <select
              value={form.subjectId}
              onChange={(e) => setForm({ ...form, subjectId: e.target.value })}
              className="rounded border border-gray-300 px-2 py-1.5 text-sm"
            >
              <option value="">Which trip?</option>
              {trips.map((tr) => (
                <option key={tr.id} value={tr.id}>
                  {tr.title}
                </option>
              ))}
            </select>
          ) : (
            <input
              placeholder={`${form.subject} id`}
              value={form.subjectId}
              onChange={(e) => setForm({ ...form, subjectId: e.target.value })}
              className="rounded border border-gray-300 px-2 py-1.5 text-sm"
            />
          )}
        </div>
        <button
          onClick={add}
          disabled={busy || !form.title || !form.fileUrl || !form.subjectId}
          className="mt-3 rounded bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700 disabled:opacity-50"
        >
          Add
        </button>
        <p className="text-xs text-gray-500 mt-2">
          {!form.title || !form.fileUrl || !form.subjectId ? (
            <span className="text-amber-700">
              Still needed:{' '}
              {[!form.title && 'a title', !form.fileUrl && 'a file URL', !form.subjectId && `a ${form.subject}`]
                .filter(Boolean)
                .join(', ')}
              .{' '}
            </span>
          ) : null}
          A document belongs to exactly one subject — the database refuses anything else.
        </p>
      </div>

      {docs.length === 0 ? (
        <div className="py-12 text-center text-gray-500 text-sm">No documents yet.</div>
      ) : (
        <Table head={['Title', 'Category', 'Belongs to', 'Added', '']}>
          {docs.map((d) => {
            const s = subjectOf(d);
            return (
              <tr key={d.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <a
                    href={d.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-green-700 hover:underline"
                  >
                    {d.title}
                  </a>
                  {d.fileName && <div className="text-xs text-gray-500">{d.fileName}</div>}
                </td>
                <td className="px-4 py-3 text-gray-600">{d.category ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className="text-xs rounded bg-gray-100 px-2 py-0.5 text-gray-700">{s.kind}</span>
                  <div className="text-xs text-gray-400 mt-0.5 font-mono">{s.id.slice(0, 8)}…</div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-gray-500">
                  {new Date(d.createdAt).toLocaleDateString('en-IN')}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => remove(d)}
                    disabled={busy}
                    className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            );
          })}
        </Table>
      )}
    </Shell>
  );
};

export default OpsDocuments;
