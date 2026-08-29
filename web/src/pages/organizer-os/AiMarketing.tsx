import React from 'react';
import { apiClient } from '../../services/apiClient';
import { Shell, StatTile } from './analyticsShared';
import { useAiStatus, NotConfigured, QuotaMeter } from './aiShared';

// Marketing copy and campaign subjects.
//
// These are shareable features: the cache key is hashed without the organizer,
// so two operators asking for copy about the same public trip get the same
// answer and it is generated once. Insights are the opposite and live on their
// own screen for that reason — they are computed over an organizer's own
// bookings, and a shared cache there would hand one operator another's numbers.
//
// Worth stating on the screen, because "your text may be identical to a
// competitor's" is a real consequence of a decision made for cost.

interface Draft {
  id: string;
  feature: string;
  content: string;
  createdAt: string;
}

interface Outcome {
  status: string;
  content: string | null;
  message: string | null;
  refusalCode: string | null;
  cached: boolean;
}

const AiMarketing: React.FC = () => {
  const { status, loading, error, reload } = useAiStatus();
  const [drafts, setDrafts] = React.useState<Draft[]>([]);
  const [feature, setFeature] = React.useState('marketing_copy');
  const [brief, setBrief] = React.useState('');
  const [outcome, setOutcome] = React.useState<Outcome | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const loadDrafts = React.useCallback(async () => {
    try {
      const res = await apiClient.get('/api/ai-studio/drafts');
      setDrafts(
        (res.data ?? []).filter((d: Draft) =>
          ['marketing_copy', 'campaign_subject'].includes(d.feature)
        )
      );
    } catch {
      /* the banner already explains an unconfigured system */
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
      });
      setOutcome(res.data);
      await loadDrafts();
      await reload();
    } catch (e: any) {
      setActionError(e?.response?.data?.error || 'Could not generate');
    } finally {
      setBusy(false);
    }
  };

  const discard = async (id: string) => {
    setBusy(true);
    try {
      await apiClient.post(`/api/ai-studio/drafts/${id}/discard`);
      await loadDrafts();
    } catch (e: any) {
      setActionError(e?.response?.data?.error || 'Could not discard');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell
      title="AI marketing"
      subtitle="Copy and subject lines, drafted for you to edit"
      loading={loading}
      error={error ?? actionError}
    >
      {status && <NotConfigured status={status} />}
      {status?.quota && <QuotaMeter status={status} />}

      <section className="rounded-lg border border-gray-200 bg-white p-5 mb-6">
        <div className="flex flex-wrap gap-3 items-end mb-3">
          <select
            value={feature}
            onChange={(e) => setFeature(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="marketing_copy">Marketing copy</option>
            <option value="campaign_subject">Campaign subject line</option>
          </select>
        </div>
        <textarea
          placeholder="What are you promoting?"
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
          Draft it
        </button>
      </section>

      {outcome && (
        <div
          className={
            'mb-6 rounded-lg border px-5 py-4 ' +
            (outcome.status === 'refused'
              ? 'border-amber-200 bg-amber-50 text-amber-900'
              : 'border-green-200 bg-green-50 text-green-900')
          }
        >
          <div className="font-medium">
            {outcome.status === 'refused'
              ? 'Refused before anything was spent'
              : outcome.cached
              ? 'Served from cache — no tokens used'
              : 'Draft created'}
          </div>
          {outcome.message && <p className="text-sm mt-2">{outcome.message}</p>}
        </div>
      )}

      <div className="grid grid-cols-3 gap-3 mb-6">
        <StatTile label="Drafts" value={String(drafts.length)} />
        <StatTile label="Provider" value={status?.provider ?? 'none'} />
        <StatTile label="Cache" value="Shared" hint="copy is not organizer-specific" />
      </div>

      {drafts.length === 0 ? (
        <div className="py-10 text-center text-gray-500 text-sm">No marketing drafts yet.</div>
      ) : (
        <div className="space-y-3">
          {drafts.map((d) => (
            <div key={d.id} className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs rounded bg-gray-100 px-2 py-0.5 text-gray-700">
                  {d.feature.replace(/_/g, ' ')}
                </span>
                <span className="text-xs text-gray-400">
                  {new Date(d.createdAt).toLocaleString('en-IN')}
                </span>
              </div>
              <p className="text-sm text-gray-800 whitespace-pre-wrap mb-3">{d.content}</p>
              <button
                onClick={() => discard(d.id)}
                disabled={busy}
                className="text-xs px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-50"
              >
                Discard
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-500 mt-6">
        Marketing copy is cached across organizers, so the same brief costs one generation
        rather than many. The trade is real and worth knowing: another operator asking the same
        thing can receive the same words. Anything derived from your own bookings is never
        shared this way — that is what the insights screen uses.
      </p>
    </Shell>
  );
};

export default AiMarketing;
