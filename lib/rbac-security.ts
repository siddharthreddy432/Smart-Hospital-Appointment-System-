import crypto from 'node:crypto';

export type SahsRole = 'ADMIN' | 'PATIENT' | 'DOCTOR';

export interface VerifiedSessionPrincipal {
  jti: string;
  uid: string;
  email: string;
  userName: string;
  role: SahsRole;
  patientId: number | null;
  doctorId: number | null;
  issuedAt: number;
  expiresAt: number;
}

declare global {
  var __sahsRevokedTokens: Set<string> | undefined;
}

function getRevokedTokenStore(): Set<string> {
  if (!globalThis.__sahsRevokedTokens) {
    globalThis.__sahsRevokedTokens = new Set<string>();
  }
  return globalThis.__sahsRevokedTokens;
}

const SESSION_HMAC_SECRET =
  process.env.SAHS_SESSION_SECRET ||
  'sahs-telis-tech-production-hmac-secret-key-2026-v1';

export function normalizeRole(input?: string | null): SahsRole {
  const upper = (input || '').trim().toUpperCase();
  if (upper === 'ADMIN') return 'ADMIN';
  if (upper === 'DOCTOR') return 'DOCTOR';
  return 'PATIENT';
}

export function issueSignedSessionToken(
  params: {
    uid: string;
    email: string;
    userName: string;
    role: SahsRole | 'patient' | 'admin' | 'doctor';
    patientId?: number | null;
    doctorId?: number | null;
  },
  ttlMs: number = 12 * 60 * 60 * 1000,
  now: number = Date.now()
): string {
  const payload: VerifiedSessionPrincipal = {
    jti: crypto.randomBytes(16).toString('hex'),
    uid: params.uid.trim(),
    email: params.email.trim().toLowerCase(),
    userName: params.userName.trim(),
    role: normalizeRole(params.role),
    patientId: params.patientId ?? null,
    doctorId: params.doctorId ?? null,
    issuedAt: now,
    expiresAt: now + ttlMs,
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString(
    'base64url'
  );
  const signature = crypto
    .createHmac('sha256', SESSION_HMAC_SECRET)
    .update(encodedPayload)
    .digest('base64url');

  return `${encodedPayload}.${signature}`;
}

export function verifySignedSessionToken(
  token: string | null | undefined,
  now: number = Date.now()
): VerifiedSessionPrincipal | null {
  if (!token || typeof token !== 'string') return null;
  const trimmed = token.replace(/^Bearer\s+/i, '').trim();
  const parts = trimmed.split('.');
  if (parts.length !== 2) return null;

  const [encodedPayload, providedSig] = parts;
  if (!encodedPayload || !providedSig) return null;

  const expectedSig = crypto
    .createHmac('sha256', SESSION_HMAC_SECRET)
    .update(encodedPayload)
    .digest('base64url');

  const providedBuf = Buffer.from(providedSig);
  const expectedBuf = Buffer.from(expectedSig);
  if (
    providedBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(providedBuf, expectedBuf)
  ) {
    return null;
  }

  try {
    const decodedJson = Buffer.from(encodedPayload, 'base64url').toString(
      'utf8'
    );
    const principal = JSON.parse(decodedJson) as VerifiedSessionPrincipal;

    if (!principal || !principal.jti || !principal.email || !principal.role) {
      return null;
    }

    if (now > principal.expiresAt) {
      return null;
    }

    const revoked = getRevokedTokenStore();
    if (revoked.has(principal.jti) || revoked.has(trimmed)) {
      return null;
    }

    return {
      ...principal,
      role: normalizeRole(principal.role),
      email: principal.email.trim().toLowerCase(),
    };
  } catch {
    return null;
  }
}

export function revokeSessionToken(token: string | null | undefined): boolean {
  if (!token) return false;
  const trimmed = token.replace(/^Bearer\s+/i, '').trim();
  const store = getRevokedTokenStore();
  store.add(trimmed);

  const parts = trimmed.split('.');
  if (parts.length === 2) {
    try {
      const parsed = JSON.parse(
        Buffer.from(parts[0], 'base64url').toString('utf8')
      ) as Partial<VerifiedSessionPrincipal>;
      if (parsed.jti) {
        store.add(parsed.jti);
      }
    } catch {
      // ignore malformed
    }
  }
  return true;
}

export function extractTokenFromHeadersAndCookies(
  headers: Headers,
  cookieValue?: string | null
): string | null {
  const xSession = headers.get('x-sahs-session');
  if (xSession && xSession.trim()) {
    return xSession.trim();
  }

  const authHeader = headers.get('authorization');
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    const candidate = authHeader.slice(7).trim();
    if (candidate.split('.').length === 2) {
      return candidate;
    }
  }

  if (cookieValue && cookieValue.trim()) {
    return cookieValue.trim();
  }

  const rawCookie = headers.get('cookie') || '';
  const match = rawCookie.match(/(?:^|;\s*)sahs_session=([^;]+)/);
  if (match && match[1]) {
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  }

  return null;
}

export function requireAdminAccess(
  principal: VerifiedSessionPrincipal | null
): { allowed: boolean; status: 200 | 401 | 403; error?: string } {
  if (!principal) {
    return {
      allowed: false,
      status: 401,
      error: 'Authentication required. Please sign in to the Admin Portal.',
    };
  }
  if (principal.role !== 'ADMIN') {
    return {
      allowed: false,
      status: 403,
      error:
        'Forbidden: Administrative privileges are required to access patient records or management functions.',
    };
  }
  return { allowed: true, status: 200 };
}

export function canAccessPatientRecord(
  principal: VerifiedSessionPrincipal | null,
  targetPatient: { id: number; email: string; userUid?: string | null }
): boolean {
  if (!principal) return false;
  if (principal.role === 'ADMIN') return true;
  if (principal.role === 'PATIENT') {
    const cleanTargetEmail = (targetPatient.email || '').trim().toLowerCase();
    const cleanPrincipalEmail = principal.email.trim().toLowerCase();
    if (
      principal.patientId !== null &&
      Number(principal.patientId) === Number(targetPatient.id)
    ) {
      return true;
    }
    if (cleanTargetEmail && cleanTargetEmail === cleanPrincipalEmail) {
      return true;
    }
    if (targetPatient.userUid && targetPatient.userUid === principal.uid) {
      return true;
    }
    return false;
  }
  return false;
}

export function canAccessAppointmentRecord(
  principal: VerifiedSessionPrincipal | null,
  targetAppointment: {
    id: number;
    patientId: number;
    doctorId: number;
    bookedByUid?: string | null;
  },
  ownerPatientEmail?: string | null
): boolean {
  if (!principal) return false;
  if (principal.role === 'ADMIN') return true;

  if (principal.role === 'DOCTOR') {
    return (
      principal.doctorId !== null &&
      Number(principal.doctorId) === Number(targetAppointment.doctorId)
    );
  }

  if (principal.role === 'PATIENT') {
    if (
      principal.patientId !== null &&
      Number(principal.patientId) === Number(targetAppointment.patientId)
    ) {
      return true;
    }
    const cleanPrincipalEmail = principal.email.trim().toLowerCase();
    if (
      ownerPatientEmail &&
      ownerPatientEmail.trim().toLowerCase() === cleanPrincipalEmail
    ) {
      return true;
    }
    const bookedUid = (targetAppointment.bookedByUid || '')
      .trim()
      .toLowerCase();
    if (
      bookedUid &&
      (bookedUid === cleanPrincipalEmail ||
        bookedUid === principal.uid.toLowerCase())
    ) {
      return true;
    }
    return false;
  }

  return false;
}
