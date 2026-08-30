import React from 'react';
import { apiClient } from '../../services/apiClient';
import { Shell, StatTile, Table, inr } from './analyticsShared';

// Templates live in their own table, not as flagged trips, so they cannot
// appear in any query that reads trips — that is the sprint gate "templates
// never appear as trips", held by there being no row to find rather than by
// every listing query remembering to filter.
//
// Creating a trip from a template produces a draft, like a duplicate does. A
// template is a starting point, not a publish button.

interface Template {
  id: string;
  name: string;
  title: string;
  destination: string | null;
  difficulty: string;
  capacity: number | null;
  price: string | number | null;
  durationDays: number | null;
  timesUsed: number;
  lastUsedAt: string | null;
}

const TripTemplates: React.FC = () => {
  const [templates, setTemplates] = React.useState<Template[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [useFor, setUseFor] = React.useState<Template | null>(null);
  const [dates, setDates] = React.useState({ startDate: '', endDate: '' });

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/trips/templates/list');
      setTemplates(res.data ?? []);
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Request failed');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const remove = async (t: Template) => {
    setBusyId(t.id);
    setError(null);
    try {
      await apiClient.delete(`/trips/templates/${t.id}`);
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Delete failed');
    } finally {
      setBusyId(null);
    }
  };

  const createTrip = async () => {
    if (!useFor || !dates.startDate || !dates.endDate) return;
    setBusyId(useFor.id);
    setError(null);
    try {
      await apiClient.post(`/trips/templates/${useFor.id}/create-trip`, dates);
      setUseFor(null);
      setDates({ startDate: '', endDate: '' });
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Could not create trip');
    } finally {
      setBusyId(null);
    }
  };

  const totalUses = templates.reduce((s, t) => s + t.timesUsed, 0);

  return (
    <Shell
      title="Trip templates"
      subtitle="Reusable starting points — never listed as trips themselves"
      loading={loading}
      error={error}
      empty={templates.length === 0}
      emptyMessage="No templates yet. A template is a trip you save to start from next time — create one from any trip you have already set up."
    >
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        <StatTile label="Templates" value={String(templates.length)} />
        <StatTile label="Trips created" value={String(totalUses)} hint="from templates" />
        <StatTile
          label="Most used"
          value={
            templates.length > 0
              ? [...templates].sort((a, b) => b.timesUsed - a.timesUsed)[0].name
              : '—'
          }
        />
      </div>

      {useFor && (
        <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div className="font-medium text-gray-900 mb-2">
            New trip from “{useFor.name}”
          </div>
          <p className="text-xs text-gray-500 mb-3">
            The trip is created as a draft. Nothing is public until you publish it.
          </p>
          <div className="flex flex-wrap gap-3 items-end">
            <label className="text-sm">
              <span className="block text-xs text-gray-600 mb-1">Starts</span>
              <input
                type="date"
                value={dates.startDate}
                onChange={(e) => setDates({ ...dates, startDate: e.target.value })}
                className="rounded border border-gray-300 px-2 py-1"
              />
            </label>
            <label className="text-sm">
              <span className="block text-xs text-gray-600 mb-1">Ends</span>
              <input
                type="date"
                value={dates.endDate}
                onChange={(e) => setDates({ ...dates, endDate: e.target.value })}
                className="rounded border border-gray-300 px-2 py-1"
              />
            </label>
            <button
              onClick={createTrip}
              disabled={!dates.startDate || !dates.endDate || busyId === useFor.id}
              className="rounded bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700 disabled:opacity-50"
            >
              Create draft
            </button>
            <button
              onClick={() => setUseFor(null)}
              className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <Table head={['Template', 'Destination', 'Difficulty', 'Days', 'Capacity', 'Price', 'Used', '']}>
        {templates.map((t) => (
          <tr key={t.id} className="hover:bg-gray-50">
            <td className="px-4 py-3">
              <div className="font-medium text-gray-900">{t.name}</div>
              <div className="text-xs text-gray-500">{t.title}</div>
            </td>
            <td className="px-4 py-3 text-gray-600">{t.destination ?? '—'}</td>
            <td className="px-4 py-3 text-gray-600">{t.difficulty}</td>
            <td className="px-4 py-3 tabular-nums">{t.durationDays ?? '—'}</td>
            <td className="px-4 py-3 tabular-nums">{t.capacity ?? '—'}</td>
            <td className="px-4 py-3 tabular-nums">
              {t.price === null ? '—' : inr(Number(t.price))}
            </td>
            <td className="px-4 py-3 tabular-nums">
              {t.timesUsed}
              {t.lastUsedAt && (
                <div className="text-xs text-gray-400">
                  {new Date(t.lastUsedAt).toLocaleDateString('en-IN')}
                </div>
              )}
            </td>
            <td className="px-4 py-3 whitespace-nowrap">
              <div className="flex gap-2">
                <button
                  onClick={() => setUseFor(t)}
                  disabled={busyId === t.id}
                  className="text-xs px-2 py-1 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                >
                  Use
                </button>
                <button
                  onClick={() => remove(t)}
                  disabled={busyId === t.id}
                  className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </td>
          </tr>
        ))}
      </Table>

      <p className="text-xs text-gray-500 mt-4">
        Deleting a template leaves trips created from it standing — the link is cleared, the
        trips are not touched.
      </p>
    </Shell>
  );
};

export default TripTemplates;
