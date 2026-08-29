import React from 'react';
import { apiClient } from '../../services/apiClient';
import { Shell, StatTile } from './analyticsShared';
import OrganizerNav from './OrganizerNav';

// Account settings, plus the one place that answers "what can I actually reach
// right now, and why not the rest".
//
// The payout and scope readouts are live, not decorative. Both come from the
// same endpoints the real screens use, so if this page says payouts are on hold
// it is because the server says so, not because a flag was copied here.

interface Readiness {
  state: 'ready' | 'kyc_blocked' | 'not_onboarded';
  reason: string;
}

interface Scope {
  unrestricted: boolean;
  tripIds: string[];
}

const Section: React.FC<{ title: string; children: React.ReactNode; note?: string }> = ({
  title,
  children,
  note,
}) => (
  <section className="rounded-lg border border-gray-200 bg-white p-5 mb-5">
    <h2 className="font-medium text-gray-900 mb-1">{title}</h2>
    {note && <p className="text-xs text-gray-500 mb-3">{note}</p>}
    <div className="mt-3">{children}</div>
  </section>
);

const OrganizerSettings: React.FC = () => {
  const [readiness, setReadiness] = React.useState<Readiness | null>(null);
  const [scope, setScope] = React.useState<Scope | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    Promise.all([
      apiClient.get('/api/finance/payout-readiness').then((r) => r.data).catch(() => null),
      apiClient.get('/api/team/my-scope').then((r) => r.data).catch(() => null),
    ])
      .then(([p, s]) => {
        if (!alive) return;
        setReadiness(p);
        setScope(s);
      })
      .catch((e: any) => alive && setError(e?.message ?? 'Request failed'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <Shell title="Settings" subtitle="Your account, and what it can reach" loading={loading} error={error}>
      <Section
        title="Payouts"
        note="Read live from the payout service — this is the same answer the Payouts screen gives."
      >
        {readiness ? (
          <div className="flex items-start gap-3">
            <span
              className={
                'inline-block rounded px-2 py-0.5 text-xs font-medium ' +
                (readiness.state === 'ready'
                  ? 'bg-green-100 text-green-800'
                  : readiness.state === 'kyc_blocked'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-gray-100 text-gray-700')
              }
            >
              {readiness.state === 'kyc_blocked' ? 'on hold' : readiness.state.replace(/_/g, ' ')}
            </span>
            <span className="text-sm text-gray-700">{readiness.reason}</span>
          </div>
        ) : (
          <p className="text-sm text-gray-500">Could not read payout status.</p>
        )}
      </Section>

      <Section
        title="What you can see"
        note="Rebuilt from your assignments on every request. There is no cached copy of this."
      >
        {scope ? (
          scope.unrestricted ? (
            <p className="text-sm text-gray-700">
              All trips. You are the organizer, an owner, a manager or an admin.
            </p>
          ) : (
            <p className="text-sm text-gray-700">
              {scope.tripIds.length === 0 ? (
                <span className="text-amber-800">
                  No trips are assigned to you, so trip data returns nothing — including
                  direct API requests, not only the screens.
                </span>
              ) : (
                <>
                  {scope.tripIds.length} trip{scope.tripIds.length === 1 ? '' : 's'} assigned to
                  you. Everything else returns nothing.
                </>
              )}
            </p>
          )
        ) : (
          <p className="text-sm text-gray-500">Could not read your scope.</p>
        )}
      </Section>

      <Section
        title="Everything else"
        note="Every organizer screen. Greyed items are blocked, and hovering says on what."
      >
        <OrganizerNav />
      </Section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-6">
        <StatTile
          label="Bank & KYC"
          value={readiness?.state === 'ready' ? 'Connected' : 'Needs attention'}
        />
        <StatTile label="Billing" value="Subscriptions" hint="manage under Money" />
        <StatTile
          label="Access"
          value={scope?.unrestricted ? 'Full' : `${scope?.tripIds.length ?? 0} trips`}
        />
      </div>
    </Shell>
  );
};

export default OrganizerSettings;
