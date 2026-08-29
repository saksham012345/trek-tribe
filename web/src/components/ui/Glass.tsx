import React from 'react';
import { ShieldCheck, Star, Users, Clock } from 'lucide-react';
import useScrollReveal from '../../hooks/useScrollReveal';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  reveal?: boolean;
  delayMs?: number;
  dark?: boolean;
}

/** Floating frosted-glass card with hover lift. Use `dark` over 3D/hero scenes. */
export const GlassCard: React.FC<GlassCardProps> = ({ children, className = '', reveal = true, delayMs = 0, dark = false }) => {
  const ref = useScrollReveal<HTMLDivElement>();
  return (
    <div
      ref={reveal ? ref : undefined}
      className={`${dark ? 'glass-panel-dark' : 'glass-card'} ${reveal ? 'reveal-on-scroll' : ''} ${className}`}
      style={reveal ? { transitionDelay: `${delayMs}ms` } : undefined}
    >
      {children}
    </div>
  );
};

interface GlassPanelProps {
  children: React.ReactNode;
  className?: string;
  dark?: boolean;
}

/** Static frosted-glass surface for nav bars, sticky panels, modals — no hover lift. */
export const GlassPanel: React.FC<GlassPanelProps> = ({ children, className = '', dark = false }) => (
  <div className={`${dark ? 'glass-panel-dark' : 'glass-panel'} ${className}`}>{children}</div>
);

/** Trust signal: verified organizer / secure payment badge. */
export const TrustBadge: React.FC<{ label: string; className?: string }> = ({ label, className = '' }) => (
  <span className={`inline-flex items-center gap-1.5 rounded-full bg-forest-50 border border-forest-200 px-3 py-1 text-xs font-semibold text-forest-700 ${className}`}>
    <ShieldCheck size={14} strokeWidth={2.25} />
    {label}
  </span>
);

/** Social proof: aggregate rating pill. */
export const RatingBadge: React.FC<{ rating: number; count?: number; className?: string }> = ({ rating, count, className = '' }) => (
  <span className={`inline-flex items-center gap-1 rounded-full bg-earth-50 border border-earth-200 px-2.5 py-1 text-xs font-bold text-earth-800 ${className}`}>
    <Star size={13} fill="currentColor" strokeWidth={0} />
    {rating.toFixed(1)}
    {typeof count === 'number' && <span className="font-medium text-earth-600">({count})</span>}
  </span>
);

/** Scarcity/urgency psychology cue — use only with a real, current value. */
export const ScarcityBadge: React.FC<{ spotsLeft: number; className?: string }> = ({ spotsLeft, className = '' }) => {
  if (spotsLeft <= 0) return null;
  const urgent = spotsLeft <= 5;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
        urgent ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-forest-50 border border-forest-200 text-forest-700'
      } ${className}`}
    >
      <Users size={13} strokeWidth={2.25} />
      {urgent ? `Only ${spotsLeft} spot${spotsLeft === 1 ? '' : 's'} left` : `${spotsLeft} spots left`}
    </span>
  );
};

/** Recency cue for freshly listed items. */
export const RecentBadge: React.FC<{ label?: string; className?: string }> = ({ label = 'New', className = '' }) => (
  <span className={`inline-flex items-center gap-1 rounded-full bg-white/80 backdrop-blur-sm border border-white/60 px-2.5 py-1 text-[11px] font-bold text-forest-700 shadow-sm ${className}`}>
    <Clock size={12} strokeWidth={2.5} />
    {label}
  </span>
);
