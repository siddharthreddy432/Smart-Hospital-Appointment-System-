import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSyncSessionState,
  recordDeviceHandshake,
  applyFieldDelta,
  resolveFieldConflict,
  generateSyncQrMatrix,
  generateSecurePairingToken,
  hashPairingToken,
  buildProductionPairingUrl,
  generateRealQrCodeDataUrl,
} from './dual-device-sync';

test('creates session in Waiting for scan state and transitions through all pairing states', () => {
  const t0 = 1700000000000;
  let session = createSyncSessionState('SAHS-SYNC-1001', undefined, t0);
  assert.equal(session.pairingStatus, 'Waiting for scan');
  assert.equal(session.desktopConnected, true);
  assert.equal(session.mobileConnected, false);

  // 1. Mobile scans QR code
  session = recordDeviceHandshake(session, 'mobile', 'scan', t0 + 1000);
  assert.equal(session.pairingStatus, 'QR scanned');
  assert.equal(session.mobileScanned, true);

  // 2. Mobile establishes connection while desktop is connected
  session = recordDeviceHandshake(session, 'mobile', 'connect', t0 + 2000);
  assert.equal(session.pairingStatus, 'Both devices connected');
  assert.equal(session.mobileConnected, true);

  // 3. If desktop temporarily disconnects, status reflects single Device connected
  session = recordDeviceHandshake(session, 'desktop', 'disconnect', t0 + 3000);
  assert.equal(session.pairingStatus, 'Device connected');

  // 4. Desktop reconnects -> Both devices connected
  session = recordDeviceHandshake(session, 'desktop', 'connect', t0 + 4000);
  assert.equal(session.pairingStatus, 'Both devices connected');

  // 5. After TTL expires -> Session expired
  const expired = recordDeviceHandshake(
    session,
    'mobile',
    'connect',
    session.expiresAt + 1000
  );
  assert.equal(expired.pairingStatus, 'Session expired');
});

test('two-way real-time field synchronization updates Rahul Sharma, phone, and department', () => {
  const t0 = 1700000000000;
  let session = createSyncSessionState('SAHS-SYNC-2002', undefined, t0);
  session = recordDeviceHandshake(session, 'mobile', 'connect', t0 + 500);

  // Example 1: Patient enters "Rahul Sharma" on smartphone
  const res1 = applyFieldDelta(session, {
    field: 'patientName',
    value: 'Rahul Sharma',
    device: 'mobile',
    baseFieldRevision: session.fieldMeta.patientName.revision,
    now: t0 + 1000,
  });
  assert.equal(res1.conflictDetected, false);
  session = res1.session;
  assert.equal(session.fields.patientName, 'Rahul Sharma');
  assert.equal(session.fieldMeta.patientName.updatedBy, 'mobile');
  assert.equal(session.fieldMeta.patientName.revision, 2);

  // Example 2: Patient enters phone number on desktop
  const res2 = applyFieldDelta(session, {
    field: 'patientPhone',
    value: '+91 98765 43210',
    device: 'desktop',
    baseFieldRevision: session.fieldMeta.patientPhone.revision,
    now: t0 + 2000,
  });
  assert.equal(res2.conflictDetected, false);
  session = res2.session;
  assert.equal(session.fields.patientPhone, '+91 98765 43210');
  assert.equal(session.fieldMeta.patientPhone.updatedBy, 'desktop');

  // Example 3: Patient changes department on smartphone
  const res3 = applyFieldDelta(session, {
    field: 'department',
    value: 'Cardiology & Heart Institute',
    device: 'mobile',
    baseFieldRevision: session.fieldMeta.department.revision,
    now: t0 + 3000,
  });
  assert.equal(res3.conflictDetected, false);
  session = res3.session;
  assert.equal(session.fields.department, 'Cardiology & Heart Institute');
  assert.equal(session.fieldMeta.department.updatedBy, 'mobile');
});

test('simultaneous edits on the same field detect conflict and support explicit resolution', () => {
  const t0 = 1700000000000;
  let session = createSyncSessionState('SAHS-SYNC-3003', undefined, t0);
  session = recordDeviceHandshake(session, 'mobile', 'connect', t0 + 100);

  const initialNameRevision = session.fieldMeta.patientName.revision; // revision 1

  // Desktop updates patientName to "Rahul Sharma (Desktop)" based on revision 1
  const desktopEdit = applyFieldDelta(session, {
    field: 'patientName',
    value: 'Rahul Sharma (Desktop)',
    device: 'desktop',
    baseFieldRevision: initialNameRevision,
    now: t0 + 500,
  });
  assert.equal(desktopEdit.conflictDetected, false);
  session = desktopEdit.session;
  assert.equal(session.fieldMeta.patientName.revision, 2);

  // Mobile simultaneously submits a different patientName based on stale revision 1
  const mobileConcurrentEdit = applyFieldDelta(session, {
    field: 'patientName',
    value: 'Rahul K. Sharma (Mobile)',
    device: 'mobile',
    baseFieldRevision: initialNameRevision, // stale revision 1 < 2
    now: t0 + 700,
  });

  assert.equal(mobileConcurrentEdit.conflictDetected, true);
  session = mobileConcurrentEdit.session;
  assert.ok(session.conflicts.patientName);
  assert.equal(
    session.conflicts.patientName?.desktopValue,
    'Rahul Sharma (Desktop)'
  );
  assert.equal(
    session.conflicts.patientName?.mobileValue,
    'Rahul K. Sharma (Mobile)'
  );

  // Resolve conflict in favor of mobile value
  session = resolveFieldConflict(session, 'patientName', 'mobile', t0 + 1500);
  assert.equal(session.fields.patientName, 'Rahul K. Sharma (Mobile)');
  assert.equal(session.conflicts.patientName, undefined);
  assert.equal(session.fieldMeta.patientName.updatedBy, 'mobile');
});

test('generates deterministic 21x21 QR matrix and real qrcode DataURL for https://sahs.telis.tech/appointment/pair/TEMPORARY_TOKEN', async () => {
  const token = generateSecurePairingToken(24);
  assert.ok(token.length >= 24);
  const hash = hashPairingToken(token);
  assert.equal(hash.length, 64);
  assert.notEqual(hash, token);

  const pairingUrl = buildProductionPairingUrl(token);
  assert.equal(pairingUrl, `https://sahs.telis.tech/appointment/pair/${token}`);

  const dataUrl = await generateRealQrCodeDataUrl(pairingUrl);
  assert.ok(dataUrl.startsWith('data:image/png;base64,'));

  const qr = generateSyncQrMatrix(pairingUrl);
  assert.equal(qr.size, 21);
  assert.equal(qr.matrix[0][0], true);
});

