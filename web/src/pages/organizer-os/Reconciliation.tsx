import React from 'react';
import { useAnalytics, Shell, StatTile, Table, inr } from './analyticsShared';

// Every flag on this screen is computed at request time from current data. The
// API stores nothing and there is no "mark as reconciled" — deliberately. A
// stored flag is a claim about the past that nothing re-checks, which is how a
// reconciliation dashboard ends up green while the money is wrong.
//
// So the honest thing for this screen to say is when it last looked, not that
// something "is" fine.

interface Flag {
  kind: string;
  severity: 'error' | 'warning';
  reference: string;
  detail: string;
  amountPaise?: number;
}

interface Report {
  window: { from: string; to: string };
  checked: { orders: number; transfers: number; ledgerEntries: number; refunds: number };
  flags: Flag[];
  clean: boolean;
}

// Amounts from this API are paise. Converting here rather than in inr() keeps
// the rupee/paise boundary in one visible place per screen.
const rupees = (paise?: number) => inr((paise ?? 0) / 100);

const kindLabel: Record<string, string> = {
  split_does_not_sum: 'Split does not add up',
  paid_order_without_transfer: 'Paid, never passed on',
  transfer_without_ledger_entry: 'Transfer not credited',
  ledger_credit_without_transfer: 'Credit without a transfer',
  commission_rate_drifted: 'Commission rate drifted',
  refund_exceeds_order: 'Refunds exceed the order',
};

const Reconciliation: React.FC = () => {
  const { data, error, loading } = useAnalytics<Report>('/api/finance/reconciliation');
  const flags = data?.flags ?? [];
  const errors = flags.filter((f) => f.severity === 'error');
  const warnings = flags.filter((f) => f.severity === 'warning');

  return (
    <Shell
      title="Reconciliation"
      subtitle="Recomputed from current records every time this page loads"
      loading={loading}
      error={error}
    >
      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <StatTile label="Orders checked" value={String(data.checked.orders)} />
            <StatTile label="Transfers" value={String(data.checked.transfers)} />
            <StatTile label="Ledger entries" value={String(data.checked.ledgerEntries)} />
            <StatTile label="Refunds" value={String(data.checked.refunds)} />
          </div>

          <div
            className={
              'mb-6 rounded border px-4 py-3 ' +
              (errors.length > 0
                ? 'border-red-200 bg-red-50 text-red-800'
                : warnings.length > 0
                ? 'border-amber-200 bg-amber-50 text-amber-800'
                : 'border-green-200 bg-green-50 text-green-800')
            }
          >
            <div className="font-medium">
              {errors.length > 0
                ? `${errors.length} thing${errors.length === 1 ? '' : 's'} to fix`
                : warnings.length > 0
                ? `${warnings.length} thing${warnings.length === 1 ? '' : 's'} worth a look`
                : 'Everything agreed when this page loaded'}
            </div>
            <div className="text-sm mt-1">
              {new Date(data.window.from).toLocaleDateString('en-IN')} —{' '}
              {new Date(data.window.to).toLocaleDateString('en-IN')}. Nothing here is stored;
              reload to check again.
            </div>
          </div>
        </>
      )}

      {flags.length > 0 && (
        <Table head={['Problem', 'Reference', 'Amount', 'What it means']}>
          {flags.map((f, i) => (
            <tr key={`${f.reference}-${i}`} className="hover:bg-gray-50">
              <td className="px-4 py-3">
                <span
                  className={
                    'inline-block rounded px-2 py-0.5 text-xs font-medium ' +
                    (f.severity === 'error'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-amber-100 text-amber-800')
                  }
                >
                  {kindLabel[f.kind] ?? f.kind}
                </span>
              </td>
              <td className="px-4 py-3 font-mono text-xs text-gray-600">{f.reference}</td>
              <td className="px-4 py-3 tabular-nums whitespace-nowrap">
                {f.amountPaise === undefined ? '—' : rupees(f.amountPaise)}
              </td>
              <td className="px-4 py-3 text-gray-700">{f.detail}</td>
            </tr>
          ))}
        </Table>
      )}
    </Shell>
  );
};

export default Reconciliation;
