import React from 'react';
import { Link } from 'react-router-dom';
import { useAnalytics, Shell, StatTile } from './analyticsShared';

// Automatic discount rules — early-bird, last-minute — are OFF, by decision D5.
//
// This screen exists rather than being left out, because a missing screen reads
// as an oversight and invites somebody to build the feature again. It says what
// was decided, when, and why, so the next person to wonder about early-bird
// pricing finds the answer instead of the gap.
//
// D5, 2026-08-21: "Coupon codes only. Automatic early-bird / last-minute rules
// off. Simpler and predictable; also dissolves the precedence question rather
// than answering it."
//
// That last clause is the substance. Two rules that both apply to one booking
// need an order, and the order changes what the customer pays. Not having the
// rules means not needing the answer.

interface FloorResponse {
  floor: {
    kind: 'max_total_percent' | 'min_net_amount';
    maxTotalPercent?: number;
    minNetPaise?: number;
  } | null;
  couponsUsable: boolean;
}

const DiscountRules: React.FC = () => {
  const { data, error, loading } = useAnalytics<FloorResponse>('/api/marketing/discount-floor');

  return (
    <Shell
      title="Discount rules"
      subtitle="What discounts this account can apply, and what it deliberately cannot"
      loading={loading}
      error={error}
    >
      <div className="rounded-lg border border-gray-200 bg-white p-5 mb-6">
        <h2 className="font-medium text-gray-900 mb-2">Automatic rules are off</h2>
        <p className="text-sm text-gray-700">
          Early-bird and last-minute pricing are not available, and that is a decision rather
          than something unbuilt. It was taken on 21 August 2026 as D5.
        </p>
        <p className="text-sm text-gray-700 mt-3">
          The reasoning is worth keeping: two automatic rules that both apply to one booking
          need an order of precedence, and that order changes what the customer pays. Removing
          the rules removes the question, instead of answering it in a way somebody has to
          remember.
        </p>
        <p className="text-sm text-gray-700 mt-3">
          Discounts are coupon codes only. A code is something a person chose to give out and
          a customer chose to enter, which is easier to explain afterwards than a price that
          moved on its own.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <StatTile label="Early-bird" value="Off" hint="D5, by decision" />
        <StatTile label="Last-minute" value="Off" hint="D5, by decision" />
        <StatTile
          label="Coupon codes"
          value={data?.couponsUsable ? 'On' : 'Blocked'}
          hint={data?.couponsUsable ? undefined : 'no floor set'}
        />
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-5">
        <h2 className="font-medium text-gray-900 mb-2">The one rule that does apply</h2>
        {data?.floor ? (
          <p className="text-sm text-gray-700">
            The discount floor:{' '}
            <span className="font-medium">
              {data.floor.kind === 'max_total_percent'
                ? `never more than ${data.floor.maxTotalPercent}% off a booking`
                : `the customer always pays at least ₹${((data.floor.minNetPaise ?? 0) / 100).toLocaleString('en-IN')}`}
            </span>
            . It binds the total across every stacked coupon, not each one, so codes cannot add
            up past it.
          </p>
        ) : (
          <p className="text-sm text-amber-800">
            No discount floor is set, so no coupon applies at all and bookings are charged in
            full. That is the safe direction to fail, but it is not a working offer.
          </p>
        )}
        <Link
          to="/organizer/coupons"
          className="inline-block mt-4 rounded bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700"
        >
          {data?.floor ? 'Manage coupons and the floor' : 'Set the floor'}
        </Link>
      </div>
    </Shell>
  );
};

export default DiscountRules;
