'use client';

import React, { useRef } from 'react';
import gsap from 'gsap';
import {
  Thermometer,
  Wind,
  Zap,
  HeartPulse,
  Droplets,
  Stethoscope,
  Activity,
  ShieldAlert,
} from 'lucide-react';
import { SymptomCategory } from '../lib/csv-export';
import { useGsapAnimation } from './animation/useGsapAnimation';

export interface SymptomPreset {
  id: SymptomCategory;
  label: string;
  defaultReason: string;
  recommendedSpecialty: string;
  badgeText: string;
  description: string;
}

export const SYMPTOM_PRESETS: SymptomPreset[] = [
  {
    id: 'fever',
    label: 'Fever & Chills',
    defaultReason: 'High Fever, Chills & Elevated Body Temperature',
    recommendedSpecialty: 'Internal Medicine',
    badgeText: '102.4°F · Pyrexia Triage',
    description:
      'Elevated body temperature, chills, and general infection evaluation.',
  },
  {
    id: 'cold',
    label: 'Cold & Sneezing',
    defaultReason: 'Severe Cold, Nonstop Sneezing & Sinus Congestion',
    recommendedSpecialty: 'Pulmonology & Respiratory Care',
    badgeText: 'Rhinitis · Upper Airway',
    description:
      'Acute sneezing, sinus congestion, and upper respiratory care.',
  },
  {
    id: 'cough',
    label: 'Cough & Throat',
    defaultReason: 'Persistent Cough, Sore Throat & Hoarseness',
    recommendedSpecialty: 'Pulmonology & Respiratory Care',
    badgeText: 'Pharyngitis · Airway',
    description: 'Throat irritation, persistent cough, and airway evaluation.',
  },
  {
    id: 'headache',
    label: 'Migraine & Head',
    defaultReason: 'Severe Throbbing Migraine & Temple Pressure',
    recommendedSpecialty: 'Neurology & Spine Center',
    badgeText: 'Cephalgia · Neurology',
    description: 'Acute migraine pressure, light sensitivity, and neuro triage.',
  },
  {
    id: 'stomach',
    label: 'Digestive Care',
    defaultReason: 'Acute Stomach Cramps, Indigestion & Nausea',
    recommendedSpecialty: 'Internal Medicine',
    badgeText: 'Gastric · Internal Med',
    description: 'Abdominal discomfort, indigestion, and gastric evaluation.',
  },
  {
    id: 'heart',
    label: 'Heart & BP',
    defaultReason: 'Cardiac Checkup, Palpitations & BP Monitoring',
    recommendedSpecialty: 'Cardiology & Heart Institute',
    badgeText: 'ECG · Cardiology',
    description: 'Blood pressure monitoring, ECG screening, and cardiac review.',
  },
  {
    id: 'pain',
    label: 'Joint & Back',
    defaultReason: 'Acute Lower Back, Shoulder & Joint Stiffness',
    recommendedSpecialty: 'Orthopedics & Sports Medicine',
    badgeText: 'Musculoskeletal · Ortho',
    description: 'Lumbar, shoulder, or joint strain orthopedic consultation.',
  },
  {
    id: 'rash',
    label: 'Skin & Allergy',
    defaultReason: 'Itchy Skin Rash, Hives & Allergic Reaction',
    recommendedSpecialty: 'Dermatology & Aesthetics',
    badgeText: 'Dermatology · Allergy',
    description: 'Localized skin rash, hives, or seasonal allergy reaction.',
  },
  {
    id: 'checkup',
    label: 'Annual Checkup',
    defaultReason: 'Annual Full-Body Health & Preventive Checkup',
    recommendedSpecialty: 'Internal Medicine',
    badgeText: 'Preventive · Vitals',
    description: 'Comprehensive physical exam, blood panel, and vitals review.',
  },
];

