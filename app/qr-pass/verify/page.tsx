'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ShieldAlert, Lock, QrCode, ArrowLeft, KeyRound } from 'lucide-react';

function QrPassExternalDenyContent() {
  const searchParams = useSearchParams();
  const code = searchParams?.get('code') || 'RESTRICTED-PASS';

  return (
    <div className="max-w-xl mx-auto my-10 px-4">
      <div
        data-testid="google-scanner-denied-card"
        className="sahs-card p-6 sm:p-8 border-2 border-rose-500/70 dark:border-rose-500/80 space-y-5"
      >
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 block">
              Security Enforcement · External Scanner Blocked
            </span>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
              Access Denied on Google Scanner / External Camera
            </h1>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-rose-50/90 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/80 text-xs text-rose-900 dark:text-rose-200 space-y-2 leading-relaxed">
          <p className="font-bold">
            This SAHS Confirmed Appointment QR Pass ({code}) is encrypted and restricted.
          </p>
          <p>
            To protect patient medical confidentiality, Confirmed Appointment QR Passes{' '}
            <strong>cannot be decoded or opened by Google Lens, Google Scanner, or public phone cameras</strong>.
          </p>
          <p>
            Patient identity, contact details, blood group, and clinical reason are encrypted using SAHS Admin-Only cipher (<code className="font-mono">SAHS-ADMIN-QR-V3</code>) and can only be scanned inside the authorized <strong>SAHS Admin Portal QR Scanner</strong>.
          </p>
        </div>

        <div className="sahs-panel p-4 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-semibold">
            <QrCode className="w-4 h-4 text-[#0F766E] dark:text-[#2DD4BF]" />
            <span>Authorized Hospital Receptionist or Administrator?</span>
          </div>
          <span className="font-mono text-[11px] font-bold text-[#0F766E] dark:text-[#2DD4BF]">
            {code}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Link
            href="/admin"
            className="sahs-button-primary px-4 py-2.5 rounded-xl text-xs font-bold inline-flex items-center gap-2"
          >
            <KeyRound className="w-4 h-4" />
            <span>Open Authorized Admin QR Scanner</span>
          </Link>
          <Link
            href="/appointments"
            className="sahs-button-secondary px-4 py-2.5 rounded-xl text-xs font-bold inline-flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Appointments &amp; QR</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function QrPassVerifyDenyPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-xl mx-auto my-10 p-6 sahs-card text-xs font-semibold">
          Verifying scanner authorization...
        </div>
      }
    >
      <QrPassExternalDenyContent />
    </Suspense>
  );
}
