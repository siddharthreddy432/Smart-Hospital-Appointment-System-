'use client';

import { RefObject } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { useSmoothScroll } from './SmoothScrollProvider';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(useGSAP, ScrollTrigger);
}

export interface UseGsapAnimationOptions {
  scope?: RefObject<HTMLElement | null>;
  dependencies?: unknown[];
  revertOnUpdate?: boolean;
}

export function useGsapAnimation(
  callback: (context: gsap.Context, prefersReducedMotion: boolean) => void | (() => void),
  options: UseGsapAnimationOptions = {}
) {
  const { prefersReducedMotion } = useSmoothScroll();

  useGSAP(
    (context) => {
      return callback(context, prefersReducedMotion);
    },
    {
      scope: options.scope,
      dependencies: [prefersReducedMotion, ...(options.dependencies || [])],
      revertOnUpdate: options.revertOnUpdate ?? true,
    }
  );
}
