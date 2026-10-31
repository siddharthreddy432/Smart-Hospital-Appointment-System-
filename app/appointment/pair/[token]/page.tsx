'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import BookingWorkspace from '@/components/BookingWorkspace';
import {
  Smartphone,
  ShieldAlert,
  CheckCircle2,
  ArrowLeft,
  RefreshCw,
} from 'lucide-react';

function MobilePairingContent() {
  const params = useParams();
  const router = useRouter();
  const rawToken =
    typeof params?.token === 'string'
      ? params.token
      : Array.isArray(params?.token)
      ? params.token[0]
      : '';

  const [status, setStatus] = useState<'verifying' | 'paired' | 'error'>(
    'verifying'
  );
  const [pairedSessionId, setPairedSessionId] = useState<string | null>(null);
  const [mobileSecret, setMobileSecret] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function verifyAndPairToken() {
      if (!rawToken) {
        setStatus('error');
        setErrorCode('MISSING_TOKEN');
        setErrorMessage('No pairing token was provided in the URL.');
        return;
      }

      try {
        let savedMobileSecret: string | null = null;
        try {
          savedMobileSecret = window.sessionStorage.getItem(
            `sahs_pair_secret_${rawToken}`
          );
        } catch {
          // ignore
        }

        const res = await fetch('/api/sync-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'pair_token',
            token: rawToken,
            ...(savedMobileSecret ? { mobileSecret: savedMobileSecret } : {}),
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          if (!cancelled) {
            setStatus('error');
            setErrorCode(data.code || 'PAIRING_FAILED');
            setErrorMessage(
              data.error ||
                'Unable to pair with the desktop appointment session.'
            );
          }
          return;
        }

        if (!cancelled && data.sessionId && data.mobileSecret) {
          try {
            window.sessionStorage.setItem(
              `sahs_pair_secret_${rawToken}`,
              data.mobileSecret
            );
          } catch {
            // ignore
          }
          setPairedSessionId(data.sessionId);
          setMobileSecret(data.mobileSecret);
          setStatus('paired');
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setStatus('error');
          setErrorCode('NETWORK_ERROR');
          setErrorMessage(
            err instanceof Error
              ? err.message
              : 'Network error while validating QR pairing token.'
          );
        }
      }
    }

    verifyAndPairToken();
    return () => {
      cancelled = true;
    };
  }, [rawToken]);

  if (status === 'verifying') {
    return (
      <div className="max-w-lg mx-auto my-12 sahs-card p-6 space-y-4 text-center">
        <div className="w-11 h-11 rounded-xl bg-[#0F766E] text-white border border-[#263238] flex items-center justify-center mx-auto">
          <RefreshCw className="w-5 h-5 animate-spin" />
        </div>
        <div className="space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#0F766E]">
            SAHS Dual-Device Handshake
          </span>
          <h1 className="text-lg font-extrabold text-[#17211F]">
            Validating Temporary QR Pairing Token...
          </h1>
          <p className="text-xs text-[#64748B]">
            Verifying single-use cryptographic token and establishing secure
            two-way synchronization with your desktop booking session.
          </p>
        </div>
      </div>
    );
  }

  if (status === 'error' || !pairedSessionId || !mobileSecret) {
    return (
      <div
        data-testid="pairing-error-card"
        className="max-w-lg mx-auto my-12 sahs-card p-6 space-y-4"
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-800 border border-[#263238] flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <span className="text-[11px] font-mono font-bold uppercase text-rose-700">
              {errorCode || 'TOKEN_INVALID'}
            </span>
            <h1 className="text-lg font-extrabold text-[#17211F]">
              QR Pairing Token Cannot Be Used
            </h1>
            <p className="text-xs text-[#64748B] leading-relaxed">
              {errorMessage}
            </p>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-[#FAFAF8] border border-[#263238] text-xs text-[#17211F] space-y-1">
          <p className="font-bold">How to continue:</p>
          <p className="text-[#64748B]">
            Click &ldquo;Rotate QR&rdquo; on your desktop booking page to
            generate a fresh single-use QR code, or book directly from this
            device below.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          <button
            type="button"
            onClick={() => router.push('/book')}
            className="sahs-button-primary px-4 py-2 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Start Standalone Mobile Booking</span>
          </button>

          <Link
            href="/"
            className="sahs-button-secondary px-4 py-2 rounded-lg text-xs font-bold inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Hospital Home</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div
        data-testid="paired-mobile-banner"
        className="sahs-card p-4 bg-[#F1F5F2] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
      >
        <div className="flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-[#0F766E] shrink-0" />
          <div className="text-xs">
            <span className="font-bold text-[#17211F]">
              Paired with Desktop Session ({pairedSessionId})
            </span>
            <span className="text-[#64748B] ml-2">
              Single-use token verified · Live two-way form sync active
            </span>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded-md bg-[#0F766E] text-white font-mono text-[10px] font-bold self-start sm:self-auto">
          https://sahs.telis.tech
        </span>
      </div>

      <BookingWorkspace
        initialPairedSessionId={pairedSessionId}
        initialMobileSecret={mobileSecret}
      />
    </div>
  );
}

export default function AppointmentPairTokenPage() {
  return (
    <Suspense
      fallback={
        <div className="sahs-card p-6 text-xs font-semibold text-[#64748B]">
          Connecting to SAHS Dual-Device Pairing Session...
        </div>
      }
    >
      <MobilePairingContent />
    </Suspense>
  );
}
