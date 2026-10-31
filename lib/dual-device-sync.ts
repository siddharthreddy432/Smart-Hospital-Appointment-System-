import QRCode from 'qrcode';
import { SymptomCategory } from './csv-export';

export const PUBLIC_PRODUCTION_ORIGIN = 'https://sahs.telis.tech';

export type PairingStatus =
  | 'Waiting for scan'
  | 'QR scanned'
  | 'Device connected'
  | 'Synchronizing'
  | 'Both devices connected'
  | 'Session expired'
  | 'Session revoked';

export type DeviceRole = 'desktop' | 'mobile';

export interface SyncedBookingFormFields {
  patientName: string;
  patientPhone: string;
  patientEmail: string;
  age: string | number;
  gender: string;
  bloodGroup: string;
  department: string;
  doctorId: number | 'custom';
  customDoctorName: string;
  appointmentDate: string;
  timeSlot: string;
  visitType: 'In-Person' | 'Telehealth';
  symptomCategory: SymptomCategory;
  reason: string;
  clinicalNotes: string;
  smsReminder: boolean;
}

export type SyncedFieldKey = keyof SyncedBookingFormFields;

export const FIELD_LABELS: Record<SyncedFieldKey, string> = {
  patientName: 'Patient Name',
  patientPhone: 'Phone Number',
  patientEmail: 'Email Address',
  age: 'Patient Age',
  gender: 'Gender',
  bloodGroup: 'Blood Group',
  department: 'Hospital Department',
  doctorId: 'Preferred Doctor',
  customDoctorName: 'Custom Specialist Name',
  appointmentDate: 'Appointment Date',
  timeSlot: 'Time Slot',
  visitType: 'Visit Mode',
  symptomCategory: 'Symptom Preset',
  reason: 'Reason for Visit',
  clinicalNotes: 'Clinical Notes',
  smsReminder: 'SMS & WhatsApp Reminder',
};

export interface FieldRevisionMeta {
  revision: number;
  updatedBy: DeviceRole;
  updatedAt: number;
}

export interface FieldConflict {
  field: SyncedFieldKey;
  fieldLabel?: string;
  desktopValue: string | number | boolean;
  mobileValue: string | number | boolean;
  detectedAt: number;
}

export interface SyncSessionState {
  sessionId: string;
  revision: number;
  pairingStatus: PairingStatus;
  desktopConnected: boolean;
  mobileConnected: boolean;
  mobileScanned: boolean;
  qrScanned: boolean;
  isTokenConsumed?: boolean;
  isRevoked?: boolean;
  pairingUrl?: string;
  localPairingPath?: string;
  createdAt: number;
  expiresAt: number;
  lastUpdatedAt: number;
  lastUpdatedBy: DeviceRole;
  fields: SyncedBookingFormFields;
  fieldMeta: Record<SyncedFieldKey, FieldRevisionMeta>;
  conflicts: Partial<Record<SyncedFieldKey, FieldConflict>>;
  submittedAppointmentId: number | null;
}

export const SESSION_TTL_MS = 15 * 60 * 1000; // 15 minutes
export const CONFLICT_WINDOW_MS = 2200; // 2.2s simultaneous edit window

function sha256HexSync(message: string): string {
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  const bytes = Array.from(new TextEncoder().encode(message));
  const bitLen = bytes.length * 8;
  bytes.push(0x80);
  while ((bytes.length % 64) !== 56) bytes.push(0);
  const hi = Math.floor(bitLen / 0x100000000);
  const lo = bitLen >>> 0;
  for (let i = 3; i >= 0; i--) bytes.push((hi >>> (i * 8)) & 0xff);
  for (let i = 3; i >= 0; i--) bytes.push((lo >>> (i * 8)) & 0xff);

  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
  const rotr = (n: number, x: number) => (x >>> n) | (x << (32 - n));

  for (let offset = 0; offset < bytes.length; offset += 64) {
    const W = new Array<number>(64);
    for (let i = 0; i < 16; i++) {
      const j = offset + i * 4;
      W[i] = ((bytes[j] << 24) | (bytes[j + 1] << 16) | (bytes[j + 2] << 8) | bytes[j + 3]) >>> 0;
    }
    for (let i = 16; i < 64; i++) {
      const s0 = (rotr(7, W[i - 15]) ^ rotr(18, W[i - 15]) ^ (W[i - 15] >>> 3)) >>> 0;
      const s1 = (rotr(17, W[i - 2]) ^ rotr(19, W[i - 2]) ^ (W[i - 2] >>> 10)) >>> 0;
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0;
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let i = 0; i < 64; i++) {
      const S1 = (rotr(6, e) ^ rotr(11, e) ^ rotr(25, e)) >>> 0;
      const ch = ((e & f) ^ (~e & g)) >>> 0;
      const temp1 = (h + S1 + ch + K[i] + W[i]) >>> 0;
      const S0 = (rotr(2, a) ^ rotr(13, a) ^ rotr(22, a)) >>> 0;
      const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      const temp2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + temp1) >>> 0;
      d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
  }
  return [h0, h1, h2, h3, h4, h5, h6, h7].map((v) => v.toString(16).padStart(8, '0')).join('');
}

