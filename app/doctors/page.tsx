'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useHospital } from '../../components/HospitalProvider';
import { Search, Plus, Clock, Users, Calendar } from 'lucide-react';

export default function DoctorsPage() {
  const { doctors, schedules, appointments, patients } = useHospital();
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('All');

  const specialties = useMemo(() => {
    const set = new Set<string>(['All']);
    doctors.forEach((d) => set.add(d.specialty));
    return Array.from(set);
  }, [doctors]);

  const filteredDoctors = useMemo(() => {
    return doctors.filter((doc) => {
      const matchesSpec =
        selectedSpecialty === 'All' || doc.specialty === selectedSpecialty;
      const q = searchQuery.trim().toLowerCase();
      const matchesQuery =
        !q ||
        doc.name.toLowerCase().includes(q) ||
        doc.specialty.toLowerCase().includes(q) ||
        doc.department.toLowerCase().includes(q);
      return matchesSpec && matchesQuery;
    });
  }, [doctors, selectedSpecialty, searchQuery]);

  const activeQueue = useMemo(() => {
    return appointments.filter((a) => a.status === 'Scheduled').slice(0, 4);
  }, [appointments]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div
        data-gsap-layer="card"
        className="sahs-card p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div className="space-y-1">
          <span
            data-gsap-layer="subheading"
            className="text-xs font-bold text-[#0F766E] dark:text-[#2DD4BF] uppercase tracking-wider block"
          >
            Doctor Dashboard &amp; Directory
          </span>
          <h1
            data-gsap-layer="heading"
            className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white"
          >
            Attending Physicians, Patient Queue &amp; Availability
          </h1>
          <p
            data-gsap-layer="subheading"
            className="text-xs text-slate-500 dark:text-slate-400"
          >
            Meet our attending specialists, check live outpatient wait times, or
            reserve a 1-on-1 consultation slot.
          </p>
        </div>

        <Link
          href="/book"
          className="sahs-button-primary inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Book Appointment</span>
        </Link>
      </div>

      {/* Doctor Dashboard Overview: Today's Appointments & Live Patient Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div
          data-gsap-layer="card"
          className="lg:col-span-8 sahs-card p-5 space-y-3.5"
        >
          <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#0F766E] dark:text-[#2DD4BF]" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Today&apos;s Outpatient Queue ({activeQueue.length} Active)
              </h2>
            </div>
            <Link
              href="/schedules"
              className="text-xs font-bold text-[#0F766E] dark:text-[#2DD4BF] hover:underline"
            >
              Manage Shifts →
            </Link>
          </div>

          {activeQueue.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 py-4">
              No patients currently waiting in queue.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {activeQueue.map((appt, idx) => {
                const doc = doctors.find((d) => d.id === appt.doctorId);
                const pat = patients.find((p) => p.id === appt.patientId);
                return (
                  <div
                    key={appt.id}
                    className="p-3.5 sahs-panel flex items-center justify-between gap-2 text-xs transition-all duration-150 hover:border-teal-600/40"
                  >
                    <div className="min-w-0">
                      <span className="text-[10px] font-mono font-bold text-[#0F766E] dark:text-[#2DD4BF] block">
                        Queue #{idx + 1} · {appt.timeSlot}
                      </span>
                      <div className="font-bold text-slate-900 dark:text-white truncate">
                        {pat?.fullName || `Patient #${appt.patientId}`}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {doc?.name} ({doc?.roomNumber})
                      </div>
                    </div>
                    <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 shrink-0">
                      {appt.visitType}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div
          data-gsap-layer="visual"
          data-gsap-illustration
          className="lg:col-span-4 sahs-card p-5 flex flex-col justify-between space-y-3"
        >
          <div>
            <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 pb-2.5 mb-3">
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                Department Availability
              </span>
              <Calendar className="w-4 h-4 text-[#0F766E] dark:text-[#2DD4BF]" />
            </div>
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between p-3 sahs-panel">
                <span className="text-slate-500 dark:text-slate-400">
                  Active Specialists
                </span>
                <span className="font-bold font-mono text-slate-900 dark:text-white">
                  {doctors.length} Doctors
                </span>
              </div>
              <div className="flex items-center justify-between p-3 sahs-panel">
                <span className="text-slate-500 dark:text-slate-400">
                  Open Weekly Shifts
                </span>
                <span className="font-bold font-mono text-[#0F766E] dark:text-[#2DD4BF]">
                  {schedules.filter((s) => s.isAvailable).length} Shifts
                </span>
              </div>
            </div>
          </div>

          <Link
            href="/schedules"
            className="sahs-button-secondary w-full py-2.5 px-3 rounded-xl text-xs font-bold text-center"
          >
            View Full Weekly Timetable
          </Link>
        </div>
      </div>

      {/* Search & Unboxed Specialty Filter Tabs */}
      <div
        data-gsap-layer="subheading"
        className="flex flex-col lg:flex-row lg:items-center justify-between gap-3"
      >
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            aria-label="Search doctors by name or specialty"
            placeholder="Search doctors by name, specialty, or department..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs border rounded-xl"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
          {specialties.map((spec) => {
            const active = selectedSpecialty === spec;
            return (
              <button
                key={spec}
                type="button"
                onClick={() => setSelectedSpecialty(spec)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer active:scale-[0.96] ${
                  active
                    ? 'bg-[#0F766E] dark:bg-[#14B8A6] text-white dark:text-slate-950 font-bold shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.05]'
                }`}
              >
                {spec === 'All' ? 'All Specialties' : spec}
              </button>
            );
          })}
        </div>
      </div>

      {/* Doctors Grid (Unboxed Specialty Kickers) */}
      <div
        data-scroll-group
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
      >
        {filteredDoctors.map((doc) => {
          const docSchedules = schedules.filter(
            (s) => s.doctorId === doc.id && s.isAvailable
          );
          const docApptsCount = appointments.filter(
            (a) => a.doctorId === doc.id && a.status === 'Scheduled'
          ).length;

          return (
            <article
              key={doc.id}
              data-gsap-layer="card"
              data-scroll-item
              className="sahs-card sahs-card-interactive p-5 flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2.5">
                {/* Unboxed Department & Suite Metadata */}
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-bold uppercase tracking-wider text-[#0F766E] dark:text-[#2DD4BF] text-[11px]">
                    {doc.specialty}
                  </span>
                  <span className="font-mono text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    {doc.roomNumber} · ★ {doc.rating}
                  </span>
                </div>

                <div>
                  <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                    {doc.name}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {doc.qualification} · {doc.experienceYears} yrs clinical
                    experience
                  </p>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {doc.bio}
                </p>
              </div>

              <div className="space-y-3 pt-3 border-t border-slate-200/80 dark:border-slate-800 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#0F766E] dark:text-[#2DD4BF]" />
                    Consultation Days
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {doc.availableDays.replace(/,/g, ', ')}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">
                    Consultation Fee
                  </span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    ₹{doc.consultationFee} · {docApptsCount} in queue
                  </span>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <Link
                    href={`/book?doctorId=${doc.id}`}
                    className="sahs-button-primary flex-1 py-2 px-3 text-center text-xs font-bold rounded-xl"
                  >
                    Book Appointment
                  </Link>
                  <Link
                    href="/schedules"
                    className="sahs-button-secondary py-2 px-3 text-xs font-bold rounded-xl shrink-0"
                  >
                    {docSchedules.length} Shifts
                  </Link>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

