'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useHospital } from '../../components/HospitalProvider';
import {
  User,
  Mail,
  ShieldCheck,
  CheckCircle2,
  LogIn,
  Lock,
  KeyRound,
  ArrowRight,
} from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const {
    sessionUser,
    isAdminAuthenticated,
    loginWithGmailPopup,
    loginWithMatchedGmail,
    loginAsAdmin,
    logout,
  } = useHospital();

  const [userName, setUserName] = useState<string>(
    sessionUser.userName || 'Rahul Sharma'
  );
  const [gmailAddress, setGmailAddress] = useState<string>(
    sessionUser.email || 'patient.care@example.com'
  );
  const [patientBusy, setPatientBusy] = useState<boolean>(false);
  const [patientError, setPatientError] = useState<string | null>(null);

  const [adminUser, setAdminUser] = useState<string>('Admin');
  const [adminPass, setAdminPass] = useState<string>('Admin@123');
  const [adminError, setAdminError] = useState<string | null>(null);

  const handleDirectGmailMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setPatientError(null);

    if (!userName.trim()) {
      setPatientError('Please enter your User Name first.');
      return;
    }
    if (!gmailAddress.trim() || !gmailAddress.includes('@')) {
      setPatientError('Please enter a valid Gmail address.');
      return;
    }

    setPatientBusy(true);
    try {
      await loginWithMatchedGmail(userName, gmailAddress, 'patient');
      router.push('/book');
    } catch (err: unknown) {
      setPatientError(err instanceof Error ? err.message : 'Login failed.');
    } finally {
      setPatientBusy(false);
    }
  };

  const handleGooglePopup = async () => {
    setPatientError(null);
    if (!userName.trim()) {
      setPatientError(
        'Please enter your User Name so we can match it to your Gmail account.'
      );
      return;
    }
    if (!gmailAddress.trim() || !gmailAddress.includes('@')) {
      setPatientError('Please enter a valid Gmail address.');
      return;
    }
    setPatientBusy(true);
    try {
      const ok = await loginWithGmailPopup(userName, 'patient');
      if (ok) {
        router.push('/book');
        return;
      }
    } catch {
      // Fallback for custom domains (sahs.telis.tech) where Firebase popup domain whitelist may not be configured
    }

    try {
      await loginWithMatchedGmail(userName, gmailAddress, 'patient');
      router.push('/book');
    } catch (fallbackErr: unknown) {
      setPatientError(
        fallbackErr instanceof Error
          ? fallbackErr.message
          : 'Could not complete Gmail sign-in.'
      );
    } finally {
      setPatientBusy(false);
    }
  };

  const handleAdminLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError(null);
    const ok = loginAsAdmin(adminUser, adminPass);
    if (ok) {
      router.push('/admin');
    } else {
      setAdminError(
        'Invalid Admin credentials. Please use Username: Admin and Password: Admin@123'
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="sahs-card p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <span className="text-xs font-bold text-[#0F766E] dark:text-[#2DD4BF] uppercase tracking-wider block">
            SAHS Authentication
          </span>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
            Patient Gmail Sign-In &amp; Administrator Access
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Match your User Name and Gmail account for booking, or sign in as
            Administrator on the right.
          </p>
        </div>

        {(sessionUser.isAuthenticated || isAdminAuthenticated) && (
          <button
            type="button"
            onClick={logout}
            className="sahs-button-secondary px-4 py-2 text-xs font-bold rounded-xl cursor-pointer shrink-0"
          >
            Sign Out Active Session
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left: Patient Login */}
        <div className="lg:col-span-7 sahs-card p-6 flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 pb-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#0F766E] dark:text-[#2DD4BF]">
                  Patient Portal
                </span>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Match User Name &amp; Gmail
                </h2>
              </div>
              <Mail className="w-4 h-4 text-[#0F766E] dark:text-[#2DD4BF]" />
            </div>

            {patientError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800 rounded-xl text-xs font-semibold">
                {patientError}
              </div>
            )}

            <form onSubmit={handleDirectGmailMatch} className="space-y-3.5">
              <div>
                <label
                  htmlFor="login-username"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  1. Enter Your User Name
                </label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="login-username"
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="e.g., Rahul Sharma"
                    className="w-full pl-9 pr-4 py-2 text-xs border rounded-xl"
                    required
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="login-gmail"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  2. Matched Gmail Account
                </label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="login-gmail"
                    type="email"
                    value={gmailAddress}
                    onChange={(e) => setGmailAddress(e.target.value)}
                    placeholder="patient.care@example.com"
                    className="w-full pl-9 pr-4 py-2 text-xs font-mono border rounded-xl"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2.5 pt-1">
                <button
                  type="submit"
                  disabled={patientBusy}
                  className="sahs-button-primary w-full py-2.5 px-4 text-xs font-bold rounded-xl cursor-pointer flex items-center justify-center gap-2"
                >
                  <LogIn className="w-4 h-4" />
                  <span>
                    {patientBusy
                      ? 'Syncing Profile...'
                      : `Continue as ${userName || 'Patient'}`}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleGooglePopup}
                  disabled={patientBusy}
                  className="sahs-button-secondary w-full py-2.5 px-4 text-xs font-bold rounded-xl cursor-pointer flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4 text-[#0F766E] dark:text-[#2DD4BF]" />
                  <span>Verify with Google Sign-In Popup</span>
                </button>
              </div>
            </form>
          </div>

          <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>Active Session</span>
            <span className="font-mono font-bold text-slate-900 dark:text-white">
              {sessionUser.userName} ({sessionUser.email})
            </span>
          </div>
        </div>

        {/* Right: Separate Admin Login */}
        <div className="lg:col-span-5 sahs-card p-6 flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 pb-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#0F766E] dark:text-[#2DD4BF]">
                  Separate Admin Portal
                </span>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Administrator Sign-In
                </h2>
              </div>
              <ShieldCheck className="w-4 h-4 text-[#0F766E] dark:text-[#2DD4BF]" />
            </div>

            <div className="sahs-panel p-3.5 flex items-center justify-between gap-2 text-xs">
              <div className="font-mono">
                <div className="text-[10px] text-slate-500 dark:text-slate-400">
                  Demo Admin Credentials
                </div>
                <div className="font-bold text-slate-900 dark:text-white">
                  User: Admin · Pass: Admin@123
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAdminUser('Admin');
                  setAdminPass('Admin@123');
                }}
                className="sahs-button-secondary px-2.5 py-1 text-[11px] font-bold rounded-lg cursor-pointer shrink-0"
              >
                Auto-Fill
              </button>
            </div>

            {adminError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800 rounded-xl text-xs font-semibold">
                {adminError}
              </div>
            )}

            <form onSubmit={handleAdminLoginSubmit} className="space-y-3.5">
              <div>
                <label
                  htmlFor="admin-username-input"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Admin Username
                </label>
                <div className="relative">
                  <KeyRound className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="admin-username-input"
                    type="text"
                    value={adminUser}
                    onChange={(e) => setAdminUser(e.target.value)}
                    placeholder="Admin"
                    className="w-full pl-9 pr-4 py-2 text-xs font-mono border rounded-xl"
                    required
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="admin-password-input"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Admin Password
                </label>
                <div className="relative">
                  <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="admin-password-input"
                    type="password"
                    value={adminPass}
                    onChange={(e) => setAdminPass(e.target.value)}
                    placeholder="Admin@123"
                    className="w-full pl-9 pr-4 py-2 text-xs font-mono border rounded-xl"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="sahs-button-primary w-full py-2.5 px-4 text-xs font-bold rounded-xl cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Open Standalone Admin Portal</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>

          <div className="text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-200/80 dark:border-slate-800 pt-3">
            Includes Appointments CSV Export, Manual WhatsApp &amp; SMS
            Dispatch, Doctor Management &amp; Patient Management.
          </div>
        </div>
      </div>
    </div>
  );
}

