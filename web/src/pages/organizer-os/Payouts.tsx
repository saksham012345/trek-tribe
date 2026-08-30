import React from 'react';
import { useAnalytics, Shell, StatTile } from './analyticsShared';

// The sprint gate asks that kyc_blocked stay visually distinct from failed.
//
// They are different problems with different fixes. A blocked payout is waiting
// on the organizer's own paperwork and they can act on it themselves; a failed
// one is waiting on a retry and they cannot. Showing both in the same red
// "payout failed" banner sends someone to support when the answer was a form.
//
// So the two states get different colours, different words, and different
// instructions — and the blocked one gets a link to the thing that unblocks it.

interface Readiness {
  state: 'ready' | 'kyc_blocked' | 'not_onboarded';
  reason: string;
}

const presentation: Record<
  Readiness['state'],
  { tone: string; heading: string; whatNow: string }
> = {
  ready: {
    tone: 'border-green-200 bg-green-50 text-green-900',
    heading: 'Payouts are running',
    whatNow: 'Money reaches your account on the usual schedule. Nothing to do.',
  },
  kyc_blocked: {
    // Amber, not red. Nothing has gone wrong — something is unfinished, and it
    // is the organizer who can finish it.
    tone: 'border-amber-200 bg-amber-50 text-amber-900',
    heading: 'Payouts are on hold until your KYC is approved',
    whatNow:
      'This is not a failure and nothing has been lost. Bookings keep working and the money is held, not returned. Finish or correct your KYC details and payouts resume automatically.',
  },
  not_onboarded: {
    tone: 'border-gray-200 bg-gray-50 text-gray-800',
    heading: 'No payout account connected',
    whatNow:
      'Connect a bank account to start receiving payouts. Money from bookings is held until then.',
  },
};

const Payouts: React.FC = () => {
  const { data, error, loading } = useAnalytics<Readiness>('/api/finance/payout-readiness');
  const view = data ? presentation[data.state] : null;

  return (
    <Shell
      title="Payouts"
      subtitle="Whether money can reach your account, and why not if it cannot"
      loading={loading}
      error={error}
    >
      {data && view && (
        <>
          <div className={`rounded-lg border px-5 py-4 mb-6 ${view.tone}`}>
            <div className="font-medium text-base">{view.heading}</div>
            <div className="text-sm mt-2">{data.reason}</div>
            <div className="text-sm mt-3">{view.whatNow}</div>

            {data.state === 'kyc_blocked' && (
              <a
                href="/organizer/bank-details"
                className="inline-block mt-4 rounded bg-amber-600 px-3 py-1.5 text-sm text-white hover:bg-amber-700"
              >
                Go to KYC details
              </a>
            )}
            {data.state === 'not_onboarded' && (
              <a
                href="/organizer/bank-details"
                className="inline-block mt-4 rounded bg-gray-800 px-3 py-1.5 text-sm text-white hover:bg-gray-900"
              >
                Connect a bank account
              </a>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <StatTile
              label="Status"
              value={data.state === 'kyc_blocked' ? 'On hold' : data.state === 'ready' ? 'Running' : 'Not set up'}
              hint={data.state === 'kyc_blocked' ? 'not a failure' : undefined}
            />
            <StatTile label="Bookings" value="Unaffected" hint="customers can still book" />
            <StatTile
              label="Your money"
              value={data.state === 'ready' ? 'Being paid out' : 'Held, not lost'}
            />
          </div>

          <p className="text-xs text-gray-500 mt-6">
            A payout that is <span className="font-medium">on hold</span> is waiting on your
            details. A payout that <span className="font-medium">failed</span> is a separate
            problem on our side and is retried without you doing anything — the two are never
            shown as the same thing.
          </p>
        </>
      )}
    </Shell>
  );
};

export default Payouts;
