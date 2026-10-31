import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizePhoneForMessaging,
  generateAppointmentMessage,
  detectSensitiveClinicalContent,
  buildWhatsAppClickToChatUrl,
  buildSmsLinks,
  transitionManualDeliveryStatus,
  MESSAGE_TEMPLATES,
} from './manual-messaging.ts';

describe('Manual WhatsApp & SMS Messaging Module', () => {
  it('normalizes 10-digit Indian phone numbers with default +91 country code', () => {
    const res = normalizePhoneForMessaging('98765 43210', '+91');
    assert.equal(res.isValid, true);
    assert.equal(res.e164Phone, '+919876543210');
    assert.equal(res.waMeDigits, '919876543210');
    assert.equal(res.countryCode, '+91');
  });

  it('normalizes trunk-prefixed 09876543210 Indian numbers', () => {
    const res = normalizePhoneForMessaging('09876543210', '+91');
    assert.equal(res.isValid, true);
    assert.equal(res.e164Phone, '+919876543210');
    assert.equal(res.waMeDigits, '919876543210');
  });

  it('supports international numbers starting with +1 or +44', () => {
    const us = normalizePhoneForMessaging('+1 (415) 555-0199', '+91');
    assert.equal(us.isValid, true);
    assert.equal(us.e164Phone, '+14155550199');
    assert.equal(us.waMeDigits, '14155550199');

    const uk = normalizePhoneForMessaging('+44 7700 900077', '+91');
    assert.equal(uk.isValid, true);
    assert.equal(uk.e164Phone, '+447700900077');
    assert.equal(uk.waMeDigits, '447700900077');
  });

  it('rejects empty or too-short invalid phone numbers', () => {
    const empty = normalizePhoneForMessaging('', '+91');
    assert.equal(empty.isValid, false);

    const shortNum = normalizePhoneForMessaging('1234', '+91');
    assert.equal(shortNum.isValid, false);
  });

  it('generates all 4 reusable appointment templates without leaking clinical diagnoses', () => {
    assert.equal(MESSAGE_TEMPLATES.length, 4);
    const context = {
      appointmentId: 108,
      patientName: 'Aarav Patel',
      hospitalName: 'SAHS (Smart Appointment & Hospital System)',
      doctorName: 'Dr. Elena Rostova',
      department: 'Cardiology Department',
      appointmentDate: '2026-11-05',
      timeSlot: '10:30 AM',
      roomNumber: 'Suite 302',
    };

    for (const tpl of MESSAGE_TEMPLATES) {
      const msg = generateAppointmentMessage(tpl.id, context);
      assert.ok(msg.includes('Aarav Patel'));
      assert.ok(msg.includes('Dr. Elena Rostova'));
      assert.ok(msg.includes('2026-11-05'));
      assert.ok(msg.includes('10:30 AM'));
      // Must not contain diagnoses or clinical notes
      const check = detectSensitiveClinicalContent(msg, 'Acute Arrhythmia');
      assert.equal(check.hasSensitiveContent, false);
    }
  });

  it('detects sensitive clinical terms if manually added to a message', () => {
    const check = detectSensitiveClinicalContent(
      'Hello patient, your biopsy and pathology report for Acute Fever are ready.',
      'Acute Fever'
    );
    assert.equal(check.hasSensitiveContent, true);
    assert.ok(check.matchedTerms.length >= 2);
  });

  it('builds official WhatsApp click-to-chat URL with URL-encoded text', () => {
    const { url, normalizedPhone } = buildWhatsAppClickToChatUrl(
      '9876543210',
      'Hello Aarav, your SAHS appointment is on 2026-11-05 at 10:30 AM.',
      '+91'
    );
    assert.equal(normalizedPhone.isValid, true);
    assert.equal(
      url,
      'https://wa.me/919876543210?text=Hello%20Aarav%2C%20your%20SAHS%20appointment%20is%20on%202026-11-05%20at%2010%3A30%20AM.'
    );
  });

  it('builds SMS fallback URI and Google Messages for Web URL', () => {
    const { smsUri, googleMessagesWebUrl } = buildSmsLinks(
      '+91 98765 43210',
      'Appointment reminder at 10:30 AM',
      '+91'
    );
    assert.equal(
      smsUri,
      'sms:+919876543210?body=Appointment%20reminder%20at%2010%3A30%20AM'
    );
    assert.equal(
      googleMessagesWebUrl,
      'https://messages.google.com/web/conversations'
    );
  });

  it('enforces honest delivery status lifecycle and never auto-marks opened links as Sent', () => {
    const prepared = transitionManualDeliveryStatus('PREPARED', 'PREPARE');
    assert.equal(prepared.status, 'PREPARED');
    assert.equal(prepared.label, 'Message prepared');

    const waOpened = transitionManualDeliveryStatus(
      prepared.status,
      'OPEN_WHATSAPP'
    );
    assert.equal(waOpened.status, 'APP_OPENED');
    assert.equal(waOpened.label, 'Messaging application opened');

    const smsOpened = transitionManualDeliveryStatus(
      prepared.status,
      'OPEN_SMS'
    );
    assert.equal(smsOpened.status, 'APP_OPENED');
    assert.equal(smsOpened.label, 'Messaging application opened');

    const manuallyConfirmed = transitionManualDeliveryStatus(
      waOpened.status,
      'CONFIRM_MANUAL_SEND'
    );
    assert.equal(manuallyConfirmed.status, 'MANUALLY_SENT');
    assert.equal(manuallyConfirmed.label, 'Message manually sent');
  });
});
