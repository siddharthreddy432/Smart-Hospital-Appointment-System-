'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import {
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth, googleAuthProvider } from '../src/lib/firebase';
import {
  Doctor,
  Patient,
  DoctorSchedule,
  Appointment,
  AppointmentHistoryLog,
} from './types';
import SmoothScrollProvider, {
  useSmoothScroll,
} from './animation/SmoothScrollProvider';
import PageTransitionProvider, {
  usePageTransition,
} from './animation/PageTransitionProvider';
import PageTransition from './animation/PageTransition';
import {
  SAHS_NAV_ROUTES,
  normalizeRoutePath,
} from '../lib/gsap-transition-config';
import {
  Plus,
  LogIn,
  UserCheck,
  X,
  LayoutDashboard,
  Stethoscope,
  Calendar,
  QrCode,
  Users,
  CalendarPlus,
  BrainCircuit,
  Layers,
  ArrowUpRight,
  Moon,
  Sun,
  HeartHandshake,
} from 'lucide-react';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(useGSAP);
}

export const SAHS_LOGO_SRC =
  '/assets/aistudio/Gemini_Generated_Image_xgunhyxgunhyxgun_8142619c.png';

export interface SessionUser {
  userName: string;
  email: string;
  role: 'patient' | 'admin';
  patientId: number | null;
  idToken: string | null;
  isAuthenticated: boolean;
}

interface HospitalContextValue {
  doctors: Doctor[];
  schedules: DoctorSchedule[];
  patients: Patient[];
  appointments: Appointment[];
  historyLogs: AppointmentHistoryLog[];
  loading: boolean;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  sessionUser: SessionUser;
  isAdminAuthenticated: boolean;
  statusBanner: string | null;
  setStatusBanner: (msg: string | null) => void;
  refreshHospitalData: () => Promise<void>;
  openBooking: (doctorId?: number) => void;
  loginWithGmailPopup: (
    enteredUserName: string,
    role?: 'patient' | 'admin'
  ) => Promise<boolean>;
  loginWithMatchedGmail: (
    enteredUserName: string,
    enteredGmail: string,
    role?: 'patient' | 'admin'
  ) => Promise<boolean>;
  loginAsAdmin: (username: string, password: string) => boolean;
  logoutAdmin: () => void;
  logout: () => Promise<void>;
}

const HospitalContext = createContext<HospitalContextValue | null>(null);

export function useHospital() {
  const ctx = useContext(HospitalContext);
  if (!ctx) {
    throw new Error('useHospital must be used within HospitalProvider');
  }
  return ctx;
}

const NAV_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  '/': LayoutDashboard,
  '/doctors': Stethoscope,
  '/schedules': Calendar,
  '/appointments': QrCode,
  '/patients': Users,
  '/book': CalendarPlus,
  '/predictor': BrainCircuit,
};

