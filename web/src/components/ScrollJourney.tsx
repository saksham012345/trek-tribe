import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowRight } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

/**
 * Cinematic scroll journey (drinkstill.nz technique, verified via DOM study):
 * one sticky full-viewport stage; REAL photographic scenes crossfade and
 * slow-zoom (Ken Burns) as scroll advances, while editorial serif chapters
 * fade through. No WebGL — the premium feel comes from real imagery, massive
 * typography, a circle-reveal intro, and precise scrub choreography.
 */

interface Chapter {
  step: string;
  title: React.ReactNode;
  desc: string;
  img: string;
  alt: string;
  range: [number, number];
  cta?: boolean;
}

const IMG = (id: string) =>
  `https://images.unsplash.com/${id}?q=80&w=1920&auto=format&fit=crop`;

const CHAPTERS: Chapter[] = [
  {
    step: '01',
    title: (<>Walk into <em className="font-display-serif italic text-forest-300">the wild.</em></>),
    desc: 'Discover breathtaking destinations while supporting conservation efforts and sustainable tourism practices.',
    img: IMG('photo-1551632811-561732d1e306'),
    alt: 'Hikers crossing a bridge on a lush forest trail',
    range: [0.08, 0.3],
  },
  {
    step: '02',
    title: (<>Climb with <em className="font-display-serif italic text-forest-300">your tribe.</em></>),
    desc: 'Connect with passionate eco-adventurers, conservationists, and nature enthusiasts from around the globe.',
    img: IMG('photo-1458668383970-8ddd3927deed'),
    alt: 'A green mountain valley stretching to the horizon',
    range: [0.34, 0.54],
  },
  {
    step: '03',
    title: (<>Leave only <em className="font-display-serif italic text-forest-300">footprints.</em></>),
    desc: 'Offset your carbon footprint, support local communities, and make every adventure count for the planet.',
    img: IMG('photo-1506905925346-21bda4d32df4'),
    alt: 'A mist-wrapped peak at dusk',
    range: [0.58, 0.78],
  },
  {
    step: '04',
    title: (<>Your summit <em className="font-display-serif italic text-forest-300">awaits.</em></>),
    desc: 'Every journey on TrekTribe ends with a story worth telling. Start writing yours.',
    img: IMG('photo-1519681393784-d120267933ba'),
    alt: 'A mountain range under a starry night sky',
    range: [0.84, 1.01],
    cta: true,
  },
];

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