export function generateSecurePairingToken(byteLength: number = 24): string {
  const bytes = new Uint8Array(byteLength);
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < byteLength; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let token = '';
  for (let i = 0; i < bytes.length; i++) {
    token += alphabet[bytes[i] & 63];
  }
  return token;
}

export function hashPairingToken(rawToken: string): string {
  return sha256HexSync(rawToken.trim());
}

export function buildProductionPairingUrl(rawToken: string): string {
  return `${PUBLIC_PRODUCTION_ORIGIN}/appointment/pair/${encodeURIComponent(
    rawToken.trim()
  )}`;
}

export function buildRelativePairingPath(rawToken: string): string {
  return `/appointment/pair/${encodeURIComponent(rawToken.trim())}`;
}

export async function generateRealQrCodeDataUrl(
  targetUrl: string
): Promise<string> {
  return QRCode.toDataURL(targetUrl, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 240,
    color: {
      dark: '#080D16',
      light: '#FFFFFF',
    },
  });
}

export async function generateRealQrCodeSvg(
  targetUrl: string
): Promise<string> {
  return QRCode.toString(targetUrl, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 1,
    color: {
      dark: '#080D16',
      light: '#FFFFFF',
    },
  });
}

export function createDefaultBookingFields(
  overrides?: Partial<SyncedBookingFormFields>
): SyncedBookingFormFields {
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  return {
    patientName: 'Rahul Sharma',
    patientPhone: '+91 98450 11223',
    patientEmail: 'patient.care@example.com',
    age: '29',
    gender: 'Male',
    bloodGroup: 'O+',
    department: 'Internal Medicine',
    doctorId: 1,
    customDoctorName: '',
    appointmentDate: tomorrow,
    timeSlot: '10:00 AM',
    visitType: 'In-Person',
    symptomCategory: 'fever',
    reason: 'High Fever, Chills & Elevated Body Temperature',
    clinicalNotes: '',
    smsReminder: true,
    ...overrides,
  };
}

export function createSyncSessionState(
  sessionId: string,
  initialFields?: Partial<SyncedBookingFormFields>,
  now: number = Date.now()
): SyncSessionState {
  const fields = createDefaultBookingFields(initialFields);
  const fieldMeta = {} as Record<SyncedFieldKey, FieldRevisionMeta>;

  (Object.keys(fields) as SyncedFieldKey[]).forEach((key) => {
    fieldMeta[key] = {
      revision: 1,
      updatedBy: 'desktop',
      updatedAt: now,
    };
  });

  return {
    sessionId,
    revision: 1,
    pairingStatus: 'Waiting for scan',
    desktopConnected: true,
    mobileConnected: false,
    mobileScanned: false,
    qrScanned: false,
    isTokenConsumed: false,
    isRevoked: false,
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
    lastUpdatedAt: now,
    lastUpdatedBy: 'desktop',
    fields,
    fieldMeta,
    conflicts: {},
    submittedAppointmentId: null,
  };
}

export function computePairingStatus(
  session: SyncSessionState,
  now: number = Date.now(),
  isActivelySyncing: boolean = false
): PairingStatus {
  if (session.isRevoked) {
    return 'Session revoked';
  }
  if (now >= session.expiresAt) {
    return 'Session expired';
  }
  if (isActivelySyncing) {
    return 'Synchronizing';
  }
  if (session.desktopConnected && session.mobileConnected) {
    return 'Both devices connected';
  }
  if (session.mobileConnected) {
    return 'Device connected';
  }
  if (session.qrScanned || session.mobileScanned) {
    return 'QR scanned';
  }
  return 'Waiting for scan';
}

