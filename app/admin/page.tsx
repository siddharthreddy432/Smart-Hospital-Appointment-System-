'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ShieldAlert,
  Lock,
  KeyRound,
  Download,
  UserPlus,
  Trash2,
  CalendarPlus,
  CheckCircle2,
  MessageSquare,
  PhoneCall,
  Send,
  BrainCircuit,
  Stethoscope,
  CalendarClock,
  ClipboardList,
  Users,
  Database,
  LogOut,
  ExternalLink,
  Copy,
  Check,
  QrCode,
  AlertTriangle,
  RefreshCw,
  Sun,
  Moon,
  Scan,
  ShieldCheck,
  UserCheck,
  XCircle,
} from 'lucide-react';
import { useHospital, SAHS_LOGO_SRC } from '@/components/HospitalProvider';
import {
  generateAppointmentsCsv,
  ExportableAppointmentRow,
} from '@/lib/csv-export';
import BookingWorkspace from '@/components/BookingWorkspace';
import {
  generateCheckInCode,
  generateAppointmentQrPass,
  decodeAndVerifyAdminQrPayload,
  EncodedPatientQrDetails,
} from '@/lib/qr-checkin';
import AppointmentQrModal, {
  QrPassAppointmentData,
} from '@/components/AppointmentQrModal';
import {
  MESSAGE_TEMPLATES,
  MessageTemplateType,
  MessagingChannel,
  ManualDeliveryStatus,
  MANUAL_DELIVERY_STATUS_LABELS,
  GOOGLE_MESSAGES_WEB_URL,
  normalizePhoneForMessaging,
  generateAppointmentMessage,
  detectSensitiveClinicalContent,
  buildWhatsAppClickToChatUrl,
  buildSmsLinks,
  transitionManualDeliveryStatus,
} from '@/lib/manual-messaging';

type AdminCloneTab =
  | 'overview'
  | 'qr-scanner'
  | 'appointments'
  | 'doctors'
  | 'schedules'
  | 'patients'
  | 'booking-clone'
  | 'ml-engine'
  | 'messaging';

const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

