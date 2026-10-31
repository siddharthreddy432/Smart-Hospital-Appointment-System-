import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateCheckInCode,
  generateAppointmentQrPass,
  encodeAdminOnlyPatientQrPayload,
  decodeAndVerifyAdminQrPayload,
} from './qr-checkin';

test('generateCheckInCode produces deterministic SAHS check-in code', () => {
  const input = {
    appointmentId: 42,
    patientName: 'Rahul Sharma',
    patientEmail: 'patient.care@example.com',
    doctorName: 'Dr. Elena Rostova',
    appointmentDate: '2026-11-04',
    timeSlot: '10:00 AM',
  };

  const code1 = generateCheckInCode(input);
  const code2 = generateCheckInCode(input);
  assert.equal(code1, code2);
  assert.ok(code1.startsWith('SAHS-0042-'));
});

test('generateAppointmentQrPass builds 21x21 QR matrix with intact finder patterns and scannableMatrix', () => {
  const pass = generateAppointmentQrPass({
    appointmentId: 101,
    patientName: 'Rahul Sharma',
    patientEmail: 'patient.care@example.com',
    patientPhone: '+91 98765 43210',
    patientAge: 28,
    patientGender: 'Male',
    bloodGroup: 'O+',
    doctorName: 'Dr. Elena Rostova',
    doctorSpecialty: 'Cardiology',
    roomNumber: 'Suite 204',
    appointmentDate: '2026-11-04',
    timeSlot: '10:00 AM',
    visitType: 'In-Person',
    reason: 'Cardiac Checkup',
    status: 'Scheduled',
  });

  assert.equal(pass.size, 21);
  assert.equal(pass.matrix.length, 21);
  assert.equal(pass.matrix[0].length, 21);
  assert.ok(pass.scannableMatrix.length >= 21);

  // Top-left finder pattern corners and center must be true (dark module)
  assert.equal(pass.matrix[0][0], true);
  assert.equal(pass.matrix[0][6], true);
  assert.equal(pass.matrix[3][3], true);
  // Top-left finder inner separator (1,1) must be false (light module)
  assert.equal(pass.matrix[1][1], false);

  // Top-right finder pattern center (3, 17) must be true
  assert.equal(pass.matrix[3][17], true);

  // Bottom-left finder pattern center (17, 3) must be true
  assert.equal(pass.matrix[17][3], true);
});

test('encodeAdminOnlyPatientQrPayload and decodeAndVerifyAdminQrPayload round-trip full patient details for Admin Scanner only', () => {
  const input = {
    appointmentId: 77,
    patientName: 'Rahul Sharma',
    patientEmail: 'rahul.sharma@gmail.com',
    patientPhone: '+91 98111 22334',
    patientAge: 34,
    patientGender: 'Male',
    bloodGroup: 'B+',
    doctorName: 'Dr. Priya Nair',
    doctorSpecialty: 'Internal Medicine',
    roomNumber: 'Suite 105',
    appointmentDate: '2026-11-08',
    timeSlot: '11:00 AM',
    visitType: 'In-Person',
    reason: '[Internal Medicine] High Fever & Chills',
    status: 'Scheduled',
  };

  const encoded = encodeAdminOnlyPatientQrPayload(input);
  assert.ok(encoded.adminQrToken.startsWith('SAHS-ADMIN-QR-V3::'));
  // Ensure raw patient name and email are encrypted/obfuscated in the QR token so Google Scanner cannot read plain text
  assert.equal(encoded.adminQrToken.includes('Rahul Sharma'), false);
  assert.equal(encoded.adminQrToken.includes('rahul.sharma@gmail.com'), false);

  const decoded = decodeAndVerifyAdminQrPayload(encoded.adminQrToken);
  assert.equal(decoded.valid, true);
  assert.ok(decoded.details);
  assert.equal(decoded.details.appointmentId, 77);
  assert.equal(decoded.details.patientName, 'Rahul Sharma');
  assert.equal(decoded.details.patientEmail, 'rahul.sharma@gmail.com');
  assert.equal(decoded.details.patientPhone, '+91 98111 22334');
  assert.equal(decoded.details.bloodGroup, 'B+');
  assert.equal(decoded.details.doctorName, 'Dr. Priya Nair');
  assert.equal(
    decoded.details.accessPolicy,
    'ADMIN_DASHBOARD_ONLY_DENY_GOOGLE_SCANNER'
  );

  // Also test decoding from publicDenyUrl when pasted into Admin Portal
  const decodedFromUrl = decodeAndVerifyAdminQrPayload(encoded.publicDenyUrl);
  assert.equal(decodedFromUrl.valid, true);
  assert.equal(decodedFromUrl.details?.patientName, 'Rahul Sharma');

  // Tampered signature must be rejected
  const tampered = encoded.adminQrToken.slice(0, -4) + 'ffff';
  const tamperedResult = decodeAndVerifyAdminQrPayload(tampered);
  assert.equal(tamperedResult.valid, false);
});
