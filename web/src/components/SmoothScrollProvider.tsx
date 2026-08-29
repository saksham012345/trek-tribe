import React, { useEffect } from 'react';
import Lenis from 'lenis';
import gsap from 'gsap';

/**
 * Site-wide smooth scroll. Lenis handles momentum/easing; GSAP's ticker drives
 * both Lenis and ScrollTrigger from the same RAF loop so scroll-linked
 * animations never desync/jitter against the smoothed scroll position.
 */
const SmoothScrollProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t: number) => 1 - Math.pow(1 - t, 3),
    });

    const onTick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(onTick);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(onTick);
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
};

export default SmoothScrollProvider;