const ScrollJourney: React.FC = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const imgRefs = useRef<Array<HTMLImageElement | null>>([]);
  const textRefs = useRef<Array<HTMLDivElement | null>>([]);
  const railRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (prefersReducedMotion || !sectionRef.current) return;

    const applyProgress = (p: number) => {
      // circle-reveal intro: the whole stage irises open over the first 6%
      if (stageRef.current) {
        const reveal = clamp01(p / 0.06);
        stageRef.current.style.clipPath =
          reveal >= 1 ? 'none' : `circle(${(reveal * 120).toFixed(1)}% at 50% 55%)`;
      }
      if (railRef.current) railRef.current.style.height = `${(p * 100).toFixed(1)}%`;

      const fade = 0.06;
      CHAPTERS.forEach((ch, i) => {
        const [a, b] = ch.range;
        const o = clamp01(Math.min((p - (a - fade)) / fade, ((b + fade) - p) / fade));

        const img = imgRefs.current[i];
        if (img) {
          img.style.opacity = String(o);
          // Ken Burns: slow push-out across the chapter's full active window
          const t = clamp01((p - (a - fade)) / ((b + fade) - (a - fade)));
          img.style.transform = `scale(${(1.18 - 0.14 * t).toFixed(4)})`;
        }

        const text = textRefs.current[i];
        if (text) {
          text.style.opacity = String(o);
          text.style.transform = `translateY(${((1 - o) * 28).toFixed(1)}px)`;
          text.style.pointerEvents = o > 0.5 ? 'auto' : 'none';
        }
      });
    };

    const st = ScrollTrigger.create({
      trigger: sectionRef.current,
      start: 'top top',
      end: 'bottom bottom',
      scrub: true,
      onUpdate: (self) => applyProgress(self.progress),
    });
    applyProgress(0);
    return () => st.kill();
  }, [prefersReducedMotion]);

  if (prefersReducedMotion) {
    // Static fallback: chapters stacked with their photographs, no scroll effects.
    return (
      <section className="bg-[#020617] py-24">
        <div className="max-w-4xl mx-auto px-6 space-y-20">
          {CHAPTERS.map((ch) => (
            <figure key={ch.step}>
              <img src={ch.img} alt={ch.alt} className="w-full h-72 object-cover rounded-glass mb-8" />
              <div className="text-forest-500 font-display-serif italic text-lg mb-2">{ch.step}</div>
              <h3 className="text-4xl font-bold text-white mb-4">{ch.title}</h3>
              <p className="text-forest-200/80 text-lg leading-relaxed">{ch.desc}</p>
              {ch.cta && (
                <Link to="/discover" className="inline-flex items-center gap-2 mt-6 px-8 py-4 bg-forest-500 text-forest-950 rounded-full font-semibold">
                  Start your journey <ArrowRight size={18} strokeWidth={2.25} />
                </Link>
              )}
            </figure>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section ref={sectionRef} className="relative bg-[#020617]" style={{ height: '500vh' }}>
      <div className="sticky top-0 h-screen overflow-hidden">
        <div ref={stageRef} className="absolute inset-0">
          {/* photographic scenes, stacked; opacity/scale driven by scroll */}
          {CHAPTERS.map((ch, i) => (
            <img
              key={ch.step}
              ref={(el) => { imgRefs.current[i] = el; }}
              src={ch.img}
              alt={ch.alt}
              className="absolute inset-0 w-full h-full object-cover will-change-transform"
              style={{ opacity: i === 0 ? 1 : 0, transform: 'scale(1.18)' }}
            />
          ))}

          {/* cinematic grade: left scrim for text legibility + edge vignette */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/25 to-transparent" />
          <div
            className="absolute inset-0"
            style={{ background: 'radial-gradient(ellipse at center, transparent 55%, rgba(2,6,23,0.65) 100%)' }}
          />
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#020617]/80 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#020617]/80 to-transparent" />
        </div>

        <div className="absolute inset-0 z-10 pointer-events-none">
          <div className="max-w-7xl mx-auto h-full relative px-6 sm:px-8 lg:px-12">
            <span className="absolute top-24 left-6 sm:left-8 lg:left-12 text-xs font-semibold tracking-[0.25em] uppercase text-forest-300/90">
              The TrekTribe Journey
            </span>

            {CHAPTERS.map((ch, i) => (
              <div
                key={ch.step}
                ref={(el) => { textRefs.current[i] = el; }}
                className="absolute left-6 sm:left-8 lg:left-12 top-1/2 -translate-y-1/2 max-w-xl"
                style={{ opacity: 0 }}
              >
                {/* oversized ghost numeral, editorial-style */}
                <div aria-hidden className="absolute -top-24 -left-2 text-[9rem] leading-none font-display-serif italic text-white/[0.08] select-none">
                  {ch.step}
                </div>
                <div className="relative">
                  <h3 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-[1.05]">{ch.title}</h3>
                  <p className="text-forest-100/85 text-lg md:text-xl leading-relaxed max-w-md">{ch.desc}</p>
                  {ch.cta && (
                    <Link
                      to="/discover"
                      className="inline-flex items-center gap-2 mt-8 px-8 py-4 bg-forest-500 hover:bg-forest-400 hover:shadow-glow-forest text-forest-950 rounded-full font-semibold transition-all duration-300 ease-spring"
                    >
                      Start your journey <ArrowRight size={18} strokeWidth={2.25} />
                    </Link>
                  )}
                </div>
              </div>
            ))}

            {/* scroll progress rail */}
            <div className="absolute right-6 sm:right-8 lg:right-12 top-1/2 -translate-y-1/2 h-40 w-0.5 bg-white/15 rounded-full overflow-hidden">
              <div ref={railRef} className="w-full bg-forest-400 rounded-full" style={{ height: '0%' }} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ScrollJourney;
