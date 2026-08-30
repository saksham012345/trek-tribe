import React from 'react';
import { apiClient } from '../../services/apiClient';
import { Shell, StatTile, Table } from './analyticsShared';

// Team and invites in one screen.
//
// An expired invite offers Resend and nothing else — the gate says an expired
// invite cannot be accepted, only resent, and the surest way to keep that true
// in the UI is to not draw the other button. Resend issues a fresh token rather
// than extending the old one, so a link forwarded months ago stays dead.

interface Member {
  id: string;
  userId: string;
  role: 'owner' | 'manager' | 'trip_leader' | 'viewer';
  status: 'active' | 'suspended' | 'removed';
  joinedAt: string;
  assignments: { tripId: string }[];
}

interface Invite {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  acceptedAt: string | null;
  state: 'pending' | 'expired' | 'accepted';
}

const roleLabel: Record<string, string> = {
  owner: 'Owner',
  manager: 'Manager',
  trip_leader: 'Trip leader',
  viewer: 'Viewer',
};

const inviteTone: Record<string, string> = {
  pending: 'bg-blue-100 text-blue-800',
  expired: 'bg-gray-100 text-gray-600',
  accepted: 'bg-green-100 text-green-800',
};

const Team: React.FC = () => {
  const [members, setMembers] = React.useState<Member[]>([]);
  const [invites, setInvites] = React.useState<Invite[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [form, setForm] = React.useState({ email: '', role: 'viewer' });

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [t, i] = await Promise.all([
        apiClient.get('/api/team'),
        apiClient.get('/api/team/invites'),
      ]);
      setMembers(t.data ?? []);
      setInvites(i.data ?? []);
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Request failed');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  const invite = () =>
    act(async () => {
      await apiClient.post('/api/team/invites', form);
      setForm({ email: '', role: 'viewer' });
    });

  const active = members.filter((m) => m.status === 'active');
  const leaders = active.filter((m) => m.role === 'trip_leader');
  const pending = invites.filter((i) => i.state === 'pending').length;

  return (
    <Shell title="Team" subtitle="Who works with you, and what they can reach" loading={loading} error={error}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatTile label="Members" value={String(active.length)} />
        <StatTile label="Trip leaders" value={String(leaders.length)} />
        <StatTile label="Invites out" value={String(pending)} />
        <StatTile
          label="Expired invites"
          value={String(invites.filter((i) => i.state === 'expired').length)}
          hint="resend to revive"
        />
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 mb-6">
        <div className="font-medium text-gray-900 mb-3 text-sm">Invite someone</div>
        <div className="flex flex-wrap gap-3 items-end">
          <input
            placeholder="their@email.com"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="rounded border border-gray-300 px-2 py-1.5 text-sm min-w-[240px]"
          />
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            className="rounded border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="viewer">Viewer — read only</option>
            <option value="trip_leader">Trip leader — only assigned trips</option>
            <option value="manager">Manager — everything except ownership</option>
          </select>
          <button
            onClick={invite}
            disabled={busy || !form.email.includes('@')}
            className="rounded bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700 disabled:opacity-50"
          >
            Send invite
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Invites last 7 days. A trip leader sees nothing until you assign them trips.
        </p>
      </div>

      <h2 className="text-sm font-medium text-gray-700 mb-2">Members</h2>
      <Table head={['Person', 'Role', 'Trips assigned', 'Joined', '']}>
        {active.map((m) => (
          <tr key={m.id} className="hover:bg-gray-50">
            <td className="px-4 py-3 font-mono text-xs text-gray-600">{m.userId.slice(0, 12)}…</td>
            <td className="px-4 py-3">
              {/* Changing a role, not just reading it.

                  PATCH /api/team/members/:id/role existed and nothing called it,
                  so a viewer stayed a viewer — and only a trip leader can be given
                  trips, which left the assignment screen with nobody to assign to.
                  The owner row is fixed: there is no endpoint to demote yourself
                  and no sensible thing for it to do. */}
              {m.role === 'owner' ? (
                <span className="text-gray-500">{roleLabel[m.role] ?? m.role}</span>
              ) : (
                <select
                  value={m.role}
                  disabled={busy}
                  onChange={(e) =>
                    act(() => apiClient.patch(`/api/team/members/${m.id}/role`, { role: e.target.value }))
                  }
                  className="rounded border border-gray-300 px-2 py-1 text-sm disabled:opacity-50"
                >
                  <option value="viewer">Viewer — read only</option>
                  <option value="trip_leader">Trip leader — only assigned trips</option>
                  <option value="manager">Manager — everything but billing</option>
                </select>
              )}
            </td>
            <td className="px-4 py-3 tabular-nums">
              {m.role === 'trip_leader' ? (
                m.assignments.length === 0 ? (
                  <span className="text-amber-700">none — sees nothing</span>
                ) : (
                  m.assignments.length
                )
              ) : (
                <span className="text-gray-400">all</span>
              )}
            </td>
            <td className="px-4 py-3 whitespace-nowrap text-gray-500">
              {new Date(m.joinedAt).toLocaleDateString('en-IN')}
            </td>
            <td className="px-4 py-3">
              {m.role !== 'owner' && (
                <button
                  onClick={() => act(() => apiClient.delete(`/api/team/members/${m.id}`))}
                  disabled={busy}
                  className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-50"
                >
                  Remove
                </button>
              )}
            </td>
          </tr>
        ))}
      </Table>

      <h2 className="text-sm font-medium text-gray-700 mt-8 mb-2">Invites</h2>
      {invites.length === 0 ? (
        <div className="py-8 text-center text-gray-500 text-sm">No invites sent.</div>
      ) : (
        <Table head={['Email', 'Role', 'State', 'Expires', '']}>
          {invites.map((i) => (
            <tr key={i.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 font-medium text-gray-900">{i.email}</td>
              <td className="px-4 py-3">{roleLabel[i.role] ?? i.role}</td>
              <td className="px-4 py-3">
                <span
                  className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                    inviteTone[i.state]
                  }`}
                >
                  {i.state}
                </span>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-gray-500">
                {new Date(i.expiresAt).toLocaleDateString('en-IN')}
              </td>
              <td className="px-4 py-3">
                {/* An expired invite offers only this. There is no accept path
                    to draw, because there is no accept path to take. */}
                {i.state !== 'accepted' && (
                  <button
                    onClick={() => act(() => apiClient.post(`/api/team/invites/${i.id}/resend`))}
                    disabled={busy}
                    className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-50"
                  >
                    Resend
                  </button>
                )}
              </td>
            </tr>
          ))}
        </Table>
      )}
    </Shell>
  );
};

export default Team;