export default function SymptomVectorArt({
  category,
}: {
  category: SymptomCategory;
}) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const previousCategoryRef = useRef<SymptomCategory>(category);
  const preset =
    SYMPTOM_PRESETS.find((p) => p.id === category) || SYMPTOM_PRESETS[0];

  // Coordinated foreground & background artwork transition when symptom category changes (Requirement #8)
  useGsapAnimation(
    (_ctx, prefersReducedMotion) => {
      if (previousCategoryRef.current === category) {
        return;
      }
      previousCategoryRef.current = category;

      const root = cardRef.current;
      if (!root || prefersReducedMotion) return;

      const copy = root.querySelector<HTMLElement>('[data-art-copy]');
      const character = root.querySelector<HTMLElement>('[data-art-character]');
      const bgRing = root.querySelector<HTMLElement>('[data-art-ambient]');

      const tl = gsap.timeline({ defaults: { overwrite: 'auto' } });

      if (bgRing) {
        tl.fromTo(
          bgRing,
          { x: 18, scale: 0.9, opacity: 0 },
          {
            x: 0,
            scale: 1,
            opacity: 1,
            duration: 0.45,
            ease: 'power3.out',
            clearProps: 'transform,opacity',
          },
          0
        );
      }

      if (copy) {
        tl.fromTo(
          copy,
          { y: 10, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.35,
            ease: 'power3.out',
            clearProps: 'transform,opacity',
          },
          0.02
        );
      }

      if (character) {
        tl.fromTo(
          character,
          { x: 20, scale: 0.92, opacity: 0 },
          {
            x: 0,
            scale: 1,
            opacity: 1,
            duration: 0.45,
            ease: 'back.out(1.4)',
            clearProps: 'transform,opacity',
          },
          0.04
        );
      }
    },
    { scope: cardRef, dependencies: [category] }
  );

  return (
    <div
      ref={cardRef}
      data-testid={`vector-art-${category}`}
      data-gsap-layer="visual"
      data-gsap-illustration
      className="sahs-card p-5 space-y-3"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#0F766E] dark:text-[#2DD4BF]">
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            {preset.badgeText}
          </span>
          <span className="text-xs font-bold text-slate-900 dark:text-white">
            · {preset.label}
          </span>
        </div>
        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
          {preset.recommendedSpecialty}
        </span>
      </div>

      {/* Compact Clean Vector Stage with Coordinated Foreground & Background Layers */}
      <div
        data-art-stage
        className="relative h-36 w-full sahs-panel rounded-2xl flex items-center justify-between px-5 py-3 overflow-hidden"
      >
        {/* Subtle Layered Ambient Backdrop */}
        <div
          data-art-ambient
          aria-hidden="true"
          className="absolute -right-6 -bottom-6 w-28 h-28 rounded-full bg-teal-500/10 dark:bg-teal-400/10 pointer-events-none"
        />

        <div data-art-copy className="relative z-10 space-y-1 max-w-[58%]">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#0F766E] dark:text-[#2DD4BF]">
            Triage Indicator
          </span>
          <p className="text-xs font-bold text-slate-900 dark:text-white">{preset.label}</p>
          <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug">
            {preset.description}
          </p>
        </div>

        {/* Clean Minimalist Vector Character Preview */}
        <div
          data-art-character
          className="relative z-10 shrink-0 flex flex-col items-center justify-center pr-2"
        >
          {category === 'fever' && (
            <div className="relative flex flex-col items-center">
              <div className="text-[10px] font-mono font-bold text-rose-600 dark:text-rose-400 mb-1 flex items-center gap-1">
                <Thermometer className="w-3 h-3" /> 102.4°F
              </div>
              <div className="w-14 h-14 bg-amber-100 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-700 rounded-full flex flex-col items-center justify-center relative">
                <Droplets className="w-3 h-3 text-sky-600 dark:text-sky-400 absolute top-1 right-1" />
                <div className="flex gap-3">
                  <div className="w-2 h-1 border-b-2 border-slate-800 dark:border-amber-200" />
                  <div className="w-2 h-1 border-b-2 border-slate-800 dark:border-amber-200" />
                </div>
                <div className="flex justify-between w-10 mt-1">
                  <div className="w-2.5 h-1.5 bg-rose-400 rounded-full" />
                  <div className="w-2.5 h-1.5 bg-rose-400 rounded-full" />
                </div>
                <div className="w-8 h-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-full mt-1 rotate-6 flex items-center px-0.5">
                  <div className="w-5 h-1 bg-rose-500 rounded-full" />
                </div>
              </div>
            </div>
          )}

          {category === 'cold' && (
            <div className="relative flex flex-col items-center">
              <div className="text-[10px] font-bold text-sky-600 dark:text-sky-400 mb-1 flex items-center gap-1">
                <Wind className="w-3 h-3" /> Sneezing
              </div>
              <div className="w-14 h-14 bg-amber-100 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-700 rounded-full flex flex-col items-center justify-center relative">
                <div className="flex gap-3 text-xs font-bold text-slate-800 dark:text-amber-100">
                  <span>&gt;</span>
                  <span>&lt;</span>
                </div>
                <div className="w-3 h-3 bg-rose-400 rounded-full" />
                <div className="w-6 h-4 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md -mt-0.5 flex items-center justify-center">
                  <Wind className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                </div>
              </div>
            </div>
          )}

          {category !== 'fever' && category !== 'cold' && (
            <div className="flex flex-col items-center gap-1.5">
              <div className="w-14 h-14 bg-teal-500/10 dark:bg-teal-400/15 border border-teal-500/20 rounded-full flex items-center justify-center text-[#0F766E] dark:text-[#2DD4BF]">
                {category === 'cough' && <Wind className="w-6 h-6" />}
                {category === 'headache' && <Zap className="w-6 h-6" />}
                {category === 'stomach' && <Activity className="w-6 h-6" />}
                {category === 'heart' && <HeartPulse className="w-6 h-6" />}
                {category === 'pain' && <Activity className="w-6 h-6" />}
                {category === 'rash' && <ShieldAlert className="w-6 h-6" />}
                {category === 'checkup' && <Stethoscope className="w-6 h-6" />}
              </div>
              <span className="text-[10px] font-mono font-semibold text-slate-800 dark:text-slate-200">
                {preset.label}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
