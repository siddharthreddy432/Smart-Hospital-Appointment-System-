'use client';

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useHospital } from './HospitalProvider';
import SymptomVectorArt, { SYMPTOM_PRESETS } from './SymptomVectorArt';
import { detectSymptomCategory, SymptomCategory } from '../lib/csv-export';
import {
  predictNoShowProbability,
  calculateLeadTimeDays,
} from '../lib/no-show-predictor';
import {
  PairingStatus,
  DeviceRole,
  SyncedBookingFormFields,
  SyncedFieldKey,
  SyncSessionState,
  FieldConflict,
  createSyncSessionState,
  generateSyncQrMatrix,
} from '../lib/dual-device-sync';
import AppointmentQrModal, {
  QrPassAppointmentData,
} from './AppointmentQrModal';
import {
  Mail,
  User,
  CheckCircle2,
  Phone,
  QrCode,
  Smartphone,
  Monitor,
  AlertTriangle,
  Wifi,
  ExternalLink,
  Copy,
  Check,
  ShieldAlert,
} from 'lucide-react';

const TIME_SLOTS = [
  '09:00 AM',
  '09:30 AM',
  '10:00 AM',
  '10:30 AM',
  '11:00 AM',
  '11:30 AM',
  '02:00 PM',
  '02:30 PM',
  '03:30 PM',
  '04:00 PM',
];

const HOSPITAL_DEPARTMENTS = [
  'Internal Medicine',
  'Cardiology & Heart Institute',
  'Neurology & Spine Center',
  'Pulmonology & Respiratory Care',
  'Orthopedics & Sports Medicine',
  'Dermatology & Aesthetics',
  'Pediatrics & Family Care',
  'General Surgery',
];

const GENDERS = ['Male', 'Female', 'Non-Binary', 'Prefer not to say'];
const BLOOD_GROUPS = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];

const PAIRING_STATUS_LIST: PairingStatus[] = [
  'Waiting for scan',
  'QR scanned',
  'Device connected',
  'Synchronizing',
  'Both devices connected',
  'Session expired',
  'Session revoked',
];

