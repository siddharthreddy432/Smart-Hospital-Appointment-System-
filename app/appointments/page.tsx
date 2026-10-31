'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useHospital } from '../../components/HospitalProvider';
import AppointmentQrModal, {
  QrMatrixRenderer,
  QrPassAppointmentData,
} from '../../components/AppointmentQrModal';
import { generateAppointmentQrPass } from '../../lib/qr-checkin';
import {
  Search,
  Plus,
  Mail,
  QrCode,
  Calendar,
  Clock,
  User,
} from 'lucide-react';

export default function AppointmentsPage() {
  const {
    doctors,
    patients,
    appointments,
    historyLogs,
    sessionUser,
    refreshHospitalData,
    setStatusBanner,
  } = useHospital();

  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [onlyMyGmail, setOnlyMyGmail] = useState<boolean>(false);
  const [selectedQrAppt, setSelectedQrAppt] =
    useState<QrPassAppointmentData | null>(null);

  const doctorMap = useMemo(() => {
    const map = new Map<number, (typeof doctors)[0]>();
    doctors.forEach((d) => map.set(d.id, d));
    return map;
  }, [doctors]);

  const patientMap = useMemo(() => {
    const map = new Map<number, (typeof patients)[0]>();
    patients.forEach((p) => map.set(p.id, p));
    return map;
  }, [patients]);

  const upcomingAppt = useMemo(() => {
    return (
      appointments.find((a) => a.status === 'Scheduled') ||
      appointments[0] ||
      null
    );
  }, [appointments]);

  const filteredAppointments = useMemo(() => {
    const cleanMyEmail = sessionUser.email.trim().toLowerCase();
    return appointments.filter((appt) => {
      const pat = patientMap.get(appt.patientId);
      const doc = doctorMap.get(appt.doctorId);

      if (onlyMyGmail) {
        const patEmail = pat?.email.toLowerCase() || '';
        const bookedUid = (appt.bookedByUid || '').toLowerCase();
        if (patEmail !== cleanMyEmail && bookedUid !== cleanMyEmail) {
          return false;
        }
      }

      const matchesStatus =
        statusFilter === 'All' || appt.status === statusFilter;
      const q = searchQuery.trim().toLowerCase();
      if (!q) return matchesStatus;

      const patName = pat?.fullName.toLowerCase() || '';
      const patMail = pat?.email.toLowerCase() || '';
      const docName = doc?.name.toLowerCase() || '';
      const reasonText = appt.reason.toLowerCase();

      return (
        matchesStatus &&
        (patName.includes(q) ||
          patMail.includes(q) ||
          docName.includes(q) ||
          reasonText.includes(q))
      );
    });
  }, [
    appointments,
    statusFilter,
    searchQuery,
    onlyMyGmail,
    sessionUser.email,
    patientMap,
    doctorMap,
  ]);

  const handleStatusChange = async (
    appointmentId: number,
    newStatus: 'Scheduled' | 'Completed' | 'Cancelled' | 'No-Show',
    customNote?: string
  ) => {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (sessionUser.idToken) {
        headers['Authorization'] = `Bearer ${sessionUser.idToken}`;
      }
      const res = await fetch('/api/appointments', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          appointmentId,
          newStatus,
          ...(customNote ? { clinicalNotes: customNote } : {}),
          changedBy: `${sessionUser.userName} (${sessionUser.email})`,
        }),
      });
      if (res.ok) {
        await refreshHospitalData();
        setStatusBanner(
          customNote
            ? `Checked in via QR Pass for Appointment #${appointmentId}!`
            : `Appointment #${appointmentId} marked as ${newStatus}.`
        );
      }
    } catch (error) {
      console.error('Status update error:', error);
    }
  };

  const handleQrCheckInScan = async (
    appointmentId: number,
    checkInCode: string
  ) => {
    await handleStatusChange(
      appointmentId,
      'Completed',
      `CHECKED-IN VIA QR (${checkInCode}) at Hospital Reception Kiosk`
    );
    setSelectedQrAppt((prev) =>
      prev
        ? {
            ...prev,
            status: 'Completed',
            clinicalNotes: `CHECKED-IN VIA QR (${checkInCode})`,
          }
        : null
    );
  };

  return (
    <div className="space-y-6">
      {/* Patient Dashboard Top Bar */}
      <div
        data-gsap-layer="card"
        className="sahs-card p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div className="space-y-1">
          <span
            data-gsap-layer="subheading"
            className="text-xs font-bold text-[#0F766E] dark:text-[#2DD4BF] uppercase tracking-wider block"
          >
            Patient Care Portal
          </span>
          <h1
            data-gsap-layer="heading"
            className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white"
          >
            Upcoming Appointments, Profile &amp; QR Check-In
          </h1>
          <p
            data-gsap-layer="subheading"
            className="text-xs text-slate-500 dark:text-slate-400"
          >
            Present your digital QR check-in pass at the hospital lobby kiosk
            upon arrival—our care team will guide you to your suite.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setOnlyMyGmail((prev) => !prev)}
            className={`px-3.5 py-2 text-xs font-bold rounded-xl border cursor-pointer transition-all duration-150 inline-flex items-center gap-1.5 active:scale-[0.97] ${
              onlyMyGmail
                ? 'bg-[#0F766E] dark:bg-[#14B8A6] text-white dark:text-slate-950 border-[#0F766E] dark:border-[#14B8A6]'
                : 'sahs-button-secondary'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>
              {onlyMyGmail
                ? `Filtered: ${sessionUser.email}`
                : 'Filter by My Gmail'}
            </span>
          </button>

          <Link
            href="/book"
            className="sahs-button-primary inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Book Appointment</span>
          </Link>
        </div>
      </div>

      {/* Patient Dashboard Summary: Upcoming Appointment + QR Check-In Pass & Basic Profile */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left 8 Cols: Upcoming Appointment + QR Check-In Pass */}
        <div
          data-gsap-layer="visual"
          data-gsap-illustration
          className="lg:col-span-8 sahs-card p-5 sm:p-6 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 pb-3 mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-[#0F766E] dark:text-[#2DD4BF]">
              Upcoming Appointment &amp; QR Check-In Pass
            </span>
            {upcomingAppt && (
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                Status: {upcomingAppt.status}
              </span>
            )}
          </div>

          {!upcomingAppt ? (
            <div className="p-6 text-center sahs-panel space-y-2.5">
              <p className="text-xs font-bold text-slate-900 dark:text-white">
                No upcoming appointment scheduled.
              </p>
              <Link
                href="/book"
                className="sahs-button-primary inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Schedule Now</span>
              </Link>
            </div>
          ) : (
            (() => {
              const pat = patientMap.get(upcomingAppt.patientId);
              const doc = doctorMap.get(upcomingAppt.doctorId);
              const qrData: QrPassAppointmentData = {
                id: upcomingAppt.id,
                appointmentDate: upcomingAppt.appointmentDate,
                timeSlot: upcomingAppt.timeSlot,
                visitType: upcomingAppt.visitType,
                reason: upcomingAppt.reason,
                status: upcomingAppt.status,
                clinicalNotes: upcomingAppt.clinicalNotes,
                patientName: pat?.fullName || sessionUser.userName,
                patientEmail: pat?.email || sessionUser.email,
                patientPhone: pat?.phone,
                patientAge: pat?.age,
                patientGender: pat?.gender,
                bloodGroup: pat?.bloodGroup,
                doctorName: doc?.name || `Doctor #${upcomingAppt.doctorId}`,
                doctorSpecialty: doc?.specialty || 'Internal Medicine',
                roomNumber: doc?.roomNumber || 'Suite 101',
              };
              const qrPass = generateAppointmentQrPass({
                appointmentId: qrData.id,
                patientName: qrData.patientName,
                patientEmail: qrData.patientEmail,
                patientPhone: qrData.patientPhone,
                patientAge: qrData.patientAge,
                patientGender: qrData.patientGender,
                bloodGroup: qrData.bloodGroup,
                doctorName: qrData.doctorName,
                doctorSpecialty: qrData.doctorSpecialty,
                roomNumber: qrData.roomNumber,
                appointmentDate: qrData.appointmentDate,
                timeSlot: qrData.timeSlot,
                reason: qrData.reason,
              });

              return (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 sahs-panel p-4 sm:p-5">
                  <div className="space-y-2">
                    <div className="font-mono text-xs font-bold text-[#0F766E] dark:text-[#2DD4BF]">
                      Token · {qrPass.checkInCode}
                    </div>
                    <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                      {qrData.doctorName} · {qrData.doctorSpecialty}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {qrData.roomNumber} · {upcomingAppt.reason}
                    </p>
                    <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-slate-700 dark:text-slate-200 pt-1">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-[#0F766E] dark:text-[#2DD4BF]" />
                        {upcomingAppt.appointmentDate}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-[#0F766E] dark:text-[#2DD4BF]" />
                        {upcomingAppt.timeSlot}
                      </span>
                    </div>
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => setSelectedQrAppt(qrData)}
                        className="sahs-button-primary px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span>Open Check-In QR Pass</span>
                      </button>
                    </div>
                  </div>

                  <div
                    onClick={() => setSelectedQrAppt(qrData)}
                    className="cursor-pointer shrink-0 flex flex-col items-center gap-1.5 p-2 rounded-xl bg-white"
                  >
                    <QrMatrixRenderer matrix={qrPass.matrix} cellSize={4} />
                    <span className="text-[10px] font-mono text-slate-600">
                      Click to Scan
                    </span>
                  </div>
                </div>
              );
            })()
          )}
        </div>

        {/* Right 4 Cols: Basic Patient Profile (Unboxed Clean Rows) */}
        <div
          data-gsap-layer="card"
          className="lg:col-span-4 sahs-card p-5 sm:p-6 flex flex-col justify-between space-y-4"
        >
          <div>
            <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 pb-3 mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Patient Profile
              </span>
              <User className="w-4 h-4 text-[#0F766E] dark:text-[#2DD4BF]" />
            </div>

            <div className="divide-y divide-slate-200/70 dark:divide-slate-800/70 text-xs">
              <div className="py-2.5 flex items-center justify-between gap-2">
                <span className="text-slate-500 dark:text-slate-400">
                  Patient Name
                </span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {sessionUser.userName}
                </span>
              </div>
              <div className="py-2.5 flex items-center justify-between gap-2">
                <span className="text-slate-500 dark:text-slate-400">
                  Linked Gmail
                </span>
                <span className="font-mono font-semibold text-[#0F766E] dark:text-[#2DD4BF] truncate">
                  {sessionUser.email}
                </span>
              </div>
            </div>
          </div>

          <Link
            href="/login"
            className="sahs-button-secondary w-full py-2.5 px-3 rounded-xl text-xs font-bold text-center"
          >
            Switch Patient Account
          </Link>
        </div>
      </div>

      {/* Search & Unboxed Status Filter */}
      <div
        data-gsap-layer="subheading"
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
      >
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            aria-label="Search appointments"
            placeholder="Search by patient, Gmail, doctor, or symptom..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs border rounded-xl"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
          {['All', 'Scheduled', 'Completed', 'No-Show', 'Cancelled'].map(
            (st) => {
              const active = statusFilter === st;
              return (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer active:scale-[0.96] ${
                    active
                      ? 'bg-[#0F766E] dark:bg-[#14B8A6] text-white dark:text-slate-950 font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.05]'
                  }`}
                >
                  {st}
                </button>
              );
            }
          )}
        </div>
      </div>

      {/* Appointment History Table */}
      <div
        data-gsap-layer="card"
        data-scroll-reveal="panel"
        className="sahs-card overflow-hidden"
      >
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            Appointment History &amp; QR Check-In Ledger
          </h2>
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
            {filteredAppointments.length} records
          </span>
        </div>

        {filteredAppointments.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <p className="text-xs font-bold text-slate-900 dark:text-white">
              No appointments match your filter.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/50 text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Check-In QR</th>
                  <th className="py-3.5 px-4">Date &amp; Time</th>
                  <th className="py-3.5 px-4">Patient</th>
                  <th className="py-3.5 px-4">Doctor</th>
                  <th className="py-3.5 px-4">Reason</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody
                data-scroll-group
                className="divide-y divide-slate-200/70 dark:divide-slate-800/70 text-xs"
              >
                {filteredAppointments.map((appt) => {
                  const pat = patientMap.get(appt.patientId);
                  const doc = doctorMap.get(appt.doctorId);

                  const qrData: QrPassAppointmentData = {
                    id: appt.id,
                    appointmentDate: appt.appointmentDate,
                    timeSlot: appt.timeSlot,
                    visitType: appt.visitType,
                    reason: appt.reason,
                    status: appt.status,
                    clinicalNotes: appt.clinicalNotes,
                    patientName: pat?.fullName || `Patient #${appt.patientId}`,
                    patientEmail:
                      pat?.email || appt.bookedByUid || sessionUser.email,
                    patientPhone: pat?.phone,
                    patientAge: pat?.age,
                    patientGender: pat?.gender,
                    bloodGroup: pat?.bloodGroup,
                    doctorName: doc?.name || `Doctor #${appt.doctorId}`,
                    doctorSpecialty: doc?.specialty || 'General Medicine',
                    roomNumber: doc?.roomNumber || 'Suite 101',
                  };

                  const qrPass = generateAppointmentQrPass({
                    appointmentId: qrData.id,
                    patientName: qrData.patientName,
                    patientEmail: qrData.patientEmail,
                    patientPhone: qrData.patientPhone,
                    patientAge: qrData.patientAge,
                    patientGender: qrData.patientGender,
                    bloodGroup: qrData.bloodGroup,
                    doctorName: qrData.doctorName,
                    doctorSpecialty: qrData.doctorSpecialty,
                    roomNumber: qrData.roomNumber,
                    appointmentDate: qrData.appointmentDate,
                    timeSlot: qrData.timeSlot,
                    reason: qrData.reason,
                  });

                  return (
                    <tr
                      key={appt.id}
                      data-scroll-item
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="py-3 px-4 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedQrAppt(qrData)}
                          className="inline-flex items-center gap-1.5 text-[#0F766E] dark:text-[#2DD4BF] hover:underline font-mono text-[11px] font-bold cursor-pointer"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          <span>{qrPass.checkInCode}</span>
                        </button>
                      </td>
                      <td className="py-3 px-4 font-mono whitespace-nowrap">
                        <div className="font-bold text-slate-900 dark:text-white">
                          {appt.appointmentDate}
                        </div>
                        <div className="text-slate-500 dark:text-slate-400">
                          {appt.timeSlot}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 dark:text-white">
                          {qrData.patientName}
                        </div>
                        <div className="font-mono text-[11px] text-[#0F766E] dark:text-[#2DD4BF]">
                          {qrData.patientEmail}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 dark:text-white">
                          {qrData.doctorName}
                        </div>
                        <div className="text-slate-500 dark:text-slate-400">
                          {qrData.doctorSpecialty} · {qrData.roomNumber}
                        </div>
                      </td>
                      <td className="py-3 px-4 max-w-xs truncate text-slate-700 dark:text-slate-200">
                        {appt.reason}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`text-xs font-bold ${
                            appt.status === 'Completed'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : appt.status === 'Cancelled'
                              ? 'text-slate-400 dark:text-slate-500'
                              : 'text-[#0F766E] dark:text-[#2DD4BF]'
                          }`}
                        >
                          {appt.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedQrAppt(qrData)}
                            className="sahs-button-primary px-2.5 py-1 text-xs font-bold rounded-lg cursor-pointer"
                          >
                            Show QR
                          </button>
                          {appt.status === 'Scheduled' && (
                            <button
                              type="button"
                              onClick={() =>
                                handleStatusChange(appt.id, 'Cancelled')
                              }
                              className="sahs-button-secondary px-2.5 py-1 text-xs font-semibold rounded-lg cursor-pointer"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Audit Trail */}
      {historyLogs.length > 0 && (
        <div
          data-gsap-layer="card"
          data-scroll-reveal="panel"
          className="sahs-card p-5 space-y-3"
        >
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            Recent Check-In &amp; Status Activity
          </h2>
          <div className="divide-y divide-slate-200/70 dark:divide-slate-800/70 text-xs">
            {historyLogs.slice(0, 5).map((log) => (
              <div
                key={log.id}
                className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
                  <span className="font-mono text-[#0F766E] dark:text-[#2DD4BF]">
                    Appt #{log.appointmentId}
                  </span>
                  <span>·</span>
                  <span>
                    {log.previousStatus} → {log.newStatus}
                  </span>
                </div>
                <span className="text-slate-500 dark:text-slate-400 truncate">
                  {log.note}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <AppointmentQrModal
        appointment={selectedQrAppt}
        isOpen={Boolean(selectedQrAppt)}
        onClose={() => setSelectedQrAppt(null)}
        onCheckInScan={handleQrCheckInScan}
      />
    </div>
  );
}