export function recordDeviceHandshake(
  session: SyncSessionState,
  device: DeviceRole,
  stage: 'scan' | 'connect' | 'disconnect',
  now: number = Date.now()
): SyncSessionState {
  if (session.isRevoked) {
    return {
      ...session,
      pairingStatus: 'Session revoked',
    };
  }
  if (now >= session.expiresAt) {
    return {
      ...session,
      pairingStatus: 'Session expired',
    };
  }

  const next: SyncSessionState = {
    ...session,
    fields: { ...session.fields },
    fieldMeta: { ...session.fieldMeta },
    conflicts: { ...session.conflicts },
    revision: session.revision + 1,
    lastUpdatedAt: now,
    lastUpdatedBy: device,
  };

  if (device === 'mobile') {
    if (stage === 'scan') {
      next.qrScanned = true;
      next.mobileScanned = true;
      next.pairingStatus = 'QR scanned';
    } else if (stage === 'connect') {
      next.qrScanned = true;
      next.mobileScanned = true;
      next.mobileConnected = true;
      next.isTokenConsumed = true;
      next.pairingStatus = next.desktopConnected
        ? 'Both devices connected'
        : 'Device connected';
    } else if (stage === 'disconnect') {
      next.mobileConnected = false;
      next.pairingStatus = 'Waiting for scan';
    }
  } else {
    next.desktopConnected = stage !== 'disconnect';
    next.pairingStatus = computePairingStatus(next, now, false);
  }

  return next;
}

export interface ApplyFieldDeltaInput<
  K extends SyncedFieldKey = SyncedFieldKey
> {
  field: K;
  value: SyncedBookingFormFields[K];
  device: DeviceRole;
  baseFieldRevision?: number;
  forceConflict?: boolean;
  counterpartValue?: SyncedBookingFormFields[K];
  now?: number;
}

export interface ApplyFieldDeltaResult {
  session: SyncSessionState;
  conflictDetected: boolean;
  conflict?: FieldConflict;
}

export function applyFieldDelta<K extends SyncedFieldKey>(
  session: SyncSessionState,
  input: ApplyFieldDeltaInput<K>
): ApplyFieldDeltaResult {
  const now = input.now ?? Date.now();

  if (session.isRevoked) {
    return {
      session: {
        ...session,
        pairingStatus: 'Session revoked',
      },
      conflictDetected: false,
    };
  }

  if (now >= session.expiresAt) {
    return {
      session: {
        ...session,
        pairingStatus: 'Session expired',
      },
      conflictDetected: false,
    };
  }

  const currentMeta = session.fieldMeta[input.field] || {
    revision: 1,
    updatedBy: 'desktop',
    updatedAt: session.createdAt,
  };
  const currentValue = session.fields[input.field];

  const isRevisionBehind =
    input.baseFieldRevision !== undefined &&
    input.baseFieldRevision < currentMeta.revision;

  const isRecentOppositeDeviceEdit =
    currentMeta.revision > 1 &&
    currentMeta.updatedBy !== input.device &&
    now - currentMeta.updatedAt <= CONFLICT_WINDOW_MS &&
    currentValue !== input.value;

  if (
    input.forceConflict ||
    (isRevisionBehind && currentMeta.updatedBy !== input.device && currentValue !== input.value) ||
    isRecentOppositeDeviceEdit
  ) {
    const desktopVal =
      input.device === 'desktop'
        ? input.value
        : input.counterpartValue !== undefined
        ? input.counterpartValue
        : currentValue;
    const mobileVal =
      input.device === 'mobile'
        ? input.value
        : input.counterpartValue !== undefined
        ? input.counterpartValue
        : currentValue;

    const conflict: FieldConflict = {
      field: input.field,
      fieldLabel: FIELD_LABELS[input.field] || String(input.field),
      desktopValue: desktopVal as string | number | boolean,
      mobileValue: mobileVal as string | number | boolean,
      detectedAt: now,
    };

    const nextSession: SyncSessionState = {
      ...session,
      revision: session.revision + 1,
      lastUpdatedAt: now,
      lastUpdatedBy: input.device,
      mobileConnected: session.mobileConnected || input.device === 'mobile',
      qrScanned: session.qrScanned || input.device === 'mobile',
      fields: {
        ...session.fields,
        [input.field]: input.value,
      },
      fieldMeta: {
        ...session.fieldMeta,
        [input.field]: {
          revision: currentMeta.revision + 1,
          updatedBy: input.device,
          updatedAt: now,
        },
      },
      conflicts: {
        ...session.conflicts,
        [input.field]: conflict,
      },
    };
    nextSession.pairingStatus = computePairingStatus(nextSession, now, false);

    return {
      session: nextSession,
      conflictDetected: true,
      conflict,
    };
  }

  const nextConflicts = { ...session.conflicts };
  delete nextConflicts[input.field];

  const nextSession: SyncSessionState = {
    ...session,
    revision: session.revision + 1,
    lastUpdatedAt: now,
    lastUpdatedBy: input.device,
    mobileConnected: session.mobileConnected || input.device === 'mobile',
    qrScanned: session.qrScanned || input.device === 'mobile',
    fields: {
      ...session.fields,
      [input.field]: input.value,
    },
    fieldMeta: {
      ...session.fieldMeta,
      [input.field]: {
        revision: currentMeta.revision + 1,
        updatedBy: input.device,
        updatedAt: now,
      },
    },
    conflicts: nextConflicts,
  };

  nextSession.pairingStatus = computePairingStatus(nextSession, now, false);

  return {
    session: nextSession,
    conflictDetected: false,
  };
}

