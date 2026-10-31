'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from 'react';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

interface SmoothScrollContextValue {
  lenis: Lenis | null;
  prefersReducedMotion: boolean;
  scrollToTop: (immediate?: boolean) => void;
  scrollToElement: (target: string | HTMLElement, offset?: number) => void;
}

const SmoothScrollContext = createContext<SmoothScrollContextValue>({
  lenis: null,
  prefersReducedMotion: false,
  scrollToTop: () => {},
  scrollToElement: () => {},
});

export function useSmoothScroll() {
  return useContext(SmoothScrollContext);
}

export default function SmoothScrollProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const lenisRef = useRef<Lenis | null>(null);
  const [lenisInstance, setLenisInstance] = useState<Lenis | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] =
    useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleMotionChange = () => {
      setPrefersReducedMotion(mediaQuery.matches);
    };
    handleMotionChange();
    mediaQuery.addEventListener('change', handleMotionChange);

    if (mediaQuery.matches) {
      return () => {
        mediaQuery.removeEventListener('change', handleMotionChange);
      };
    }

    const lenis = new Lenis({
      duration: 0.65,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 1.0,
      touchMultiplier: 1.15,
      infinite: false,
      autoRaf: false,
    });

    lenisRef.current = lenis;
    requestAnimationFrame(() => {
      setLenisInstance(lenis);
    });

    const onScroll = () => {
      ScrollTrigger.update();
    };

    lenis.on('scroll', onScroll);

    const updateLenis = (time: number) => {
      lenis.raf(time * 1000);
    };

    gsap.ticker.add(updateLenis);
    gsap.ticker.lagSmoothing(0);

    return () => {
      mediaQuery.removeEventListener('change', handleMotionChange);
      gsap.ticker.remove(updateLenis);
      lenis.off('scroll', onScroll);
      lenis.destroy();
      lenisRef.current = null;
      setLenisInstance(null);
    };
  }, []);

  const scrollToTop = useCallback((immediate = false) => {
    if (lenisRef.current) {
      lenisRef.current.scrollTo(0, { immediate });
    }
    if (typeof window !== 'undefined') {
      window.scrollTo({
        top: 0,
        left: 0,
        behavior: immediate ? 'instant' : 'smooth',
      });
    }
  }, []);

  const scrollToElement = useCallback(
    (target: string | HTMLElement, offset = -84) => {
      if (lenisRef.current) {
        lenisRef.current.scrollTo(target, { offset });
      }
    },
    []
  );

  return (
    <SmoothScrollContext.Provider
      value={{
        lenis: lenisInstance,
        prefersReducedMotion,
        scrollToTop,
        scrollToElement,
      }}
    >
      {children}
    </SmoothScrollContext.Provider>
  );
}
