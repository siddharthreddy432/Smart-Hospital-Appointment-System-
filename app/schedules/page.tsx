'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useHospital } from '../../components/HospitalProvider';

export default function SchedulesPage() {
  const {
    doctors,
    schedules,
    refreshHospitalData,
    setStatusBanner,
  } = useHospital();

  const [dayFilter, setDayFilter] = useState<string>('All');
  const [doctorFilter, setDoctorFilter] = useState<number | 'All'>('All');

  const doctorMap = useMemo(() => {
    const map = new Map<number, (typeof doctors)[0]>();
    doctors.forEach((d) => map.set(d.id, d));
    return map;
  }, [doctors]);

  const filteredSchedules = useMemo(() => {
    return schedules.filter((s) => {
      const matchesDay = dayFilter === 'All' || s.dayOfWeek === dayFilter;
      const matchesDoc =
        doctorFilter === 'All' || s.doctorId === Number(doctorFilter);
      return matchesDay && matchesDoc;
    });
  }, [schedules, dayFilter, doctorFilter]);

  const handleToggleSchedule = async (
    scheduleId: number,
    currentAvailable: boolean
  ) => {
    try {
      const res = await fetch('/api/schedules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduleId,
          isAvailable: !currentAvailable,
        }),
      });
      if (res.ok) {
        await refreshHospitalData();
        setStatusBanner(
          `Shift #${scheduleId} marked as ${
            !currentAvailable ? 'Available' : 'Blocked'
          }.`
        );
      }
    } catch (error) {
      console.error('Error toggling schedule:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div
        data-gsap-layer="card"
        className="sahs-card p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
      >
        <div className="space-y-1">
          <span
            data-gsap-layer="subheading"
            className="text-xs font-bold text-[#0F766E] dark:text-[#2DD4BF] uppercase tracking-wider block"
          >
            Outpatient Timetables
          </span>
          <h1
            data-gsap-layer="heading"
            className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white"
          >
            Doctor Weekly Schedules &amp; Shifts
          </h1>
          <p
            data-gsap-layer="subheading"
            className="text-xs text-slate-500 dark:text-slate-400"
          >
            Review consultation hours, slot durations, and live availability
            across hospital departments.
          </p>
        </div>

        <div
          data-gsap-layer="visual"
          className="flex flex-wrap items-center gap-3"
        >
          <select
            aria-label="Filter schedule by physician"
            value={doctorFilter}
            onChange={(e) =>
              setDoctorFilter(
                e.target.value === 'All' ? 'All' : Number(e.target.value)
              )
            }
            className="px-3 py-2 text-xs font-semibold border rounded-xl"
          >
            <option value="All">All Physicians</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.specialty})
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1 overflow-x-auto py-0.5">
            {[
              'All',
              'Monday',
              'Tuesday',
              'Wednesday',
              'Thursday',
              'Friday',
              'Saturday',
            ].map((day) => {
              const active = dayFilter === day;
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => setDayFilter(day)}
                  className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer active:scale-[0.96] ${
                    active
                      ? 'bg-[#0F766E] dark:bg-[#14B8A6] text-white dark:text-slate-950 font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.05]'
                  }`}
                >
                  {day === 'All' ? 'All Days' : day.slice(0, 3)}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div
        data-gsap-layer="card"
        data-scroll-reveal="panel"
        className="sahs-card overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/50 text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                <th className="py-3.5 px-4">Physician</th>
                <th className="py-3.5 px-4">Specialty &amp; Suite</th>
                <th className="py-3.5 px-4">Day</th>
                <th className="py-3.5 px-4">Shift Hours</th>
                <th className="py-3.5 px-4 text-right">Slot</th>
                <th className="py-3.5 px-4 text-right">Capacity</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody
              data-scroll-group
              className="divide-y divide-slate-200/70 dark:divide-slate-800/70 text-xs"
            >
              {filteredSchedules.map((sched) => {
                const doc = doctorMap.get(sched.doctorId);
                return (
                  <tr
                    key={sched.id}
                    data-scroll-item
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                      {doc?.name || `Doctor #${sched.doctorId}`}
                    </td>
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400">
                      {doc?.specialty} · {doc?.roomNumber}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">
                      {sched.dayOfWeek}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-800 dark:text-slate-200">
                      {sched.startTime} – {sched.endTime}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-500 dark:text-slate-400">
                      {sched.slotDurationMinutes}m
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-500 dark:text-slate-400">
                      {sched.maxPatients}
                    </td>
                    <td className="py-3 px-4">
                      {sched.isAvailable ? (
                        <span className="font-bold text-[#0F766E] dark:text-[#2DD4BF]">
                          Available
                        </span>
                      ) : (
                        <span className="font-semibold text-slate-400 dark:text-slate-500">
                          Blocked
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            handleToggleSchedule(sched.id, sched.isAvailable)
                          }
                          className="sahs-button-secondary px-2.5 py-1 text-xs font-semibold rounded-lg cursor-pointer"
                        >
                          {sched.isAvailable ? 'Block' : 'Enable'}
                        </button>
                        {sched.isAvailable && (
                          <Link
                            href={`/book?doctorId=${sched.doctorId}`}
                            className="sahs-button-primary px-2.5 py-1 text-xs font-bold rounded-lg"
                          >
                            Book
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