export function resolveFieldConflict(
  session: SyncSessionState,
  field: SyncedFieldKey,
  winner: DeviceRole,
  now: number = Date.now()
): SyncSessionState {
  const existingConflict = session.conflicts[field];
  if (!existingConflict) {
    return session;
  }

  const chosenValue =
    winner === 'desktop'
      ? existingConflict.desktopValue
      : existingConflict.mobileValue;

  const nextConflicts = { ...session.conflicts };
  delete nextConflicts[field];

  const currentMeta = session.fieldMeta[field] || {
    revision: 1,
    updatedBy: winner,
    updatedAt: now,
  };

  const next: SyncSessionState = {
    ...session,
    revision: session.revision + 1,
    lastUpdatedAt: now,
    lastUpdatedBy: winner,
    fields: {
      ...session.fields,
      [field]: chosenValue as never,
    },
    fieldMeta: {
      ...session.fieldMeta,
      [field]: {
        revision: currentMeta.revision + 1,
        updatedBy: winner,
        updatedAt: now,
      },
    },
    conflicts: nextConflicts,
  };

  next.pairingStatus = computePairingStatus(next, now, false);
  return next;
}

export interface SyncQrMatrixData {
  url: string;
  size: number;
  matrix: boolean[][];
}

export function generateSyncQrMatrix(url: string): SyncQrMatrixData {
  const size = 21;
  const matrix: boolean[][] = Array.from({ length: size }, () =>
    Array(size).fill(false)
  );
  const reserved: boolean[][] = Array.from({ length: size }, () =>
    Array(size).fill(false)
  );

  const placeFinderPattern = (rowOffset: number, colOffset: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const rr = rowOffset + r;
        const cc = colOffset + c;
        if (rr >= 0 && rr < size && cc >= 0 && cc < size) {
          reserved[rr][cc] = true;
          const inOuter =
            r >= 0 &&
            r <= 6 &&
            c >= 0 &&
            c <= 6 &&
            (r === 0 || r === 6 || c === 0 || c === 6);
          const inInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
          matrix[rr][cc] = inOuter || inInner;
        }
      }
    }
  };

  placeFinderPattern(0, 0);
  placeFinderPattern(0, size - 7);
  placeFinderPattern(size - 7, 0);

  for (let i = 8; i < size - 8; i++) {
    reserved[6][i] = true;
    reserved[i][6] = true;
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
  }

  let seed = 2166136261;
  for (let i = 0; i < url.length; i++) {
    seed ^= url.charCodeAt(i);
    seed = Math.imul(seed, 16777619);
  }

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!reserved[r][c]) {
        seed ^= (r * 37 + c * 101) & 0xff;
        seed = Math.imul(seed, 16777619);
        matrix[r][c] = (Math.abs(seed) & 0b11) !== 0;
      }
    }
  }

  return {
    url,
    size,
    matrix,
  };
}