function PersistentHeader({
  sessionUser,
  statusBanner,
  setStatusBanner,
  theme,
  toggleTheme,
}: {
  sessionUser: SessionUser;
  statusBanner: string | null;
  setStatusBanner: (msg: string | null) => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}) {
  const pathname = usePathname();
  const { prefersReducedMotion } = useSmoothScroll();
  const { navigateWithTransition } = usePageTransition();

  const navContainerRef = useRef<HTMLElement | null>(null);
  const indicatorRef = useRef<HTMLDivElement | null>(null);
  const linkRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const previewStripRef = useRef<HTMLDivElement | null>(null);
  const [previewOpen, setPreviewOpen] = useState<boolean>(false);

  const normalizedPathname = normalizeRoutePath(pathname);

  const isRouteActive = useCallback(
    (href: string) => {
      if (href === '/') return normalizedPathname === '/';
      return normalizedPathname.startsWith(href);
    },
    [normalizedPathname]
  );

  // Fast, crisp sliding underline indicator (no heavy pill box behind text)
  useGSAP(
    () => {
      const navEl = navContainerRef.current;
      const indicatorEl = indicatorRef.current;
      if (!navEl || !indicatorEl) return;

      const activeRoute =
        SAHS_NAV_ROUTES.find((r) => isRouteActive(r.href)) || null;

      if (!activeRoute) {
        gsap.to(indicatorEl, {
          opacity: 0,
          duration: 0.14,
          ease: 'power2.out',
        });
        return;
      }

      const targetLink = linkRefs.current[activeRoute.href];
      if (!targetLink) return;

      const left = targetLink.offsetLeft + 10;
      const width = Math.max(16, targetLink.offsetWidth - 20);

      gsap.to(indicatorEl, {
        x: left,
        width,
        opacity: 1,
        duration: prefersReducedMotion ? 0.01 : 0.18,
        ease: 'power3.out',
        overwrite: 'auto',
      });
    },
    { dependencies: [normalizedPathname, prefersReducedMotion, isRouteActive] }
  );

  const [prevRoutePath, setPrevRoutePath] = useState(normalizedPathname);
  if (prevRoutePath !== normalizedPathname) {
    setPrevRoutePath(normalizedPathname);
    setPreviewOpen(false);
  }

  useGSAP(
    () => {
      const strip = previewStripRef.current;
      if (!strip) return;
      const cards = strip.querySelectorAll<HTMLElement>('[data-preview-card]');

      if (previewOpen) {
        gsap.set(strip, { display: 'block' });
        gsap.fromTo(
          strip,
          { height: 0, opacity: 0 },
          {
            height: 'auto',
            opacity: 1,
            duration: prefersReducedMotion ? 0.01 : 0.2,
            ease: 'power3.out',
          }
        );
        if (cards.length > 0 && !prefersReducedMotion) {
          gsap.fromTo(
            cards,
            { y: 8, opacity: 0 },
            {
              y: 0,
              opacity: 1,
              duration: 0.18,
              stagger: 0.02,
              ease: 'power2.out',
            }
          );
        }
      } else {
        gsap.to(strip, {
          height: 0,
          opacity: 0,
          duration: prefersReducedMotion ? 0.01 : 0.15,
          ease: 'power2.inOut',
          onComplete: () => {
            gsap.set(strip, { display: 'none' });
          },
        });
      }
    },
    { dependencies: [previewOpen, prefersReducedMotion] }
  );

  return (
    <>
      <header
        data-gsap="persistent-header"
        className="sticky top-0 z-30 bg-white/85 dark:bg-[#0D161C]/90 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800/80 px-4 sm:px-6 transition-colors duration-200"
      >
        <div className="max-w-[1400px] mx-auto h-16 flex items-center justify-between gap-2.5">
          {/* Brand: Uploaded SAHS Logo + SAHS Wordmark + Human Care Tagline */}
          <Link
            href="/"
            className="inline-flex items-center gap-2.5 whitespace-nowrap shrink-0 group focus-visible:outline-none"
          >
            <div className="relative w-9 h-9 rounded-lg overflow-hidden ring-1 ring-slate-900/10 dark:ring-white/15 shadow-sm transition-transform duration-150 group-hover:scale-[1.04] group-active:scale-[0.97]">
              <Image
                src={SAHS_LOGO_SRC}
                alt="SAHS Logo"
                width={36}
                height={36}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
                priority
              />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white leading-none">
                  SAHS
                </span>
                <span className="hidden 2xl:inline-block text-[11px] font-medium text-slate-400 dark:text-slate-500">
                  /
                </span>
                <span className="hidden 2xl:inline-block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Patient-First Care
                </span>
              </div>
              <span className="text-[10px] font-medium text-teal-700 dark:text-teal-400 tracking-tight leading-tight mt-0.5">
                Smart Hospital System
              </span>
            </div>
          </Link>

          {/* Reimagined Unboxed Typographic Desktop Navigation */}
          <nav
            ref={navContainerRef}
            aria-label="Primary Navigation"
            className="hidden lg:flex relative items-center gap-0.5 py-1"
          >
            {/* Crisp 2px Sliding Bottom Indicator (No Box Behind Text) */}
            <div
              ref={indicatorRef}
              data-gsap="nav-indicator"
              aria-hidden="true"
              className="absolute left-0 bottom-0 h-[2.5px] pointer-events-none rounded-full bg-[#0F766E] dark:bg-[#2DD4BF] opacity-0"
            />

            {SAHS_NAV_ROUTES.map((item) => {
              const Icon = NAV_ICON_MAP[item.href] || LayoutDashboard;
              const isActive = isRouteActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  ref={(el) => {
                    linkRefs.current[item.href] = el;
                  }}
                  aria-current={isActive ? 'page' : undefined}
                  className={`relative z-10 inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-semibold transition-all duration-150 whitespace-nowrap shrink-0 active:scale-[0.97] ${
                    isActive
                      ? 'text-[#0F766E] dark:text-[#2DD4BF] font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-900/[0.03] dark:hover:bg-white/[0.04]'
                  }`}
                >
                  <Icon
                    className={`w-3.5 h-3.5 transition-transform duration-150 ${
                      isActive
                        ? 'text-[#0F766E] dark:text-[#2DD4BF] scale-105'
                        : 'text-slate-400 dark:text-slate-500'
                    }`}
                  />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right Utility & Primary CTA Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setPreviewOpen((prev) => !prev)}
              aria-expanded={previewOpen}
              aria-label="Toggle Clinical Scene Index"
              className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 transition-all duration-150 active:scale-[0.96] cursor-pointer ${
                previewOpen
                  ? 'text-[#0F766E] dark:text-[#2DD4BF] bg-teal-500/10'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.05]'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-[#0F766E] dark:text-[#2DD4BF]" />
              <span>Scenes</span>
            </button>

            {/* Dark / Light Mode Toggle with Micro-Detailing */}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={
                theme === 'dark'
                  ? 'Switch to light theme'
                  : 'Switch to dark theme'
              }
              title={
                theme === 'dark'
                  ? 'Switch to Light Mode'
                  : 'Switch to Dark Mode'
              }
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-900/[0.05] dark:hover:bg-white/[0.06] transition-all duration-150 active:scale-[0.92] cursor-pointer"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400 transition-transform duration-200 rotate-0 hover:rotate-12" />
              ) : (
                <Moon className="w-4 h-4 text-slate-700 transition-transform duration-200 rotate-0 hover:-rotate-12" />
              )}
            </button>

            <span
              aria-hidden="true"
              className="hidden sm:inline-block h-4 w-[1px] bg-slate-200 dark:bg-slate-800"
            />

            {/* Unboxed / Clean User Account Trigger */}
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-[#0F766E] dark:hover:text-[#2DD4BF] hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.05] rounded-lg whitespace-nowrap shrink-0 transition-all duration-150 active:scale-[0.97]"
            >
              {sessionUser.isAuthenticated ? (
                <>
                  <UserCheck className="w-3.5 h-3.5 text-[#0F766E] dark:text-[#2DD4BF]" />
                  <span className="max-w-[115px] truncate">
                    {sessionUser.userName}
                  </span>
                </>
              ) : (
                <>
                  <LogIn className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                  <span className="max-w-[115px] truncate">
                    {sessionUser.userName || 'Sign In'}
                  </span>
                </>
              )}
            </Link>

            {/* Primary Tactile CTA */}
            <Link
              href="/book"
              className="sahs-button-primary inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Book Appointment</span>
              <span className="sm:hidden">Book</span>
            </Link>
          </div>
        </div>

        {/* Interactive Visual Scene Strip */}
        <div
          ref={previewStripRef}
          style={{ display: 'none' }}
          className="overflow-hidden"
        >
          <div className="max-w-[1360px] mx-auto pt-2 pb-3.5 border-t border-slate-200/70 dark:border-slate-800/70 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
            {SAHS_NAV_ROUTES.map((route) => {
              const Icon = NAV_ICON_MAP[route.href] || LayoutDashboard;
              const active = isRouteActive(route.href);
              return (
                <button
                  key={route.href}
                  type="button"
                  data-preview-card
                  onClick={() => {
                    setPreviewOpen(false);
                    navigateWithTransition(route.href);
                  }}
                  className={`text-left p-3 rounded-xl border transition-all duration-150 cursor-pointer flex flex-col justify-between gap-2 active:scale-[0.97] ${
                    active
                      ? 'bg-[#0F766E] text-white border-[#0F766E]'
                      : 'bg-slate-50/80 dark:bg-slate-900/60 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 hover:border-teal-600/50 hover:bg-white dark:hover:bg-slate-800/80'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={`text-[10px] font-mono font-bold uppercase ${
                        active
                          ? 'text-white/80'
                          : 'text-[#0F766E] dark:text-[#2DD4BF]'
                      }`}
                    >
                      {route.accentTag}
                    </span>
                    <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-extrabold">
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{route.label}</span>
                    </div>
                    <p
                      className={`text-[10px] mt-0.5 line-clamp-2 ${
                        active
                          ? 'text-white/85'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {route.sceneSubtitle}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Clean Unboxed Mobile Navigation Strip */}
      <nav
        aria-label="Mobile Navigation"
        className="lg:hidden bg-white/90 dark:bg-[#0D161C]/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-1.5 flex items-center gap-1 overflow-x-auto"
      >
        {SAHS_NAV_ROUTES.map((item) => {
          const Icon = NAV_ICON_MAP[item.href] || LayoutDashboard;
          const isActive = isRouteActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 transition-all duration-150 active:scale-[0.97] ${
                isActive
                  ? 'text-[#0F766E] dark:text-[#2DD4BF] bg-teal-500/10 font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Notification Toast */}
      {statusBanner && (
        <div className="max-w-[1280px] w-full mx-auto px-4 sm:px-6 pt-4">
          <div className="p-3.5 rounded-xl sahs-card text-xs font-semibold flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-[#0F766E] dark:bg-[#2DD4BF] sahs-breathe-dot" />
              <span>{statusBanner}</span>
            </div>
            <button
              type="button"
              onClick={() => setStatusBanner(null)}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer p-1 rounded-md"
              aria-label="Dismiss notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

const INITIAL_DOCTORS_SEED: Doctor[] = [
  {
    id: 1,
    name: 'Dr. Elena Rostova',
    specialty: 'Cardiology',
    department: 'Cardiology & Heart Institute',
    qualification: 'MD, FACC',
    experienceYears: 14,
    roomNumber: 'Suite 204',
    availableDays: 'Monday,Wednesday,Friday',
    consultationFee: 180,
    rating: '4.9',
    bio: 'Senior interventional cardiologist specializing in preventive heart care and non-invasive diagnostics.',
  },
  {
    id: 2,
    name: 'Dr. Marcus Vance',
    specialty: 'Neurology',
    department: 'Neurology & Spine Center',
    qualification: 'MD, PhD',
    experienceYears: 11,
    roomNumber: 'Suite 310',
    availableDays: 'Tuesday,Thursday,Saturday',
    consultationFee: 210,
    rating: '4.8',
    bio: 'Specialist in migraine therapeutics, peripheral neuropathy, and clinical neurophysiology.',
  },
  {
    id: 3,
    name: 'Dr. Priya Nair',
    specialty: 'Internal Medicine',
    department: 'Internal Medicine',
    qualification: 'MBBS, MD',
    experienceYears: 9,
    roomNumber: 'Suite 105',
    availableDays: 'Monday,Tuesday,Thursday,Friday',
    consultationFee: 140,
    rating: '4.9',
    bio: 'Comprehensive adult primary care, metabolic wellness, and acute outpatient triage.',
  },
  {
    id: 4,
    name: 'Dr. Julian Thorne',
    specialty: 'Orthopedics',
    department: 'Orthopedics & Sports Medicine',
    qualification: 'MS, FRCS',
    experienceYears: 16,
    roomNumber: 'Suite 118',
    availableDays: 'Monday,Wednesday,Saturday',
    consultationFee: 195,
    rating: '4.7',
    bio: 'Joint preservation, sports injury rehabilitation, and minimally invasive arthroscopy.',
  },
];

export default function HospitalProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const [doctors, setDoctors] = useState<Doctor[]>(INITIAL_DOCTORS_SEED);
  const [schedules, setSchedules] = useState<DoctorSchedule[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [historyLogs, setHistoryLogs] = useState<AppointmentHistoryLog[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = window.localStorage.getItem('sahs_theme');
        if (saved === 'dark' || saved === 'light') return saved;
      } catch {
        // ignore
      }
    }
    return 'light';
  });

  const [sessionUser, setSessionUser] = useState<SessionUser>({
    userName: 'Siddharth Reddy',
    email: 'siddharthreddy432@gmail.com',
    role: 'patient',
    patientId: null,
    idToken: null,
    isAuthenticated: false,
  });

  const [isAdminAuthenticated, setIsAdminAuthenticated] =
    useState<boolean>(false);

  const [pendingUserName, setPendingUserName] = useState<string>('');
  const [pendingRole, setPendingRole] = useState<'patient' | 'admin'>('patient');
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  // Initialize and sync Light/Dark theme class
  useEffect(() => {
    try {
      const savedTheme = window.localStorage.getItem('sahs_theme');
      if (savedTheme === 'dark' || savedTheme === 'light') {
        document.documentElement.classList.toggle('dark', savedTheme === 'dark');
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      try {
        window.localStorage.setItem('sahs_theme', next);
      } catch {
        // ignore
      }
      if (typeof document !== 'undefined') {
        document.documentElement.classList.toggle('dark', next === 'dark');
      }
      return next;
    });
  }, []);

  const showBanner = useCallback((msg: string | null) => {
    setStatusBanner(msg);
    if (msg) {
      setTimeout(() => {
        setStatusBanner((prev) => (prev === msg ? null : prev));
      }, 5000);
    }
  }, []);

  const refreshHospitalData = useCallback(async () => {
    try {
      const res = await fetch('/api/hospital', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      if (data.doctors && data.doctors.length > 0) setDoctors(data.doctors);
      if (data.schedules) setSchedules(data.schedules);
      if (data.patients) setPatients(data.patients);
      if (data.appointments) setAppointments(data.appointments);
      if (data.historyLogs) setHistoryLogs(data.historyLogs);
    } catch (error) {
      console.error('Failed to load SAHS data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Parallelized bootstrap so hospital data and auth resolve concurrently for fast initial load
  useEffect(() => {
    let mounted = true;
    async function bootstrapSession() {
      const dataPromise = refreshHospitalData();
      try {
        const savedAdmin = window.sessionStorage.getItem('sahs_admin_auth');
        if (savedAdmin === 'true') {
          setIsAdminAuthenticated(true);
          await fetch('/api/auth/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'admin_login',
              username: 'Admin',
              password: 'Admin@123',
            }),
          });
          if (mounted) {
            await refreshHospitalData();
          }
        } else {
          const authRes = await fetch('/api/auth/sync', { cache: 'no-store' });
          if (authRes.ok) {
            const authData = await authRes.json();
            if (mounted && authData.authenticated && authData.principal) {
              const p = authData.principal;
              if (p.role === 'ADMIN') {
                setIsAdminAuthenticated(true);
                window.sessionStorage.setItem('sahs_admin_auth', 'true');
              }
              setSessionUser({
                userName: p.userName || 'Siddharth Reddy',
                email: p.email || 'siddharthreddy432@gmail.com',
                role: p.role === 'ADMIN' ? 'admin' : 'patient',
                patientId: p.patientId ?? null,
                idToken: null,
                isAuthenticated: true,
              });
            } else if (mounted) {
              // Ensure default patient profile is initialized so patient appointments always populate immediately
              const defaultSync = await fetch('/api/auth/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  userName: 'Siddharth Reddy',
                  displayName: 'Siddharth Reddy',
                  email: 'siddharthreddy432@gmail.com',
                  role: 'patient',
                }),
              });
              if (defaultSync.ok) {
                const synced = await defaultSync.json();
                setSessionUser({
                  userName: 'Siddharth Reddy',
                  email: 'siddharthreddy432@gmail.com',
                  role: 'patient',
                  patientId: synced.patient?.id || null,
                  idToken: null,
                  isAuthenticated: true,
                });
                await refreshHospitalData();
              }
            }
          }
        }
      } catch {
        // ignore storage/network errors
      } finally {
        await dataPromise;
      }
    }
    bootstrapSession();
    return () => {
      mounted = false;
    };
  }, [refreshHospitalData]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser && fbUser.email) {
        try {
          const token = await fbUser.getIdToken();
          const chosenName =
            pendingUserName.trim() ||
            fbUser.displayName ||
            fbUser.email.split('@')[0];

          const syncRes = await fetch('/api/auth/sync', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              userName: chosenName,
              displayName: chosenName,
              email: fbUser.email,
              role: pendingRole,
            }),
          });

          if (syncRes.ok) {
            const synced = await syncRes.json();
            setSessionUser({
              userName: synced.user?.displayName || chosenName,
              email: fbUser.email.toLowerCase(),
              role: (synced.user?.role as 'patient' | 'admin') || pendingRole,
              patientId: synced.patient?.id || null,
              idToken: token,
              isAuthenticated: true,
            });
            await refreshHospitalData();
          }
        } catch (err) {
          console.error('Error syncing Firebase user:', err);
        }
      }
    });
    return () => unsubscribe();
  }, [pendingUserName, pendingRole, refreshHospitalData]);

  const loginWithGmailPopup = async (
    enteredUserName: string,
    role: 'patient' | 'admin' = 'patient'
  ): Promise<boolean> => {
    setPendingUserName(enteredUserName.trim());
    setPendingRole(role);
    try {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      const user = cred.user;
      const token = await user.getIdToken();
      const matchedName =
        enteredUserName.trim() ||
        user.displayName ||
        (user.email ? user.email.split('@')[0] : 'SAHS User');

      const syncRes = await fetch('/api/auth/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userName: matchedName,
          displayName: matchedName,
          email: user.email,
          role,
        }),
      });

      if (syncRes.ok) {
        const synced = await syncRes.json();
        setSessionUser({
          userName: matchedName,
          email: (user.email || '').toLowerCase(),
          role,
          patientId: synced.patient?.id || null,
          idToken: token,
          isAuthenticated: true,
        });
        await refreshHospitalData();
        showBanner(
          `Welcome, ${matchedName}. Your profile is synced with ${user.email}.`
        );
        return true;
      }
      return false;
    } catch (err) {
      console.error('Google Sign-In popup error:', err);
      throw err;
    }
  };

  const loginWithMatchedGmail = async (
    enteredUserName: string,
    enteredGmail: string,
    role: 'patient' | 'admin' = 'patient'
  ): Promise<boolean> => {
    const cleanName = enteredUserName.trim();
    const cleanEmail = enteredGmail.trim().toLowerCase();

    const syncRes = await fetch('/api/auth/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userName: cleanName,
        displayName: cleanName,
        email: cleanEmail,
        role,
      }),
    });

    if (!syncRes.ok) {
      const err = await syncRes.json().catch(() => ({}));
      throw new Error(err.error || 'Could not match User Name and Gmail account.');
    }

    const synced = await syncRes.json();
    setSessionUser({
      userName: cleanName,
      email: cleanEmail,
      role,
      patientId: synced.patient?.id || null,
      idToken: null,
      isAuthenticated: true,
    });
    await refreshHospitalData();
    showBanner(`Signed in as ${cleanName} (${cleanEmail}).`);
    return true;
  };

  const loginAsAdmin = (username: string, password: string): boolean => {
    if (
      username.trim().toLowerCase() === 'admin' &&
      password.trim() === 'Admin@123'
    ) {
      setIsAdminAuthenticated(true);
      setSessionUser((prev) => ({
        ...prev,
        role: 'admin',
        isAuthenticated: true,
      }));
      try {
        window.sessionStorage.setItem('sahs_admin_auth', 'true');
      } catch {
        // ignore
      }
      fetch('/api/auth/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'admin_login',
          username: username.trim(),
          password: password.trim(),
        }),
      })
        .then(() => refreshHospitalData())
        .catch(() => {});
      showBanner('Signed in to SAHS Admin Portal.');
      return true;
    }
    return false;
  };

  const logoutAdmin = () => {
    setIsAdminAuthenticated(false);
    setSessionUser((prev) => ({
      ...prev,
      role: 'patient',
    }));
    try {
      window.sessionStorage.removeItem('sahs_admin_auth');
    } catch {
      // ignore
    }
    fetch('/api/auth/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'logout' }),
    })
      .then(() => refreshHospitalData())
      .catch(() => {});
    showBanner('Signed out of Admin Portal.');
    router.push('/login');
  };

  const logout = async () => {
    try {
      await firebaseSignOut(auth);
    } catch {
      // ignore
    }
    setIsAdminAuthenticated(false);
    try {
      window.sessionStorage.removeItem('sahs_admin_auth');
    } catch {
      // ignore
    }
    fetch('/api/auth/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'logout' }),
    })
      .then(() => refreshHospitalData())
      .catch(() => {});
    setSessionUser((prev) => ({
      ...prev,
      role: 'patient',
      isAuthenticated: false,
      idToken: null,
    }));
    showBanner('Signed out of SAHS.');
  };

  const openBooking = (docId?: number) => {
    if (docId) {
      router.push(`/book?doctorId=${docId}`);
    } else {
      router.push('/book');
    }
  };

  const isStandaloneAdminRoute = pathname?.startsWith('/admin');

  return (
    <HospitalContext.Provider
      value={{
        doctors,
        schedules,
        patients,
        appointments,
        historyLogs,
        loading,
        theme,
        toggleTheme,
        sessionUser,
        isAdminAuthenticated,
        statusBanner,
        setStatusBanner: showBanner,
        refreshHospitalData,
        openBooking,
        loginWithGmailPopup,
        loginWithMatchedGmail,
        loginAsAdmin,
        logoutAdmin,
        logout,
      }}
    >
      <SmoothScrollProvider>
        <PageTransitionProvider>
          {isStandaloneAdminRoute ? (
            <div className="min-h-screen flex flex-col">
              {statusBanner && (
                <div className="bg-[#0F766E] text-white border-b border-teal-800 px-6 py-2.5 text-xs font-medium flex items-center justify-between">
                  <span>{statusBanner}</span>
                  <button
                    type="button"
                    onClick={() => showBanner(null)}
                    className="text-xs font-bold text-white/90 hover:text-white cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              )}
              <main className="flex-1">{children}</main>
            </div>
          ) : (
            <div className="min-h-screen flex flex-col">
              <PersistentHeader
                sessionUser={sessionUser}
                statusBanner={statusBanner}
                setStatusBanner={showBanner}
                theme={theme}
                toggleTheme={toggleTheme}
              />

              {/* Coordinated Scene Transition Stage */}
              <PageTransition>{children}</PageTransition>

              {/* Warm, Human-Centered Functional Footer */}
              <footer className="border-t border-slate-200/80 dark:border-slate-800/80 bg-white/75 dark:bg-[#0D161C]/80 backdrop-blur-md px-4 sm:px-6 py-6 mt-12">
                <div className="max-w-[1280px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-2.5">
                    <Image
                      src={SAHS_LOGO_SRC}
                      alt="SAHS Logo"
                      width={24}
                      height={24}
                      referrerPolicy="no-referrer"
                      className="w-6 h-6 rounded-md object-cover"
                    />
                    <span className="font-bold text-slate-900 dark:text-white">
                      SAHS
                    </span>
                    <span>·</span>
                    <span>Smart Appointment &amp; Hospital System</span>
                    <span className="hidden md:inline-flex items-center gap-1 text-teal-700 dark:text-teal-400 font-medium ml-2">
                      <HeartHandshake className="w-3.5 h-3.5" />
                      <span>Designed around calm patient care</span>
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 font-medium">
                    {SAHS_NAV_ROUTES.map((route) => (
                      <Link
                        key={route.href}
                        href={route.href}
                        className="hover:text-[#0F766E] dark:hover:text-[#2DD4BF] transition-colors"
                      >
                        {route.label}
                      </Link>
                    ))}
                    <Link
                      href="/login"
                      className="hover:text-[#0F766E] dark:hover:text-[#2DD4BF] transition-colors"
                    >
                      Sign In
                    </Link>
                  </div>
                </div>
              </footer>
            </div>
          )}
        </PageTransitionProvider>
      </SmoothScrollProvider>
    </HospitalContext.Provider>
  );
}

