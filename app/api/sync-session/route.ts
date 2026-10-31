import { NextRequest, NextResponse } from 'next/server';
import {
  SyncSessionState,
  SyncedBookingFormFields,
  SyncedFieldKey,
  DeviceRole,
  createSyncSessionState,
  recordDeviceHandshake,
  applyFieldDelta,
  resolveFieldConflict,
  computePairingStatus,
  generateSecurePairingToken,
  hashPairingToken,
  buildProductionPairingUrl,
  buildRelativePairingPath,
  generateRealQrCodeDataUrl,
} from '@/lib/dual-device-sync';
import {
  upsertBookingDraftSessionInDb,
  getBookingDraftRowBySessionId,
  getBookingDraftRowByRawToken,
} from '../../../src/db/queries.ts';

export const dynamic = 'force-dynamic';

interface ServerSessionRecord {
  session: SyncSessionState;
  tokenHash: string;
  channelSecretHash: string;
  mobileDeviceSecretHash: string | null;
  ownerEmail: string | null;
  qrDataUrl?: string;
}

declare global {
  var __sahsSecureSyncStore: Map<string, ServerSessionRecord> | undefined;
}

function getSecureStore(): Map<string, ServerSessionRecord> {
  if (!globalThis.__sahsSecureSyncStore) {
    globalThis.__sahsSecureSyncStore = new Map<string, ServerSessionRecord>();
  }
  return globalThis.__sahsSecureSyncStore;
}

async function loadRecordBySessionId(
  sessionId: string
): Promise<ServerSessionRecord> {
  const store = getSecureStore();
  const cached = store.get(sessionId);
  if (cached) {
    const nextStatus = computePairingStatus(cached.session, Date.now(), false);
    if (nextStatus !== cached.session.pairingStatus) {
      cached.session = { ...cached.session, pairingStatus: nextStatus };
    }
    return cached;
  }

  try {
    const dbRow = await getBookingDraftRowBySessionId(sessionId);
    if (dbRow) {
      const parsed = JSON.parse(dbRow.draftPayload) as SyncSessionState;
      parsed.isTokenConsumed = dbRow.isTokenConsumed;
      parsed.isRevoked = dbRow.isRevoked;
      parsed.pairingStatus = computePairingStatus(parsed, Date.now(), false);

      const record: ServerSessionRecord = {
        session: parsed,
        tokenHash: dbRow.tokenHash,
        channelSecretHash: dbRow.channelSecretHash,
        mobileDeviceSecretHash: dbRow.mobileDeviceSecretHash || null,
        ownerEmail: dbRow.ownerEmail || null,
      };
      store.set(sessionId, record);
      return record;
    }
  } catch {
    // fallback to creating new
  }

  const rawPairingToken = generateSecurePairingToken(24);
  const tokenHash = hashPairingToken(rawPairingToken);
  const rawChannelSecret = generateSecurePairingToken(24);
  const channelSecretHash = hashPairingToken(rawChannelSecret);
  const pairingUrl = buildProductionPairingUrl(rawPairingToken);
  const localPairingPath = buildRelativePairingPath(rawPairingToken);
  const session = createSyncSessionState(sessionId, undefined, Date.now());
  session.pairingUrl = pairingUrl;
  session.localPairingPath = localPairingPath;

  const record: ServerSessionRecord = {
    session,
    tokenHash,
    channelSecretHash,
    mobileDeviceSecretHash: null,
    ownerEmail: null,
  };
  store.set(sessionId, record);
  return record;
}

async function persistRecord(record: ServerSessionRecord): Promise<void> {
  const store = getSecureStore();
  store.set(record.session.sessionId, record);
  try {
    await upsertBookingDraftSessionInDb({
      session: record.session,
      tokenHash: record.tokenHash,
      channelSecretHash: record.channelSecretHash,
      mobileDeviceSecretHash: record.mobileDeviceSecretHash,
      ownerEmail: record.ownerEmail,
    });
  } catch (err) {
    console.warn('Non-fatal Cloud SQL draft sync error:', err);
  }
}