export default function SeparateAdminPortalPage() {
  const {
    doctors,
    schedules,
    patients,
    appointments,
    historyLogs,
    isAdminAuthenticated,
    loginAsAdmin,
    logoutAdmin,
    refreshHospitalData,
    setStatusBanner,
    theme,
    toggleTheme,
  } = useHospital();

  const [usernameInput, setUsernameInput] = useState('Admin');
  const [passwordInput, setPasswordInput] = useState('Admin@123');
  const [loginError, setLoginError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<AdminCloneTab>('overview');
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);
  const [selectedQrAppt, setSelectedQrAppt] =
    useState<QrPassAppointmentData | null>(null);

  // Doctor CRUD Form
  const [docName, setDocName] = useState('');
  const [docSpecialty, setDocSpecialty] = useState('Cardiology');
  const [docDepartment, setDocDepartment] = useState('Cardiology');
  const [docQualification, setDocQualification] = useState('MD, FACC');
  const [docRoom, setDocRoom] = useState('Suite 200');
  const [docExp, setDocExp] = useState('10');
  const [docFee, setDocFee] = useState('150');
  const [docBio, setDocBio] = useState('');
  const [docSubmitting, setDocSubmitting] = useState(false);

  // Schedule CRUD Form
  const [schedDoctorId, setSchedDoctorId] = useState<number>(0);
  const [schedDay, setSchedDay] = useState('Monday');
  const [schedStart, setSchedStart] = useState('09:00');
  const [schedEnd, setSchedEnd] = useState('17:00');
  const [schedDuration, setSchedDuration] = useState('30');
  const [schedMaxPatients, setSchedMaxPatients] = useState('16');
  const [schedSubmitting, setSchedSubmitting] = useState(false);

  // Patient CRUD Form
  const [patName, setPatName] = useState('');
  const [patEmail, setPatEmail] = useState('');
  const [patPhone, setPatPhone] = useState('');
  const [patAge, setPatAge] = useState('30');
  const [patGender, setPatGender] = useState('Female');
  const [patBlood, setPatBlood] = useState('O+');
  const [patSubmitting, setPatSubmitting] = useState(false);

  // Manual WhatsApp & SMS Messaging Module State
  const [selectedApptId, setSelectedApptId] = useState<number>(0);
  const [channel, setChannel] = useState<MessagingChannel>('WHATSAPP');
  const [templateType, setTemplateType] =
    useState<MessageTemplateType>('CONFIRMATION');
  const [defaultCountryCode, setDefaultCountryCode] = useState<string>('+91');
  const [phoneOverride, setPhoneOverride] = useState<string>('');
  const [customMessage, setCustomMessage] = useState<string>('');
  const [isMessageEdited, setIsMessageEdited] = useState<boolean>(false);
  const [deliveryStatusByAppt, setDeliveryStatusByAppt] = useState<
    Record<number, ManualDeliveryStatus>
  >({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [sendingMsg, setSendingMsg] = useState(false);

  // Admin QR Scanner Module State
  const [scanInput, setScanInput] = useState<string>('');
  const [selectedScanApptId, setSelectedScanApptId] = useState<number>(0);
  const [verifiedQrDetails, setVerifiedQrDetails] =
    useState<EncodedPatientQrDetails | null>(null);
  const [scanVerificationStatus, setScanVerificationStatus] = useState<
    'idle' | 'valid' | 'invalid'
  >('idle');
  const [scanStatusMessage, setScanStatusMessage] = useState<string>('');
  const [isGrantingAccess, setIsGrantingAccess] = useState<boolean>(false);
  const [isSimulatingCamera, setIsSimulatingCamera] = useState<boolean>(false);

  const showToast = (msg: string) => {
    setFeedbackBanner(msg);
    setStatusBanner(msg);
  };

  const handleOpenScannerForAppt = (apptId: number) => {
    setSelectedScanApptId(apptId);
    setActiveTab('qr-scanner');
    const appt = appointments.find((a) => a.id === apptId);
    if (!appt) return;
    const pat = patients.find((p) => p.id === appt.patientId);
    const doc = doctors.find((d) => d.id === appt.doctorId);

    const generated = generateAppointmentQrPass({
      appointmentId: appt.id,
      patientName: pat?.fullName || `Patient #${appt.patientId}`,
      patientEmail: pat?.email || 'patient@gmail.com',
      patientPhone: pat?.phone,
      patientAge: pat?.age,
      patientGender: pat?.gender,
      bloodGroup: pat?.bloodGroup,
      doctorName: doc?.name || `Doctor #${appt.doctorId}`,
      doctorSpecialty: doc?.specialty || 'General Medicine',
      roomNumber: doc?.roomNumber || 'Suite 101',
      appointmentDate: appt.appointmentDate,
      timeSlot: appt.timeSlot,
      reason: appt.reason,
      status: appt.status,
    });

    setScanInput(generated.adminQrToken);
    const result = decodeAndVerifyAdminQrPayload(generated.adminQrToken);
    if (result.valid && result.details) {
      setVerifiedQrDetails(result.details);
      setScanVerificationStatus('valid');
      setScanStatusMessage('Signature Verified: Authentic SAHS Encrypted Pass.');
      showToast(`Loaded QR Pass for ${result.details.patientName}.`);
    } else {
      setVerifiedQrDetails(null);
      setScanVerificationStatus('invalid');
      setScanStatusMessage(result.error || 'Invalid QR payload.');
    }
  };

  const handleVerifyCurrentInput = () => {
    const trimmed = scanInput.trim();
    if (!trimmed) {
      setScanVerificationStatus('invalid');
      setScanStatusMessage('Please enter or scan an SAHS QR code payload.');
      return;
    }
    const result = decodeAndVerifyAdminQrPayload(trimmed);
    if (result.valid && result.details) {
      setVerifiedQrDetails(result.details);
      setSelectedScanApptId(result.details.appointmentId);
      setScanVerificationStatus('valid');
      setScanStatusMessage('Signature Verified: Authentic SAHS QR Pass.');
      showToast(`Verified Pass for ${result.details.patientName}.`);
    } else if (result.valid && result.checkInCode) {
      const matched = appointments.find((a) => {
        const p = patients.find((pat) => pat.id === a.patientId);
        const code = generateCheckInCode({
          appointmentId: a.id,
          patientEmail: p?.email || '',
          appointmentDate: a.appointmentDate,
          timeSlot: a.timeSlot,
          patientName: p?.fullName || '',
          doctorName: '',
        });
        return code === result.checkInCode;
      });
      if (matched) {
        handleOpenScannerForAppt(matched.id);
      } else {
        setScanVerificationStatus('invalid');
        setScanStatusMessage(`Token ${result.checkInCode} not found in active hospital records.`);
      }
    } else {
      setVerifiedQrDetails(null);
      setScanVerificationStatus('invalid');
      setScanStatusMessage(result.error || 'QR Verification Failed: Invalid payload or signature.');
    }
  };

  const handleGrantAccessAndCheckIn = async () => {
    const targetApptId = verifiedQrDetails?.appointmentId || selectedScanApptId;
    if (!targetApptId) return;
    setIsGrantingAccess(true);
    try {
      const res = await fetch('/api/appointments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: targetApptId,
          status: 'Completed',
          clinicalNotes: `ACCESS GRANTED & CHECKED-IN VIA ADMIN QR SCANNER (${verifiedQrDetails?.checkInCode || 'VERIFIED'}) at ${new Date().toLocaleTimeString()}`,
          performedBy: 'SAHS Admin QR Security Kiosk',
        }),
      });
      if (res.ok) {
        await refreshHospitalData();
        setScanVerificationStatus('valid');
        setScanStatusMessage(`Access Granted! Patient checked-in to hospital suite (Appointment #${targetApptId}).`);
        showToast(`Access Granted & Patient Checked-In for Appointment #${targetApptId}!`);
        if (verifiedQrDetails) {
          setVerifiedQrDetails((prev) => (prev ? { ...prev, status: 'Completed' } : null));
        }
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || 'Failed to update check-in status.');
      }
    } finally {
      setIsGrantingAccess(false);
    }
  };

  const handleDenyQrPass = async () => {
    const targetApptId = verifiedQrDetails?.appointmentId || selectedScanApptId;
    if (!targetApptId) return;
    setIsGrantingAccess(true);
    try {
      const res = await fetch('/api/appointments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: targetApptId,
          status: 'Cancelled',
          clinicalNotes: `ENTRY DENIED AT ADMIN QR SCANNER: Pass rejected or invalidated by hospital security at ${new Date().toLocaleTimeString()}`,
          performedBy: 'SAHS Admin QR Security Kiosk',
        }),
      });
      if (res.ok) {
        await refreshHospitalData();
        setScanVerificationStatus('invalid');
        setScanStatusMessage(`Access Denied: Appointment #${targetApptId} invalidated by hospital staff.`);
        showToast(`Access Denied for Appointment #${targetApptId}.`);
        if (verifiedQrDetails) {
          setVerifiedQrDetails((prev) => (prev ? { ...prev, status: 'Cancelled' } : null));
        }
      }
    } finally {
      setIsGrantingAccess(false);
    }
  };

  const handleSimulateOpticalScan = (apptId: number) => {
    setIsSimulatingCamera(true);
    setTimeout(() => {
      setIsSimulatingCamera(false);
      handleOpenScannerForAppt(apptId);
    }, 600);
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    const ok = loginAsAdmin(usernameInput, passwordInput);
    if (!ok) {
      setLoginError(
        'Invalid credentials. Temporary Admin credentials: Admin / Admin@123'
      );
    }
  };

  const handleExportCsv = () => {
    const rows: ExportableAppointmentRow[] = appointments.map((appt) => {
      const doc = doctors.find((d) => d.id === appt.doctorId);
      const pat = patients.find((p) => p.id === appt.patientId);
      return {
        id: appt.id,
        appointmentDate: appt.appointmentDate,
        timeSlot: appt.timeSlot,
        patientName: pat?.fullName || `Patient #${appt.patientId}`,
        patientEmail: pat?.email || 'N/A',
        patientPhone: pat?.phone || 'N/A',
        doctorName: doc?.name || `Doctor #${appt.doctorId}`,
        doctorSpecialty: doc?.specialty || 'General',
        visitType: appt.visitType || 'In-Person',
        reason: appt.reason,
        status: appt.status,
        noShowProbability: appt.noShowProbability,
        noShowRiskLevel: appt.noShowRiskLevel || 'Low',
        smsReminder: Boolean(appt.smsReminder),
        clinicalNotes: appt.clinicalNotes || '',
      };
    });

    const csvContent = generateAppointmentsCsv(rows);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStamp = new Date().toISOString().split('T')[0];
    link.href = url;
    link.setAttribute('download', `SAHS_Appointments_Backup_${dateStamp}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(
      `Exported ${rows.length} appointment row(s) as CSV backup file.`
    );
  };

  // Standalone Admin Login Gate
  if (!isAdminAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col justify-between p-6 text-slate-900 dark:text-slate-100">
        <div className="max-w-5xl mx-auto w-full flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="relative w-9 h-9 rounded-xl overflow-hidden border border-slate-300/80 dark:border-slate-700/80 shadow-sm shrink-0 bg-slate-900">
              <Image
                src={SAHS_LOGO_SRC}
                alt="SAHS Logo"
                fill
                sizes="36px"
                className="object-cover"
                priority
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <span className="font-extrabold text-sm text-slate-900 dark:text-white block">
                SAHS Admin Portal
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Hospital Operations &amp; Clinical Command
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              className="w-8 h-8 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800/80 transition-colors cursor-pointer"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>
            <Link
              href="/"
              className="sahs-button-secondary px-3.5 py-1.5 rounded-xl font-bold text-xs inline-flex items-center gap-1.5"
            >
              <span>Patient Portal</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        <div className="max-w-md mx-auto w-full my-auto py-8">
          <div className="sahs-card p-6 sm:p-8 space-y-5">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 text-[#0F766E] dark:text-[#2DD4BF] text-[11px] font-bold uppercase tracking-wider">
                <Lock className="w-3.5 h-3.5" /> Restricted Hospital Command
              </div>
              <h1 className="text-xl font-extrabold text-slate-900 dark:text-white pt-0.5 tracking-tight">
                Administrator Sign-In
              </h1>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Sign in with administrator credentials to manage doctors, schedules, patient care records, and manual messaging.
              </p>
            </div>

            <div className="p-3.5 sahs-panel rounded-xl flex items-center justify-between text-xs">
              <div>
                <p className="font-semibold text-slate-500 dark:text-slate-400 text-[10px]">
                  Demo Credentials
                </p>
                <p className="font-mono font-bold text-slate-900 dark:text-white">
                  User: Admin | Pass: Admin@123
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setUsernameInput('Admin');
                  setPasswordInput('Admin@123');
                }}
                className="sahs-button-secondary px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer"
              >
                Auto-Fill
              </button>
            </div>

            {loginError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-800 dark:text-rose-200 font-semibold text-xs">
                {loginError}
              </div>
            )}

            <form onSubmit={handleAdminLogin} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-800 dark:text-slate-200 mb-1">
                  Admin Username
                </label>
                <input
                  type="text"
                  required
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50/90 dark:bg-slate-900/90 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-800 dark:text-slate-200 mb-1">
                  Admin Password
                </label>
                <input
                  type="password"
                  required
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50/90 dark:bg-slate-900/90 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                className="sahs-button-primary w-full py-2.5 rounded-lg font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <KeyRound className="w-4 h-4" /> Unlock Admin Dashboard
              </button>
            </form>
          </div>
        </div>

        <div className="max-w-5xl mx-auto w-full text-center text-xs text-[#64748B]">
          SAHS Administration · Cloud SQL PostgreSQL
        </div>
      </div>
    );
  }

  // CRUD Handlers
  const handleAddDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docName.trim()) return;
    setDocSubmitting(true);
    try {
      const res = await fetch('/api/doctors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: docName.trim(),
          specialty: docSpecialty,
          department: docDepartment,
          qualification: docQualification,
          roomNumber: docRoom.trim() || 'Suite 200',
          experienceYears: Number(docExp) || 8,
          consultationFee: Number(docFee) || 150,
          bio:
            docBio.trim() ||
            `Board-certified specialist in ${docSpecialty} at SAHS.`,
          availableDays: 'Monday, Wednesday, Friday',
        }),
      });
      if (res.ok) {
        await refreshHospitalData();
        setDocName('');
        setDocRoom('Suite 200');
        setDocBio('');
        showToast(`Added ${docName} to PostgreSQL.`);
      }
    } finally {
      setDocSubmitting(false);
    }
  };

  const handleDeleteDoctor = async (id: number) => {
    await fetch(`/api/admin?entity=doctor&id=${id}`, { method: 'DELETE' });
    await refreshHospitalData();
    showToast(`Removed Doctor #${id}.`);
  };

  const handleAddSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetDocId = schedDoctorId || doctors[0]?.id;
    if (!targetDocId) return;
    setSchedSubmitting(true);
    try {
      const res = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doctorId: Number(targetDocId),
          dayOfWeek: schedDay,
          startTime: schedStart,
          endTime: schedEnd,
          slotDurationMinutes: Number(schedDuration) || 30,
          maxPatients: Number(schedMaxPatients) || 15,
          isAvailable: true,
        }),
      });
      if (res.ok) {
        await refreshHospitalData();
        showToast(`Added ${schedDay} schedule block.`);
      }
    } finally {
      setSchedSubmitting(false);
    }
  };

  const handleDeleteSchedule = async (id: number) => {
    await fetch(`/api/admin?entity=schedule&id=${id}`, { method: 'DELETE' });
    await refreshHospitalData();
    showToast(`Deleted schedule block #${id}.`);
  };

  const handleAddPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patName.trim() || !patEmail.trim()) return;
    setPatSubmitting(true);
    try {
      const res = await fetch('/api/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: patName.trim(),
          email: patEmail.trim().toLowerCase(),
          phone: patPhone.trim() || '+1 (555) 000-0000',
          age: Number(patAge) || 30,
          gender: patGender,
          bloodGroup: patBlood,
        }),
      });
      if (res.ok) {
        await refreshHospitalData();
        setPatName('');
        setPatEmail('');
        setPatPhone('');
        showToast(`Registered patient ${patName.trim()}.`);
      }
    } finally {
      setPatSubmitting(false);
    }
  };

  const handleDeletePatient = async (id: number) => {
    await fetch(`/api/admin?entity=patient&id=${id}`, { method: 'DELETE' });
    await refreshHospitalData();
    showToast(`Removed patient #${id}.`);
  };

  const handleUpdateAppointmentStatus = async (id: number, status: string) => {
    await fetch('/api/appointments', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        status,
        performedBy: 'Admin Portal',
      }),
    });
    await refreshHospitalData();
    showToast(`Updated Appointment #${id} status to ${status}.`);
  };

  const handleDeleteAppointment = async (id: number) => {
    await fetch(`/api/admin?entity=appointment&id=${id}`, {
      method: 'DELETE',
    });
    await refreshHospitalData();
    showToast(`Deleted Appointment #${id}.`);
  };

  const handleClearDatabase = async () => {
    await fetch('/api/admin?entity=all', { method: 'DELETE' });
    await refreshHospitalData();
    showToast('All database tables cleared.');
  };

  const handleQrCheckInScan = async (
    appointmentId: number,
    checkInCode: string
  ) => {
    const res = await fetch('/api/appointments', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: appointmentId,
        status: 'Completed',
        clinicalNotes: `CHECKED-IN VIA QR (${checkInCode}) AT RECEPTION`,
        performedBy: `Admin Kiosk Scanner (${checkInCode})`,
      }),
    });
    if (res.ok) {
      await refreshHospitalData();
      setSelectedQrAppt((prev) =>
        prev
          ? {
              ...prev,
              status: 'Completed',
              clinicalNotes: `CHECKED-IN VIA QR (${checkInCode}) AT RECEPTION`,
            }
          : null
      );
      showToast(
        `Verified QR Check-In (${checkInCode}) for Appointment #${appointmentId}.`
      );
    }
  };

  const activeApptId = selectedApptId || appointments[0]?.id || 0;
  const selectedAppt = appointments.find((a) => a.id === Number(activeApptId));
  const selectedApptPatient = patients.find(
    (p) => p.id === selectedAppt?.patientId
  );
  const selectedApptDoctor = doctors.find(
    (d) => d.id === selectedAppt?.doctorId
  );

  const effectiveRawPhone =
    phoneOverride !== ''
      ? phoneOverride
      : selectedApptPatient?.phone || '+91 98765 43210';

  const generatedTemplateMessage = selectedAppt
    ? generateAppointmentMessage(templateType, {
        appointmentId: selectedAppt.id,
        patientName:
          selectedApptPatient?.fullName ||
          `Patient #${selectedAppt.patientId}`,
        hospitalName: 'SAHS (Smart Appointment & Hospital System)',
        doctorName:
          selectedApptDoctor?.name || `Doctor #${selectedAppt.doctorId}`,
        department:
          selectedApptDoctor?.department ||
          selectedApptDoctor?.specialty ||
          'General Medicine',
        appointmentDate: selectedAppt.appointmentDate,
        timeSlot: selectedAppt.timeSlot,
        roomNumber: selectedApptDoctor?.roomNumber,
        visitType: selectedAppt.visitType,
      })
    : 'Hello from SAHS (Smart Appointment & Hospital System)! Your appointment details are ready.';

  const effectiveMessage = isMessageEdited
    ? customMessage
    : generatedTemplateMessage;

  const waLinkResult = buildWhatsAppClickToChatUrl(
    effectiveRawPhone,
    effectiveMessage,
    defaultCountryCode
  );
  const smsLinkResult = buildSmsLinks(
    effectiveRawPhone,
    effectiveMessage,
    defaultCountryCode
  );
  const clinicalPrivacyCheck = detectSensitiveClinicalContent(
    effectiveMessage,
    selectedAppt?.reason
  );

  const currentApptDeliveryStatus: ManualDeliveryStatus =
    (selectedAppt && deliveryStatusByAppt[selectedAppt.id]) || 'PREPARED';

  const handleSelectAppointmentForMessaging = (apptId: number) => {
    setSelectedApptId(apptId);
    const appt = appointments.find((a) => a.id === apptId);
    const pat = patients.find((p) => p.id === appt?.patientId);
    setPhoneOverride(pat?.phone || '+91 98765 43210');
    setIsMessageEdited(false);
    setCustomMessage('');
    setDeliveryStatusByAppt((prev) => ({
      ...prev,
      [apptId]: prev[apptId] || 'PREPARED',
    }));
  };

  const handleSelectTemplate = (nextTemplate: MessageTemplateType) => {
    setTemplateType(nextTemplate);
    setIsMessageEdited(false);
    setCustomMessage('');
    if (selectedAppt) {
      const nextState = transitionManualDeliveryStatus(
        currentApptDeliveryStatus,
        'PREPARE'
      );
      setDeliveryStatusByAppt((prev) => ({
        ...prev,
        [selectedAppt.id]: nextState.status,
      }));
    }
  };

  const handleCopyText = (key: string, textToCopy: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(textToCopy);
      setCopiedKey(key);
      setTimeout(() => {
        setCopiedKey((prev) => (prev === key ? null : prev));
      }, 2000);
    }
  };

  const handleRecordManualMessagingAction = async (
    targetChannel: MessagingChannel,
    transitionAction: 'PREPARE' | 'OPEN_WHATSAPP' | 'OPEN_SMS' | 'CONFIRM_MANUAL_SEND'
  ) => {
    if (!selectedAppt) return;
    setChannel(targetChannel);
    const nextTransition = transitionManualDeliveryStatus(
      currentApptDeliveryStatus,
      transitionAction
    );
    setDeliveryStatusByAppt((prev) => ({
      ...prev,
      [selectedAppt.id]: nextTransition.status,
    }));

    if (!waLinkResult.normalizedPhone.isValid) {
      showToast(
        waLinkResult.normalizedPhone.error ||
          'Please enter a valid phone number first.'
      );
      return;
    }

    setSendingMsg(true);
    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointmentId: selectedAppt.id,
          channel: targetChannel,
          deliveryStatus: nextTransition.status,
          templateType,
          defaultCountryCode,
          recipientPhone: effectiveRawPhone,
          message: effectiveMessage,
        }),
      });
      if (res.ok) {
        await refreshHospitalData();
      }
      showToast(
        `Appointment #${selectedAppt.id} (${targetChannel}): ${nextTransition.label}.`
      );
    } finally {
      setSendingMsg(false);
    }
  };

  return (
    <div className="min-h-screen text-slate-900 dark:text-slate-100">
      {/* Reimagined Unboxed Admin Header */}
      <header className="bg-white/85 dark:bg-[#0B1211]/85 backdrop-blur-xl border-b border-slate-200/70 dark:border-slate-800/80 sticky top-0 z-40 transition-colors">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 h-16 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative w-9 h-9 rounded-xl overflow-hidden border border-slate-300/80 dark:border-slate-700/80 shadow-sm shrink-0 bg-slate-900">
              <Image
                src={SAHS_LOGO_SRC}
                alt="SAHS Logo"
                fill
                sizes="36px"
                className="object-cover"
                priority
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base text-slate-900 dark:text-white tracking-tight">
                  SAHS Admin Dashboard
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#0F766E] dark:text-[#2DD4BF]">
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                  Verified
                </span>
              </div>
              <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 block">
                Smart Appointment &amp; Hospital Operations
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              className="w-8 h-8 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800/80 transition-colors cursor-pointer"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              className="sahs-button-primary px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> Export Appointments CSV (
              {appointments.length})
            </button>

            <Link
              href="/"
              className="sahs-button-secondary px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1"
            >
              <span>Patient Site</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>

            <button
              type="button"
              onClick={logoutAdmin}
              className="sahs-button-secondary px-3 py-1.5 rounded-xl font-bold text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" /> Lock Admin
            </button>
          </div>
        </div>

        {/* Clean Unboxed Admin Tabs */}
        <div className="border-t border-slate-200/60 dark:border-slate-800/70 px-4 sm:px-6 overflow-x-auto">
          <div className="max-w-[1280px] mx-auto flex items-center gap-1">
            {[
              { id: 'overview', label: 'Overview', icon: Copy },
              {
                id: 'qr-scanner',
                label: 'QR Scanner & Access Control',
                icon: QrCode,
              },
              {
                id: 'appointments',
                label: `Appointments & CSV (${appointments.length})`,
                icon: ClipboardList,
              },
              {
                id: 'doctors',
                label: `Doctors (${doctors.length})`,
                icon: Stethoscope,
              },
              {
                id: 'schedules',
                label: `Schedules (${schedules.length})`,
                icon: CalendarClock,
              },
              {
                id: 'patients',
                label: `Patients (${patients.length})`,
                icon: Users,
              },
              {
                id: 'booking-clone',
                label: 'Booking Workspace',
                icon: CalendarPlus,
              },
              { id: 'ml-engine', label: 'No-Show ML', icon: BrainCircuit },
              {
                id: 'messaging',
                label: 'SMS & WhatsApp',
                icon: MessageSquare,
              },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as AdminCloneTab)}
                  className={`relative px-3 py-2.5 font-semibold text-xs whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer ${
                    isActive
                      ? 'text-[#0F766E] dark:text-[#2DD4BF] font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                  {isActive && (
                    <span className="absolute bottom-0 left-2.5 right-2.5 h-[2.5px] rounded-full bg-[#0F766E] dark:bg-[#2DD4BF]" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-6 space-y-6">
        {feedbackBanner && (
          <div className="p-3.5 sahs-card flex items-center justify-between text-slate-900 dark:text-white text-xs font-bold">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#0F766E] dark:text-[#2DD4BF] shrink-0" />
              <span>{feedbackBanner}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedbackBanner(null)}
              className="text-xs font-bold text-[#0F766E] dark:text-[#2DD4BF] hover:underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="sahs-card p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#0F766E] block">
                  Hospital Administration
                </span>
                <h1 className="text-xl sm:text-2xl font-extrabold text-[#17211F] mt-0.5">
                  SAHS Operations &amp; Database Overview
                </h1>
                <p className="text-xs text-[#64748B] mt-1 max-w-2xl">
                  Manage doctors, weekly shift schedules, patient registrations, appointment check-ins, and CSV backups.
                </p>
              </div>

              <div className="flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="sahs-button-primary px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> Export Appointments CSV
                </button>
                <button
                  type="button"
                  onClick={handleClearDatabase}
                  className="sahs-button-secondary px-3.5 py-2 text-rose-700 rounded-lg font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Database className="w-3.5 h-3.5" /> Clear All Data
                </button>
              </div>
            </div>

            {/* Essential Statistics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {
                  label: 'Doctors',
                  val: doctors.length,
                  target: 'doctors' as AdminCloneTab,
                },
                {
                  label: 'Schedule Shifts',
                  val: schedules.length,
                  target: 'schedules' as AdminCloneTab,
                },
                {
                  label: 'Registered Patients',
                  val: patients.length,
                  target: 'patients' as AdminCloneTab,
                },
                {
                  label: 'Appointments',
                  val: appointments.length,
                  target: 'appointments' as AdminCloneTab,
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="sahs-card p-4 flex flex-col justify-between"
                >
                  <p className="text-xs font-semibold text-[#64748B]">
                    {stat.label}
                  </p>
                  <p className="text-2xl font-extrabold text-[#17211F] my-1.5">
                    {stat.val}
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab(stat.target)}
                    className="text-xs font-bold text-[#0F766E] hover:underline text-left cursor-pointer"
                  >
                    Manage →
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB: QR SCANNER & ACCESS CONTROL */}
        {activeTab === 'qr-scanner' && (
          <div className="space-y-6">
            <div className="sahs-card p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#0F766E] dark:text-[#2DD4BF] flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" /> Kiosk Access Control &amp; Arrival Authentication
                </span>
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white mt-0.5">
                  Admin QR Pass Scanner
                </h1>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 max-w-2xl">
                  Scan patient arrival QR Passes encrypted with SAHS-ADMIN-QR-V3. Google Scanner and external public cameras are denied by protocol to protect patient privacy.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1.5 rounded-xl border border-teal-600/30 bg-teal-500/10 text-xs font-bold text-[#0F766E] dark:text-[#2DD4BF]">
                  {appointments.filter((a) => a.status === 'Scheduled').length} Scheduled
                </span>
                <span className="px-3 py-1.5 rounded-xl border border-emerald-600/30 bg-emerald-500/10 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                  {appointments.filter((a) => a.status === 'Completed').length} Checked-In
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left 6 cols: Scanner Terminal / Camera Simulator / Input */}
              <div className="lg:col-span-6 sahs-card p-5 sm:p-6 space-y-5">
                <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 pb-3">
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Scan className="w-4 h-4 text-[#0F766E] dark:text-[#2DD4BF]" />
                    Optical Scanner Input
                  </h2>
                  <span className="text-[10px] font-mono font-bold text-[#0F766E] dark:text-[#2DD4BF] bg-teal-500/10 px-2 py-0.5 rounded">
                    Admin Only · Lens Denied
                  </span>
                </div>

                {/* Quick Selection from Active Appointments */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                    Select Patient Appointment to Scan
                  </label>
                  <select
                    value={selectedScanApptId}
                    onChange={(e) => {
                      const id = Number(e.target.value);
                      if (id > 0) {
                        handleOpenScannerForAppt(id);
                      } else {
                        setSelectedScanApptId(0);
                        setScanInput('');
                        setVerifiedQrDetails(null);
                        setScanVerificationStatus('idle');
                        setScanStatusMessage('');
                      }
                    }}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value={0}>-- Select from Hospital Appointment Queue --</option>
                    {appointments.map((a) => {
                      const p = patients.find((pat) => pat.id === a.patientId);
                      const d = doctors.find((doc) => doc.id === a.doctorId);
                      return (
                        <option key={a.id} value={a.id}>
                          #{a.id} · {p?.fullName || `Patient #${a.patientId}`} · {d?.name || `Doctor #${a.doctorId}`} ({a.appointmentDate} {a.timeSlot}) [{a.status}]
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Simulated Scanner Viewfinder */}
                <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 p-6 flex flex-col items-center justify-center text-center min-h-[180px]">
                  {/* Viewfinder Target Reticle */}
                  <div className="absolute inset-4 pointer-events-none border border-teal-500/30 rounded-xl flex flex-col justify-between p-2">
                    <div className="flex justify-between">
                      <span className="w-4 h-4 border-t-2 border-l-2 border-teal-400" />
                      <span className="w-4 h-4 border-t-2 border-r-2 border-teal-400" />
                    </div>
                    {isSimulatingCamera && (
                      <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-teal-400 to-transparent animate-pulse" />
                    )}
                    <div className="flex justify-between">
                      <span className="w-4 h-4 border-b-2 border-l-2 border-teal-400" />
                      <span className="w-4 h-4 border-b-2 border-r-2 border-teal-400" />
                    </div>
                  </div>

                  <QrCode className={`w-12 h-12 mb-2 transition-transform duration-200 ${isSimulatingCamera ? 'text-teal-400 scale-110' : 'text-slate-600'}`} />
                  <p className="text-xs font-bold text-white">
                    {isSimulatingCamera ? 'Decoding encrypted QR stream...' : 'Optical Kiosk Scanner Ready'}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
                    Hold patient mobile screen up to the scanner or paste the raw SAHS-ADMIN-QR-V3 string below.
                  </p>

                  {selectedScanApptId > 0 && (
                    <button
                      type="button"
                      onClick={() => handleSimulateOpticalScan(selectedScanApptId)}
                      disabled={isSimulatingCamera}
                      className="mt-3 px-3 py-1.5 rounded-lg text-xs font-bold sahs-button-primary inline-flex items-center gap-1.5"
                    >
                      <Scan className="w-3.5 h-3.5" />
                      <span>{isSimulatingCamera ? 'Scanning...' : 'Simulate Camera Laser Scan'}</span>
                    </button>
                  )}
                </div>

                {/* Raw QR Payload or Verification URL Input */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Raw Encrypted Payload / Verify URL / Check-In Code
                    </label>
                    {scanInput && (
                      <button
                        type="button"
                        onClick={() => {
                          setScanInput('');
                          setVerifiedQrDetails(null);
                          setScanVerificationStatus('idle');
                          setScanStatusMessage('');
                        }}
                        className="text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <textarea
                    rows={3}
                    value={scanInput}
                    onChange={(e) => setScanInput(e.target.value)}
                    placeholder="Paste SAHS-ADMIN-QR-V3::<code >::<cipher>::<sig> or https://sahs.telis.tech/qr-pass/verify?... or SAHS-1001-XXXXXX"
                    className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleVerifyCurrentInput}
                      className="sahs-button-primary px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Decrypt &amp; Authenticate QR</span>
                    </button>

                    {selectedScanApptId > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const appt = appointments.find((a) => a.id === selectedScanApptId);
                          const pat = patients.find((p) => p.id === appt?.patientId);
                          const doc = doctors.find((d) => d.id === appt?.doctorId);
                          if (appt) {
                            setSelectedQrAppt({
                              id: appt.id,
                              appointmentDate: appt.appointmentDate,
                              timeSlot: appt.timeSlot,
                              visitType: appt.visitType,
                              reason: appt.reason,
                              status: appt.status,
                              clinicalNotes: appt.clinicalNotes,
                              patientName: pat?.fullName || `Patient #${appt.patientId}`,
                              patientEmail: pat?.email || 'patient@gmail.com',
                              patientPhone: pat?.phone,
                              patientAge: pat?.age,
                              patientGender: pat?.gender,
                              bloodGroup: pat?.bloodGroup,
                              doctorName: doc?.name || `Doctor #${appt.doctorId}`,
                              doctorSpecialty: doc?.specialty || 'General Medicine',
                              roomNumber: doc?.roomNumber || 'Suite 101',
                            });
                          }
                        }}
                        className="sahs-button-secondary px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span>View Scannable QR Matrix</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Google Scanner / Lens Denial Protocol Explanation */}
                <div className="p-3.5 rounded-xl border border-amber-300/60 dark:border-amber-700/60 bg-amber-500/10 text-xs text-amber-900 dark:text-amber-200 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span>Google Scanner &amp; Lens Denial Policy</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    If scanned with Google Scanner, Google Lens, or public cameras, the encrypted payload cannot be decoded and the URL route (/qr-pass/verify) displays an explicit access denial screen to protect patient health confidentiality. Only this SAHS Admin Portal can authenticate arrival and grant hospital access.
                  </p>
                </div>
              </div>

              {/* Right 6 cols: Decrypted Patient Verification Card & Access Granting Action */}
              <div className="lg:col-span-6 sahs-card p-5 sm:p-6 space-y-5">
                <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 pb-3">
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-[#0F766E] dark:text-[#2DD4BF]" />
                    Decrypted Patient Pass &amp; Clinical Authentication
                  </h2>
                  <span
                    className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                      scanVerificationStatus === 'valid'
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                        : scanVerificationStatus === 'invalid'
                        ? 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30'
                        : 'bg-slate-500/15 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {scanVerificationStatus === 'valid'
                      ? 'AUTHENTIC PASS'
                      : scanVerificationStatus === 'invalid'
                      ? 'INVALID / TAMPERED'
                      : 'AWAITING SCAN'}
                  </span>
                </div>

                {scanStatusMessage && (
                  <div
                    className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                      scanVerificationStatus === 'valid'
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800'
                        : 'bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 border border-rose-300 dark:border-rose-800'
                    }`}
                  >
                    {scanVerificationStatus === 'valid' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                    )}
                    <span>{scanStatusMessage}</span>
                  </div>
                )}

                {verifiedQrDetails ? (
                  <div className="space-y-4">
                    {/* Primary Patient Demographics Banner */}
                    <div className="p-4 rounded-xl sahs-panel border border-teal-500/30 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono font-bold text-[#0F766E] dark:text-[#2DD4BF] uppercase">
                          Token: {verifiedQrDetails.checkInCode} · Appt #{verifiedQrDetails.appointmentId}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-200/80 dark:bg-slate-700 text-slate-800 dark:text-white">
                          Status: {verifiedQrDetails.status}
                        </span>
                      </div>

                      <div>
                        <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                          {verifiedQrDetails.patientName}
                        </h3>
                        <p className="text-xs font-mono text-[#0F766E] dark:text-[#2DD4BF]">
                          {verifiedQrDetails.patientEmail} · {verifiedQrDetails.patientPhone}
                        </p>
                      </div>

                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/80 dark:border-slate-800 text-xs">
                        <div>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">Age</span>
                          <span className="font-bold text-slate-900 dark:text-white">{verifiedQrDetails.patientAge} yrs</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">Gender</span>
                          <span className="font-bold text-slate-900 dark:text-white">{verifiedQrDetails.patientGender}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">Blood Group</span>
                          <span className="font-bold text-rose-600 dark:text-rose-400">{verifiedQrDetails.bloodGroup}</span>
                        </div>
                      </div>
                    </div>

                    {/* Clinical Suite & Doctor Details */}
                    <div className="p-4 rounded-xl sahs-panel space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Attending Physician</span>
                          <p className="text-xs font-extrabold text-slate-900 dark:text-white">
                            {verifiedQrDetails.doctorName}
                          </p>
                          <p className="text-[11px] text-slate-600 dark:text-slate-300">
                            {verifiedQrDetails.doctorSpecialty} · {verifiedQrDetails.roomNumber}
                          </p>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-teal-500/10 text-[#0F766E] dark:text-[#2DD4BF] border border-teal-500/20">
                          {verifiedQrDetails.visitType}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs border-t border-slate-200/80 dark:border-slate-800 pt-2">
                        <div>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Appointment Date</span>
                          <span className="font-mono font-bold text-slate-900 dark:text-white">{verifiedQrDetails.appointmentDate}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Time Slot</span>
                          <span className="font-mono font-bold text-slate-900 dark:text-white">{verifiedQrDetails.timeSlot}</span>
                        </div>
                      </div>

                      <div className="border-t border-slate-200/80 dark:border-slate-800 pt-2">
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Clinical Reason / Symptoms</span>
                        <p className="text-xs text-slate-800 dark:text-slate-200 font-medium">
                          {verifiedQrDetails.reason}
                        </p>
                      </div>

                      <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 dark:text-slate-400 pt-1">
                        <span>Digital Signature: Valid SHA-256 HMAC</span>
                        <span className="truncate max-w-[120px]">{verifiedQrDetails.signature}</span>
                      </div>
                    </div>

                    {/* Access Grant Action Buttons */}
                    <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                      <button
                        type="button"
                        onClick={handleGrantAccessAndCheckIn}
                        disabled={isGrantingAccess || verifiedQrDetails.status === 'Completed'}
                        className={`w-full sm:flex-1 py-3 px-4 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-2 cursor-pointer shadow-md transition-all active:scale-[0.98] ${
                          verifiedQrDetails.status === 'Completed'
                            ? 'bg-emerald-600 text-white opacity-90 cursor-default'
                            : 'sahs-button-primary'
                        }`}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>
                          {isGrantingAccess
                            ? 'Processing Admission...'
                            : verifiedQrDetails.status === 'Completed'
                            ? '✓ Access Granted (Patient In Suite)'
                            : 'Grant Access & Check-In Patient'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={handleDenyQrPass}
                        disabled={isGrantingAccess}
                        className="w-full sm:w-auto py-3 px-4 rounded-xl text-xs font-bold sahs-button-secondary text-rose-600 dark:text-rose-400 inline-flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>Deny Entry</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center sahs-panel rounded-2xl space-y-3">
                    <ShieldCheck className="w-12 h-12 text-slate-400 dark:text-slate-600 mx-auto" />
                    <div>
                      <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                        No Patient QR Pass Decoded Yet
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                        Select an appointment from the queue on the left or scan a patient&rsquo;s arrival QR code to decrypt details and authorize hospital entry.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: APPOINTMENTS + CSV EXPORT + QR CHECK-IN */}
        {activeTab === 'appointments' && (
          <div className="sahs-card p-5 sm:p-6 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-[#263238]/20">
              <div>
                <h2 className="text-base font-bold text-[#17211F]">
                  Appointment Management, QR Check-In &amp; CSV Backup
                </h2>
                <p className="text-xs text-[#64748B]">
                  Export the appointments list as a CSV file or verify patient QR check-in passes.
                </p>
              </div>

              <button
                type="button"
                onClick={handleExportCsv}
                className="sahs-button-primary px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-1.5 cursor-pointer self-start"
              >
                <Download className="w-3.5 h-3.5" /> Export Appointments CSV (
                {appointments.length})
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 text-[11px] font-bold text-slate-700 dark:text-slate-200">
                    <th className="py-3 px-4">ID</th>
                    <th className="py-3 px-4">Patient</th>
                    <th className="py-3 px-4">Doctor</th>
                    <th className="py-3 px-4">Date &amp; Time</th>
                    <th className="py-3 px-4">QR Check-In Pass</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/70 text-xs">
                  {appointments.map((appt) => {
                    const doc = doctors.find((d) => d.id === appt.doctorId);
                    const pat = patients.find((p) => p.id === appt.patientId);
                    const code = generateCheckInCode({
                      appointmentId: appt.id,
                      patientName: pat?.fullName || `Patient #${appt.patientId}`,
                      patientEmail: pat?.email || 'patient@gmail.com',
                      doctorName: doc?.name || `Doctor #${appt.doctorId}`,
                      appointmentDate: appt.appointmentDate,
                      timeSlot: appt.timeSlot,
                    });
                    return (
                      <tr key={appt.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-slate-500 dark:text-slate-400">
                          #{appt.id}
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-bold text-slate-900 dark:text-white">
                            {pat?.fullName || `Patient #${appt.patientId}`}
                          </p>
                          <p className="font-mono text-[11px] text-[#0F766E] dark:text-[#2DD4BF]">
                            {pat?.email}
                          </p>
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-bold text-slate-900 dark:text-white">
                            {doc?.name || `Doctor #${appt.doctorId}`}
                          </p>
                          <p className="text-slate-500 dark:text-slate-400">{doc?.specialty}</p>
                        </td>
                        <td className="py-3 px-4 font-mono">
                          <p className="font-bold text-slate-900 dark:text-white">
                            {appt.appointmentDate}
                          </p>
                          <p className="text-slate-500 dark:text-slate-400">{appt.timeSlot}</p>
                        </td>
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedQrAppt({
                                id: appt.id,
                                appointmentDate: appt.appointmentDate,
                                timeSlot: appt.timeSlot,
                                visitType: appt.visitType,
                                reason: appt.reason,
                                status: appt.status,
                                clinicalNotes: appt.clinicalNotes,
                                patientName:
                                  pat?.fullName || `Patient #${appt.patientId}`,
                                patientEmail: pat?.email || 'patient@gmail.com',
                                patientPhone: pat?.phone,
                                patientAge: pat?.age,
                                patientGender: pat?.gender,
                                bloodGroup: pat?.bloodGroup,
                                doctorName:
                                  doc?.name || `Doctor #${appt.doctorId}`,
                                doctorSpecialty:
                                  doc?.specialty || 'General Medicine',
                                roomNumber: doc?.roomNumber || 'Suite 200',
                              })
                            }
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-teal-500/10 hover:bg-[#0F766E] hover:text-white text-[#0F766E] dark:text-[#2DD4BF] border border-teal-600/30 rounded-lg font-mono text-[11px] font-bold transition-colors cursor-pointer"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                            {code}
                          </button>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] ${
                              appt.status === 'Completed'
                                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                                : appt.status === 'Cancelled'
                                ? 'bg-slate-500/15 text-slate-600 dark:text-slate-400'
                                : 'bg-teal-500/15 text-[#0F766E] dark:text-[#2DD4BF] border border-teal-500/30'
                            }`}
                          >
                            {appt.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenScannerForAppt(appt.id)}
                              className="sahs-button-primary px-2.5 py-1 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                              title="Scan QR Pass in Admin Kiosk"
                            >
                              <Scan className="w-3 h-3" />
                              <span>Scan Pass</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                handleSelectAppointmentForMessaging(appt.id);
                                setActiveTab('messaging');
                              }}
                              className="sahs-button-secondary px-2.5 py-1 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <MessageSquare className="w-3 h-3 text-[#0F766E] dark:text-[#2DD4BF]" />
                              <span>Message</span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateAppointmentStatus(
                                  appt.id,
                                  'Completed'
                                )
                              }
                              className="sahs-button-secondary px-2.5 py-1 rounded-lg text-[11px] font-bold text-emerald-700 dark:text-emerald-400 cursor-pointer"
                            >
                              Complete
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateAppointmentStatus(
                                  appt.id,
                                  'Cancelled'
                                )
                              }
                              className="sahs-button-secondary px-2.5 py-1 rounded-lg text-[11px] font-bold text-slate-600 dark:text-slate-400 cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteAppointment(appt.id)}
                              className="p-1.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 rounded-lg cursor-pointer"
                              aria-label={`Delete appointment ${appt.id}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: DOCTORS MANAGEMENT */}
        {activeTab === 'doctors' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 sahs-card p-5 space-y-4">
              <h2 className="text-sm font-bold text-[#17211F] flex items-center gap-2 border-b border-[#263238]/20 pb-2.5">
                <UserPlus className="w-4 h-4 text-[#0F766E]" /> Add Attending
                Doctor
              </h2>
              <form onSubmit={handleAddDoctor} className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-[#17211F] mb-1">
                    Doctor Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={docName}
                    onChange={(e) => setDocName(e.target.value)}
                    placeholder="Dr. Sarah Lin"
                    className="w-full px-3 py-2 bg-[#FAFAF8] border border-[#263238] rounded-lg"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block font-semibold text-[#17211F] mb-1">
                      Specialty
                    </label>
                    <input
                      type="text"
                      required
                      value={docSpecialty}
                      onChange={(e) => setDocSpecialty(e.target.value)}
                      className="w-full px-3 py-2 bg-[#FAFAF8] border border-[#263238] rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[#17211F] mb-1">
                      Department
                    </label>
                    <input
                      type="text"
                      required
                      value={docDepartment}
                      onChange={(e) => setDocDepartment(e.target.value)}
                      className="w-full px-3 py-2 bg-[#FAFAF8] border border-[#263238] rounded-lg"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="block font-semibold text-[#17211F] mb-1">
                      Room
                    </label>
                    <input
                      type="text"
                      value={docRoom}
                      onChange={(e) => setDocRoom(e.target.value)}
                      className="w-full px-2.5 py-2 bg-[#FAFAF8] border border-[#263238] rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[#17211F] mb-1">
                      Exp (Yrs)
                    </label>
                    <input
                      type="number"
                      value={docExp}
                      onChange={(e) => setDocExp(e.target.value)}
                      className="w-full px-2.5 py-2 bg-[#FAFAF8] border border-[#263238] rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[#17211F] mb-1">
                      Fee ($)
                    </label>
                    <input
                      type="number"
                      value={docFee}
                      onChange={(e) => setDocFee(e.target.value)}
                      className="w-full px-2.5 py-2 bg-[#FAFAF8] border border-[#263238] rounded-lg"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={docSubmitting}
                  className="sahs-button-primary w-full py-2.5 rounded-lg font-bold text-xs cursor-pointer"
                >
                  {docSubmitting ? 'Saving...' : 'Save Doctor'}
                </button>
              </form>
            </div>

            <div className="lg:col-span-7 sahs-card p-5 space-y-3">
              <h3 className="text-sm font-bold text-[#17211F] border-b border-[#263238]/20 pb-2.5">
                Active Doctors Directory ({doctors.length})
              </h3>
              <div className="space-y-2.5">
                {doctors.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-3.5 bg-[#FAFAF8] rounded-xl border border-[#263238] flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <span className="px-2 py-0.5 bg-[#F1F5F2] border border-[#263238] text-[#0F766E] rounded text-[10px] font-bold">
                        {doc.specialty}
                      </span>
                      <h4 className="font-bold text-sm text-[#17211F] mt-1">
                        {doc.name}
                      </h4>
                      <p className="text-[#64748B]">
                        {doc.roomNumber} · {doc.qualification} · $
                        {doc.consultationFee}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteDoctor(doc.id)}
                      className="p-2 bg-rose-50 border border-[#263238] text-rose-700 rounded-lg cursor-pointer"
                      aria-label={`Delete ${doc.name}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: SCHEDULES MANAGEMENT */}
        {activeTab === 'schedules' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 sahs-card p-5 space-y-4">
              <h2 className="text-sm font-bold text-[#17211F] flex items-center gap-2 border-b border-[#263238]/20 pb-2.5">
                <CalendarPlus className="w-4 h-4 text-[#0F766E]" /> Add Shift
                Block
              </h2>
              <form onSubmit={handleAddSchedule} className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-[#17211F] mb-1">
                    Select Doctor
                  </label>
                  <select
                    value={schedDoctorId || doctors[0]?.id || 0}
                    onChange={(e) => setSchedDoctorId(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-[#FAFAF8] border border-[#263238] rounded-lg"
                  >
                    {doctors.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.specialty})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[#17211F] mb-1">
                    Day of Week
                  </label>
                  <select
                    value={schedDay}
                    onChange={(e) => setSchedDay(e.target.value)}
                    className="w-full px-3 py-2 bg-[#FAFAF8] border border-[#263238] rounded-lg"
                  >
                    {DAYS_OF_WEEK.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block font-semibold text-[#17211F] mb-1">
                      Start Time
                    </label>
                    <input
                      type="time"
                      value={schedStart}
                      onChange={(e) => setSchedStart(e.target.value)}
                      className="w-full px-3 py-2 bg-[#FAFAF8] border border-[#263238] rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[#17211F] mb-1">
                      End Time
                    </label>
                    <input
                      type="time"
                      value={schedEnd}
                      onChange={(e) => setSchedEnd(e.target.value)}
                      className="w-full px-3 py-2 bg-[#FAFAF8] border border-[#263238] rounded-lg"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={schedSubmitting}
                  className="sahs-button-primary w-full py-2.5 rounded-lg font-bold text-xs cursor-pointer"
                >
                  {schedSubmitting ? 'Saving...' : 'Save Shift Block'}
                </button>
              </form>
            </div>

            <div className="lg:col-span-7 sahs-card p-5 space-y-3">
              <h3 className="text-sm font-bold text-[#17211F] border-b border-[#263238]/20 pb-2.5">
                Published Schedules ({schedules.length})
              </h3>
              <div className="space-y-2">
                {schedules.map((s) => {
                  const doc = doctors.find((d) => d.id === s.doctorId);
                  return (
                    <div
                      key={s.id}
                      className="p-3 bg-[#FAFAF8] rounded-xl border border-[#263238] flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="px-2 py-0.5 bg-white border border-[#263238] rounded font-bold text-[10px] text-[#0F766E] mr-2">
                          {s.dayOfWeek}
                        </span>
                        <span className="font-bold text-[#17211F]">
                          {doc?.name || `Doctor #${s.doctorId}`}
                        </span>
                        <p className="text-[#64748B] font-mono mt-0.5">
                          {s.startTime} - {s.endTime} ({s.slotDurationMinutes}m)
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteSchedule(s.id)}
                        className="p-1.5 bg-rose-50 border border-[#263238] text-rose-700 rounded-lg cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: PATIENTS MANAGEMENT */}
        {activeTab === 'patients' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 sahs-card p-5 space-y-4">
              <h2 className="text-sm font-bold text-[#17211F] flex items-center gap-2 border-b border-[#263238]/20 pb-2.5">
                <UserPlus className="w-4 h-4 text-[#0F766E]" /> Register Patient
              </h2>
              <form onSubmit={handleAddPatient} className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-[#17211F] mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={patName}
                    onChange={(e) => setPatName(e.target.value)}
                    placeholder="Rahul Sharma"
                    className="w-full px-3 py-2 bg-[#FAFAF8] border border-[#263238] rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#17211F] mb-1">
                    Gmail ID
                  </label>
                  <input
                    type="email"
                    required
                    value={patEmail}
                    onChange={(e) => setPatEmail(e.target.value)}
                    placeholder="rahul.sharma@gmail.com"
                    className="w-full px-3 py-2 bg-[#FAFAF8] border border-[#263238] rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#17211F] mb-1">
                    Phone
                  </label>
                  <input
                    type="text"
                    value={patPhone}
                    onChange={(e) => setPatPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full px-3 py-2 bg-[#FAFAF8] border border-[#263238] rounded-lg font-mono"
                  />
                </div>
                <button
                  type="submit"
                  disabled={patSubmitting}
                  className="sahs-button-primary w-full py-2.5 rounded-lg font-bold text-xs cursor-pointer"
                >
                  {patSubmitting ? 'Registering...' : 'Save Patient'}
                </button>
              </form>
            </div>

            <div className="lg:col-span-7 sahs-card p-5 space-y-3">
              <h3 className="text-sm font-bold text-[#17211F] border-b border-[#263238]/20 pb-2.5">
                Registered Patients ({patients.length})
              </h3>
              <div className="space-y-2">
                {patients.map((p) => (
                  <div
                    key={p.id}
                    className="p-3 bg-[#FAFAF8] rounded-xl border border-[#263238] flex items-center justify-between text-xs"
                  >
                    <div>
                      <p className="font-bold text-[#17211F]">{p.fullName}</p>
                      <p className="font-mono text-[#0F766E]">
                        {p.email} · {p.phone} · Blood {p.bloodGroup}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeletePatient(p.id)}
                      className="p-1.5 bg-rose-50 border border-[#263238] text-rose-700 rounded-lg cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: BOOKING WORKSPACE CLONE */}
        {activeTab === 'booking-clone' && <BookingWorkspace isAdminClone />}

        {/* TAB 7: NO-SHOW ML */}
        {activeTab === 'ml-engine' && (
          <div className="sahs-card p-5 space-y-4">
            <h2 className="text-base font-bold text-[#17211F]">
              Appointment No-Show Probability Overview
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {appointments.map((a) => {
                const pat = patients.find((p) => p.id === a.patientId);
                const doc = doctors.find((d) => d.id === a.doctorId);
                return (
                  <div
                    key={a.id}
                    className="p-4 bg-[#FAFAF8] rounded-xl border border-[#263238] flex items-center justify-between text-xs"
                  >
                    <div>
                      <p className="font-bold text-[#17211F]">
                        {pat?.fullName || `Patient #${a.patientId}`}
                      </p>
                      <p className="text-[#64748B]">
                        {doc?.name} · {a.appointmentDate} at {a.timeSlot}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-extrabold font-mono text-[#0F766E]">
                        {a.noShowProbability}%
                      </span>
                      <p className="text-[10px] font-semibold text-[#64748B]">
                        {a.noShowRiskLevel} Risk
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 8: MANUAL WHATSAPP & SMS MESSAGING MODULE */}
        {activeTab === 'messaging' && (
          <div className="space-y-6" data-testid="manual-messaging-module">
            {/* Top Header & Honest Delivery Status Tracker */}
            <div className="sahs-card p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-[#0F766E] block">
                  Manual Patient Outreach · Zero Paid API Lock-In
                </span>
                <h2 className="text-lg sm:text-xl font-extrabold text-[#17211F]">
                  Manual WhatsApp &amp; SMS Appointment Messaging
                </h2>
                <p className="text-xs text-[#64748B] max-w-2xl">
                  Prepare privacy-safe appointment messages, validate international or +91 numbers, and open official WhatsApp Click-to-Chat or SMS with prefilled text for manual administrator review and sending.
                </p>
              </div>

              {/* Honest 3-Stage Status Pill Bar */}
              <div className="bg-[#FAFAF8] border border-[#263238] rounded-xl p-3 space-y-1.5 shrink-0">
                <div className="flex items-center justify-between gap-4 text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
                  <span>Honest Delivery Status</span>
                  {selectedAppt && (
                    <span className="font-mono text-[#0F766E]">
                      Appt #{selectedAppt.id}
                    </span>
                  )}
                </div>
                <div
                  data-testid="honest-delivery-status-bar"
                  className="flex flex-wrap items-center gap-1.5"
                >
                  {(
                    [
                      'PREPARED',
                      'APP_OPENED',
                      'MANUALLY_SENT',
                    ] as ManualDeliveryStatus[]
                  ).map((st, idx) => {
                    const label = MANUAL_DELIVERY_STATUS_LABELS[st];
                    const isCurrent = currentApptDeliveryStatus === st;
                    return (
                      <span
                        key={st}
                        data-testid={`status-step-${st}`}
                        className={`px-2.5 py-1 rounded-lg border border-[#263238] text-[11px] font-bold inline-flex items-center gap-1.5 ${
                          isCurrent
                            ? 'bg-[#0F766E] text-white shadow-[1px_1px_0px_#263238]'
                            : 'bg-white text-[#64748B]'
                        }`}
                      >
                        <span className="font-mono text-[10px]">
                          {idx + 1}.
                        </span>
                        <span>{label}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left 7 Cols: Appointment Selection, Phone Normalization & Template Editor */}
              <div className="lg:col-span-7 sahs-card p-5 sm:p-6 space-y-5 text-xs">
                <div className="flex items-center justify-between border-b border-[#263238]/20 pb-3">
                  <h3 className="text-sm font-bold text-[#17211F]">
                    1. Select Appointment &amp; Normalize Recipient Phone
                  </h3>
                  {selectedAppt && (
                    <span
                      className={`px-2.5 py-0.5 rounded border border-[#263238] text-[10px] font-bold ${
                        selectedAppt.smsReminder
                          ? 'bg-emerald-50 text-[#0F766E]'
                          : 'bg-amber-50 text-amber-900'
                      }`}
                    >
                      {selectedAppt.smsReminder
                        ? 'Patient Messaging Consent: Opted In'
                        : 'Patient Messaging Consent: Not Enabled'}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
                  <div className="sm:col-span-12">
                    <label
                      htmlFor="msg-target-appt"
                      className="block font-semibold text-[#17211F] mb-1"
                    >
                      Target Appointment
                    </label>
                    <select
                      id="msg-target-appt"
                      value={activeApptId}
                      onChange={(e) =>
                        handleSelectAppointmentForMessaging(
                          Number(e.target.value)
                        )
                      }
                      className="w-full px-3 py-2 bg-[#FAFAF8] border border-[#263238] rounded-lg font-medium text-[#17211F]"
                    >
                      {appointments.map((a) => {
                        const pat = patients.find((p) => p.id === a.patientId);
                        const doc = doctors.find((d) => d.id === a.doctorId);
                        return (
                          <option key={a.id} value={a.id}>
                            #{a.id} · {pat?.fullName || `Patient #${a.patientId}`} —{' '}
                            {doc?.name || `Doctor #${a.doctorId}`} ({a.appointmentDate}{' '}
                            at {a.timeSlot}) [{a.status}]
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Country Code + Recipient Phone Input */}
                  <div className="sm:col-span-4">
                    <label
                      htmlFor="msg-country-code"
                      className="block font-semibold text-[#17211F] mb-1"
                    >
                      Default Country Code
                    </label>
                    <select
                      id="msg-country-code"
                      value={defaultCountryCode}
                      onChange={(e) => setDefaultCountryCode(e.target.value)}
                      className="w-full px-2.5 py-2 bg-[#FAFAF8] border border-[#263238] rounded-lg font-mono text-[#17211F]"
                    >
                      <option value="+91">+91 (India · Default)</option>
                      <option value="+1">+1 (US / Canada)</option>
                      <option value="+44">+44 (United Kingdom)</option>
                      <option value="+971">+971 (UAE)</option>
                      <option value="+61">+61 (Australia)</option>
                      <option value="+65">+65 (Singapore)</option>
                    </select>
                  </div>

                  <div className="sm:col-span-8">
                    <div className="flex items-center justify-between mb-1">
                      <label
                        htmlFor="msg-recipient-phone"
                        className="block font-semibold text-[#17211F]"
                      >
                        Recipient Phone Number
                      </label>
                      <span
                        data-testid="normalized-phone-badge"
                        className={`font-mono text-[11px] font-bold ${
                          waLinkResult.normalizedPhone.isValid
                            ? 'text-[#0F766E]'
                            : 'text-rose-700'
                        }`}
                      >
                        {waLinkResult.normalizedPhone.isValid
                          ? `Normalized: ${waLinkResult.normalizedPhone.e164Phone}`
                          : 'Invalid Phone'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        id="msg-recipient-phone"
                        type="tel"
                        value={effectiveRawPhone}
                        onChange={(e) => setPhoneOverride(e.target.value)}
                        placeholder="+91 98765 43210 or +1 415 555 0199"
                        className="w-full px-3 py-2 bg-[#FAFAF8] border border-[#263238] rounded-lg font-mono text-[#17211F]"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          handleCopyText(
                            'phone',
                            waLinkResult.normalizedPhone.e164Phone ||
                              effectiveRawPhone
                          )
                        }
                        className="sahs-button-secondary px-3 py-2 rounded-lg font-bold inline-flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        {copiedKey === 'phone' ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-[#0F766E]" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                    {!waLinkResult.normalizedPhone.isValid && (
                      <p className="text-[11px] text-rose-700 font-semibold mt-1">
                        {waLinkResult.normalizedPhone.error}
                      </p>
                    )}
                  </div>
                </div>

                {/* Reusable Templates */}
                <div className="space-y-2.5 pt-2 border-t border-[#263238]/20">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-[#17211F]">
                      2. Reusable Appointment Message Templates
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsMessageEdited(false);
                        setCustomMessage('');
                      }}
                      className="text-[11px] font-bold text-[#0F766E] hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Reset to Template</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {MESSAGE_TEMPLATES.map((tpl) => {
                      const active = templateType === tpl.id;
                      return (
                        <button
                          key={tpl.id}
                          type="button"
                          onClick={() => handleSelectTemplate(tpl.id)}
                          className={`p-3 rounded-xl border border-[#263238] text-left transition-colors cursor-pointer ${
                            active
                              ? 'bg-[#0F766E] text-white shadow-[2px_2px_0px_#263238]'
                              : 'bg-[#FAFAF8] text-[#17211F] hover:bg-[#F1F5F2]'
                          }`}
                        >
                          <div className="font-bold text-xs">{tpl.label}</div>
                          <div
                            className={`text-[10px] mt-0.5 ${
                              active ? 'text-white/85' : 'text-[#64748B]'
                            }`}
                          >
                            {tpl.description}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Editable Message Preview + Privacy Check */}
                <div className="space-y-2 pt-2 border-t border-[#263238]/20">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label
                      htmlFor="msg-editable-body"
                      className="text-sm font-bold text-[#17211F]"
                    >
                      3. Review &amp; Edit Message Before Opening App
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        handleCopyText('message', effectiveMessage)
                      }
                      className="sahs-button-secondary px-2.5 py-1 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                    >
                      {copiedKey === 'message' ? (
                        <>
                          <Check className="w-3 h-3 text-[#0F766E]" />
                          <span>Message Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy Message Text</span>
                        </>
                      )}
                    </button>
                  </div>

                  <textarea
                    id="msg-editable-body"
                    rows={4}
                    value={effectiveMessage}
                    onChange={(e) => {
                      setIsMessageEdited(true);
                      setCustomMessage(e.target.value);
                      if (selectedAppt) {
                        setDeliveryStatusByAppt((prev) => ({
                          ...prev,
                          [selectedAppt.id]: 'PREPARED',
                        }));
                      }
                    }}
                    className="w-full p-3 bg-[#FAFAF8] border border-[#263238] rounded-xl text-xs text-[#17211F] leading-relaxed focus:bg-white focus:outline-none"
                  />

                  {/* Privacy & Security Banner */}
                  {clinicalPrivacyCheck.hasSensitiveContent ? (
                    <div
                      data-testid="clinical-privacy-warning"
                      className="p-3 rounded-xl bg-amber-50 border border-[#263238] flex items-start gap-2.5 text-amber-950"
                    >
                      <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">
                          Clinical Privacy Alert: Sensitive Terms Detected
                        </p>
                        <p className="text-[11px] text-amber-900 mt-0.5">
                          Do not include sensitive clinical notes, diagnoses, or medical reports ({clinicalPrivacyCheck.matchedTerms.join(', ')}) in external WhatsApp or SMS messages.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-xl bg-[#F1F5F2] border border-[#263238] flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-[#17211F] inline-flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#0F766E]" />
                        <span>
                          Privacy Verified: Contains only scheduling details (Patient, SAHS Hospital, Doctor, Department, Date &amp; Time).
                        </span>
                      </span>
                      <span className="font-mono text-[#64748B]">
                        {effectiveMessage.length} chars
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Right 5 Cols: Official WhatsApp Click-to-Chat, SMS Workflows & Honest Status Confirmation */}
              <div className="lg:col-span-5 space-y-5 text-xs">
                {/* Official WhatsApp Click-to-Chat Card */}
                <div className="sahs-card p-5 space-y-3.5">
                  <div className="flex items-center justify-between border-b border-[#263238]/20 pb-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-[#0F766E] text-white border border-[#263238] flex items-center justify-center">
                        <MessageSquare className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-[#17211F]">
                          WhatsApp Click-to-Chat
                        </h3>
                        <p className="text-[10px] text-[#64748B]">
                          Official https://wa.me/ URL · Manual Review &amp; Send
                        </p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-[#F1F5F2] border border-[#263238] font-mono text-[10px] font-bold text-[#0F766E]">
                      wa.me/{waLinkResult.normalizedPhone.waMeDigits || '...'}
                    </span>
                  </div>

                  <div className="p-2.5 bg-[#FAFAF8] border border-[#263238] rounded-lg">
                    <div className="text-[10px] font-bold uppercase text-[#64748B] mb-1">
                      Generated Official Click-to-Chat URL
                    </div>
                    <p
                      data-testid="whatsapp-click-to-chat-url"
                      className="font-mono text-[10px] text-[#0F766E] break-all line-clamp-2"
                    >
                      {waLinkResult.url ||
                        'Enter a valid phone number and message to generate https://wa.me/ link'}
                    </p>
                  </div>

                  {waLinkResult.url ? (
                    <a
                      href={waLinkResult.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid="open-whatsapp-link"
                      onClick={() =>
                        handleRecordManualMessagingAction(
                          'WHATSAPP',
                          'OPEN_WHATSAPP'
                        )
                      }
                      className="sahs-button-primary w-full py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2"
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span>Open WhatsApp with Prefilled Message</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="sahs-button-primary w-full py-2.5 px-4 rounded-xl font-bold text-xs opacity-50 cursor-not-allowed"
                    >
                      Enter Valid Phone Number to Open WhatsApp
                    </button>
                  )}

                  <p className="text-[11px] text-[#64748B] leading-relaxed">
                    Opens WhatsApp Web or the WhatsApp app in a new tab. If WhatsApp Web is not signed in, scan WhatsApp&apos;s official QR code, review the prefilled message, and press <strong>Send</strong> manually.
                  </p>
                </div>

                {/* SMS Option: Device SMS Fallback (sms:) + Google Messages for Web */}
                <div className="sahs-card p-5 space-y-3.5">
                  <div className="flex items-center justify-between border-b border-[#263238]/20 pb-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-[#F1F5F2] text-[#0F766E] border border-[#263238] flex items-center justify-center">
                        <PhoneCall className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-[#17211F]">
                          Send SMS Option
                        </h3>
                        <p className="text-[10px] text-[#64748B]">
                          Device SMS App (sms:) &amp; Google Messages for Web
                        </p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-[#F1F5F2] border border-[#263238] font-mono text-[10px] font-bold text-[#17211F]">
                      {smsLinkResult.normalizedPhone.e164Phone || 'N/A'}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {smsLinkResult.smsUri ? (
                      <a
                        href={smsLinkResult.smsUri}
                        data-testid="open-sms-uri-link"
                        onClick={() =>
                          handleRecordManualMessagingAction('SMS', 'OPEN_SMS')
                        }
                        className="sahs-button-secondary w-full py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2"
                      >
                        <PhoneCall className="w-3.5 h-3.5 text-[#0F766E]" />
                        <span>Open Device SMS App (sms: Prefilled Link)</span>
                      </a>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="sahs-button-secondary w-full py-2.5 px-4 rounded-xl font-bold text-xs opacity-50 cursor-not-allowed"
                      >
                        Enter Valid Phone to Open SMS App
                      </button>
                    )}

                    <a
                      href={GOOGLE_MESSAGES_WEB_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid="open-google-messages-web-link"
                      onClick={() => {
                        handleCopyText(
                          'google_sms',
                          `${waLinkResult.normalizedPhone.e164Phone}\n\n${effectiveMessage}`
                        );
                        handleRecordManualMessagingAction('SMS', 'OPEN_SMS');
                      }}
                      className="sahs-button-secondary w-full py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2"
                    >
                      <Send className="w-3.5 h-3.5 text-[#0F766E]" />
                      <span>
                        Copy Details &amp; Open Google Messages for Web
                      </span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>

                  <p className="text-[11px] text-[#64748B] leading-relaxed">
                    Use <strong>sms:</strong> on devices with a native SMS handler, or open <strong>Google Messages for Web</strong> (manually linked via your phone&apos;s QR scanner) with the recipient and message copied to your clipboard.
                  </p>
                </div>

                {/* Explicit Manual Send Confirmation Card */}
                <div className="sahs-card p-5 bg-[#FAFAF8] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#17211F]">
                      4. Confirm Manual Send Completion
                    </span>
                    <span className="font-mono text-[11px] font-bold text-[#0F766E]">
                      {MANUAL_DELIVERY_STATUS_LABELS[currentApptDeliveryStatus]}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#64748B]">
                    Opening WhatsApp or SMS only marks the status as <strong>Messaging application opened</strong>. Click below only after you have manually pressed Send in the messaging app:
                  </p>
                  <button
                    type="button"
                    disabled={sendingMsg}
                    data-testid="confirm-manual-send-btn"
                    onClick={() =>
                      handleRecordManualMessagingAction(
                        channel,
                        'CONFIRM_MANUAL_SEND'
                      )
                    }
                    className="sahs-button-primary w-full py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {sendingMsg
                        ? 'Recording Status...'
                        : 'Mark as Message Manually Sent'}
                    </span>
                  </button>
                </div>

                {/* Audit & Notification Logs */}
                <div className="sahs-card p-5 space-y-3">
                  <h3 className="text-sm font-bold text-[#17211F] border-b border-[#263238]/20 pb-2.5">
                    Audit &amp; Manual Messaging Logs ({historyLogs.length})
                  </h3>
                  <div className="space-y-2 max-h-60 overflow-y-auto text-xs">
                    {historyLogs.map((log) => (
                      <div
                        key={log.id}
                        className="p-3 bg-[#FAFAF8] rounded-xl border border-[#263238]"
                      >
                        <div className="flex justify-between font-bold text-[#17211F] mb-0.5">
                          <span>
                            #{log.appointmentId} · {log.newStatus}
                          </span>
                          <span className="text-[#0F766E]">{log.changedBy}</span>
                        </div>
                        <p className="text-[#64748B]">{log.note}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <AppointmentQrModal
        appointment={selectedQrAppt}
        isOpen={Boolean(selectedQrAppt)}
        onClose={() => setSelectedQrAppt(null)}
        onCheckInScan={handleQrCheckInScan}
      />
    </div>
  );
}
