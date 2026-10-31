'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useHospital } from '../components/HospitalProvider';
import { usePageTransition } from '../components/animation/PageTransitionProvider';
import AppointmentQrModal, {
  QrMatrixRenderer,
  QrPassAppointmentData,
} from '../components/AppointmentQrModal';
import { generateAppointmentQrPass } from '../lib/qr-checkin';
import {
  ArrowRight,
  Plus,
  QrCode,
  Calendar,
  Clock,
  Stethoscope,
  Smartphone,
  HeartHandshake,
  Sparkles,
} from 'lucide-react';

export default function HomePage() {
  const { navigateWithTransition } = usePageTransition();
  const {
    doctors,
    patients,
    appointments,
    schedules,
    sessionUser,
    refreshHospitalData,
    setStatusBanner,
  } = useHospital();

  const [previewDocId, setPreviewDocId] = useState<number>(
    doctors[0]?.id || 1
  );
  const [previewSlot, setPreviewSlot] = useState<string>('10:00 AM');
  const [activeQrAppointment, setActiveQrAppointment] =
    useState<QrPassAppointmentData | null>(null);

  const scheduledAppointments = appointments.filter(
    (a) => a.status === 'Scheduled'
  );
  const activeShiftsCount = schedules.filter((s) => s.isAvailable).length;

  const firstName =
    (sessionUser.userName || 'Patient').trim().split(' ')[0] || 'Patient';

  const handleQrCheckInScan = async (
    appointmentId: number,
    checkInCode: string
  ) => {
    const res = await fetch('/api/appointments', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appointmentId,
        newStatus: 'Completed',
        clinicalNotes: `CHECKED-IN VIA QR (${checkInCode}) at Hospital Reception Kiosk`,
        changedBy: `${sessionUser.userName} (QR Kiosk Scan)`,
      }),
    });
    if (res.ok) {
      await refreshHospitalData();
      setStatusBanner(
        `Checked in via QR Pass (${checkInCode}) for Appointment #${appointmentId}.`
      );
      setActiveQrAppointment((prev) =>
        prev
          ? {
              ...prev,
              status: 'Completed',
              clinicalNotes: `CHECKED-IN VIA QR (${checkInCode})`,
            }
          : null
      );
    }
  };

  return (
    <div className="space-y-7">
      {/* Warm, Human-Centered Hero + Clean Appointment Booking Preview */}
      <section
        data-gsap-layer="card"
        className="sahs-card relative overflow-hidden p-6 sm:p-9"
      >
        <div
          data-gsap-layer="ambient"
          aria-hidden="true"
          className="absolute -right-16 -top-16 w-72 h-72 rounded-full bg-teal-500/[0.06] dark:bg-teal-400/[0.07] blur-2xl pointer-events-none"
        />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left 7 Cols: Unboxed Kicker, Warm Headline, Human Reassurance & Tactile CTAs */}
          <div className="lg:col-span-7 space-y-4">
            {/* Unboxed Typographic Kicker */}
            <div
              data-gsap-layer="subheading"
              className="flex flex-wrap items-center gap-2 text-xs font-semibold tracking-wide text-[#0F766E] dark:text-[#2DD4BF]"
            >
              <HeartHandshake className="w-4 h-4 shrink-0" />
              <span>Welcome back, {firstName}</span>
              <span className="text-slate-300 dark:text-slate-700">·</span>
              <span className="text-slate-500 dark:text-slate-400 font-medium">
                Calm, connected hospital care
              </span>
            </div>

            <h1
              data-gsap-layer="heading"
              className="text-2xl sm:text-3xl lg:text-[38px] font-extrabold text-slate-900 dark:text-white tracking-tight leading-[1.15]"
            >
              Streamlined Hospital Scheduling &amp; Real-Time QR Check-In
            </h1>

            <p
              data-gsap-layer="subheading"
              className="text-sm text-slate-600 dark:text-slate-300 max-w-xl leading-relaxed"
            >
              Start booking your specialist consultation on your laptop or scan
              the live QR code to finish comfortably from your phone—then walk
              straight through reception with your digital arrival pass.
            </p>

            <div
              data-gsap-layer="subheading"
              className="flex flex-wrap items-center gap-3 pt-1.5"
            >
              <Link
                href="/book"
                className="sahs-button-primary inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-xl"
              >
                <Plus className="w-4 h-4" />
                <span>Book Appointment</span>
              </Link>

              <Link
                href="/doctors"
                className="sahs-button-secondary inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-xl"
              >
                <Stethoscope className="w-4 h-4 text-[#0F766E] dark:text-[#2DD4BF]" />
                <span>Explore Doctors</span>
              </Link>
            </div>

            {/* Unboxed Human Care Assurance Footnote */}
            <div className="pt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#0F766E] dark:text-[#2DD4BF]" />
                <span>Instant two-way smartphone sync</span>
              </span>
              <span>·</span>
              <span>Zero waiting-room paperwork</span>
              <span>·</span>
              <span>Average check-in under 30 seconds</span>
            </div>
          </div>

          {/* Right 5 Cols: Clean Appointment Booking Preview */}
          <div
            data-gsap-layer="visual"
            data-gsap-illustration
            className="lg:col-span-5 sahs-panel p-5 sm:p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 pb-3">
              <div>
                <span className="text-[11px] font-bold text-[#0F766E] dark:text-[#2DD4BF] uppercase tracking-wider block">
                  Quick Booking Preview
                </span>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                  Select Specialist &amp; Preferred Time
                </h2>
              </div>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-teal-700 dark:text-teal-400">
                <Smartphone className="w-3.5 h-3.5" />
                <span>QR Sync Ready</span>
              </span>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label
                  htmlFor="preview-doctor"
                  className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Specialist &amp; Department
                </label>
                <select
                  id="preview-doctor"
                  value={previewDocId}
                  onChange={(e) => setPreviewDocId(Number(e.target.value))}
                  className="w-full px-3 py-2.5 text-xs border rounded-xl font-medium"
                >
                  {doctors.length === 0 ? (
                    <option value={1}>
                      Dr. Elena Rostova — Cardiology (₹800)
                    </option>
                  ) : (
                    doctors.map((doc) => (
                      <option key={doc.id} value={doc.id}>
                        {doc.name} — {doc.specialty} (₹{doc.consultationFee})
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <span className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Available Morning &amp; Afternoon Slots
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {['09:30 AM', '10:00 AM', '02:00 PM'].map((slot) => {
                    const selected = previewSlot === slot;
                    return (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setPreviewSlot(slot)}
                        className={`py-2 px-2.5 rounded-xl text-[11px] font-mono font-semibold border transition-all duration-150 active:scale-[0.96] cursor-pointer ${
                          selected
                            ? 'bg-[#0F766E] dark:bg-[#14B8A6] text-white dark:text-slate-950 border-[#0F766E] dark:border-[#14B8A6] shadow-sm'
                            : 'bg-white dark:bg-slate-900/70 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-800 hover:border-teal-600/50'
                        }`}
                      >
                        {slot}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  navigateWithTransition(`/book?doctorId=${previewDocId || 1}`)
                }
                className="sahs-button-primary w-full py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Continue to Booking Form</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Essential Hospital Statistics (Unboxed Status Labels & Tabular Numerals) */}
      <section
        data-scroll-group
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <div
          data-gsap-layer="card"
          data-scroll-item
          className="sahs-card sahs-card-interactive p-5 flex items-baseline justify-between gap-2"
        >
          <div>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">
              Attending Doctors
            </span>
            <span className="text-2xl font-extrabold font-mono text-slate-900 dark:text-white mt-1 block">
              {doctors.length}
            </span>
          </div>
          <span className="text-[11px] font-semibold text-[#0F766E] dark:text-[#2DD4BF]">
            On Duty Today
          </span>
        </div>

        <div
          data-gsap-layer="card"
          data-scroll-item
          className="sahs-card sahs-card-interactive p-5 flex items-baseline justify-between gap-2"
        >
          <div>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">
              Scheduled Visits
            </span>
            <span className="text-2xl font-extrabold font-mono text-slate-900 dark:text-white mt-1 block">
              {scheduledAppointments.length}
            </span>
          </div>
          <span className="text-[11px] font-semibold text-[#0F766E] dark:text-[#2DD4BF]">
            QR Pass Ready
          </span>
        </div>

        <div
          data-gsap-layer="card"
          data-scroll-item
          className="sahs-card sahs-card-interactive p-5 flex items-baseline justify-between gap-2"
        >
          <div>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">
              Outpatient Shifts
            </span>
            <span className="text-2xl font-extrabold font-mono text-slate-900 dark:text-white mt-1 block">
              {activeShiftsCount}
            </span>
          </div>
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Weekly Blocks
          </span>
        </div>

        <div
          data-gsap-layer="card"
          data-scroll-item
          className="sahs-card sahs-card-interactive p-5 flex items-baseline justify-between gap-2"
        >
          <div>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">
              Registered Patients
            </span>
            <span className="text-2xl font-extrabold font-mono text-slate-900 dark:text-white mt-1 block">
              {patients.length}
            </span>
          </div>
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Verified Records
          </span>
        </div>
      </section>

      {/* Two-Column Workspace: Upcoming Appointments & Attending Specialists */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 7 Cols: Upcoming Appointments & QR Check-In Passes */}
        <section
          data-gsap-layer="card"
          data-scroll-reveal="panel"
          className="lg:col-span-7 sahs-card p-5 sm:p-6 space-y-4"
        >
          <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 pb-3.5">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Upcoming Appointments &amp; Check-In QR Passes
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Show your appointment QR pass at Reception Desk A when you arrive.
              </p>
            </div>
            <Link
              href="/appointments"
              className="text-xs font-bold text-[#0F766E] dark:text-[#2DD4BF] hover:underline inline-flex items-center gap-1 shrink-0"
            >
              <span>All Appointments</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {scheduledAppointments.length === 0 ? (
            <div className="p-6 sahs-panel text-center space-y-2.5">
              <p className="text-xs font-bold text-slate-900 dark:text-white">
                You have no upcoming scheduled appointments right now.
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Choose a specialist and time slot that works best for your schedule.
              </p>
              <Link
                href="/book"
                className="sahs-button-primary inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Book Appointment</span>
              </Link>
            </div>
          ) : (
            <div data-scroll-group className="space-y-3">
              {scheduledAppointments.slice(0, 3).map((appt) => {
                const pat = patients.find((p) => p.id === appt.patientId);
                const doc = doctors.find((d) => d.id === appt.doctorId);
                const qrData: QrPassAppointmentData = {
                  id: appt.id,
                  appointmentDate: appt.appointmentDate,
                  timeSlot: appt.timeSlot,
                  visitType: appt.visitType,
                  reason: appt.reason,
                  status: appt.status,
                  clinicalNotes: appt.clinicalNotes,
                  patientName: pat?.fullName || sessionUser.userName,
                  patientEmail: pat?.email || sessionUser.email,
                  doctorName: doc?.name || `Doctor #${appt.doctorId}`,
                  doctorSpecialty: doc?.specialty || 'General Medicine',
                  roomNumber: doc?.roomNumber || 'Suite 101',
                };
                const qrPass = generateAppointmentQrPass({
                  appointmentId: qrData.id,
                  patientName: qrData.patientName,
                  patientEmail: qrData.patientEmail,
                  doctorName: qrData.doctorName,
                  appointmentDate: qrData.appointmentDate,
                  timeSlot: qrData.timeSlot,
                });

                return (
                  <div
                    key={appt.id}
                    data-scroll-item
                    className="p-4 sahs-panel flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-150 hover:border-teal-600/40"
                  >
                    <div className="space-y-1.5">
                      {/* Unboxed Status & Token Metadata */}
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-bold text-[#0F766E] dark:text-[#2DD4BF]">
                          {appt.status}
                        </span>
                        <span className="text-slate-300 dark:text-slate-600">
                          ·
                        </span>
                        <span className="font-mono text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                          {qrPass.checkInCode}
                        </span>
                      </div>

                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        {qrData.doctorName}{' '}
                        <span className="font-medium text-slate-500 dark:text-slate-400">
                          · {qrData.doctorSpecialty} ({qrData.roomNumber})
                        </span>
                      </h3>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400 font-mono">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-[#0F766E] dark:text-[#2DD4BF]" />
                          {appt.appointmentDate}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-[#0F766E] dark:text-[#2DD4BF]" />
                          {appt.timeSlot}
                        </span>
                        <span className="text-slate-700 dark:text-slate-200 font-sans font-medium">
                          Patient: {qrData.patientName}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <button
                        type="button"
                        onClick={() => setActiveQrAppointment(qrData)}
                        className="sahs-button-primary px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span>QR Pass</span>
                      </button>
                      <div
                        onClick={() => setActiveQrAppointment(qrData)}
                        className="cursor-pointer hidden sm:block p-1 rounded-lg bg-white"
                        title="Open QR Check-In Pass"
                      >
                        <QrMatrixRenderer matrix={qrPass.matrix} cellSize={3} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Right 5 Cols: Attending Doctors (Unboxed Specialty Metadata) */}
        <section
          data-gsap-layer="card"
          data-scroll-reveal="panel"
          className="lg:col-span-5 sahs-card p-5 sm:p-6 space-y-4"
        >
          <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 pb-3.5">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Attending Specialists
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Compassionate specialists with direct outpatient booking.
              </p>
            </div>
            <Link
              href="/doctors"
              className="text-xs font-bold text-[#0F766E] dark:text-[#2DD4BF] hover:underline inline-flex items-center gap-1"
            >
              <span>Explore All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div data-scroll-group className="space-y-2.5">
            {doctors.slice(0, 4).map((doc) => (
              <div
                key={doc.id}
                data-scroll-item
                className="p-3.5 sahs-panel flex items-center justify-between gap-3 transition-all duration-150 hover:border-teal-600/40"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {doc.name}
                    </h3>
                    <span className="text-slate-300 dark:text-slate-600">·</span>
                    <span className="text-[11px] font-semibold text-[#0F766E] dark:text-[#2DD4BF] truncate">
                      {doc.specialty}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                    {doc.roomNumber} · {doc.availableDays.replace(/,/g, ', ')} ·{' '}
                    <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">
                      ₹{doc.consultationFee}
                    </span>
                  </p>
                </div>

                <Link
                  href={`/book?doctorId=${doc.id}`}
                  className="sahs-button-secondary px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0"
                >
                  Book
                </Link>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* QR Code Check-In Modal */}
      <AppointmentQrModal
        appointment={activeQrAppointment}
        isOpen={Boolean(activeQrAppointment)}
        onClose={() => setActiveQrAppointment(null)}
        onCheckInScan={handleQrCheckInScan}
      />
    </div>
  );
}

