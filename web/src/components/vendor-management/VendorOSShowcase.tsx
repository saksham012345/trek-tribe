import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { Hotel, Bus, Compass, Wrench, UtensilsCrossed, Camera } from 'lucide-react';
import VendorNetworkScene from './VendorNetworkScene';

const CATEGORY_CHIPS = [
  { label: 'Hotels', Icon: Hotel },
  { label: 'Transport', Icon: Bus },
  { label: 'Guides', Icon: Compass },
  { label: 'Equipment', Icon: Wrench },
  { label: 'Food', Icon: UtensilsCrossed },
  { label: 'Photography', Icon: Camera },
];

/**
 * Flagship hero for Vendor OS. Sells the feature before the functional
 * tabs below it: one glance should communicate "every vendor relationship
 * for every trip, run from one place" without reading a word of copy.
 */
const VendorOSShowcase: React.FC = () => {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!rootRef.current) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const els = rootRef.current.querySelectorAll<HTMLElement>('[data-reveal]');

    if (reduced) {
      els.forEach((el) => { el.style.opacity = '1'; el.style.transform = 'none'; });
      return;
    }

    gsap.fromTo(
      els,
      { opacity: 0, y: 24 },
      { opacity: 1, y: 0, duration: 0.7, ease: 'expo.out', stagger: 0.08 }
    );
  }, []);

  return (
    <div
      ref={rootRef}
      className="relative overflow-hidden rounded-2xl mb-8"
      style={{
        background: 'radial-gradient(circle at 30% 20%, #0C4A6E 0%, #020617 65%)',
        minHeight: '380px',
      }}
    >
      <VendorNetworkScene />

      <div className="relative z-10 flex flex-col justify-center h-full px-8 py-12 md:px-14 md:py-16 max-w-2xl">
        <span
          data-reveal
          className="inline-block text-xs font-semibold tracking-wider uppercase text-sky-300 mb-3"
          style={{ opacity: 0 }}
        >
          Your business operating system
        </span>
        <h1
          data-reveal
          className="text-3xl md:text-4xl font-bold text-white leading-tight mb-4"
          style={{ opacity: 0 }}
        >
          Every vendor. Every trip. One place to run it all.
        </h1>
        <p
          data-reveal
          className="text-slate-300 text-base md:text-lg mb-6"
          style={{ opacity: 0 }}
        >
          Vendor OS replaces the WhatsApp threads, phone calls, and spreadsheets
          with one private, automated system — your hotels, transport, guides,
          and every other vendor, coordinated for every trip automatically.
        </p>
        <div data-reveal className="flex flex-wrap gap-2" style={{ opacity: 0 }}>
          {CATEGORY_CHIPS.map(({ label, Icon }) => (
            <span
              key={label}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm text-slate-100 text-sm font-medium"
            >
              <Icon size={14} strokeWidth={2} />
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default VendorOSShowcase;
