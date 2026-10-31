import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  issueSignedSessionToken,
  verifySignedSessionToken,
  revokeSessionToken,
  requireAdminAccess,
  canAccessPatientRecord,
  canAccessAppointmentRecord,
} from './rbac-security.ts';

describe('RBAC Security & Patient Data Isolation', () => {
  it('issues and verifies HMAC-SHA256 signed session tokens', () => {
    const token = issueSignedSessionToken({
      uid: 'admin-root',
      email: 'admin@sahs.telis.tech',
      userName: 'Admin',
      role: 'ADMIN',
      patientId: null,
    });

    const verified = verifySignedSessionToken(token);
    assert.ok(verified);
    assert.equal(verified.role, 'ADMIN');
    assert.equal(verified.email, 'admin@sahs.telis.tech');
  });

  it('rejects tampered or revoked tokens', () => {
    const token = issueSignedSessionToken({
      uid: 'pat-a',
      email: 'patient.a@gmail.com',
      userName: 'Patient A',
      role: 'PATIENT',
      patientId: 101,
    });

    const tampered = `${token}tamper`;
    assert.equal(verifySignedSessionToken(tampered), null);

    revokeSessionToken(token);
    assert.equal(verifySignedSessionToken(token), null);
  });

  it('enforces admin-only access for administrative operations', () => {
    const unauthCheck = requireAdminAccess(null);
    assert.equal(unauthCheck.allowed, false);
    assert.equal(unauthCheck.status, 401);

    const patientPrincipal = verifySignedSessionToken(
      issueSignedSessionToken({
        uid: 'pat-a',
        email: 'patient.a@gmail.com',
        userName: 'Patient A',
        role: 'PATIENT',
        patientId: 101,
      })
    );
    const patientCheck = requireAdminAccess(patientPrincipal);
    assert.equal(patientCheck.allowed, false);
    assert.equal(patientCheck.status, 403);

    const adminPrincipal = verifySignedSessionToken(
      issueSignedSessionToken({
        uid: 'admin-1',
        email: 'admin@sahs.telis.tech',
        userName: 'Admin',
        role: 'ADMIN',
      })
    );
    const adminCheck = requireAdminAccess(adminPrincipal);
    assert.equal(adminCheck.allowed, true);
    assert.equal(adminCheck.status, 200);
  });

  it('isolates Patient A and Patient B records from each other while allowing Admin', () => {
    const patientAPrincipal = verifySignedSessionToken(
      issueSignedSessionToken({
        uid: 'uid-a',
        email: 'patient.a@gmail.com',
        userName: 'Patient A',
        role: 'PATIENT',
        patientId: 101,
      })
    );
    const patientBPrincipal = verifySignedSessionToken(
      issueSignedSessionToken({
        uid: 'uid-b',
        email: 'patient.b@gmail.com',
        userName: 'Patient B',
        role: 'PATIENT',
        patientId: 202,
      })
    );
    const adminPrincipal = verifySignedSessionToken(
      issueSignedSessionToken({
        uid: 'admin-1',
        email: 'admin@sahs.telis.tech',
        userName: 'Admin',
        role: 'ADMIN',
      })
    );

    const patientARecord = {
      id: 101,
      email: 'patient.a@gmail.com',
      userUid: 'uid-a',
    };
    const patientBRecord = {
      id: 202,
      email: 'patient.b@gmail.com',
      userUid: 'uid-b',
    };

    // Patient A can access own record, NOT Patient B's record
    assert.equal(canAccessPatientRecord(patientAPrincipal, patientARecord), true);
    assert.equal(canAccessPatientRecord(patientAPrincipal, patientBRecord), false);

    // Patient B can access own record, NOT Patient A's record
    assert.equal(canAccessPatientRecord(patientBPrincipal, patientBRecord), true);
    assert.equal(canAccessPatientRecord(patientBPrincipal, patientARecord), false);

    // Admin can access both
    assert.equal(canAccessPatientRecord(adminPrincipal, patientARecord), true);
    assert.equal(canAccessPatientRecord(adminPrincipal, patientBRecord), true);

    // Appointment isolation
    const apptA = {
      id: 501,
      patientId: 101,
      doctorId: 1,
      bookedByUid: 'patient.a@gmail.com',
    };
    assert.equal(
      canAccessAppointmentRecord(patientAPrincipal, apptA, 'patient.a@gmail.com'),
      true
    );
    assert.equal(
      canAccessAppointmentRecord(patientBPrincipal, apptA, 'patient.a@gmail.com'),
      false
    );
    assert.equal(
      canAccessAppointmentRecord(adminPrincipal, apptA, 'patient.a@gmail.com'),
      true
    );
  });
});
