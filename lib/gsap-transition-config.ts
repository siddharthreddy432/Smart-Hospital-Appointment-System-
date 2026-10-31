export interface SahsNavRoute {
  href: string;
  label: string;
  shortLabel: string;
  sceneTitle: string;
  sceneSubtitle: string;
  accentTag: string;
}

export const SAHS_NAV_ROUTES: SahsNavRoute[] = [
  {
    href: '/',
    label: 'Home',
    shortLabel: 'Home',
    sceneTitle: 'Hospital Overview & Check-In',
    sceneSubtitle: 'Streamlined scheduling, live metrics & lobby QR passes',
    accentTag: '01 · Overview',
  },
  {
    href: '/doctors',
    label: 'Doctors',
    shortLabel: 'Doctors',
    sceneTitle: 'Attending Specialists & Queue',
    sceneSubtitle: 'Outpatient roster, live queue & department availability',
    accentTag: '02 · Specialists',
  },
  {
    href: '/schedules',
    label: 'Schedules',
    shortLabel: 'Schedules',
    sceneTitle: 'Weekly Shift Timetables',
    sceneSubtitle: 'Physician consultation hours & slot capacities',
    accentTag: '03 · Timetables',
  },
  {
    href: '/appointments',
    label: 'Appointments & QR',
    shortLabel: 'Appointments',
    sceneTitle: 'Patient Portal & QR Check-In',
    sceneSubtitle: 'Digital arrival passes, patient profile & visit ledger',
    accentTag: '04 · QR Portal',
  },
  {
    href: '/patients',
    label: 'Patients',
    shortLabel: 'Patients',
    sceneTitle: 'Patient Directory & Intake',
    sceneSubtitle: 'Registered records, demographics & Gmail verification',
    accentTag: '05 · Directory',
  },
  {
    href: '/book',
    label: 'Symptom Booking',
    shortLabel: 'Book',
    sceneTitle: 'Dual-Device QR Symptom Booking',
    sceneSubtitle: 'Real-time desktop & smartphone synchronized form',
    accentTag: '06 · QR Sync',
  },
  {
    href: '/predictor',
    label: 'No-Show AI',
    shortLabel: 'No-Show AI',
    sceneTitle: 'No-Show Probability AI',
    sceneSubtitle: 'Clinical attendance logistic regression simulator',
    accentTag: '07 · AI Model',
  },
];

export type TransitionDirection = 'forward' | 'backward' | 'neutral';

export interface TransitionTimingConfig {
  isReducedMotion: boolean;
  direction: TransitionDirection;
  exitDuration: number;
  curtainInDuration: number;
  curtainOutDuration: number;
  enterDuration: number;
  headingOffsetY: number;
  cardOffsetY: number;
  visualOffsetX: number;
  staggerStep: number;
  curtainEnterFromYPercent: number;
  curtainExitToYPercent: number;
}

export function normalizeRoutePath(pathname: string | null | undefined): string {
  if (!pathname || pathname.trim() === '') return '/';
  const clean = pathname.split('?')[0].split('#')[0].trim();
  if (clean === '') return '/';
  if (clean.length > 1 && clean.endsWith('/')) {
    return clean.slice(0, -1);
  }
  return clean;
}

export function getRouteIndex(pathname: string | null | undefined): number {
  const normalized = normalizeRoutePath(pathname);
  const exactIdx = SAHS_NAV_ROUTES.findIndex((r) => r.href === normalized);
  if (exactIdx !== -1) return exactIdx;

  const prefixIdx = SAHS_NAV_ROUTES.findIndex(
    (r) => r.href !== '/' && normalized.startsWith(r.href)
  );
  return prefixIdx;
}

export function getRouteMeta(pathname: string | null | undefined): SahsNavRoute {
  const idx = getRouteIndex(pathname);
  if (idx !== -1) {
    return SAHS_NAV_ROUTES[idx];
  }
  const normalized = normalizeRoutePath(pathname);
  if (normalized.startsWith('/login')) {
    return {
      href: '/login',
      label: 'Sign In',
      shortLabel: 'Sign In',
      sceneTitle: 'Patient & Admin Authentication',
      sceneSubtitle: 'Matched Gmail verification & administrative access',
      accentTag: 'Auth · Portal',
    };
  }
  return SAHS_NAV_ROUTES[0];
}

export function computeTransitionDirection(
  fromPath: string | null | undefined,
  toPath: string | null | undefined
): TransitionDirection {
  const fromNorm = normalizeRoutePath(fromPath);
  const toNorm = normalizeRoutePath(toPath);
  if (fromNorm === toNorm) return 'neutral';

  const fromIdx = getRouteIndex(fromNorm);
  const toIdx = getRouteIndex(toNorm);

  if (fromIdx === -1 || toIdx === -1) {
    return 'forward';
  }
  if (toIdx > fromIdx) return 'forward';
  if (toIdx < fromIdx) return 'backward';
  return 'neutral';
}

export function getTransitionTimings(
  prefersReducedMotion: boolean,
  direction: TransitionDirection
): TransitionTimingConfig {
  if (prefersReducedMotion) {
    return {
      isReducedMotion: true,
      direction,
      exitDuration: 0.01,
      curtainInDuration: 0.01,
      curtainOutDuration: 0.01,
      enterDuration: 0.01,
      headingOffsetY: 0,
      cardOffsetY: 0,
      visualOffsetX: 0,
      staggerStep: 0,
      curtainEnterFromYPercent: 0,
      curtainExitToYPercent: 0,
    };
  }

  const sign = direction === 'backward' ? -1 : 1;

  return {
    isReducedMotion: false,
    direction,
    exitDuration: 0.1,
    curtainInDuration: 0.12,
    curtainOutDuration: 0.16,
    enterDuration: 0.18,
    headingOffsetY: 8 * sign,
    cardOffsetY: 10 * sign,
    visualOffsetX: 8 * sign,
    staggerStep: 0.018,
    curtainEnterFromYPercent: sign > 0 ? 100 : -100,
    curtainExitToYPercent: sign > 0 ? -100 : 100,
  };
}

