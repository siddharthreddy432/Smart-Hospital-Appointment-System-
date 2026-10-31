'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Doctor, Patient } from './types';
import {
  predictNoShowProbability,
  calculateLeadTimeDays,
} from '../lib/no-show-predictor';
import { X, Mail, User, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  doctors: Doctor[];
  patients: Patient[];
  initialDoctorId: number | null;
  activePatientId: number | null;
  activeUserEmail: string;
  activeUserName: string;
  idToken: string | null;
  onBookingSuccess: (bookedEmail: string) => Promise<void>;
}

const TIME_SLOTS = [
  '09:00',
  '09:30',
  '10:00',
  '10:30',
  '11:00',
  '11:30',
  '14:00',
  '14:30',
  '15:00',
  '15:30',
  '16:00',
];

export default function BookingModal({
  isOpen,
  onClose,
  doctors,
  patients,
  initialDoctorId,
  activePatientId,
  activeUserEmail,
  activeUserName,
  idToken,
  onBookingSuccess,
}: BookingModalProps) {
  const [doctorId, setDoctorId] = useState<number>(
    initialDoctorId || doctors[0]?.id || 1
  );
  const [userName, setUserName] = useState<string>(activeUserName || 'Siddharth Reddy');
  const [userEmail, setUserEmail] = useState<string>(
    activeUserEmail || 'siddharthreddy432@gmail.com'
  );
  const [appointmentDate, setAppointmentDate] = useState<string>('2026-11-06');
  const [timeSlot, setTimeSlot] = useState<string>('10:00');
  const [visitType, setVisitType] = useState<'In-Person' | 'Telehealth'>('In-Person');
  const [smsReminder, setSmsReminder] = useState<boolean>(true);
  const [reason, setReason] = useState<string>('');
  const [clinicalNotes, setClinicalNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [prevDocId, setPrevDocId] = useState(initialDoctorId);
  if (prevDocId !== initialDoctorId && initialDoctorId) {
    setPrevDocId(initialDoctorId);
    setDoctorId(initialDoctorId);
  }

  const [prevEmail, setPrevEmail] = useState(activeUserEmail);
  if (prevEmail !== activeUserEmail && activeUserEmail) {
    setPrevEmail(activeUserEmail);
    setUserEmail(activeUserEmail);
  }

  const [prevName, setPrevName] = useState(activeUserName);
  if (prevName !== activeUserName && activeUserName) {
    setPrevName(activeUserName);
    setUserName(activeUserName);
  }

  const matchedPatient = useMemo(() => {
    const cleanMail = userEmail.trim().toLowerCase();
    return (
      patients.find((p) => p.email.toLowerCase() === cleanMail) ||
      patients.find((p) => p.id === activePatientId) ||
      patients[0]
    );
  }, [patients, userEmail, activePatientId]);

  const selectedDoctor = useMemo(
    () => doctors.find((d) => d.id === Number(doctorId)) || doctors[0],
    [doctors, doctorId]
  );

  const livePrediction = useMemo(() => {
    const leadDays = calculateLeadTimeDays(appointmentDate);
    return predictNoShowProbability({
      leadTimeDays: leadDays,
      priorMissedAppointments: matchedPatient?.missedAppointments ?? 0,
      totalPastAppointments: matchedPatient?.totalAppointments ?? 0,
      patientAge: matchedPatient?.age ?? 30,
      smsReminder,
      distanceKm: matchedPatient?.distanceKm ?? 6,
      chronicConditions: matchedPatient?.chronicConditions ?? 0,
      visitType,
    });
  }, [appointmentDate, matchedPatient, smsReminder, visitType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!userEmail.trim() || !userEmail.includes('@')) {
      setErrorMsg('Please enter a valid Gmail ID so we can link your booking.');
      return;
    }

    if (!userName.trim()) {
      setErrorMsg('Please enter your User Name to match with your Gmail ID.');
      return;
    }

    if (!reason.trim()) {
      setErrorMsg('Please enter the reason or symptoms for your visit.');
      return;
    }

    setSubmitting(true);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (idToken) {
        headers['Authorization'] = `Bearer ${idToken}`;
      }

      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          patientId: matchedPatient?.id,
          userEmail: userEmail.trim().toLowerCase(),
          userName: userName.trim(),
          doctorId: Number(doctorId),
          appointmentDate,
          timeSlot,
          visitType,
          smsReminder,
          reason: reason.trim(),
          clinicalNotes: clinicalNotes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Unable to book appointment.');
      }

      setReason('');
      setClinicalNotes('');
      await onBookingSuccess(userEmail.trim().toLowerCase());
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to book appointment.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="booking-modal-title"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="bg-white border-2 border-teal-100 rounded-3xl max-w-2xl w-full p-6 sm:p-7 space-y-5 my-8 shadow-xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <p className="text-xs font-semibold text-teal-600">
                  SAHS Instant Slot Booking · Gmail Matched
                </p>
                <h2 id="booking-modal-title" className="text-xl font-bold text-slate-900">
                  Book Your Hospital Visit
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close booking dialog"
                className="p-2 text-slate-500 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 flex items-center gap-2.5 text-xs text-red-800">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Matched User Name & Gmail ID Banner */}
              <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-900">
                    Booking Identity (User Name &amp; Gmail ID)
                  </span>
                  <span className="text-xs text-amber-700">
                    Confirmation &amp; history linked to this Gmail
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="booking-user-name"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      User Name
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        id="booking-user-name"
                        type="text"
                        value={userName}
                        onChange={(e) => setUserName(e.target.value)}
                        placeholder="Your full name"
                        className="w-full pl-9 pr-3 py-2 text-sm border border-amber-300 rounded-xl bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="booking-user-email"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      Gmail ID (Used for Booking)
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        id="booking-user-email"
                        type="email"
                        value={userEmail}
                        onChange={(e) => setUserEmail(e.target.value)}
                        placeholder="you@gmail.com"
                        className="w-full pl-9 pr-3 py-2 text-sm border border-amber-300 rounded-xl bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                        required
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="booking-doctor"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Choose Specialist Doctor
                  </label>
                  <select
                    id="booking-doctor"
                    value={doctorId}
                    onChange={(e) => setDoctorId(Number(e.target.value))}
                    className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    {doctors.map((doc) => (
                      <option key={doc.id} value={doc.id}>
                        {doc.name} — {doc.specialty} (${doc.consultationFee})
                      </option>
                    ))}
                  </select>
                  {selectedDoctor && (
                    <p className="text-xs text-slate-500 mt-1">
                      {selectedDoctor.department} · {selectedDoctor.roomNumber}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="booking-patient-preset"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Or Quick-Fill From Existing Patient
                  </label>
                  <select
                    id="booking-patient-preset"
                    value={matchedPatient?.id || ''}
                    onChange={(e) => {
                      const pat = patients.find((p) => p.id === Number(e.target.value));
                      if (pat) {
                        setUserName(pat.fullName);
                        setUserEmail(pat.email);
                      }
                    }}
                    className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    {patients.map((pat) => (
                      <option key={pat.id} value={pat.id}>
                        {pat.fullName} ({pat.email})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label
                    htmlFor="booking-date"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Appointment Date
                  </label>
                  <input
                    id="booking-date"
                    type="date"
                    value={appointmentDate}
                    onChange={(e) => setAppointmentDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-xl bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="booking-time"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Time Slot
                  </label>
                  <select
                    id="booking-time"
                    value={timeSlot}
                    onChange={(e) => setTimeSlot(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-xl bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    {TIME_SLOTS.map((slot) => (
                      <option key={slot} value={slot}>
                        {slot}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <span className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Visit Mode
                  </span>
                  <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setVisitType('In-Person')}
                      className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                        visitType === 'In-Person'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      In-Person
                    </button>
                    <button
                      type="button"
                      onClick={() => setVisitType('Telehealth')}
                      className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                        visitType === 'Telehealth'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Telehealth
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label
                  htmlFor="booking-reason"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Reason for Visit / Symptoms
                </label>
                <input
                  id="booking-reason"
                  type="text"
                  placeholder="e.g., Heart checkup, migraine consultation, knee soreness..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="inline-flex items-center gap-2.5 text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={smsReminder}
                    onChange={(e) => setSmsReminder(e.target.checked)}
                    className="w-4 h-4 accent-teal-600 rounded"
                  />
                  <span>
                    Send automated SMS, WhatsApp &amp; Gmail confirmation to{' '}
                    <strong className="text-slate-900">{userEmail || 'your Gmail'}</strong>
                  </span>
                </label>
              </div>

              {/* Playful Live ML No-Show Risk Preview */}
              <div className="p-4 rounded-2xl bg-teal-50/70 border border-teal-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                    <span className="text-xs font-bold text-slate-900">
                      SAHS Smart No-Show Risk Prediction
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">
                    {livePrediction.recommendation}
                  </p>
                </div>
                <div className="text-left sm:text-right shrink-0">
                  <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                    {livePrediction.probability}%
                  </div>
                  <div
                    className={`text-xs font-bold ${
                      livePrediction.riskLevel === 'High'
                        ? 'text-red-700'
                        : livePrediction.riskLevel === 'Moderate'
                        ? 'text-amber-700'
                        : 'text-emerald-700'
                    }`}
                  >
                    {livePrediction.riskLevel} Risk
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors whitespace-nowrap shrink-0"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 rounded-xl shadow-xs transition-all cursor-pointer whitespace-nowrap shrink-0"
                >
                  {submitting ? 'Booking Slot...' : 'Confirm Appointment'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
