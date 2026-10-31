'use client';

import React, { useState } from 'react';
import {
  predictNoShowProbability,
  NoShowFeatures,
} from '../lib/no-show-predictor';
import {
  Calculator,
  Copy,
  Check,
  Sliders,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';

const PYTHON_SOURCE_SNIPPET = `# python/no_show_predictor.py
import math
from dataclasses import dataclass

@dataclass
class PatientBookingFeatures:
    lead_time_days: int
    prior_missed_appointments: int
    total_past_appointments: int
    patient_age: int
    sms_reminder: bool
    distance_km: float
    chronic_conditions: int = 0
    visit_type: str = "In-Person"

class AppointmentNoShowModel:
    INTERCEPT = -1.85

    def predict_proba(self, f: PatientBookingFeatures) -> dict:
        z = self.INTERCEPT
        z += max(0, min(180, f.lead_time_days)) * 0.052
        prior_rate = (f.prior_missed_appointments / f.total_past_appointments) if f.total_past_appointments > 0 else 0.0
        z += (prior_rate * 2.15) + (min(f.prior_missed_appointments, 6) * 0.24)
        z += -0.62 if f.sms_reminder else 0.38
        if 18 <= f.patient_age <= 32:
            z += 0.28
        elif f.patient_age >= 60:
            z += -0.18
        z += -0.35 if f.visit_type == "Telehealth" else (f.distance_km * 0.022)
        if f.chronic_conditions > 0:
            z += -0.16 * min(f.chronic_conditions, 3)

        prob = max(2, min(96, round((1.0 / (1.0 + math.exp(-z))) * 100)))
        risk = "High" if prob >= 50 else ("Moderate" if prob >= 25 else "Low")
        return {"probability_percent": prob, "risk_level": risk, "log_odds": round(z, 3)}`;

export default function NoShowSimulatorView() {
  const [features, setFeatures] = useState<NoShowFeatures>({
    leadTimeDays: 14,
    priorMissedAppointments: 1,
    totalPastAppointments: 5,
    patientAge: 29,
    smsReminder: true,
    distanceKm: 12,
    chronicConditions: 0,
    visitType: 'In-Person',
  });
  const [copied, setCopied] = useState(false);

  const prediction = predictNoShowProbability(features);

  const handleCopyPython = () => {
    navigator.clipboard?.writeText(PYTHON_SOURCE_SNIPPET);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const applyPreset = (preset: 'low' | 'moderate' | 'high') => {
    if (preset === 'low') {
      setFeatures({
        leadTimeDays: 3,
        priorMissedAppointments: 0,
        totalPastAppointments: 9,
        patientAge: 58,
        smsReminder: true,
        distanceKm: 4,
        chronicConditions: 2,
        visitType: 'In-Person',
      });
    } else if (preset === 'moderate') {
      setFeatures({
        leadTimeDays: 15,
        priorMissedAppointments: 1,
        totalPastAppointments: 5,
        patientAge: 34,
        smsReminder: true,
        distanceKm: 16,
        chronicConditions: 0,
        visitType: 'In-Person',
      });
    } else {
      setFeatures({
        leadTimeDays: 28,
        priorMissedAppointments: 3,
        totalPastAppointments: 5,
        patientAge: 24,
        smsReminder: false,
        distanceKm: 26,
        chronicConditions: 0,
        visitType: 'In-Person',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div
        data-gsap-layer="card"
        className="sahs-card p-6 flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div className="space-y-1.5">
          <span
            data-gsap-layer="subheading"
            className="text-xs font-bold text-[#0F766E] dark:text-[#2DD4BF] uppercase tracking-wider block"
          >
            Predictive Care Support
          </span>
          <h1
            data-gsap-layer="heading"
            className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight"
          >
            Appointment Attendance &amp; No-Show Predictor
          </h1>
          <p data-gsap-layer="subheading" className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
            Identify patients who may benefit from a warm reminder call or telehealth option using our clinical logistic regression model (<code className="font-mono text-[#0F766E] dark:text-[#2DD4BF]">python/no_show_predictor.py</code>).
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {(['low', 'moderate', 'high'] as const).map((tier) => (
            <button
              key={tier}
              type="button"
              onClick={() => applyPreset(tier)}
              className="sahs-button-secondary px-3 py-1.5 text-xs font-semibold rounded-xl capitalize cursor-pointer"
            >
              {tier} Risk Preset
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div
          data-gsap-layer="card"
          className="lg:col-span-7 sahs-card p-5 sm:p-6 space-y-5"
        >
          <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800/80 pb-3.5">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#0F766E] dark:text-[#2DD4BF]" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Patient &amp; Scheduling Parameters
              </h2>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
              z = {prediction.logOdds}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs">
            <div>
              <div className="flex justify-between font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                <label htmlFor="sim-lead-time">Lead Time (Days)</label>
                <span className="font-mono text-[#0F766E] dark:text-[#2DD4BF]">{features.leadTimeDays}d</span>
              </div>
              <input
                id="sim-lead-time"
                type="range"
                min={0}
                max={60}
                value={features.leadTimeDays}
                onChange={(e) =>
                  setFeatures((prev) => ({
                    ...prev,
                    leadTimeDays: Number(e.target.value),
                  }))
                }
                className="w-full accent-[#0F766E] dark:accent-[#2DD4BF] cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                <label htmlFor="sim-age">Patient Age</label>
                <span className="font-mono text-[#0F766E] dark:text-[#2DD4BF]">{features.patientAge} yrs</span>
              </div>
              <input
                id="sim-age"
                type="range"
                min={1}
                max={95}
                value={features.patientAge}
                onChange={(e) =>
                  setFeatures((prev) => ({
                    ...prev,
                    patientAge: Number(e.target.value),
                  }))
                }
                className="w-full accent-[#0F766E] dark:accent-[#2DD4BF] cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                <label htmlFor="sim-missed">Prior Missed Visits</label>
                <span className="font-mono text-[#0F766E] dark:text-[#2DD4BF]">
                  {features.priorMissedAppointments}
                </span>
              </div>
              <input
                id="sim-missed"
                type="range"
                min={0}
                max={10}
                value={features.priorMissedAppointments}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setFeatures((prev) => ({
                    ...prev,
                    priorMissedAppointments: val,
                    totalPastAppointments: Math.max(
                      prev.totalPastAppointments,
                      val
                    ),
                  }));
                }}
                className="w-full accent-[#0F766E] dark:accent-[#2DD4BF] cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                <label htmlFor="sim-total">Total Past Visits</label>
                <span className="font-mono text-[#0F766E] dark:text-[#2DD4BF]">
                  {features.totalPastAppointments}
                </span>
              </div>
              <input
                id="sim-total"
                type="range"
                min={0}
                max={25}
                value={features.totalPastAppointments}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setFeatures((prev) => ({
                    ...prev,
                    totalPastAppointments: Math.max(
                      val,
                      prev.priorMissedAppointments
                    ),
                  }));
                }}
                className="w-full accent-[#0F766E] dark:accent-[#2DD4BF] cursor-pointer"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-200/80 dark:border-slate-800/80">
            <div className="flex items-center gap-1.5">
              {(['In-Person', 'Telehealth'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() =>
                    setFeatures((prev) => ({ ...prev, visitType: mode }))
                  }
                  className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                    features.visitType === mode
                      ? 'sahs-button-primary'
                      : 'sahs-button-secondary'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() =>
                setFeatures((prev) => ({
                  ...prev,
                  smsReminder: !prev.smsReminder,
                }))
              }
              className={`py-2 px-3.5 text-xs font-bold rounded-xl flex items-center justify-between cursor-pointer ${
                features.smsReminder
                  ? 'sahs-button-primary'
                  : 'sahs-button-secondary'
              }`}
            >
              <span>
                {features.smsReminder ? 'SMS Reminder On' : 'SMS Reminder Off'}
              </span>
              <span className="font-mono">
                {features.smsReminder ? '-0.62' : '+0.38'}
              </span>
            </button>
          </div>
        </div>

        <div
          data-gsap-layer="visual"
          data-gsap-illustration
          className="lg:col-span-5 sahs-card p-5 sm:p-6 space-y-4"
        >
          <div className="flex items-start justify-between border-b border-slate-200/80 dark:border-slate-800/80 pb-3.5">
            <div>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Predicted No-Show Probability
              </span>
              <div className="flex items-baseline gap-3 mt-1">
                <span className="text-3xl font-extrabold font-mono text-slate-900 dark:text-white">
                  {prediction.probability}%
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0F766E] dark:text-[#2DD4BF]">
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                  {prediction.riskLevel} Risk
                </span>
              </div>
            </div>
            <Calculator className="w-4 h-4 text-[#0F766E] dark:text-[#2DD4BF]" />
          </div>

          <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#0F766E] dark:bg-[#2DD4BF] transition-all duration-150"
              style={{ width: `${prediction.probability}%` }}
            />
          </div>

          <div className="divide-y divide-slate-200/70 dark:divide-slate-800/70 text-xs">
            {prediction.factors.map((f, idx) => (
              <div
                key={idx}
                className="py-2.5 flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {f.direction === 'increase' ? (
                    <TrendingUp className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                  ) : f.direction === 'decrease' ? (
                    <TrendingDown className="w-3.5 h-3.5 text-[#0F766E] dark:text-[#2DD4BF] shrink-0" />
                  ) : (
                    <Minus className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  )}
                  <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                    {f.label}
                  </span>
                </div>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {f.weight > 0 ? `+${f.weight}` : f.weight}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Python Source Block */}
      <div
        data-gsap-layer="card"
        data-scroll-reveal="panel"
        className="sahs-card overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200/80 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900/50">
          <h3 className="text-xs font-bold text-slate-900 dark:text-white">
            Python Component · python/no_show_predictor.py
          </h3>
          <button
            type="button"
            onClick={handleCopyPython}
            className="sahs-button-secondary px-3 py-1.5 text-xs font-bold rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
          >
            {copied ? (
              <Check className="w-3 h-3 text-[#0F766E] dark:text-[#2DD4BF]" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
            <span>{copied ? 'Copied' : 'Copy Python'}</span>
          </button>
        </div>
        <pre className="p-5 text-xs font-mono text-slate-800 dark:text-slate-200 bg-white/50 dark:bg-slate-950/60 overflow-x-auto leading-relaxed">
          <code>{PYTHON_SOURCE_SNIPPET}</code>
        </pre>
      </div>
    </div>
  );
}
