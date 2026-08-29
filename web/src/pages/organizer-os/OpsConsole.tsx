import React from 'react';
import { useParams } from 'react-router-dom';
import { apiClient } from '../../services/apiClient';
import { Shell, Table } from './analyticsShared';

// The seven operations tabs for one trip.
//
// Two behaviours here are deliberate and worth not "fixing" later:
//
//   - Assigning someone to a full room succeeds and returns a warning. The
//     organiser may have a reason at 11pm in a hill station, and blocking it
//     would leave no way to record what actually happened. Assigning someone
//     who is already in a room is refused outright — that one is a mistake, not
//     a judgement.
//
//   - Expiry is never stored. Permits carry a date, and the word "expired"
//     comes from the server, derived in one place.

type Tab = 'rooms' | 'transport' | 'checklist' | 'attendance' | 'equipment' | 'permits' | 'emergency';

const TABS: { key: Tab; label: string }[] = [
  { key: 'rooms', label: 'Rooms' },
  { key: 'transport', label: 'Transport' },
  { key: 'checklist', label: 'Checklist' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'equipment', label: 'Equipment' },
  { key: 'permits', label: 'Permits' },
  { key: 'emergency', label: 'Emergency' },
];

const expiryTone: Record<string, string> = {
  expired: 'bg-red-100 text-red-800',
  expiring_soon: 'bg-amber-100 text-amber-800',
  valid: 'bg-green-100 text-green-800',
  no_expiry: 'bg-gray-100 text-gray-600',
};

