'use client';

import { RefObject, useEffect } from 'react';
import gsap from 'gsap';
import { useSmoothScroll } from './SmoothScrollProvider';

export function useScrollReveal(
  containerRef: RefObject<HTMLElement | null>,
  dependencies: unknown[] = []
) {
  const { prefersReducedMotion } = useSmoothScroll();

  useEffect(() => {
    const root = containerRef.current;
    if (!root || prefersReducedMotion) return;

    const cards = root.querySelectorAll<HTMLElement>(
      '[data-gsap-layer="card"], [data-scroll-item]'
    );
    if (cards.length === 0) return;

    const tween = gsap.fromTo(
      cards,
      {
        y: 5,
        opacity: 0.95,
      },
      {
        y: 0,
        opacity: 1,
        duration: 0.16,
        stagger: 0.01,
        ease: 'power2.out',
        overwrite: 'auto',
        clearProps: 'transform,opacity',
      }
    );

    return () => {
      tween.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefersReducedMotion, ...dependencies]);
}
