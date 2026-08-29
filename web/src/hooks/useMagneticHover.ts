import { useEffect, useRef } from 'react';
import gsap from 'gsap';

/** Cursor-following magnetic pull on hover, GSAP quickTo — desktop pointer only. */
export function useMagneticHover<T extends HTMLElement = HTMLButtonElement>(strength = 0.35) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (window.matchMedia('(pointer: coarse)').matches) return;

    const xTo = gsap.quickTo(el, 'x', { duration: 0.4, ease: 'elastic.out(1,0.4)' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.4, ease: 'elastic.out(1,0.4)' });

    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      xTo((e.clientX - r.left - r.width / 2) * strength);
      yTo((e.clientY - r.top - r.height / 2) * strength);
    };
    const onLeave = () => {
      xTo(0);
      yTo(0);
    };

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
    };
  }, [strength]);

  return ref;
}

export default useMagneticHover;
