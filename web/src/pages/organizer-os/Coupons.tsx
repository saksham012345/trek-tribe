import React from 'react';
import { apiClient } from '../../services/apiClient';
import { Shell, StatTile, Table, inr, pct } from './analyticsShared';

// Coupons, and the floor that stops them emptying a booking.
//
// The floor is not a setting tucked away in a preferences page — it is the
// first thing on this screen, because without it no coupon works at all and a
// screen full of live-looking codes that silently do nothing is worse than an
// empty one. When no floor is set the banner says so and says why.
//
// That failure direction is deliberate. Coupons stack off the original amount,
// so two 50% codes would make a trip free. No cap means no coupons, not
// unlimited coupons.

interface Floor {
  kind: 'max_total_percent' | 'min_net_amount';
  maxTotalPercent?: number;
  minNetPaise?: number;
}

interface FloorResponse {
  floor: Floor | null;
  couponsUsable: boolean;
  note: string | null;
}

interface Coupon {
  id: string;
  code: string;
  kind: 'percent' | 'fixed_amount';
  percent_off: string | null;
  amount_off_paise: number | null;
  starts_at: string;
  ends_at: string | null;
  max_redemptions: number | null;
  times_redeemed: number;
  state: 'live' | 'scheduled' | 'expired' | 'exhausted' | 'paused';
}

const stateTone: Record<string, string> = {
  live: 'bg-green-100 text-green-800',
  scheduled: 'bg-blue-100 text-blue-800',
  expired: 'bg-gray-100 text-gray-600',
  exhausted: 'bg-amber-100 text-amber-800',
  paused: 'bg-gray-100 text-gray-700',
};

const rupees = (paise: number) => inr(paise / 100);

const Coupons: React.FC = () => {
  const [floor, setFloor] = React.useState<FloorResponse | null>(null);
  const [coupons, setCoupons] = React.useState<Coupon[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [floorForm, setFloorForm] = React.useState({ kind: 'max_total_percent', value: '' });

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [f, c] = await Promise.all([
        apiClient.get('/api/marketing/discount-floor'),
        apiClient.get('/api/marketing/coupons'),
      ]);
      setFloor(f.data);
      setCoupons(c.data ?? []);
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Request failed');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const saveFloor = async () => {
    const raw = Number(floorForm.value);
    if (!Number.isFinite(raw)) return;
    setBusy(true);
    setError(null);
    try {
      await apiClient.put('/api/marketing/discount-floor', {
        kind: floorForm.kind,
        // A rupee figure typed in the box becomes paise here — the API takes
        // integer paise and nothing else.
        value: floorForm.kind === 'min_net_amount' ? Math.round(raw * 100) : raw,
      });
      setFloorForm({ ...floorForm, value: '' });
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Could not save the floor');
    } finally {
      setBusy(false);
    }
  };

  const live = coupons.filter((c) => c.state === 'live').length;

  return (
    <Shell title="Coupons" subtitle="Discount codes, and the limit on what they can take off" loading={loading} error={error}>
      {floor && !floor.couponsUsable && (
        <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-5 py-4 text-amber-900">
          <div className="font-medium">No discount floor is set, so no coupon will apply.</div>
          <p className="text-sm mt-2">
            Coupons stack, and percentages come off the original amount — two 50% codes would
            make a trip free. Until a floor exists, every code below is refused at checkout and
            bookings are charged in full.
          </p>
          <p className="text-sm mt-2">
            That is the safe direction to fail, but it is not a working offer. Set the floor to
            turn coupons on.
          </p>
        </div>
      )}

      <section className="rounded-lg border border-gray-200 bg-white p-5 mb-6">
        <h2 className="font-medium text-gray-900 mb-1">Discount floor</h2>
        <p className="text-xs text-gray-500 mb-4">
          The most any booking may be discounted, however many codes are stacked on it.
        </p>

        {floor?.floor && (
          <div className="mb-4 text-sm text-gray-800">
            Currently:{' '}
            <span className="font-medium">
              {floor.floor.kind === 'max_total_percent'
                ? `never more than ${floor.floor.maxTotalPercent}% off`
                : `the customer always pays at least ${rupees(floor.floor.minNetPaise ?? 0)}`}
            </span>
          </div>
        )}

        <div className="flex flex-wrap gap-3 items-end">
          <select
            value={floorForm.kind}
            onChange={(e) => setFloorForm({ ...floorForm, kind: e.target.value })}
            className="rounded border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="max_total_percent">Maximum total discount (%)</option>
            <option value="min_net_amount">Minimum the customer pays (₹)</option>
          </select>
          <input
            type="number"
            min="0"
            placeholder={floorForm.kind === 'max_total_percent' ? 'e.g. 40' : 'e.g. 500'}
            value={floorForm.value}
            onChange={(e) => setFloorForm({ ...floorForm, value: e.target.value })}
            className="rounded border border-gray-300 px-2 py-1.5 text-sm w-32"
          />
          <button
            onClick={saveFloor}
            disabled={busy || floorForm.value === ''}
            className="rounded bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700 disabled:opacity-50"
          >
            {floor?.floor ? 'Update floor' : 'Set floor'}
          </button>
        </div>
      </section>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <StatTile label="Coupons" value={String(coupons.length)} />
        <StatTile label="Live" value={String(live)} hint={floor?.couponsUsable ? undefined : 'none apply — no floor'} />
        <StatTile
          label="Redemptions"
          value={String(coupons.reduce((s, c) => s + c.times_redeemed, 0))}
        />
      </div>

      {coupons.length === 0 ? (
        <div className="py-12 text-center text-gray-500 text-sm">No coupons yet.</div>
      ) : (
        <Table head={['Code', 'Takes off', 'Window', 'Used', 'State']}>
          {coupons.map((c) => (
            <tr key={c.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 font-mono font-medium text-gray-900">{c.code}</td>
              <td className="px-4 py-3">
                {c.kind === 'percent'
                  ? pct(Number(c.percent_off))
                  : rupees(c.amount_off_paise ?? 0)}
                <div className="text-xs text-gray-500">of the original amount</div>
              </td>
              <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                {new Date(c.starts_at).toLocaleDateString('en-IN')}
                {c.ends_at ? ` — ${new Date(c.ends_at).toLocaleDateString('en-IN')}` : ' — open'}
              </td>
              <td className="px-4 py-3 tabular-nums">
                {c.times_redeemed}
                {c.max_redemptions !== null && ` / ${c.max_redemptions}`}
              </td>
              <td className="px-4 py-3">
                <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${stateTone[c.state]}`}>
                  {c.state}
                </span>
              </td>
            </tr>
          ))}
        </Table>
      )}

      <p className="text-xs text-gray-500 mt-4">
        State comes from the coupon's window and its redemption limit — only "paused" is a
        setting. Expired and exhausted are worked out, so they cannot be stale.
      </p>
    </Shell>
  );
};

export default Coupons;
