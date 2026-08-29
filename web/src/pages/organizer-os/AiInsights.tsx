import React from 'react';
import { Shell, StatTile, Table, inr } from './analyticsShared';
import { useAnalytics } from './analyticsShared';
import { useAiStatus, NotConfigured } from './aiShared';

// What the AI has cost, and what it declined to cost.
//
// This is the screen the first provider invoice gets reconciled against, so it
// shows attempts that never reached a provider as prominently as the ones that
// did. A month of heavy cache use should read as a month of heavy cache use,
// not as a month where the provider mysteriously charged nothing.
//
// Token columns are blank rather than zero for cache hits and refusals. Zero
// would say "we called and were charged nothing"; blank says "there was no
// call", and reconciliation depends on telling those apart.

interface SpendRow {
  period: string;
  provider: string | null;
  attempts: number;
  providerCalls: number;
  cacheHits: number;
  refused: number;
  failed: number;
  promptTokens: number | null;
  completionTokens: number | null;
  costPaise: number;
}

const AiInsights: React.FC = () => {
  const { status } = useAiStatus();
  const { data, error, loading } = useAnalytics<SpendRow[]>('/api/ai-studio/spend');
  const rows = data ?? [];

  const total = rows.reduce(
    (acc, r) => ({
      attempts: acc.attempts + r.attempts,
      calls: acc.calls + r.providerCalls,
      cached: acc.cached + r.cacheHits,
      refused: acc.refused + r.refused,
      cost: acc.cost + r.costPaise,
    }),
    { attempts: 0, calls: 0, cached: 0, refused: 0, cost: 0 }
  );

  const savedByCache =
    total.attempts > 0 ? Math.round((total.cached / total.attempts) * 100) : 0;

  return (
    <Shell
      title="AI insights"
      subtitle="What was spent, what was cached, and what was refused before spending"
      loading={loading}
      error={error}
    >
      {status && <NotConfigured status={status} />}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatTile label="Spent" value={inr(total.cost / 100)} />
        <StatTile label="Provider calls" value={String(total.calls)} />
        <StatTile
          label="Served from cache"
          value={String(total.cached)}
          hint={total.attempts > 0 ? `${savedByCache}% of attempts` : undefined}
        />
        <StatTile
          label="Refused"
          value={String(total.refused)}
          hint="before any spend"
        />
      </div>

      {rows.length === 0 ? (
        <div className="py-12 text-center text-gray-500 text-sm">
          Nothing has been generated yet, so nothing has been spent.
        </div>
      ) : (
        <Table
          head={['Month', 'Provider', 'Calls', 'Cached', 'Refused', 'Failed', 'Tokens', 'Cost']}
        >
          {rows.map((r) => (
            <tr key={`${r.period}-${r.provider ?? 'none'}`} className="hover:bg-gray-50">
              <td className="px-4 py-3 font-medium text-gray-900">{r.period}</td>
              <td className="px-4 py-3 text-gray-600">{r.provider ?? '—'}</td>
              <td className="px-4 py-3 tabular-nums">{r.providerCalls}</td>
              <td className="px-4 py-3 tabular-nums text-green-700">{r.cacheHits}</td>
              <td className="px-4 py-3 tabular-nums text-amber-700">{r.refused}</td>
              <td className="px-4 py-3 tabular-nums text-gray-500">{r.failed}</td>
              <td className="px-4 py-3 tabular-nums">
                {r.promptTokens === null && r.completionTokens === null ? (
                  <span className="text-gray-400" title="No provider call was made">
                    —
                  </span>
                ) : (
                  (r.promptTokens ?? 0) + (r.completionTokens ?? 0)
                )}
              </td>
              <td className="px-4 py-3 tabular-nums font-medium">{inr(r.costPaise / 100)}</td>
            </tr>
          ))}
        </Table>
      )}

      <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4 text-xs text-gray-600">
        A dash in the tokens column means no provider call was made — a cache hit or a refusal.
        It is deliberately not a zero: zero would claim a call happened and cost nothing, and
        the first provider invoice is reconciled against exactly this distinction.
      </div>
    </Shell>
  );
};

export default AiInsights;
