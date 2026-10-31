'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useHospital } from '../../components/HospitalProvider';
import { UserPlus, Lock, ShieldCheck } from 'lucide-react';

export default function PatientsPage() {
  const {
    patients,
    sessionUser,
    isAdminAuthenticated,
    refreshHospitalData,
    setStatusBanner,
  } = useHospital();

  const [fullName, setFullName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [age, setAge] = useState<string>('32');
  const [gender, setGender] = useState<string>('Female');
  const [bloodGroup, setBloodGroup] = useState<string>('O+');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const handleCreatePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!fullName.trim() || !email.trim() || !phone.trim()) {
      setFormError('Patient name, Gmail address, and phone number are required.');
      return;
    }

    setSubmitting(true);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (sessionUser.idToken) {
        headers['Authorization'] = `Bearer ${sessionUser.idToken}`;
      }
      const res = await fetch('/api/patients', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          age: Number(age) || 32,
          gender,
          bloodGroup,
          distanceKm: 5,
          chronicConditions: 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to register patient.');
      }
      setFullName('');
      setEmail('');
      setPhone('');
      await refreshHospitalData();
      setStatusBanner(
        `Registered patient ${data.patient.fullName} (${data.patient.email}).`
      );
    } catch (err: unknown) {
      setFormError(
        err instanceof Error ? err.message : 'Unable to register patient.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!isAdminAuthenticated) {
    return (
      <div className="space-y-6">
        <div data-gsap-layer="card" className="sahs-card p-6 sm:p-8 space-y-4">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#0F766E] dark:text-[#2DD4BF]">
            <Lock className="w-3.5 h-3.5" />
            <span>RBAC Protected · Admin-Only Patient Directory</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
            Patient Records Are Restricted to Hospital Administrators
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed">
            To protect patient confidentiality, the full hospital patient
            directory is strictly accessible only to authenticated
            Administrators. Patients can view only their own personal profile
            and appointments.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Link
              href="/appointments"
              className="sahs-button-primary px-4 py-2.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>View My Personal Appointments &amp; Profile</span>
            </Link>
            <Link
              href="/admin"
              className="sahs-button-secondary px-4 py-2.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5"
            >
              <Lock className="w-3.5 h-3.5 text-[#0F766E] dark:text-[#2DD4BF]" />
              <span>Administrator Sign-In</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div data-gsap-layer="card" className="sahs-card p-5 sm:p-6">
        <span
          data-gsap-layer="subheading"
          className="text-xs font-bold text-[#0F766E] dark:text-[#2DD4BF] uppercase tracking-wider block"
        >
          Patient Directory · Admin Verified
        </span>
        <h1
          data-gsap-layer="heading"
          className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white mt-0.5"
        >
          Registered Patients &amp; Profiles
        </h1>
        <p
          data-gsap-layer="subheading"
          className="text-xs text-slate-500 dark:text-slate-400 mt-0.5"
        >
          View patient profiles, blood groups, and linked Gmail accounts, or
          register a new patient record.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div
          data-gsap-layer="card"
          data-scroll-reveal="panel"
          className="lg:col-span-8 sahs-card overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/50 text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Patient Name</th>
                  <th className="py-3.5 px-4">Demographics</th>
                  <th className="py-3.5 px-4">Gmail &amp; Phone</th>
                  <th className="py-3.5 px-4 text-right">Attendance</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody
                data-scroll-group
                className="divide-y divide-slate-200/70 dark:divide-slate-800/70 text-xs"
              >
                {patients.map((pat) => (
                  <tr
                    key={pat.id}
                    data-scroll-item
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                      {pat.fullName}
                    </td>
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400">
                      {pat.age} yrs · {pat.gender} · Blood {pat.bloodGroup}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-mono text-[#0F766E] dark:text-[#2DD4BF] font-semibold">
                        {pat.email}
                      </div>
                      <div className="font-mono text-slate-500 dark:text-slate-400">
                        {pat.phone}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-700 dark:text-slate-200">
                      {pat.missedAppointments} / {pat.totalAppointments} missed
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link
                        href="/book"
                        className="sahs-button-secondary px-2.5 py-1 text-xs font-bold rounded-lg inline-block"
                      >
                        Book Visit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div
          data-gsap-layer="visual"
          data-gsap-illustration
          className="lg:col-span-4 sahs-card p-5 space-y-4"
        >
          <div className="flex items-center gap-2 border-b border-slate-200/80 dark:border-slate-800 pb-3">
            <UserPlus className="w-4 h-4 text-[#0F766E] dark:text-[#2DD4BF]" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Register New Patient
            </h2>
          </div>

          {formError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800 rounded-xl text-xs font-semibold">
              {formError}
            </div>
          )}

          <form onSubmit={handleCreatePatient} className="space-y-3 text-xs">
            <div>
              <label
                htmlFor="pat-name"
                className="block font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                Full Name
              </label>
              <input
                id="pat-name"
                type="text"
                placeholder="e.g., Rahul Sharma"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl"
              />
            </div>

            <div>
              <label
                htmlFor="pat-email"
                className="block font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                Gmail Address
              </label>
              <input
                id="pat-email"
                type="email"
                placeholder="rahul.sharma@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 font-mono border rounded-xl"
              />
            </div>

            <div>
              <label
                htmlFor="pat-phone"
                className="block font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                Phone Number
              </label>
              <input
                id="pat-phone"
                type="text"
                placeholder="+91 98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 font-mono border rounded-xl"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label
                  htmlFor="pat-age"
                  className="block font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Age
                </label>
                <input
                  id="pat-age"
                  type="number"
                  min={1}
                  max={120}
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  className="w-full px-2 py-2 font-mono border rounded-xl"
                />
              </div>

              <div>
                <label
                  htmlFor="pat-gender"
                  className="block font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Gender
                </label>
                <select
                  id="pat-gender"
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full px-2 py-2 border rounded-xl"
                >
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="pat-blood"
                  className="block font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Blood
                </label>
                <select
                  id="pat-blood"
                  value={bloodGroup}
                  onChange={(e) => setBloodGroup(e.target.value)}
                  className="w-full px-2 py-2 font-mono border rounded-xl"
                >
                  {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map(
                    (bg) => (
                      <option key={bg} value={bg}>
                        {bg}
                      </option>
                    )
                  )}
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="sahs-button-primary w-full py-2.5 px-4 text-xs font-bold rounded-xl cursor-pointer"
            >
              {submitting ? 'Saving Patient...' : 'Register Patient Profile'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

