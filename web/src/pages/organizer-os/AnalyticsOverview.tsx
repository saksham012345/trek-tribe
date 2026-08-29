import React from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../../services/apiClient';
import { Shell, StatTile, inr, pct } from './analyticsShared';

// One number from each of the four analytics views, each linking to the screen
// it came from.
//
// Every figure here is fetched from the same endpoint the detailed screen uses,
// so this page cannot disagree with the page it links to. A summary that
// recomputes its own version of a number is how two screens end up telling an
// organizer different things about the same week.

interface Occupancy {
  capacity: number;
  seatsBooked: number;
}
interface Profitability {
  totals: { revenueReceived: number; netProfit: number };
}
interface Geography {
  totals: { totalLifetimeSpend: number };
}
interface Marketing {
  totals: { totalLeads: number; conversionRatePct: number };
}

const Card: React.FC<{
  to: string;
  title: string;
  value: string;
  sub: string;
}> = ({ to, title, value, sub }) => (
  <Link
    to={to}
    className="block rounded-lg border border-gray-200 bg-white p-5 hover:border-green-400 hover:shadow-sm transition"
  >
    <div className="text-xs uppercase tracking-wide text-gray-500">{title}</div>
    <div className="text-2xl font-semibold text-gray-900 mt-1">{value}</div>
    <div className="text-xs text-gray-500 mt-1">{sub}</div>
  </Link>
);

const AnalyticsOverview: React.FC = () => {
  const [occ, setOcc] = React.useState<Occupancy[] | null>(null);
  const [prof, setProf] = React.useState<Profitability | null>(null);
  const [geo, setGeo] = React.useState<Geography | null>(null);
  const [mkt, setMkt] = React.useState<Marketing | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    // Each failure is tolerated on its own. One view being empty should not
    // blank the other three.
    Promise.all([
      apiClient.get('/api/analytics/occupancy').then((r) => r.data).catch(() => null),
      apiClient.get('/api/analytics/profitability').then((r) => r.data).catch(() => null),
      apiClient.get('/api/analytics/customers').then((r) => r.data).catch(() => null),
      apiClient.get('/api/analytics/marketing').then((r) => r.data).catch(() => null),
    ])
      .then(([o, p, g, m]) => {
        if (!alive) return;
        setOcc(o);
        setProf(p);
        setGeo(g);
        setMkt(m);
      })
      .catch((e: any) => alive && setError(e?.message ?? 'Request failed'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const capacity = (occ ?? []).reduce((s, t) => s + t.capacity, 0);
  const seats = (occ ?? []).reduce((s, t) => s + t.seatsBooked, 0);

  return (
    <Shell
      title="Analytics"
      subtitle="One number from each view — open any for the detail behind it"
      loading={loading}
      error={error}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card
          to="/organizer/analytics/profitability"
          title="Net profit"
          value={prof ? inr(prof.totals.netProfit) : '—'}
          sub={prof ? `on ${inr(prof.totals.revenueReceived)} received` : 'no data yet'}
        />
        <Card
          to="/organizer/analytics/occupancy"
          title="Fill rate"
          value={capacity > 0 ? pct((seats / capacity) * 100) : '—'}
          sub={capacity > 0 ? `${seats} seats of ${capacity}` : 'no trips yet'}
        />
        <Card
          to="/organizer/analytics/customers"
          title="Lifetime spend"
          value={geo ? inr(geo.totals.totalLifetimeSpend) : '—'}
          sub="across every destination"
        />
        <Card
          to="/organizer/analytics/marketing"
          title="Lead conversion"
          value={mkt ? pct(mkt.totals.conversionRatePct) : '—'}
          sub={mkt ? `${mkt.totals.totalLeads} leads` : 'no leads yet'}
        />
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-xs text-gray-600">
        Seats are counted from bookings, never stored — a group booking of four counts as four
        seats, not one. Every figure above is fetched from the same endpoint as the screen it
        links to, so this page cannot disagree with that screen.
      </div>
    </Shell>
  );
};

export default AnalyticsOverview;