const OpsConsole: React.FC = () => {
  const { tripId = '' } = useParams();
  const [tab, setTab] = React.useState<Tab>('rooms');
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  // Holds the over-capacity warning the assign endpoint returns. Nothing sets
  // it yet — see the note above body() — but the banner it feeds is the place
  // that warning belongs when the assign action is wired.
  const [notice] = React.useState<string | null>(null);

  const endpoint = React.useMemo(() => {
    switch (tab) {
      case 'rooms':
        return `/api/ops/trips/${tripId}/accommodation`;
      case 'transport':
        return `/api/ops/trips/${tripId}/transport`;
      case 'attendance':
        return `/api/ops/trips/${tripId}/attendance`;
      case 'equipment':
        return `/api/ops/trips/${tripId}/equipment`;
      case 'permits':
        return `/api/ops/trips/${tripId}/permits`;
      case 'emergency':
        return `/api/ops/trips/${tripId}/emergency-plan`;
      case 'checklist':
        return `/api/ops/checklist-templates`;
    }
  }, [tab, tripId]);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(endpoint);
      setData(res.data);
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Request failed');
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  React.useEffect(() => {
    load();
  }, [load]);

  // Assigning a participant to a room is not wired from this screen yet: it
  // needs a participant picker, and no endpoint on this sprint returns the
  // roster for a trip. POST /api/ops/rooms/:roomId/assign works and returns
  // { assignment, warning } — the over-capacity warning path is implemented and
  // reachable, just not from a button here. Wiring it is Sprint 5 follow-up
  // work, not a rewrite.

  const body = () => {
    if (tab === 'rooms') {
      const accommodations = Array.isArray(data) ? data : [];
      if (accommodations.length === 0) return <Empty what="accommodation" />;
      return (
        <div className="space-y-6">
          {accommodations.map((a: any) => (
            <div key={a.id} className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-baseline justify-between mb-3">
                <div>
                  <div className="font-medium text-gray-900">{a.name}</div>
                  <div className="text-xs text-gray-500">
                    {a.kind}
                    {a.address ? ` · ${a.address}` : ''}
                  </div>
                </div>
              </div>
              <Table head={['Room', 'Capacity', 'Occupants', '']}>
                {(a.rooms ?? []).map((r: any) => {
                  const over = r.assignments.length > r.capacity;
                  return (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{r.label}</td>
                      <td className="px-4 py-3 tabular-nums">{r.capacity}</td>
                      <td className="px-4 py-3">
                        <span className={over ? 'text-amber-700 font-medium' : ''}>
                          {r.assignments.length}
                        </span>
                        {r.assignments.length > 0 && (
                          <div className="text-xs text-gray-500">
                            {r.assignments.map((x: any) => x.participant.name).join(', ')}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {over ? 'over capacity — allowed' : ''}
                      </td>
                    </tr>
                  );
                })}
              </Table>
            </div>
          ))}
        </div>
      );
    }

    if (tab === 'transport') {
      const segments = Array.isArray(data) ? data : [];
      if (segments.length === 0) return <Empty what="transport" />;
      return (
        <Table head={['Mode', 'Route', 'Departs', 'Seats', 'Assigned']}>
          {segments.map((s: any) => (
            <tr key={s.id} className="hover:bg-gray-50">
              <td className="px-4 py-3">{s.mode}</td>
              <td className="px-4 py-3">
                {s.fromLocation} → {s.toLocation}
                {s.identifier && <div className="text-xs text-gray-500">{s.identifier}</div>}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                {s.departsAt ? new Date(s.departsAt).toLocaleString('en-IN') : '—'}
              </td>
              <td className="px-4 py-3 tabular-nums">{s.seatCapacity ?? '—'}</td>
              <td className="px-4 py-3 tabular-nums">{s.assignments?.length ?? 0}</td>
            </tr>
          ))}
        </Table>
      );
    }

    if (tab === 'permits') {
      const permits = Array.isArray(data) ? data : [];
      if (permits.length === 0) return <Empty what="permits" />;
      return (
        <Table head={['Permit', 'Authority', 'Expires', 'State']}>
          {permits.map((p: any) => (
            <tr key={p.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 font-medium">{p.name}</td>
              <td className="px-4 py-3 text-gray-600">{p.authority ?? '—'}</td>
              <td className="px-4 py-3 whitespace-nowrap">
                {p.expiresOn ? new Date(p.expiresOn).toLocaleDateString('en-IN') : '—'}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                    expiryTone[p.expiryState] ?? expiryTone.no_expiry
                  }`}
                >
                  {String(p.expiryState).replace(/_/g, ' ')}
                </span>
              </td>
            </tr>
          ))}
        </Table>
      );
    }

    if (tab === 'equipment') {
      const items = Array.isArray(data) ? data : [];
      if (items.length === 0) return <Empty what="equipment" />;
      return (
        <Table head={['Item', 'In stock', 'Issued', 'Holders']}>
          {items.map((i: any) => {
            const out = (i.assignments ?? []).filter((a: any) => !a.returnedAt);
            const issued = out.reduce((s: number, a: any) => s + a.units, 0);
            return (
              <tr key={i.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{i.name}</td>
                <td className="px-4 py-3 tabular-nums">{i.totalUnits}</td>
                <td className={`px-4 py-3 tabular-nums ${issued > i.totalUnits ? 'text-amber-700 font-medium' : ''}`}>
                  {issued}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {out.map((a: any) => a.participant.name).join(', ') || '—'}
                </td>
              </tr>
            );
          })}
        </Table>
      );
    }

    if (tab === 'attendance') {
      const records = Array.isArray(data) ? data : [];
      if (records.length === 0) return <Empty what="attendance for today" />;
      return (
        <Table head={['Participant', 'State', 'Marked at']}>
          {records.map((r: any) => (
            <tr key={r.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 font-medium">{r.participant?.name ?? r.participantId}</td>
              <td className="px-4 py-3">{r.state}</td>
              <td className="px-4 py-3 whitespace-nowrap text-gray-500">
                {new Date(r.markedAt).toLocaleString('en-IN')}
              </td>
            </tr>
          ))}
        </Table>
      );
    }

    if (tab === 'checklist') {
      const templates = Array.isArray(data) ? data : [];
      if (templates.length === 0) return <Empty what="checklist items" />;
      return (
        <Table head={['Item', 'Required', 'Description']}>
          {templates.map((t: any) => (
            <tr key={t.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 font-medium">{t.label}</td>
              <td className="px-4 py-3">{t.isRequired ? 'yes' : 'no'}</td>
              <td className="px-4 py-3 text-gray-600">{t.description ?? '—'}</td>
            </tr>
          ))}
        </Table>
      );
    }

    // emergency
    if (!data) return <Empty what="an emergency plan" />;
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3 text-sm">
        <Field label="Nearest hospital" value={data.nearestHospital} />
        <Field label="Hospital phone" value={data.hospitalPhone} />
        <Field
          label="Distance"
          value={data.hospitalDistanceKm ? `${data.hospitalDistanceKm} km` : null}
        />
        <Field label="Local authority" value={data.localAuthorityPhone} />
        <Field label="Evacuation plan" value={data.evacuationPlan} />
        <Field label="Notes" value={data.notes} />
      </div>
    );
  };

  return (
    <Shell
      title="Operations"
      subtitle="Day-of-trip logistics"
      loading={loading}
      error={error}
    >
      {notice && (
        <div className="mb-4 rounded border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          {notice}
        </div>
      )}

      <div className="flex flex-wrap gap-1 border-b border-gray-200 mb-6">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={
              'px-3 py-2 text-sm border-b-2 -mb-px ' +
              (tab === t.key
                ? 'border-green-600 text-green-700 font-medium'
                : 'border-transparent text-gray-500 hover:text-gray-800')
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {body()}
    </Shell>
  );
};

const Empty: React.FC<{ what: string }> = ({ what }) => (
  <div className="py-12 text-center text-gray-500 text-sm">No {what} recorded for this trip.</div>
);

const Field: React.FC<{ label: string; value: string | null | undefined }> = ({ label, value }) => (
  <div>
    <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
    <div className="text-gray-900">{value || '—'}</div>
  </div>
);

export default OpsConsole;
