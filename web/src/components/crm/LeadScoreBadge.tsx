import React from 'react';

interface LeadScoreBadgeProps {
  score: number;
}

type Tier = 'Hot' | 'Warm' | 'Cool' | 'Cold';

interface TierStyle {
  label: Tier;
  bg: string;
  text: string;
  dot: string;
}

function getTier(score: number): TierStyle {
  if (score >= 75) return { label: 'Hot',  bg: 'bg-red-100',    text: 'text-red-700',    dot: 'bg-red-500' };
  if (score >= 50) return { label: 'Warm', bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-500' };
  if (score >= 25) return { label: 'Cool', bg: 'bg-yellow-100', text: 'text-yellow-700', dot: 'bg-yellow-500' };
  return              { label: 'Cold', bg: 'bg-blue-100',   text: 'text-blue-700',   dot: 'bg-blue-500' };
}

const LeadScoreBadge: React.FC<LeadScoreBadgeProps> = ({ score }) => {
  const tier = getTier(score);

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${tier.bg} ${tier.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${tier.dot}`} />
      {score}% · {tier.label}
    </span>
  );
};

export default LeadScoreBadge;
