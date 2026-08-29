import React from 'react';
import { apiClient } from '../../services/apiClient';

// Shared pieces for the three AI screens.
//
// All three have the same first problem: no provider is configured, so nothing
// generates. That state is not an error and should not look like one — it is
// the system correctly declining to spend money it was never told it could.
// So it gets one honest banner, written once, rather than three screens each
// inventing their own way to say it.

export interface AiStatus {
  provider: string | null;
  quota: {
    monthlyRequestLimit: number;
    monthlyTokenLimit: number | null;
    requestsUsed: number;
    tokensUsed: number;
    periodMonth: string;
  } | null;
  canGenerate: boolean;
  blockedBecause: string | null;
}

export function useAiStatus() {
  const [status, setStatus] = React.useState<AiStatus | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const reload = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/api/ai-studio/status');
      setStatus(res.data);
      setError(null);
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Request failed');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    reload();
  }, [reload]);

  return { status, loading, error, reload };
}

/**
 * The "nothing is configured" banner.
 *
 * Deliberately not red. Nothing has gone wrong — a guard is doing its job, and
 * dressing that as a failure teaches people to click past guards.
 */
export const NotConfigured: React.FC<{ status: AiStatus }> = ({ status }) => {
  if (status.canGenerate) return null;

  const isProvider = status.provider === null;

  return (
    <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 px-5 py-4 text-blue-900">
      <div className="font-medium">
        {isProvider ? 'No AI provider is configured' : 'No monthly quota is set'}
      </div>
      <p className="text-sm mt-2">{status.blockedBecause}</p>
      <p className="text-sm mt-2">
        {isProvider ? (
          <>
            Everything around the model is already built and tested — the quota check, the
            cache, the draft-then-accept split, and the rule that sends refunds and disputes to
            a person whatever a model concludes. Only the provider itself is missing, and until
            one is chosen nothing here can spend anything.
          </>
        ) : (
          <>
            A missing quota is not an unlimited one. Set a monthly limit below and generation
            turns on.
          </>
        )}
      </p>
    </div>
  );
};

export const QuotaMeter: React.FC<{ status: AiStatus }> = ({ status }) => {
  if (!status.quota) return null;
  const q = status.quota;
  const pct = q.monthlyRequestLimit > 0
    ? Math.min(100, (q.requestsUsed / q.monthlyRequestLimit) * 100)
    : 0;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 mb-6">
      <div className="flex justify-between text-sm mb-2">
        <span className="text-gray-700">This month ({q.periodMonth})</span>
        <span className="tabular-nums text-gray-900">
          {q.requestsUsed} / {q.monthlyRequestLimit} generations
        </span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        <div
          className={'h-full ' + (pct >= 100 ? 'bg-amber-500' : 'bg-green-500')}
          style={{ width: `${pct}%` }}
        />
      </div>
      {q.monthlyTokenLimit !== null && (
        <div className="text-xs text-gray-500 mt-2 tabular-nums">
          {q.tokensUsed} / {q.monthlyTokenLimit} tokens
        </div>
      )}
      <p className="text-xs text-gray-500 mt-2">
        Checked before the provider is called, never after — a limit checked afterwards has
        already spent what it was meant to save.
      </p>
    </div>
  );
};

export const QuotaForm: React.FC<{ onSaved: () => void }> = ({ onSaved }) => {
  const [requests, setRequests] = React.useState('');
  const [tokens, setTokens] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await apiClient.put('/api/ai-studio/quota', {
        monthlyRequestLimit: Number(requests),
        monthlyTokenLimit: tokens === '' ? null : Number(tokens),
      });
      onSaved();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Could not save the quota');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 mb-6">
      <div className="font-medium text-gray-900 mb-3 text-sm">Monthly limit</div>
      {error && <div className="text-sm text-red-700 mb-2">{error}</div>}
      <div className="flex flex-wrap gap-3 items-end">
        <label className="text-xs text-gray-600">
          Generations
          <input
            type="number"
            min="0"
            value={requests}
            onChange={(e) => setRequests(e.target.value)}
            className="block rounded border border-gray-300 px-2 py-1.5 text-sm w-32"
          />
        </label>
        <label className="text-xs text-gray-600">
          Tokens (optional)
          <input
            type="number"
            min="0"
            value={tokens}
            onChange={(e) => setTokens(e.target.value)}
            className="block rounded border border-gray-300 px-2 py-1.5 text-sm w-40"
          />
        </label>
        <button
          onClick={save}
          disabled={busy || requests === ''}
          className="rounded bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700 disabled:opacity-50"
        >
          Save limit
        </button>
      </div>
    </div>
  );
};
