'use client';

import React, {
  createContext,
  useContext,
  useRef,
  useState,
  useCallback,
  useEffect,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useSmoothScroll } from './SmoothScrollProvider';
import {
  computeTransitionDirection,
  getRouteMeta,
  getTransitionTimings,
  normalizeRoutePath,
  SahsNavRoute,
  TransitionDirection,
} from '../../lib/gsap-transition-config';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

interface PageTransitionContextValue {
  isTransitioning: boolean;
  transitionDirection: TransitionDirection;
  activeSceneMeta: SahsNavRoute;
  stageRef: React.RefObject<HTMLDivElement | null>;
  curtainRef: React.RefObject<HTMLDivElement | null>;
  curtainLabelRef: React.RefObject<HTMLDivElement | null>;
  navigateWithTransition: (targetHref: string) => void;
}

const PageTransitionContext = createContext<PageTransitionContextValue | null>(
  null
);

export function usePageTransition() {
  const ctx = useContext(PageTransitionContext);
  if (!ctx) {
    throw new Error(
      'usePageTransition must be used within PageTransitionProvider'
    );
  }
  return ctx;
}

export default function PageTransitionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { prefersReducedMotion, scrollToTop } = useSmoothScroll();

  const stageRef = useRef<HTMLDivElement | null>(null);
  const curtainRef = useRef<HTMLDivElement | null>(null);
  const curtainLabelRef = useRef<HTMLDivElement | null>(null);

  const previousPathRef = useRef<string>(normalizeRoutePath(pathname));
  const activeTimelineRef = useRef<gsap.core.Timeline | null>(null);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);
  const [transitionDirection, setTransitionDirection] =
    useState<TransitionDirection>('forward');
  const [activeSceneMeta, setActiveSceneMeta] = useState<SahsNavRoute>(() =>
    getRouteMeta(pathname)
  );

  const clearPendingTimers = useCallback(() => {
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
  }, []);

  const runDestinationReveal = useCallback(
    (direction: TransitionDirection, nextPath: string) => {
      const stage = stageRef.current;
      const curtain = curtainRef.current;
      const timings = getTransitionTimings(prefersReducedMotion, direction);

      setActiveSceneMeta(getRouteMeta(nextPath));

      if (curtain) {
        gsap.set(curtain, { display: 'none', yPercent: 100 });
      }

      if (!stage) {
        setIsTransitioning(false);
        return;
      }

      activeTimelineRef.current?.kill();

      if (timings.isReducedMotion) {
        gsap.set(stage, { clearProps: 'all' });
        setIsTransitioning(false);
        return;
      }

      const tl = gsap.timeline({
        defaults: { ease: 'power2.out', overwrite: 'auto' },
        onComplete: () => {
          gsap.set(stage, { clearProps: 'transform,opacity' });
          setIsTransitioning(false);
        },
      });

      activeTimelineRef.current = tl;

      // Fast, compositor-only (transform + opacity) stage settle (<= 180ms)
      tl.fromTo(
        stage,
        {
          y: direction === 'backward' ? -6 : 6,
          opacity: 0.92,
        },
        {
          y: 0,
          opacity: 1,
          duration: 0.16,
          ease: 'power2.out',
        },
        0
      );
    },
    [prefersReducedMotion]
  );

  // Trigger destination reveal whenever Next.js pathname updates
  useEffect(() => {
    const currentNorm = normalizeRoutePath(pathname);
    const prevNorm = previousPathRef.current;

    clearPendingTimers();

    if (currentNorm !== prevNorm) {
      const dir = computeTransitionDirection(prevNorm, currentNorm);
      previousPathRef.current = currentNorm;
      setTransitionDirection(dir);
      scrollToTop(true);
      runDestinationReveal(dir, currentNorm);
    } else {
      runDestinationReveal('forward', currentNorm);
    }
  }, [pathname, clearPendingTimers, runDestinationReveal, scrollToTop]);

  const navigateWithTransition = useCallback(
    (targetHref: string) => {
      if (!targetHref) return;
      const targetNorm = normalizeRoutePath(targetHref);
      const currentNorm = normalizeRoutePath(pathname);

      if (targetNorm === currentNorm && !targetHref.includes('?')) {
        scrollToTop(false);
        return;
      }

      const direction = computeTransitionDirection(currentNorm, targetNorm);
      const nextSceneMeta = getRouteMeta(targetNorm);

      setTransitionDirection(direction);
      setActiveSceneMeta(nextSceneMeta);
      clearPendingTimers();
      activeTimelineRef.current?.kill();

      // Navigate immediately without blocking exit curtain delay
      router.push(targetHref);
    },
    [pathname, clearPendingTimers, router, scrollToTop]
  );

  useEffect(() => {
    return () => {
      clearPendingTimers();
      activeTimelineRef.current?.kill();
    };
  }, [clearPendingTimers]);

  return (
    <PageTransitionContext.Provider
      value={{
        isTransitioning,
        transitionDirection,
        activeSceneMeta,
        stageRef,
        curtainRef,
        curtainLabelRef,
        navigateWithTransition,
      }}
    >
      {children}
    </PageTransitionContext.Provider>
  );
}