export default function BookingWorkspace({
  isAdminClone = false,
  initialPairedSessionId,
  initialMobileSecret,
}: {
  isAdminClone?: boolean;
  initialPairedSessionId?: string;
  initialMobileSecret?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    doctors,
    patients,
    sessionUser,
    refreshHospitalData,
    setStatusBanner,
  } = useHospital();

  const initialDocParam = searchParams?.get('doctorId');
  const urlSyncSession =
    initialPairedSessionId || searchParams?.get('syncSession');
  const urlDeviceParam = searchParams?.get('device') as DeviceRole | null;

  const isMobileStandaloneView =
    Boolean(initialPairedSessionId) || urlDeviceParam === 'mobile';
  const activeDeviceRole: DeviceRole = isMobileStandaloneView
    ? 'mobile'
    : 'desktop';

  const [sessionId, setSessionId] = useState<string>(() => {
    if (urlSyncSession && urlSyncSession.trim().length > 0) {
      return urlSyncSession.trim();
    }
    return 'SAHS-SYNC-742910';
  });

  const [channelSecret, setChannelSecret] = useState<string | null>(null);
  const [mobileSecret, setMobileSecret] = useState<string | null>(
    initialMobileSecret || null
  );
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [pairingUrl, setPairingUrl] = useState<string>(
    `https://sahs.telis.tech/appointment/pair/${sessionId}`
  );
  const [localPairingPath, setLocalPairingPath] = useState<string>(
    `/appointment/pair/${sessionId}`
  );

  const channelSecretRef = useRef<string | null>(null);
  const mobileSecretRef = useRef<string | null>(initialMobileSecret || null);

  useEffect(() => {
    channelSecretRef.current = channelSecret;
  }, [channelSecret]);

  useEffect(() => {
    mobileSecretRef.current = mobileSecret;
  }, [mobileSecret]);

  const [syncSession, setSyncSession] = useState<SyncSessionState>(() =>
    createSyncSessionState(
      sessionId,
      {
        patientName: sessionUser.userName || 'Rahul Sharma',
        patientEmail: sessionUser.email || 'patient.care@example.com',
        doctorId: initialDocParam
          ? Number(initialDocParam)
          : doctors[0]?.id || 1,
        appointmentDate: '2026-11-01',
      },
      1730000000000
    )
  );

  const [fields, setFields] = useState<SyncedBookingFormFields>(
    () => syncSession.fields
  );
  const [isSyncingPulse, setIsSyncingPulse] = useState<boolean>(false);
  const [connectionInterrupted, setConnectionInterrupted] =
    useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [showCompanionSimulator, setShowCompanionSimulator] =
    useState<boolean>(false);

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmedQrAppt, setConfirmedQrAppt] =
    useState<QrPassAppointmentData | null>(null);

  const debounceTimersRef = useRef<
    Partial<Record<SyncedFieldKey, ReturnType<typeof setTimeout>>>
  >({});
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const latestRevisionRef = useRef<number>(syncSession.revision);

  useEffect(() => {
    latestRevisionRef.current = syncSession.revision;
  }, [syncSession.revision]);

  const mobileSyncUrl = useMemo(() => {
    if (localPairingPath) return localPairingPath;
    return `/book?syncSession=${encodeURIComponent(sessionId)}&device=mobile`;
  }, [localPairingPath, sessionId]);

  const qrMatrixData = useMemo(
    () => generateSyncQrMatrix(pairingUrl || `sahs://sync/${sessionId}`),
    [pairingUrl, sessionId]
  );

  const applyIncomingSession = useCallback((incoming: SyncSessionState) => {
    setSyncSession(incoming);
    setFields(incoming.fields);
    latestRevisionRef.current = incoming.revision;
    if (incoming.pairingUrl) setPairingUrl(incoming.pairingUrl);
    if (incoming.localPairingPath) setLocalPairingPath(incoming.localPairingPath);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) {
      return;
    }
    const channel = new BroadcastChannel(`sahs_sync_${sessionId}`);
    broadcastChannelRef.current = channel;

    channel.onmessage = (ev) => {
      const data = ev.data;
      if (data && data.type === 'SESSION_UPDATE' && data.session) {
        const incoming = data.session as SyncSessionState;
        setIsSyncingPulse(true);
        applyIncomingSession(incoming);
        setTimeout(() => setIsSyncingPulse(false), 450);
      }
    };

    return () => {
      channel.close();
      broadcastChannelRef.current = null;
    };
  }, [sessionId, applyIncomingSession]);

  useEffect(() => {
    let cancelled = false;

    async function initAndHandshake() {
      try {
        // If already paired via /appointment/pair/[token] with initialMobileSecret, fetch existing session directly
        if (initialPairedSessionId && initialMobileSecret) {
          const pollRes = await fetch(
            `/api/sync-session?sessionId=${encodeURIComponent(
              initialPairedSessionId
            )}&mobileSecret=${encodeURIComponent(initialMobileSecret)}`,
            { cache: 'no-store' }
          );
          if (pollRes.ok) {
            const pollData = await pollRes.json();
            if (!cancelled && pollData.session) {
              applyIncomingSession(pollData.session);
              if (pollData.qrDataUrl) setQrDataUrl(pollData.qrDataUrl);
              setConnectionInterrupted(false);
              return;
            }
          }
        }

        const initRes = await fetch('/api/sync-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            action: 'init',
            initialFields: {
              patientName: sessionUser.userName || 'Rahul Sharma',
              patientEmail: sessionUser.email || 'patient.care@example.com',
              doctorId: initialDocParam
                ? Number(initialDocParam)
                : doctors[0]?.id || 1,
            },
          }),
        });
        if (!initRes.ok) throw new Error('Sync initialization failed');
        const initData = await initRes.json();
        const issuedSecret: string | null = initData.channelSecret || null;
        if (!cancelled) {
          if (issuedSecret) {
            setChannelSecret(issuedSecret);
            channelSecretRef.current = issuedSecret;
          }
          if (initData.qrDataUrl) setQrDataUrl(initData.qrDataUrl);
          if (initData.pairingUrl) setPairingUrl(initData.pairingUrl);
          if (initData.localPairingPath)
            setLocalPairingPath(initData.localPairingPath);
          if (initData.session) {
            applyIncomingSession(initData.session);
          }
          setConnectionInterrupted(false);
        }

        if (isMobileStandaloneView && !cancelled && issuedSecret) {
          const scanRes = await fetch('/api/sync-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId,
              action: 'handshake',
              device: 'mobile',
              stage: 'scan',
              channelSecret: issuedSecret,
            }),
          });
          if (scanRes.ok) {
            const scanData = await scanRes.json();
            if (!cancelled && scanData.session) {
              applyIncomingSession(scanData.session);
              broadcastChannelRef.current?.postMessage({
                type: 'SESSION_UPDATE',
                session: scanData.session,
              });
            }
          }

          setTimeout(async () => {
            if (cancelled) return;
            const connRes = await fetch('/api/sync-session', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                sessionId,
                action: 'handshake',
                device: 'mobile',
                stage: 'connect',
                channelSecret: issuedSecret,
              }),
            });
            if (connRes.ok) {
              const connData = await connRes.json();
              if (!cancelled && connData.session) {
                applyIncomingSession(connData.session);
                broadcastChannelRef.current?.postMessage({
                  type: 'SESSION_UPDATE',
                  session: connData.session,
                });
              }
            }
          }, 500);
        }
      } catch {
        if (!cancelled) {
          setConnectionInterrupted(true);
        }
      }
    }

    initAndHandshake();
    return () => {
      cancelled = true;
    };
  }, [
    sessionId,
    initialPairedSessionId,
    initialMobileSecret,
    isMobileStandaloneView,
    sessionUser.userName,
    sessionUser.email,
    initialDocParam,
    doctors,
    applyIncomingSession,
  ]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const syncFromServer = async () => {
      if (connectionInterrupted || document.visibilityState !== 'visible') {
        return;
      }
      const cSecret = channelSecretRef.current;
      const mSecret = mobileSecretRef.current;
      if (!cSecret && !mSecret) return;

      try {
        const params = new URLSearchParams({
          sessionId,
          device: activeDeviceRole,
          event: 'poll',
        });
        if (cSecret) params.set('channelSecret', cSecret);
        if (mSecret) params.set('mobileSecret', mSecret);

        const res = await fetch(`/api/sync-session?${params.toString()}`, {
          cache: 'no-store',
        });
        if (!res.ok) return;
        const data = await res.json();
        if (
          data.session &&
          data.session.revision > latestRevisionRef.current
        ) {
          setIsSyncingPulse(true);
          applyIncomingSession(data.session);
          setTimeout(() => setIsSyncingPulse(false), 450);
        }
      } catch {
        // continue optimistic editing
      }
    };

    const interval = setInterval(syncFromServer, 2000);
    window.addEventListener('focus', syncFromServer);
    document.addEventListener('visibilitychange', syncFromServer);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', syncFromServer);
      document.removeEventListener('visibilitychange', syncFromServer);
    };
  }, [sessionId, activeDeviceRole, connectionInterrupted, applyIncomingSession]);

  const pushFieldDelta = useCallback(
    async <K extends SyncedFieldKey>(
      field: K,
      value: SyncedBookingFormFields[K],
      deviceSource: DeviceRole = activeDeviceRole
    ) => {
      setIsSyncingPulse(true);
      const baseFieldRevision = syncSession.fieldMeta[field]?.revision ?? 1;

      try {
        const res = await fetch('/api/sync-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            action: 'update_field',
            field,
            value,
            device: deviceSource,
            baseFieldRevision,
            channelSecret: channelSecretRef.current,
            mobileSecret: mobileSecretRef.current,
          }),
        });
        if (!res.ok) throw new Error('Failed to sync field');
        const data = await res.json();
        if (data.session) {
          applyIncomingSession(data.session);
          broadcastChannelRef.current?.postMessage({
            type: 'SESSION_UPDATE',
            session: data.session,
          });
        }
        setConnectionInterrupted(false);
      } catch {
        setConnectionInterrupted(true);
      } finally {
        setTimeout(() => setIsSyncingPulse(false), 380);
      }
    },
    [sessionId, activeDeviceRole, syncSession.fieldMeta, applyIncomingSession]
  );

  const updateSyncedField = useCallback(
    <K extends SyncedFieldKey>(
      field: K,
      value: SyncedBookingFormFields[K],
      deviceSource: DeviceRole = activeDeviceRole,
      immediate: boolean = false
    ) => {
      setFields((prev) => ({
        ...prev,
        [field]: value,
      }));

      if (debounceTimersRef.current[field]) {
        clearTimeout(debounceTimersRef.current[field]);
      }

      if (immediate) {
        pushFieldDelta(field, value, deviceSource);
      } else {
        debounceTimersRef.current[field] = setTimeout(() => {
          pushFieldDelta(field, value, deviceSource);
        }, 160);
      }
    },
    [activeDeviceRole, pushFieldDelta]
  );

  const handleConnectSmartphoneCompanion = async () => {
    setShowCompanionSimulator(true);
    try {
      const scanRes = await fetch('/api/sync-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          action: 'handshake',
          device: 'mobile',
          stage: 'scan',
          channelSecret: channelSecretRef.current,
          mobileSecret: mobileSecretRef.current,
        }),
      });
      if (scanRes.ok) {
        const scanData = await scanRes.json();
        applyIncomingSession(scanData.session);
        broadcastChannelRef.current?.postMessage({
          type: 'SESSION_UPDATE',
          session: scanData.session,
        });
      }

      setTimeout(async () => {
        const connRes = await fetch('/api/sync-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            action: 'handshake',
            device: 'mobile',
            stage: 'connect',
            channelSecret: channelSecretRef.current,
            mobileSecret: mobileSecretRef.current,
          }),
        });
        if (connRes.ok) {
          const connData = await connRes.json();
          applyIncomingSession(connData.session);
          broadcastChannelRef.current?.postMessage({
            type: 'SESSION_UPDATE',
            session: connData.session,
          });
        }
      }, 350);
    } catch {
      setConnectionInterrupted(true);
    }
  };

  const handleSimulateSimultaneousConflict = async () => {
    try {
      const res = await fetch('/api/sync-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          action: 'simulate_conflict',
          field: 'patientName',
          desktopValue: fields.patientName || 'Rahul Sharma',
          mobileValue: 'Rahul K. Sharma',
          channelSecret: channelSecretRef.current,
          mobileSecret: mobileSecretRef.current,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.session) {
          applyIncomingSession(data.session);
          broadcastChannelRef.current?.postMessage({
            type: 'SESSION_UPDATE',
            session: data.session,
          });
        }
      }
    } catch {
      setConnectionInterrupted(true);
    }
  };

  const handleResolveConflict = async (
    field: SyncedFieldKey,
    winner: DeviceRole
  ) => {
    try {
      const res = await fetch('/api/sync-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          action: 'resolve_conflict',
          field,
          winner,
          channelSecret: channelSecretRef.current,
          mobileSecret: mobileSecretRef.current,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.session) {
          applyIncomingSession(data.session);
          broadcastChannelRef.current?.postMessage({
            type: 'SESSION_UPDATE',
            session: data.session,
          });
        }
      }
    } catch {
      setConnectionInterrupted(true);
    }
  };

  const handleRegenerateSession = async () => {
    const newId = `SAHS-SYNC-${Math.floor(100000 + Math.random() * 900000)}`;
    setSessionId(newId);
    setConnectionInterrupted(false);
    const fresh = createSyncSessionState(newId, fields);
    applyIncomingSession(fresh);
    const res = await fetch('/api/sync-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: newId,
        action: 'rotate_token',
        initialFields: fields,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.channelSecret) {
        setChannelSecret(data.channelSecret);
        channelSecretRef.current = data.channelSecret;
      }
      if (data.qrDataUrl) setQrDataUrl(data.qrDataUrl);
      if (data.pairingUrl) setPairingUrl(data.pairingUrl);
      if (data.localPairingPath) setLocalPairingPath(data.localPairingPath);
      if (data.session) applyIncomingSession(data.session);
    }
  };

  const handleRevokeSession = async () => {
    const res = await fetch('/api/sync-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        action: 'revoke',
        channelSecret: channelSecretRef.current,
        mobileSecret: mobileSecretRef.current,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.session) {
        applyIncomingSession(data.session);
        broadcastChannelRef.current?.postMessage({
          type: 'SESSION_UPDATE',
          session: data.session,
        });
      }
    }
  };

  const handleExpireSession = async () => {
    const res = await fetch('/api/sync-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        action: 'expire',
        channelSecret: channelSecretRef.current,
        mobileSecret: mobileSecretRef.current,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.session) {
        applyIncomingSession(data.session);
        broadcastChannelRef.current?.postMessage({
          type: 'SESSION_UPDATE',
          session: data.session,
        });
      }
    }
  };

  const handleRecoverConnection = async () => {
    setConnectionInterrupted(false);
    const res = await fetch('/api/sync-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        action: 'handshake',
        device: activeDeviceRole,
        stage: 'connect',
        channelSecret: channelSecretRef.current,
        mobileSecret: mobileSecretRef.current,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.session) {
        applyIncomingSession(data.session);
      }
    }
  };

  const handleSelectPreset = (
    presetId: SymptomCategory,
    source: DeviceRole = activeDeviceRole
  ) => {
    updateSyncedField('symptomCategory', presetId, source, true);
    const found = SYMPTOM_PRESETS.find((p) => p.id === presetId);
    if (found) {
      updateSyncedField('reason', found.defaultReason, source, true);
      updateSyncedField(
        'department',
        found.recommendedSpecialty,
        source,
        true
      );
      const matchingDoc = doctors.find((d) =>
        d.specialty
          .toLowerCase()
          .includes(found.recommendedSpecialty.split(' ')[0].toLowerCase())
      );
      if (matchingDoc) {
        updateSyncedField('doctorId', matchingDoc.id, source, true);
      }
    }
  };

  const handleDepartmentChange = (
    dept: string,
    source: DeviceRole = activeDeviceRole
  ) => {
    updateSyncedField('department', dept, source, true);
    const matchingDoc = doctors.find(
      (d) =>
        d.department.toLowerCase().includes(dept.split(' ')[0].toLowerCase()) ||
        d.specialty.toLowerCase().includes(dept.split(' ')[0].toLowerCase())
    );
    if (matchingDoc) {
      updateSyncedField('doctorId', matchingDoc.id, source, true);
    }
  };

  const handleReasonChange = (
    val: string,
    source: DeviceRole = activeDeviceRole
  ) => {
    updateSyncedField('reason', val, source, false);
    const detected = detectSymptomCategory(val);
    if (detected !== fields.symptomCategory) {
      updateSyncedField('symptomCategory', detected, source, true);
    }
  };

  const matchedPatient = useMemo(() => {
    const clean = fields.patientEmail.trim().toLowerCase();
    return patients.find((p) => p.email.toLowerCase() === clean) || null;
  }, [patients, fields.patientEmail]);

  const livePrediction = useMemo(() => {
    const leadTimeDays = calculateLeadTimeDays(fields.appointmentDate);
    return predictNoShowProbability({
      leadTimeDays,
      priorMissedAppointments: matchedPatient?.missedAppointments ?? 0,
      totalPastAppointments: matchedPatient?.totalAppointments ?? 1,
      patientAge: Number(fields.age) || matchedPatient?.age || 30,
      smsReminder: fields.smsReminder,
      distanceKm: matchedPatient?.distanceKm ?? 5,
      chronicConditions: matchedPatient?.chronicConditions ?? 0,
      visitType: fields.visitType,
    });
  }, [
    fields.appointmentDate,
    fields.age,
    fields.smsReminder,
    fields.visitType,
    matchedPatient,
  ]);

  const activeConflicts = useMemo(() => {
    return Object.values(syncSession.conflicts || {}).filter(
      (c): c is FieldConflict => Boolean(c)
    );
  }, [syncSession.conflicts]);

  const displayedPairingStatus: PairingStatus = isSyncingPulse
    ? 'Synchronizing'
    : syncSession.pairingStatus;

  const handleCopySyncUrl = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(mobileSyncUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleBookSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (
      !fields.patientName.trim() ||
      !fields.patientEmail.trim() ||
      !fields.patientEmail.includes('@')
    ) {
      setErrorMsg('Please enter the patient full name and a valid email address.');
      return;
    }
    if (!fields.reason.trim()) {
      setErrorMsg(
        'Please select a symptom or describe the primary reason for your visit.'
      );
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

      const payload: Record<string, unknown> = {
        userName: fields.patientName.trim(),
        userEmail: fields.patientEmail.trim().toLowerCase(),
        userPhone: fields.patientPhone.trim(),
        age: Number(fields.age) || 30,
        gender: fields.gender,
        bloodGroup: fields.bloodGroup,
        appointmentDate: fields.appointmentDate,
        timeSlot: fields.timeSlot,
        visitType: fields.visitType,
        reason: `[${fields.department}] ${fields.reason.trim()}`,
        clinicalNotes: fields.clinicalNotes.trim(),
        smsReminder: fields.smsReminder,
      };

      if (fields.doctorId !== 'custom' && Number(fields.doctorId) > 0) {
        payload.doctorId = Number(fields.doctorId);
      } else {
        payload.doctorName = fields.customDoctorName.trim() || 'Dr. Priya Nair';
        payload.doctorSpecialty =
          fields.department.trim() || 'Internal Medicine';
      }

      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not complete appointment booking.');
      }

      const syncRes = await fetch('/api/sync-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          action: 'complete_booking',
          appointmentId: data.appointment.id,
          channelSecret: channelSecretRef.current,
          mobileSecret: mobileSecretRef.current,
        }),
      });
      if (syncRes.ok) {
        const syncData = await syncRes.json();
        if (syncData.session) {
          broadcastChannelRef.current?.postMessage({
            type: 'SESSION_UPDATE',
            session: syncData.session,
          });
        }
      }

      const doc =
        data.doctor ||
        doctors.find((d) => d.id === data.appointment.doctorId);
      const pat =
        data.patient ||
        patients.find((p) => p.id === data.appointment.patientId);

      const qrPayload: QrPassAppointmentData = {
        id: data.appointment.id,
        appointmentDate: data.appointment.appointmentDate,
        timeSlot: data.appointment.timeSlot,
        visitType: data.appointment.visitType,
        reason: data.appointment.reason,
        status: data.appointment.status,
        clinicalNotes: data.appointment.clinicalNotes,
        patientName: pat?.fullName || fields.patientName,
        patientEmail: pat?.email || fields.patientEmail,
        patientPhone: pat?.phone || fields.patientPhone,
        patientAge: pat?.age || Number(fields.age) || 30,
        patientGender: pat?.gender || fields.gender || 'Not Specified',
        bloodGroup: pat?.bloodGroup || fields.bloodGroup || 'O+',
        doctorName:
          doc?.name || fields.customDoctorName || 'Dr. Attending Specialist',
        doctorSpecialty:
          doc?.specialty || fields.department || 'Internal Medicine',
        roomNumber: doc?.roomNumber || 'Suite 101',
      };

      setConfirmedQrAppt(qrPayload);

      await refreshHospitalData();
      setStatusBanner(
        `Appointment #${data.appointment.id} confirmed for ${fields.patientName} (${fields.patientEmail}). Official Admin-Only QR Pass generated!`
      );
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to book appointment.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const renderOriginTag = (fieldKey: SyncedFieldKey) => {
    const meta = syncSession.fieldMeta[fieldKey];
    if (!meta || meta.revision <= 1) return null;
    const isFromMobile = meta.updatedBy === 'mobile';
    return (
      <span
        className={`inline-flex items-center gap-1 text-[10px] font-semibold ${
          isFromMobile
            ? 'text-[#0F766E] dark:text-[#2DD4BF]'
            : 'text-slate-500 dark:text-slate-400'
        }`}
      >
        {isFromMobile ? (
          <Smartphone className="w-2.5 h-2.5" />
        ) : (
          <Monitor className="w-2.5 h-2.5" />
        )}
        <span>
          {isFromMobile ? 'Smartphone' : 'Desktop'} · v{meta.revision}
        </span>
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Standalone Mobile Companion Banner */}
      {isMobileStandaloneView && (
        <div className="sahs-card bg-[#0F766E] text-white p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
              <Smartphone className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] uppercase tracking-wider font-bold text-emerald-100">
                  Smartphone QR Sync Session
                </span>
                <span className="text-white/90 text-[11px] font-mono">
                  · {sessionId}
                </span>
              </div>
              <h2 className="text-sm font-bold text-white">
                Two-Way Live Appointment Form Synchronization
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-100">
              <Wifi className="w-3.5 h-3.5 text-emerald-200" />
              <span>{displayedPairingStatus}</span>
            </span>
            {connectionInterrupted && (
              <button
                type="button"
                onClick={handleRecoverConnection}
                className="px-3 py-1 rounded-lg bg-amber-400 text-slate-900 text-xs font-bold cursor-pointer"
              >
                Reconnect
              </button>
            )}
          </div>
        </div>
      )}

      {/* Clean Unboxed Top Header */}
      <div
        data-gsap-layer="card"
        className="sahs-card p-6 flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div className="space-y-1.5">
          <span
            data-gsap-layer="subheading"
            className="text-xs font-bold text-[#0F766E] dark:text-[#2DD4BF] uppercase tracking-wider block"
          >
            Outpatient Scheduling Workspace
          </span>
          <h1
            data-gsap-layer="heading"
            className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight"
          >
            Book Hospital Appointment
          </h1>
          <p data-gsap-layer="subheading" className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
            Take your time — fill out your visit details here or scan the QR code to continue seamlessly on your phone.
          </p>
        </div>

        <div className="flex items-center gap-4 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-200/70 dark:border-slate-800/70">
          <div>
            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 block">
              Pairing Status
            </span>
            <span
              data-testid="pairing-status-badge"
              className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5 mt-0.5"
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  displayedPairingStatus === 'Session expired'
                    ? 'bg-rose-600'
                    : displayedPairingStatus === 'Both devices connected'
                    ? 'bg-[#0F766E] dark:bg-[#2DD4BF] animate-pulse'
                    : 'bg-[#0F766E] dark:bg-[#2DD4BF]'
                }`}
              />
              {displayedPairingStatus}
            </span>
          </div>
          <div className="border-l border-slate-200 dark:border-slate-800 pl-4 text-right">
            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 block">
              Revision
            </span>
            <span className="font-mono text-xs font-bold text-[#0F766E] dark:text-[#2DD4BF]">
              v{syncSession.revision}
            </span>
          </div>
        </div>
      </div>

      {/* Explicit Simultaneous Edit Conflict Resolution Banner */}
      {activeConflicts.length > 0 && (
        <div
          data-testid="conflict-resolution-banner"
          className="bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 rounded-2xl p-5 space-y-3"
        >
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-400/25 flex items-center justify-center shrink-0 text-amber-900 dark:text-amber-200">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Simultaneous Edit Conflict Detected ({activeConflicts.length}{' '}
                {activeConflicts.length === 1 ? 'Field' : 'Fields'})
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Both Desktop and Smartphone modified the same field concurrently. Select which value to keep:
              </p>
            </div>
          </div>

          <div className="space-y-2.5">
            {activeConflicts.map((conflict) => (
              <div
                key={conflict.field}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#0F766E] dark:text-[#2DD4BF]">
                    Field: {conflict.fieldLabel}
                  </span>
                  <div className="flex flex-wrap items-center gap-4 text-xs">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      Desktop: <strong className="text-slate-900 dark:text-white">{String(conflict.desktopValue)}</strong>
                    </span>
                    <span className="font-semibold text-[#0F766E] dark:text-[#2DD4BF]">
                      Smartphone: <strong>{String(conflict.mobileValue)}</strong>
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      handleResolveConflict(conflict.field, 'desktop')
                    }
                    className="sahs-button-secondary px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer"
                  >
                    Keep Desktop (&ldquo;{String(conflict.desktopValue)}&rdquo;)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleResolveConflict(conflict.field, 'mobile')
                    }
                    className="sahs-button-primary px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer"
                  >
                    Keep Smartphone (&ldquo;{String(conflict.mobileValue)}&rdquo;)
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Two-Column Layout: Left 7 Cols = Clean Appointment Form, Right 5 Cols = Compact QR Sync Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 7 Cols: Appointment Booking Form */}
        <div className="lg:col-span-7 sahs-card p-5 sm:p-6 space-y-5">
          {/* Symptom Quick-Select Controls */}
          <div className="space-y-2.5 border-b border-slate-200/80 dark:border-slate-800/80 pb-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                1. What brings you in today? (Symptom Triage)
              </span>
              {renderOriginTag('symptomCategory')}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SYMPTOM_PRESETS.map((preset) => {
                const isSelected = fields.symptomCategory === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectPreset(preset.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      isSelected
                        ? 'sahs-button-primary'
                        : 'sahs-button-secondary'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800 rounded-xl text-xs font-semibold">
              {errorMsg}
            </div>
          )}

          {syncSession.submittedAppointmentId && (
            <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-slate-900 dark:text-white text-xs font-bold">
                <CheckCircle2 className="w-4 h-4 text-[#0F766E] dark:text-[#2DD4BF] shrink-0" />
                <span>
                  Appointment #{syncSession.submittedAppointmentId} confirmed &amp; synced!
                </span>
              </div>
              <button
                type="button"
                onClick={() => router.push('/appointments')}
                className="sahs-button-primary px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer"
              >
                View QR Pass
              </button>
            </div>
          )}

          <form onSubmit={handleBookSubmit} className="space-y-4">
            {/* Patient Information Section */}
            <div className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                2. Patient Information
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <label
                      htmlFor="book-username"
                      className="block text-xs font-semibold text-slate-800 dark:text-slate-200"
                    >
                      Patient Name
                    </label>
                    {renderOriginTag('patientName')}
                  </div>
                  <div className="relative">
                    <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="book-username"
                      type="text"
                      value={fields.patientName}
                      onChange={(e) =>
                        updateSyncedField('patientName', e.target.value)
                      }
                      placeholder="e.g., Rahul Sharma"
                      className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50/90 dark:bg-slate-900/90 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none"
                      required
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <label
                      htmlFor="book-phone"
                      className="block text-xs font-semibold text-slate-800 dark:text-slate-200"
                    >
                      Phone Number
                    </label>
                    {renderOriginTag('patientPhone')}
                  </div>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="book-phone"
                      type="text"
                      value={fields.patientPhone}
                      onChange={(e) =>
                        updateSyncedField('patientPhone', e.target.value)
                      }
                      placeholder="+91 98765 43210"
                      className="w-full pl-8 pr-3 py-2 text-xs font-mono bg-slate-50/90 dark:bg-slate-900/90 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none"
                      required
                    />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <label
                      htmlFor="book-gmail"
                      className="block text-xs font-semibold text-slate-800 dark:text-slate-200"
                    >
                      Email Address (Matched Gmail)
                    </label>
                    {renderOriginTag('patientEmail')}
                  </div>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="book-gmail"
                      type="email"
                      value={fields.patientEmail}
                      onChange={(e) =>
                        updateSyncedField('patientEmail', e.target.value)
                      }
                      placeholder="rahul.sharma@gmail.com"
                      className="w-full pl-8 pr-3 py-2 text-xs font-mono bg-slate-50/90 dark:bg-slate-900/90 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none"
                      required
                    />
                  </div>
                </div>

                <div className="sm:col-span-2 grid grid-cols-3 gap-3">
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <label
                        htmlFor="book-age"
                        className="block text-xs font-semibold text-slate-800 dark:text-slate-200"
                      >
                        Age
                      </label>
                      {renderOriginTag('age')}
                    </div>
                    <input
                      id="book-age"
                      type="number"
                      min={1}
                      max={120}
                      value={fields.age}
                      onChange={(e) =>
                        updateSyncedField('age', Number(e.target.value) || 1)
                      }
                      className="w-full px-2.5 py-2 text-xs font-mono bg-slate-50/90 dark:bg-slate-900/90 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <label
                        htmlFor="book-gender"
                        className="block text-xs font-semibold text-slate-800 dark:text-slate-200"
                      >
                        Gender
                      </label>
                      {renderOriginTag('gender')}
                    </div>
                    <select
                      id="book-gender"
                      value={fields.gender}
                      onChange={(e) =>
                        updateSyncedField(
                          'gender',
                          e.target.value,
                          activeDeviceRole,
                          true
                        )
                      }
                      className="w-full px-2.5 py-2 text-xs bg-slate-50/90 dark:bg-slate-900/90 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                    >
                      {GENDERS.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <label
                        htmlFor="book-blood"
                        className="block text-xs font-semibold text-slate-800 dark:text-slate-200"
                      >
                        Blood Group
                      </label>
                      {renderOriginTag('bloodGroup')}
                    </div>
                    <select
                      id="book-blood"
                      value={fields.bloodGroup}
                      onChange={(e) =>
                        updateSyncedField(
                          'bloodGroup',
                          e.target.value,
                          activeDeviceRole,
                          true
                        )
                      }
                      className="w-full px-2.5 py-2 text-xs font-mono bg-slate-50/90 dark:bg-slate-900/90 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                    >
                      {BLOOD_GROUPS.map((bg) => (
                        <option key={bg} value={bg}>
                          {bg}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Department, Doctor, Date & Slot Selection */}
            <div className="space-y-3 pt-2 border-t border-slate-200/80 dark:border-slate-800/80">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                3. Department, Doctor &amp; Schedule
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <label
                      htmlFor="book-department"
                      className="block text-xs font-semibold text-slate-800 dark:text-slate-200"
                    >
                      Department
                    </label>
                    {renderOriginTag('department')}
                  </div>
                  <select
                    id="book-department"
                    value={fields.department}
                    onChange={(e) => handleDepartmentChange(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50/90 dark:bg-slate-900/90 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  >
                    {HOSPITAL_DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <label
                      htmlFor="book-doctor"
                      className="block text-xs font-semibold text-slate-800 dark:text-slate-200"
                    >
                      Preferred Doctor
                    </label>
                    {renderOriginTag('doctorId')}
                  </div>
                  <select
                    id="book-doctor"
                    value={fields.doctorId}
                    onChange={(e) =>
                      updateSyncedField(
                        'doctorId',
                        e.target.value === 'custom'
                          ? 'custom'
                          : Number(e.target.value),
                        activeDeviceRole,
                        true
                      )
                    }
                    className="w-full px-3 py-2 text-xs bg-slate-50/90 dark:bg-slate-900/90 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  >
                    {doctors.map((doc) => (
                      <option key={doc.id} value={doc.id}>
                        {doc.name} — {doc.specialty} (${doc.consultationFee})
                      </option>
                    ))}
                    <option value="custom">
                      + Custom Specialist ({fields.department})
                    </option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <label
                      htmlFor="book-date"
                      className="block text-xs font-semibold text-slate-800 dark:text-slate-200"
                    >
                      Appointment Date
                    </label>
                    {renderOriginTag('appointmentDate')}
                  </div>
                  <input
                    id="book-date"
                    type="date"
                    value={fields.appointmentDate}
                    onChange={(e) =>
                      updateSyncedField(
                        'appointmentDate',
                        e.target.value,
                        activeDeviceRole,
                        true
                      )
                    }
                    className="w-full px-2.5 py-2 text-xs font-mono bg-slate-50/90 dark:bg-slate-900/90 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <label
                      htmlFor="book-time"
                      className="block text-xs font-semibold text-slate-800 dark:text-slate-200"
                    >
                      Available Slot
                    </label>
                    {renderOriginTag('timeSlot')}
                  </div>
                  <select
                    id="book-time"
                    value={fields.timeSlot}
                    onChange={(e) =>
                      updateSyncedField(
                        'timeSlot',
                        e.target.value,
                        activeDeviceRole,
                        true
                      )
                    }
                    className="w-full px-2.5 py-2 text-xs font-mono bg-slate-50/90 dark:bg-slate-900/90 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  >
                    {TIME_SLOTS.map((slot) => (
                      <option key={slot} value={slot}>
                        {slot}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="block text-xs font-semibold text-slate-800 dark:text-slate-200">
                      Visit Mode
                    </span>
                    {renderOriginTag('visitType')}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(['In-Person', 'Telehealth'] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() =>
                          updateSyncedField(
                            'visitType',
                            mode,
                            activeDeviceRole,
                            true
                          )
                        }
                        className={`py-2 px-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                          fields.visitType === mode
                            ? 'sahs-button-primary'
                            : 'sahs-button-secondary'
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <label
                      htmlFor="book-reason"
                      className="block text-xs font-semibold text-slate-800 dark:text-slate-200"
                    >
                      Reason for Visit
                    </label>
                    {renderOriginTag('reason')}
                  </div>
                  <input
                    id="book-reason"
                    type="text"
                    value={fields.reason}
                    onChange={(e) => handleReasonChange(e.target.value)}
                    placeholder="Primary symptoms..."
                    className="w-full px-3 py-2 text-xs bg-slate-50/90 dark:bg-slate-900/90 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <label
                      htmlFor="book-notes"
                      className="block text-xs font-semibold text-slate-800 dark:text-slate-200"
                    >
                      Clinical Notes (Optional)
                    </label>
                    {renderOriginTag('clinicalNotes')}
                  </div>
                  <input
                    id="book-notes"
                    type="text"
                    value={fields.clinicalNotes}
                    onChange={(e) =>
                      updateSyncedField('clinicalNotes', e.target.value)
                    }
                    placeholder="Allergies, insurance notes..."
                    className="w-full px-3 py-2 text-xs bg-slate-50/90 dark:bg-slate-900/90 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-2 text-xs">
              <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-800 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={fields.smsReminder}
                  onChange={(e) =>
                    updateSyncedField(
                      'smsReminder',
                      e.target.checked,
                      activeDeviceRole,
                      true
                    )
                  }
                  className="w-4 h-4 accent-[#0F766E] dark:accent-[#2DD4BF] cursor-pointer"
                />
                <span>Send SMS, WhatsApp &amp; QR Check-In Pass</span>
              </label>
              <span className="font-mono text-[11px] font-semibold text-[#0F766E] dark:text-[#2DD4BF]">
                Attendance Confidence: {100 - livePrediction.probability}% ({livePrediction.riskLevel} Risk)
              </span>
            </div>

            <button
              type="submit"
              disabled={
                submitting || displayedPairingStatus === 'Session expired'
              }
              className="sahs-button-primary w-full py-3 px-5 text-xs font-bold rounded-xl disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {submitting
                  ? 'Confirming Appointment...'
                  : 'Confirm Appointment & Generate QR Pass'}
              </span>
            </button>
          </form>
        </div>

        {/* Right 5 Cols: Clean, Compact QR-Assisted Dual-Device Panel */}
        <div className="lg:col-span-5 space-y-5">
          <div
            data-gsap-layer="visual"
            data-gsap-illustration
            className="sahs-card p-5 sm:p-6 space-y-4"
          >
            <div className="flex items-start justify-between gap-2 border-b border-slate-200/80 dark:border-slate-800/80 pb-3.5">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#0F766E] dark:text-[#2DD4BF] block">
                  QR-Assisted Dual-Device Sync
                </span>
                <h2 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                  Continue on Smartphone
                </h2>
              </div>
              <QrCode className="w-4 h-4 text-[#0F766E] dark:text-[#2DD4BF] shrink-0" />
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Scan this QR code to continue filling your appointment form on your smartphone. Both screens stay active and synchronized in real time.
            </p>

            {/* Compact QR Matrix + Session Actions */}
            <div className="flex flex-col sm:flex-row items-center gap-4 p-4 sahs-panel rounded-2xl">
              <div className="bg-white p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 shrink-0 relative">
                {qrDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={qrDataUrl}
                    alt={`Scannable QR Code for ${pairingUrl}`}
                    className="w-[126px] h-[126px] object-contain block"
                    data-testid="real-qrcode-img"
                  />
                ) : (
                  <div
                    className="grid gap-0"
                    style={{
                      gridTemplateColumns: `repeat(${qrMatrixData.size}, minmax(0, 1fr))`,
                      width: '126px',
                      height: '126px',
                    }}
                    role="img"
                    aria-label={`QR Code for session ${sessionId}`}
                  >
                    {qrMatrixData.matrix.map((row, rIdx) =>
                      row.map((cell, cIdx) => (
                        <div
                          key={`${rIdx}-${cIdx}`}
                          className={cell ? 'bg-slate-900' : 'bg-white'}
                        />
                      ))
                    )}
                  </div>
                )}

                {(displayedPairingStatus === 'Session expired' ||
                  displayedPairingStatus === 'Session revoked') && (
                  <div className="absolute inset-0 bg-white/95 rounded-xl flex flex-col items-center justify-center p-2 text-center">
                    <AlertTriangle className="w-5 h-5 text-rose-600 mb-1" />
                    <span className="text-[11px] font-bold text-rose-900">
                      {displayedPairingStatus}
                    </span>
                    <button
                      type="button"
                      onClick={handleRegenerateSession}
                      className="mt-1.5 px-2.5 py-1 rounded bg-[#0F766E] text-white text-[10px] font-bold cursor-pointer"
                    >
                      New QR
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-2.5 text-xs w-full min-w-0">
                <div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold block">
                    Session ID &amp; Production Pairing URL
                  </span>
                  <span className="font-mono font-bold text-xs text-slate-900 dark:text-white block">
                    {sessionId}
                  </span>
                  <span
                    data-testid="production-pairing-url"
                    className="font-mono text-[10px] text-[#0F766E] dark:text-[#2DD4BF] truncate block"
                    title={pairingUrl}
                  >
                    {pairingUrl}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={handleCopySyncUrl}
                    className="sahs-button-secondary inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="w-3 h-3 text-[#0F766E] dark:text-[#2DD4BF]" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy Link</span>
                      </>
                    )}
                  </button>

                  <a
                    href={mobileSyncUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="sahs-button-secondary inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Open Mobile Tab</span>
                  </a>

                  <button
                    type="button"
                    onClick={handleRegenerateSession}
                    className="sahs-button-secondary inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer"
                  >
                    <span>Rotate QR</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleConnectSmartphoneCompanion}
                  className="sahs-button-primary w-full py-2 px-3 rounded-xl text-xs font-bold cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>
                    {showCompanionSimulator
                      ? 'Smartphone Companion Connected'
                      : 'Pair & Open Smartphone Companion'}
                  </span>
                </button>
              </div>
            </div>

            {/* Clean Unboxed Pairing Lifecycle List */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-slate-900 dark:text-white">
                  Session Lifecycle
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSimulateSimultaneousConflict}
                    className="font-semibold text-[#0F766E] dark:text-[#2DD4BF] hover:underline cursor-pointer"
                  >
                    Simulate Conflict
                  </button>
                  <span className="text-slate-400">·</span>
                  <button
                    type="button"
                    onClick={handleRevokeSession}
                    className="font-semibold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                  >
                    Revoke Session
                  </button>
                  <span className="text-slate-400">·</span>
                  <button
                    type="button"
                    onClick={
                      displayedPairingStatus === 'Session expired' ||
                      displayedPairingStatus === 'Session revoked'
                        ? handleRegenerateSession
                        : handleExpireSession
                    }
                    className="font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                  >
                    {displayedPairingStatus === 'Session expired' ||
                    displayedPairingStatus === 'Session revoked'
                      ? 'Restore Session'
                      : 'Expire Session'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-2 gap-x-3 pt-1">
                {PAIRING_STATUS_LIST.map((st) => {
                  const isCurrent = displayedPairingStatus === st;
                  return (
                    <div
                      key={st}
                      className={`text-[11px] flex items-center gap-1.5 ${
                        isCurrent
                          ? st === 'Session expired'
                            ? 'text-rose-600 dark:text-rose-400 font-bold'
                            : 'text-[#0F766E] dark:text-[#2DD4BF] font-bold'
                          : 'text-slate-400 dark:text-slate-500 font-medium'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          isCurrent ? 'bg-current' : 'bg-slate-300 dark:bg-slate-700'
                        }`}
                      />
                      <span className="truncate">{st}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Interactive Live Smartphone Companion Drawer */}
          {showCompanionSimulator && !isMobileStandaloneView && (
            <div
              data-testid="smartphone-companion-simulator"
              className="sahs-card p-5 space-y-3"
            >
              <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800/80 pb-2.5">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-[#0F766E] dark:text-[#2DD4BF]" />
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                      Smartphone Companion (Live Two-Way Sync)
                    </h3>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      Edits here immediately update the Desktop form.
                    </p>
                  </div>
                </div>
                <span className="text-[#0F766E] dark:text-[#2DD4BF] text-[10px] font-mono font-bold">
                  {displayedPairingStatus}
                </span>
              </div>

              <div className="space-y-2.5">
                <div>
                  <label
                    htmlFor="mobile-sim-name"
                    className="block text-[11px] font-semibold text-slate-800 dark:text-slate-200 mb-1"
                  >
                    Smartphone — Patient Name
                  </label>
                  <input
                    id="mobile-sim-name"
                    type="text"
                    value={fields.patientName}
                    onChange={(e) =>
                      updateSyncedField('patientName', e.target.value, 'mobile')
                    }
                    placeholder="Enter Rahul Sharma on smartphone..."
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label
                      htmlFor="mobile-sim-phone"
                      className="block text-[11px] font-semibold text-slate-800 dark:text-slate-200 mb-1"
                    >
                      Smartphone — Phone
                    </label>
                    <input
                      id="mobile-sim-phone"
                      type="text"
                      value={fields.patientPhone}
                      onChange={(e) =>
                        updateSyncedField(
                          'patientPhone',
                          e.target.value,
                          'mobile'
                        )
                      }
                      className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="mobile-sim-dept"
                      className="block text-[11px] font-semibold text-slate-800 dark:text-slate-200 mb-1"
                    >
                      Smartphone — Department
                    </label>
                    <select
                      id="mobile-sim-dept"
                      value={fields.department}
                      onChange={(e) =>
                        handleDepartmentChange(e.target.value, 'mobile')
                      }
                      className="w-full px-2 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                    >
                      {HOSPITAL_DEPARTMENTS.map((dept) => (
                        <option key={dept} value={dept}>
                          {dept}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    updateSyncedField(
                      'patientName',
                      'Rahul Sharma',
                      'mobile',
                      true
                    )
                  }
                  className="sahs-button-primary w-full py-2 px-3 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Quick Fill &ldquo;Rahul Sharma&rdquo; from Smartphone
                </button>
              </div>
            </div>
          )}

          {/* Compact Symptom Clinical Guide */}
          <SymptomVectorArt category={fields.symptomCategory} />
        </div>
      </div>

      {confirmedQrAppt && (
        <AppointmentQrModal
          appointment={confirmedQrAppt}
          onClose={() => setConfirmedQrAppt(null)}
        />
      )}
    </div>
  );
}
