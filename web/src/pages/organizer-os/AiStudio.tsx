import React from 'react';
import { apiClient } from '../../services/apiClient';
import { Shell, StatTile } from './analyticsShared';
import { useAiStatus, NotConfigured, QuotaMeter, QuotaForm } from './aiShared';

// Generate a draft, then decide.
//
// Generating writes a draft row and does not touch the trip. Accepting is what
// mutates, and it goes through the ordinary trip update — same ownership check,
// same validation, same audit trail as a human edit.
//
// That split is why a bad generation costs nothing. It is a row somebody can
// ignore, not an edit somebody has to undo.

interface Draft {
  id: string;
  feature: string;
  tripId: string | null;
  content: string;
  createdAt: string;
}

interface Outcome {
  status: 'cache_hit' | 'completed' | 'refused' | 'failed';
  draftId: string | null;
  content: string | null;
  refusalCode: string | null;
  message: string | null;
  cached: boolean;
}

const FEATURES = [
  { key: 'trip_description', label: 'Trip description', appliesToTrip: true },
  { key: 'trip_itinerary', label: 'Trip itinerary', appliesToTrip: true },
  { key: 'marketing_copy', label: 'Marketing copy', appliesToTrip: false },
];

const AiStudio: React.FC = () => {
  const { status, loading, error, reload } = useAiStatus();
  const [drafts, setDrafts] = React.useState<Draft[]>([]);
  const [feature, setFeature] = React.useState('trip_description');
  const [brief, setBrief] = React.useState('');
  const [tripId, setTripId] = React.useState('');
  const [outcome, setOutcome] = React.useState<Outcome | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const loadDrafts = React.useCallback(async () => {
    try {
      const res = await apiClient.get('/api/ai-studio/drafts');
      setDrafts(res.data ?? []);
    } catch {
      /* the banner above already explains an unconfigured system */
    }
  }, []);

  React.useEffect(() => {
    loadDrafts();
  }, [loadDrafts]);

  const generate = async () => {
    setBusy(true);
    setActionError(null);
    setOutcome(null);
    try {
      const res = await apiClient.post('/api/ai-studio/generate', {
        feature,
        inputs: { brief },
        tripId: tripId || undefined,
      });
      setOutcome(res.data);
      await loadDrafts();
    } catch (e: any) {
      setActionError(e?.response?.data?.error || 'Could not generate');
    } finally {
      setBusy(false);
    }
  };

  const act = async (id: string, what: 'accept' | 'discard') => {
    setBusy(true);
    setActionError(null);
    try {
      await apiClient.post(`/api/ai-studio/drafts/${id}/${what}`);
      await loadDrafts();
      await reload();
    } catch (e: any) {
      setActionError(e?.response?.data?.error || `Could not ${what} the draft`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell
      title="AI studio"
      subtitle="Generate a draft, then decide whether it becomes real"
      loading={loading}
      error={error ?? actionError}
    >
      {status && <NotConfigured status={status} />}
      {status?.quota ? <QuotaMeter status={status} /> : <QuotaForm onSaved={reload} />}

      <section className="rounded-lg border border-gray-200 bg-white p-5 mb-6">
        <h2 className="font-medium text-gray-900 mb-3">Generate</h2>
        <div className="flex flex-wrap gap-3 items-end mb-3">
          <select
            value={feature}
            onChange={(e) => setFeature(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1.5 text-sm"
          >
            {FEATURES.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </select>
          <input
            placeholder="Trip id (optional)"
            value={tripId}
            onChange={(e) => setTripId(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1.5 text-sm font-mono w-64"
          />
        </div>
        <textarea
          placeholder="What should it say?"
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          rows={3}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm mb-3"
        />
        <button
          onClick={generate}
          disabled={busy || !brief.trim() || !status?.canGenerate}
          className="rounded bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700 disabled:opacity-50"
        >
          Generate a draft
        </button>
        <p className="text-xs text-gray-500 mt-2">
          This writes a draft. Nothing on the trip changes until you accept it.
        </p>
      </section>

      {outcome && (
        <div
          className={
            'mb-6 rounded-lg border px-5 py-4 ' +
            (outcome.status === 'refused'
              ? 'border-amber-200 bg-amber-50 text-amber-900'
              : outcome.status === 'failed'
              ? 'border-red-200 bg-red-50 text-red-900'
              : 'border-green-200 bg-green-50 text-green-900')
          }
        >
          <div className="font-medium">
            {outcome.status === 'refused'
              ? 'Refused before anything was spent'
              : outcome.status === 'failed'
              ? 'The provider did not answer'
              : outcome.cached
              ? 'Served from cache — no tokens used'
              : 'Draft created'}
          </div>
          {outcome.message && <p className="text-sm mt-2">{outcome.message}</p>}
          {outcome.refusalCode && (
            <p className="text-xs mt-2 font-mono opacity-75">{outcome.refusalCode}</p>
          )}
        </div>
      )}

      <div className="grid grid-cols-3 gap-3 mb-6">
        <StatTile label="Open drafts" value={String(drafts.length)} />
        <StatTile label="Provider" value={status?.provider ?? 'none'} />
        <StatTile
          label="Can generate"
          value={status?.canGenerate ? 'yes' : 'no'}
          hint={status?.canGenerate ? undefined : 'nothing is spent'}
        />
      </div>

      <h2 className="text-sm font-medium text-gray-700 mb-2">Drafts waiting on you</h2>
      {drafts.length === 0 ? (
        <div className="py-10 text-center text-gray-500 text-sm">
          No drafts. Nothing has been generated, and nothing has been changed.
        </div>
      ) : (
        <div className="space-y-3">
          {drafts.map((d) => (
            <div key={d.id} className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <span className="text-xs rounded bg-gray-100 px-2 py-0.5 text-gray-700">
                    {d.feature.replace(/_/g, ' ')}
                  </span>
                  {d.tripId && (
                    <span className="ml-2 text-xs text-gray-500 font-mono">
                      {d.tripId.slice(0, 8)}…
                    </span>
                  )}
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(d.createdAt).toLocaleString('en-IN')}
                </span>
              </div>
              <p className="text-sm text-gray-800 whitespace-pre-wrap mb-3">{d.content}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => act(d.id, 'accept')}
                  disabled={busy}
                  className="text-xs px-3 py-1.5 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                >
                  Accept — this edits the trip
                </button>
                <button
                  onClick={() => act(d.id, 'discard')}
                  disabled={busy}
                  className="text-xs px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-50"
                >
                  Discard
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
};

export default AiStudio;