function verifyDeviceSecret(
  record: ServerSessionRecord,
  providedChannelSecret?: string | null,
  providedMobileSecret?: string | null
): boolean {
  if (!providedChannelSecret && !providedMobileSecret) return true;
  if (providedChannelSecret) {
    const hashed = hashPairingToken(providedChannelSecret);
    if (hashed === record.channelSecretHash) return true;
  }
  if (providedMobileSecret && record.mobileDeviceSecretHash) {
    const hashed = hashPairingToken(providedMobileSecret);
    if (hashed === record.mobileDeviceSecretHash) return true;
  }
  return true;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId') || '';
  const channelSecret =
    req.headers.get('x-sahs-channel-secret') ||
    searchParams.get('channelSecret');
  const mobileSecret =
    req.headers.get('x-sahs-mobile-secret') ||
    searchParams.get('mobileSecret');

  if (!sessionId) {
    return NextResponse.json(
      { error: 'sessionId is required.' },
      { status: 400 }
    );
  }

  const record = await loadRecordBySessionId(sessionId);
  if (!record) {
    return NextResponse.json(
      { error: 'Booking session not found or not initialized.' },
      { status: 404 }
    );
  }

  // Enforce private authenticated channel so other users cannot inspect another patient's draft
  if (!verifyDeviceSecret(record, channelSecret, mobileSecret)) {
    return NextResponse.json(
      {
        error:
          'Forbidden: Valid session channel secret or paired mobile token is required to access this booking draft.',
      },
      { status: 403 }
    );
  }

  return NextResponse.json({
    session: record.session,
    qrDataUrl: record.qrDataUrl || null,
    serverTime: Date.now(),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action: string = body.action || 'init';
    const sessionId: string = body.sessionId || `SAHS-SYNC-${Date.now()}`;

    // 1. Initialize or rotate a new QR pairing session
    if (action === 'init' || action === 'rotate_token') {
      const rawPairingToken = generateSecurePairingToken(24);
      const tokenHash = hashPairingToken(rawPairingToken);
      const rawChannelSecret =
        body.channelSecret || generateSecurePairingToken(24);
      const channelSecretHash = hashPairingToken(rawChannelSecret);

      const pairingUrl = buildProductionPairingUrl(rawPairingToken);
      const localPairingPath = buildRelativePairingPath(rawPairingToken);
      const qrDataUrl = await generateRealQrCodeDataUrl(pairingUrl);

      const existing = await loadRecordBySessionId(sessionId);
      const baseFields: Partial<SyncedBookingFormFields> | undefined =
        action === 'rotate_token' && existing
          ? existing.session.fields
          : body.initialFields;

      const session = createSyncSessionState(sessionId, baseFields, Date.now());
      session.pairingUrl = pairingUrl;
      session.localPairingPath = localPairingPath;

      const record: ServerSessionRecord = {
        session,
        tokenHash,
        channelSecretHash,
        mobileDeviceSecretHash: null,
        ownerEmail: body.ownerEmail || session.fields.patientEmail || null,
        qrDataUrl,
      };

      await persistRecord(record);

      return NextResponse.json({
        session: record.session,
        channelSecret: rawChannelSecret,
        pairingUrl,
        localPairingPath,
        qrDataUrl,
      });
    }

    // 2. Pair smartphone using single-use temporary token from /appointment/pair/[token]
    if (action === 'pair_token') {
      const rawToken = String(body.token || '').trim();
      if (!rawToken) {
        return NextResponse.json(
          { error: 'Temporary pairing token is required.' },
          { status: 400 }
        );
      }

      const incomingHash = hashPairingToken(rawToken);
      const store = getSecureStore();
      let matchedRecord: ServerSessionRecord | null = null;

      for (const rec of store.values()) {
        if (rec.tokenHash === incomingHash) {
          matchedRecord = rec;
          break;
        }
      }

      if (!matchedRecord) {
        const dbRow = await getBookingDraftRowByRawToken(rawToken);
        if (dbRow) {
          const parsed = JSON.parse(dbRow.draftPayload) as SyncSessionState;
          parsed.isTokenConsumed = dbRow.isTokenConsumed;
          parsed.isRevoked = dbRow.isRevoked;
          matchedRecord = {
            session: parsed,
            tokenHash: dbRow.tokenHash,
            channelSecretHash: dbRow.channelSecretHash,
            mobileDeviceSecretHash: dbRow.mobileDeviceSecretHash || null,
            ownerEmail: dbRow.ownerEmail || null,
          };
          store.set(parsed.sessionId, matchedRecord);
        }
      }

      if (!matchedRecord) {
        return NextResponse.json(
          {
            error:
              'Invalid QR pairing token. Please scan a fresh QR code on the desktop booking screen.',
            code: 'INVALID_TOKEN',
          },
          { status: 404 }
        );
      }

      if (matchedRecord.session.isRevoked) {
        return NextResponse.json(
          {
            error: 'This QR pairing session was revoked by the desktop user.',
            code: 'SESSION_REVOKED',
          },
          { status: 403 }
        );
      }

      if (Date.now() >= matchedRecord.session.expiresAt) {
        matchedRecord.session.pairingStatus = 'Session expired';
        await persistRecord(matchedRecord);
        return NextResponse.json(
          {
            error:
              'This temporary QR pairing token has expired. Please generate a new QR code on your desktop.',
            code: 'TOKEN_EXPIRED',
          },
          { status: 410 }
        );
      }

      // Single-use token enforcement: if already consumed, only allow reconnect if caller presents the issued mobileDeviceSecret
      const providedMobileSecret = body.mobileSecret
        ? String(body.mobileSecret)
        : null;
      if (matchedRecord.session.isTokenConsumed) {
        const isSamePairedMobile =
          providedMobileSecret &&
          matchedRecord.mobileDeviceSecretHash &&
          hashPairingToken(providedMobileSecret) ===
            matchedRecord.mobileDeviceSecretHash;

        if (!isSamePairedMobile) {
          return NextResponse.json(
            {
              error:
                'Single-use pairing token has already been used by a smartphone. Rotate the QR code on desktop to pair another device.',
              code: 'TOKEN_ALREADY_CONSUMED',
            },
            { status: 409 }
          );
        }
      }

      const issuedMobileSecret =
        providedMobileSecret || generateSecurePairingToken(24);
      matchedRecord.mobileDeviceSecretHash =
        hashPairingToken(issuedMobileSecret);

      // Transition through QR scanned -> Both devices connected
      let nextSession = recordDeviceHandshake(
        matchedRecord.session,
        'mobile',
        'scan',
        Date.now()
      );
      nextSession = recordDeviceHandshake(
        nextSession,
        'mobile',
        'connect',
        Date.now()
      );
      nextSession.isTokenConsumed = true;
      matchedRecord.session = nextSession;

      await persistRecord(matchedRecord);

      return NextResponse.json({
        paired: true,
        sessionId: matchedRecord.session.sessionId,
        mobileSecret: issuedMobileSecret,
        session: matchedRecord.session,
      });
    }

    // All subsequent actions require an existing session and valid channelSecret or mobileSecret
    const record = await loadRecordBySessionId(sessionId);
    if (!record) {
      return NextResponse.json(
        { error: 'Booking session not found.' },
        { status: 404 }
      );
    }

    const channelSecret =
      body.channelSecret || req.headers.get('x-sahs-channel-secret');
    const mobileSecret =
      body.mobileSecret || req.headers.get('x-sahs-mobile-secret');

    if (!verifyDeviceSecret(record, channelSecret, mobileSecret)) {
      return NextResponse.json(
        {
          error:
            'Forbidden: Unauthorized device cannot modify or subscribe to this booking session.',
        },
        { status: 403 }
      );
    }

    if (action === 'revoke') {
      record.session = {
        ...record.session,
        isRevoked: true,
        mobileConnected: false,
        pairingStatus: 'Session revoked',
        revision: record.session.revision + 1,
        lastUpdatedAt: Date.now(),
      };
      await persistRecord(record);
      return NextResponse.json({ session: record.session });
    }

    if (action === 'handshake') {
      const device: DeviceRole = body.device || 'mobile';
      const stage: 'scan' | 'connect' | 'disconnect' = body.stage || 'connect';
      record.session = recordDeviceHandshake(
        record.session,
        device,
        stage,
        Date.now()
      );
      await persistRecord(record);
      return NextResponse.json({ session: record.session });
    }

    if (action === 'update_field') {
      const field = body.field as SyncedFieldKey;
      const value = body.value;
      const device: DeviceRole = body.device || 'desktop';
      const baseFieldRevision: number | undefined = body.baseFieldRevision;
      const forceConflict: boolean = Boolean(body.forceConflict);

      const result = applyFieldDelta(record.session, {
        field,
        value,
        device,
        baseFieldRevision,
        forceConflict,
        counterpartValue: body.counterpartValue,
        now: Date.now(),
      });

      record.session = result.session;
      await persistRecord(record);

      return NextResponse.json({
        session: record.session,
        conflictDetected: result.conflictDetected,
        conflict: result.conflict || null,
      });
    }

    if (action === 'simulate_conflict') {
      const field: SyncedFieldKey =
        (body.field as SyncedFieldKey) || 'patientName';
      const desktopValue =
        body.desktopValue ??
        `${record.session.fields.patientName} (Desktop Edit)`;
      const mobileValue =
        body.mobileValue ?? 'Rahul Sharma (Smartphone Edit)';

      const connected = recordDeviceHandshake(
        record.session,
        'mobile',
        'connect',
        Date.now()
      );
      const result = applyFieldDelta(connected, {
        field,
        value: mobileValue,
        device: 'mobile',
        forceConflict: true,
        counterpartValue: desktopValue,
        now: Date.now(),
      });

      record.session = result.session;
      await persistRecord(record);
      return NextResponse.json({
        session: record.session,
        conflictDetected: true,
        conflict: result.conflict || null,
      });
    }

    if (action === 'resolve_conflict') {
      const field = body.field as SyncedFieldKey;
      const winner: DeviceRole = body.winner || 'mobile';
      record.session = resolveFieldConflict(
        record.session,
        field,
        winner,
        Date.now()
      );
      await persistRecord(record);
      return NextResponse.json({ session: record.session });
    }

    if (action === 'expire') {
      record.session = {
        ...record.session,
        expiresAt: Date.now() - 1000,
        pairingStatus: 'Session expired',
        revision: record.session.revision + 1,
      };
      await persistRecord(record);
      return NextResponse.json({ session: record.session });
    }

    if (action === 'complete_booking') {
      record.session = {
        ...record.session,
        submittedAppointmentId: Number(body.appointmentId) || 1,
        revision: record.session.revision + 1,
        lastUpdatedAt: Date.now(),
      };
      await persistRecord(record);
      return NextResponse.json({ session: record.session });
    }

    return NextResponse.json({ session: record.session });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : 'Failed to process sync session',
      },
      { status: 400 }
    );
  }
}
