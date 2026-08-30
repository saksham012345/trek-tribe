import React from 'react';
import { apiClient } from '../../services/apiClient';
import { Shell, StatTile } from './analyticsShared';

// Which trips each leader can reach.
//
// The screen states the rule it is operating under, in plain words, because the
// consequence of getting it wrong is invisible: a leader with no assignments
// sees nothing, and a leader assigned to everything sees everything, and both
// look like "a list" from here. Saying "sees nothing" out loud is the only way
// an empty row reads as a decision rather than an oversight.
//
// Nothing on this screen decides access. The server rebuilds the scope from
// these rows on every request, so unticking a box removes the access in the
// same moment, with no cache to expire and no token to reissue.

interface Member {
  id: string;
  userId: string;
  role: 'owner' | 'manager' | 'trip_leader' | 'viewer';
  status: string;
  assignments: { tripId: string }[];
}

interface Trip {
  id: string;
  title: string;
  destination: string;
  startDate: string;
  effectiveStatus: string;
}

const Leaders: React.FC = () => {
  const [members, setMembers] = React.useState<Member[]>([]);
  const [trips, setTrips] = React.useState<Trip[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [t, tr] = await Promise.all([
        apiClient.get('/api/team'),
        apiClient.get('/trips/mine'),
      ]);
      setMembers(t.data ?? []);
      setTrips(tr.data ?? []);
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Request failed');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const leaders = members.filter((m) => m.role === 'trip_leader' && m.status === 'active');
  const current = leaders.find((l) => l.id === selected) ?? leaders[0] ?? null;

  const toggle = async (leader: Member, tripId: string, assigned: boolean) => {
    setBusy(tripId);
    setError(null);
    try {
      if (assigned) {
        await apiClient.delete(`/api/team/members/${leader.id}/trips/${tripId}`);
      } else {
        await apiClient.post(`/api/team/members/${leader.id}/trips`, { tripId });
      }
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Could not change the assignment');
    } finally {
      setBusy(null);
    }
  };

  const unassignedLeaders = leaders.filter((l) => l.assignments.length === 0).length;

  return (
    <Shell
      title="Trip leaders"
      subtitle="Each leader sees only the trips ticked here"
      loading={loading}
      error={error}
      empty={leaders.length === 0}
      emptyMessage="No trip leaders yet. Invite someone as a trip leader on the Team screen first, then assign them trips here."
    >
      <div className="grid grid-cols-3 gap-3 mb-6">
        <StatTile label="Trip leaders" value={String(leaders.length)} />
        <StatTile
          label="With nothing assigned"
          value={String(unassignedLeaders)}
          hint={unassignedLeaders > 0 ? 'they see nothing' : undefined}
        />
        <StatTile label="Trips" value={String(trips.length)} />
      </div>

      {leaders.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {leaders.map((l) => (
            <button
              key={l.id}
              onClick={() => setSelected(l.id)}
              className={
                'rounded px-3 py-1.5 text-sm border ' +
                (current?.id === l.id
                  ? 'border-green-600 bg-green-50 text-green-800 font-medium'
                  : 'border-gray-300 text-gray-600 hover:bg-gray-50')
              }
            >
              {l.userId.slice(0, 10)}…
              <span className="ml-2 text-xs text-gray-500">{l.assignments.length}</span>
            </button>
          ))}
        </div>
      )}

      {current && (
        <>
          <div
            className={
              'mb-4 rounded border px-4 py-3 text-sm ' +
              (current.assignments.length === 0
                ? 'border-amber-200 bg-amber-50 text-amber-900'
                : 'border-gray-200 bg-gray-50 text-gray-700')
            }
          >
            {current.assignments.length === 0 ? (
              <>
                <span className="font-medium">This leader currently sees nothing.</span> That is
                what no assignments means — not "everything", not "the defaults". Tick a trip to
                give access.
              </>
            ) : (
              <>
                This leader can reach{' '}
                <span className="font-medium">
                  {current.assignments.length} of {trips.length}
                </span>{' '}
                trips. Everything else returns nothing for them, including direct API requests.
              </>
            )}
          </div>

          <div className="rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
            {trips.map((t) => {
              const assigned = current.assignments.some((a) => a.tripId === t.id);
              return (
                <label
                  key={t.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={assigned}
                    disabled={busy === t.id}
                    onChange={() => toggle(current, t.id, assigned)}
                    className="h-4 w-4 rounded border-gray-300 text-green-600"
                  />
                  <span className="flex-1">
                    <span className="font-medium text-gray-900">{t.title}</span>
                    <span className="block text-xs text-gray-500">
                      {t.destination} · {new Date(t.startDate).toLocaleDateString('en-IN')} ·{' '}
                      {t.effectiveStatus}
                    </span>
                  </span>
                  {assigned && (
                    <span className="text-xs text-green-700 font-medium">can see</span>
                  )}
                </label>
              );
            })}
          </div>

          <p className="text-xs text-gray-500 mt-4">
            Access is rebuilt from these rows on every request — there is no cached list and no
            token carrying an old one. Untick a trip and it is gone for them immediately.
          </p>
        </>
      )}
    </Shell>
  );
};

export default Leaders;
