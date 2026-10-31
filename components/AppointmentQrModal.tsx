'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import QRCode from 'qrcode';
import { generateAppointmentQrPass } from '../lib/qr-checkin';
import {
  QrCode,
  CheckCircle2,
  Calendar,
  Clock,
  X,
  Copy,
  ShieldAlert,
  Lock,
  Check,
  KeyRound,
} from 'lucide-react';

export interface QrPassAppointmentData {
  id: number;
  appointmentDate: string;
  timeSlot: string;
  visitType: string;
  reason: string;
  status: string;
  clinicalNotes?: string | null;
  patientName: string;
  patientEmail: string;
  patientPhone?: string;
  patientAge?: number | string;
  patientGender?: string;
  bloodGroup?: string;
  doctorName: string;
  doctorSpecialty: string;
  roomNumber: string;
}

export function QrMatrixRenderer({
  matrix,
  cellSize = 6,
}: {
  matrix: boolean[][];
  cellSize?: number;
}) {
  const size = matrix.length;
  const effectiveCell = size > 25 ? Math.max(3, Math.floor(156 / size)) : cellSize;
  return (
    <div
      data-testid="appointment-qr-code"
      role="img"
      aria-label="Hospital Appointment Admin-Only Check-In QR Code"
      className="inline-block p-2.5 bg-white border border-slate-300 dark:border-slate-600 rounded-xl shadow-sm"
    >
      <div
        className="grid gap-0"
        style={{
          gridTemplateColumns: `repeat(${size}, ${effectiveCell}px)`,
          width: `${size * effectiveCell}px`,
          height: `${size * effectiveCell}px`,
        }}
      >
        {matrix.map((row, rIdx) =>
          row.map((cell, cIdx) => (
            <div
              key={`${rIdx}-${cIdx}`}
              className={cell ? 'bg-[#0F172A]' : 'bg-white'}
              style={{ width: `${effectiveCell}px`, height: `${effectiveCell}px` }}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default function AppointmentQrModal({
  appointment,
  isOpen = true,
  onClose,
  onCheckInScan,
}: {
  appointment: QrPassAppointmentData | null;
  isOpen?: boolean;
  onClose: () => void;
  onCheckInScan?: (appointmentId: number, checkInCode: string) => Promise<void> | void;
}) {
  const [scanning, setScanning] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedCipher, setCopiedCipher] = useState(false);
  const [qrPngUrl, setQrPngUrl] = useState<string | null>(null);

  const qrPass = useMemo(() => {
    if (!appointment) return null;
    return generateAppointmentQrPass({
      appointmentId: appointment.id,
      patientName: appointment.patientName,
      patientEmail: appointment.patientEmail,
      patientPhone: appointment.patientPhone,
      patientAge: appointment.patientAge,
      patientGender: appointment.patientGender,
      bloodGroup: appointment.bloodGroup,
      doctorName: appointment.doctorName,
      doctorSpecialty: appointment.doctorSpecialty,
      roomNumber: appointment.roomNumber,
      appointmentDate: appointment.appointmentDate,
      timeSlot: appointment.timeSlot,
      visitType: appointment.visitType,
      reason: appointment.reason,
      status: appointment.status,
    });
  }, [appointment]);

  useEffect(() => {
    let active = true;
    if (!qrPass) {
      return;
    }
    QRCode.toDataURL(qrPass.adminQrToken, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 196,
      color: {
        dark: '#0F172A',
        light: '#FFFFFF',
      },
    })
      .then((url) => {
        if (active) setQrPngUrl(url);
      })
      .catch(() => {
        if (active) setQrPngUrl(null);
      });
    return () => {
      active = false;
    };
  }, [qrPass]);

  if (!isOpen || !appointment || !qrPass) return null;

  const isAlreadyCheckedIn =
    appointment.status === 'Completed' ||
    (appointment.clinicalNotes || '').includes('CHECKED-IN VIA') ||
    (appointment.clinicalNotes || '').includes('ACCESS GRANTED');

  const handleSimulateScan = async () => {
    setScanning(true);
    try {
      if (onCheckInScan) {
        await onCheckInScan(appointment.id, qrPass.checkInCode);
      }
    } finally {
      setScanning(false);
    }
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(qrPass.checkInCode);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2200);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleCopyEncryptedPayload = async () => {
    try {
      await navigator.clipboard.writeText(qrPass.adminQrToken);
      setCopiedCipher(true);
      setTimeout(() => setCopiedCipher(false), 2200);
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="qr-modal-title"
      className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-slate-700 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl text-slate-900 dark:text-slate-100">
        {/* Header */}
        <div className="bg-[#0F766E] text-white px-5 py-4 flex items-start justify-between gap-4">
          <div className="space-y-0.5">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-100">
              <Lock className="w-3.5 h-3.5" />
              <span>Admin-Only Encrypted Patient QR Pass</span>
            </div>
            <h2 id="qr-modal-title" className="text-lg font-extrabold text-white">
              Confirmed Appointment QR Ticket #{appointment.id}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close QR Pass Modal"
            className="p-1.5 rounded-lg text-white/85 hover:text-white hover:bg-white/15 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Center QR Code Stage */}
        <div className="p-5 bg-slate-50 dark:bg-[#0F172A] border-b border-slate-200 dark:border-slate-700 flex flex-col items-center text-center space-y-3">
          {qrPngUrl ? (
            <div
              data-testid="appointment-qr-code"
              className="p-3 bg-white border border-slate-300 rounded-2xl shadow-sm inline-block"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrPngUrl}
                alt={`Admin-Only Encrypted QR Pass for ${appointment.patientName}`}
                className="w-[176px] h-[176px] object-contain block"
              />
            </div>
          ) : (
            <QrMatrixRenderer matrix={qrPass.scannableMatrix} cellSize={4} />
          )}

          {/* Token + Copy Actions */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg">
              <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                {qrPass.checkInCode}
              </span>
              <button
                type="button"
                onClick={handleCopyCode}
                aria-label="Copy Check-In Token"
                className="text-xs font-bold text-[#0F766E] dark:text-[#2DD4BF] hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                {copiedToken ? (
                  <>
                    <Check className="w-3 h-3" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy ID</span>
                  </>
                )}
              </button>
            </div>

            <button
              type="button"
              onClick={handleCopyEncryptedPayload}
              className="sahs-button-secondary px-3 py-1 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              {copiedCipher ? (
                <>
                  <Check className="w-3 h-3 text-[#0F766E] dark:text-[#2DD4BF]" />
                  <span>Encrypted QR Copied</span>
                </>
              ) : (
                <>
                  <QrCode className="w-3 h-3 text-[#0F766E] dark:text-[#2DD4BF]" />
                  <span>Copy Admin QR Payload</span>
                </>
              )}
            </button>
          </div>

          {/* Explicit Google Scanner Denial Notice */}
          <div
            data-testid="google-scanner-deny-badge"
            className="w-full max-w-md p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700/80 text-[11px] text-amber-900 dark:text-amber-200 flex items-center justify-between gap-2 text-left"
          >
            <div className="flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">
                  Protected Patient QR · Google Scanner Denied
                </span>
                <span className="text-[10px] opacity-90">
                  Encodes encrypted patient details (<code className="font-mono">SAHS-ADMIN-QR-V3</code>). Decodable only via SAHS Admin Portal Scanner.
                </span>
              </div>
            </div>
            <Link
              href={`/qr-pass/verify?code=${encodeURIComponent(qrPass.checkInCode)}`}
              onClick={onClose}
              className="px-2 py-1 rounded-md bg-amber-200/70 dark:bg-amber-900/80 text-amber-950 dark:text-amber-100 font-bold text-[10px] shrink-0 hover:underline"
            >
              Test Public Scan
            </Link>
          </div>

          {isAlreadyCheckedIn ? (
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              <span>Access Granted &amp; Checked In at Hospital Reception</span>
            </div>
          ) : (
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Status: Ready for Admin Portal QR Scan ({appointment.status})
            </span>
          )}
        </div>

        {/* Encoded Patient & Appointment Details Summary */}
        <div className="p-5 space-y-4 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#0F766E] dark:text-[#2DD4BF]">
              Patient Details Encoded in QR Cipher
            </span>
            <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
              Sig: {qrPass.encodedDetails.signature.slice(0, 10)}...
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700">
              <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-bold">
                Patient Identity
              </span>
              <div className="font-bold text-slate-900 dark:text-white mt-0.5 truncate">
                {appointment.patientName}
              </div>
              <div className="font-mono text-[11px] text-[#0F766E] dark:text-[#2DD4BF] truncate">
                {appointment.patientEmail}
              </div>
              <div className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                {qrPass.encodedDetails.patientPhone} · Blood{' '}
                <strong>{qrPass.encodedDetails.bloodGroup}</strong>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700">
              <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-bold">
                Attending Physician
              </span>
              <div className="font-bold text-slate-900 dark:text-white mt-0.5 truncate">
                {appointment.doctorName}
              </div>
              <div className="text-[11px] text-slate-600 dark:text-slate-300 truncate">
                {appointment.doctorSpecialty} · {appointment.roomNumber}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                {appointment.visitType} · {appointment.reason}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 text-slate-900 dark:text-white">
              <Calendar className="w-4 h-4 text-[#0F766E] dark:text-[#2DD4BF] shrink-0" />
              <div>
                <span className="text-slate-500 dark:text-slate-400 block text-[10px]">
                  Appointment Date
                </span>
                <span className="font-mono font-bold">
                  {appointment.appointmentDate}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-slate-900 dark:text-white">
              <Clock className="w-4 h-4 text-[#0F766E] dark:text-[#2DD4BF] shrink-0" />
              <div>
                <span className="text-slate-500 dark:text-slate-400 block text-[10px]">
                  Time Slot
                </span>
                <span className="font-mono font-bold">
                  {appointment.timeSlot}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 flex flex-wrap items-center gap-2.5">
            <Link
              href={`/admin?tab=qr-scanner&scanApptId=${appointment.id}`}
              onClick={onClose}
              className="sahs-button-primary flex-1 py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
            >
              <KeyRound className="w-4 h-4" />
              <span>Scan &amp; Grant Access in Admin Portal</span>
            </Link>

            <button
              type="button"
              disabled={scanning || isAlreadyCheckedIn}
              onClick={handleSimulateScan}
              className={`py-2.5 px-3.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                isAlreadyCheckedIn
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 cursor-default'
                  : 'sahs-button-secondary'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 text-[#0F766E] dark:text-[#2DD4BF]" />
              <span>
                {isAlreadyCheckedIn
                  ? 'Access Granted'
                  : scanning
                  ? 'Verifying...'
                  : 'Quick Reception Check-In'}
              </span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="sahs-button-secondary py-2.5 px-3.5 rounded-xl text-xs font-bold cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
