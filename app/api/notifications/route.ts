import { NextRequest, NextResponse } from 'next/server';
import {
  getAppointmentById,
  getPatientById,
  getAllHospitalData,
  recordManualMessagingAuditLog,
} from '../../../src/db/queries.ts';
import {
  extractTokenFromHeadersAndCookies,
  verifySignedSessionToken,
  requireAdminAccess,
} from '../../../lib/rbac-security.ts';
import {
  MessageTemplateType,
  ManualDeliveryStatus,
  MessagingChannel,
  MANUAL_DELIVERY_STATUS_LABELS,
  normalizePhoneForMessaging,
  generateAppointmentMessage,
  detectSensitiveClinicalContent,
  buildWhatsAppClickToChatUrl,
  buildSmsLinks,
} from '../../../lib/manual-messaging.ts';

export const dynamic = 'force-dynamic';

/**
 * GET /api/notifications?appointmentId=123&template=CONFIRMATION&countryCode=+91
 * Strictly ADMIN-only endpoint that prepares a privacy-safe manual message and
 * returns the official WhatsApp click-to-chat URL and SMS URI.
 */
export async function GET(req: NextRequest) {
  try {
    const rawToken = extractTokenFromHeadersAndCookies(
      req.headers,
      req.cookies.get('sahs_session')?.value
    );
    const principal = verifySignedSessionToken(rawToken);
    const adminCheck = requireAdminAccess(principal);
    if (!adminCheck.allowed) {
      return NextResponse.json(
        { error: adminCheck.error },
        { status: adminCheck.status }
      );
    }

    const { searchParams } = new URL(req.url);
    const appointmentId = Number(searchParams.get('appointmentId'));
    const template = (searchParams.get('template') ||
      'CONFIRMATION') as MessageTemplateType;
    const countryCode = searchParams.get('countryCode') || '+91';

    if (!appointmentId) {
      return NextResponse.json(
        { error: 'Valid appointmentId is required.' },
        { status: 400 }
      );
    }

    const appt = await getAppointmentById(appointmentId);
    if (!appt) {
      return NextResponse.json(
        { error: 'Appointment not found.' },
        { status: 404 }
      );
    }

    const pat = await getPatientById(appt.patientId);
    const all = await getAllHospitalData();
    const doc = all.doctors.find((d) => d.id === appt.doctorId);

    const rawPhone = searchParams.get('phone') || pat?.phone || '';
    const message = generateAppointmentMessage(template, {
      appointmentId: appt.id,
      patientName: pat?.fullName || `Patient #${appt.patientId}`,
      hospitalName: 'SAHS (Smart Appointment & Hospital System)',
      doctorName: doc?.name || `Doctor #${appt.doctorId}`,
      department: doc?.department || doc?.specialty || 'General Medicine',
      appointmentDate: appt.appointmentDate,
      timeSlot: appt.timeSlot,
      roomNumber: doc?.roomNumber,
      visitType: appt.visitType,
    });

    const wa = buildWhatsAppClickToChatUrl(rawPhone, message, countryCode);
    const sms = buildSmsLinks(rawPhone, message, countryCode);

    return NextResponse.json({
      appointmentId: appt.id,
      patientName: pat?.fullName || `Patient #${appt.patientId}`,
      recipientPhone: rawPhone,
      normalizedPhone: wa.normalizedPhone,
      smsReminderConsent: Boolean(appt.smsReminder),
      template,
      message,
      whatsAppUrl: wa.url,
      smsUri: sms.smsUri,
      googleMessagesWebUrl: sms.googleMessagesWebUrl,
      deliveryStatus: 'PREPARED' as ManualDeliveryStatus,
      deliveryStatusLabel: MANUAL_DELIVERY_STATUS_LABELS.PREPARED,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to prepare notification.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/notifications
 * Strictly ADMIN-only endpoint that records honest manual delivery status transitions:
 * - PREPARED ('Message prepared')
 * - APP_OPENED ('Messaging application opened')
 * - MANUALLY_SENT ('Message manually sent' — only when explicitly confirmed by Admin)
 */
export async function POST(req: NextRequest) {
  try {
    const rawToken = extractTokenFromHeadersAndCookies(
      req.headers,
      req.cookies.get('sahs_session')?.value
    );
    const principal = verifySignedSessionToken(rawToken);
    const adminCheck = requireAdminAccess(principal);
    if (!adminCheck.allowed) {
      return NextResponse.json(
        { error: adminCheck.error },
        { status: adminCheck.status }
      );
    }

    const body = await req.json();
    const appointmentId = Number(body.appointmentId);
    const channel: MessagingChannel =
      body.channel === 'SMS' ? 'SMS' : 'WHATSAPP';
    const deliveryStatus: ManualDeliveryStatus =
      body.deliveryStatus === 'MANUALLY_SENT'
        ? 'MANUALLY_SENT'
        : body.deliveryStatus === 'APP_OPENED'
        ? 'APP_OPENED'
        : 'PREPARED';
    const templateType = String(body.templateType || 'CONFIRMATION');
    const defaultCountryCode = String(body.defaultCountryCode || '+91');
    const rawPhone = String(body.recipientPhone || '').trim();
    const message = String(body.message || '').trim();

    if (!appointmentId || !rawPhone || !message) {
      return NextResponse.json(
        {
          error:
            'appointmentId, recipientPhone, and message preview are required.',
        },
        { status: 400 }
      );
    }

    const normalized = normalizePhoneForMessaging(
      rawPhone,
      defaultCountryCode
    );
    if (!normalized.isValid) {
      return NextResponse.json(
        {
          error:
            normalized.error ||
            'Invalid recipient phone number for manual messaging.',
        },
        { status: 400 }
      );
    }

    const appt = await getAppointmentById(appointmentId);
    if (!appt) {
      return NextResponse.json(
        { error: 'Appointment not found.' },
        { status: 404 }
      );
    }

    // Privacy check: ensure clinical diagnosis / medical reports are not included
    const clinicalCheck = detectSensitiveClinicalContent(message, appt.reason);

    const wa = buildWhatsAppClickToChatUrl(
      rawPhone,
      message,
      defaultCountryCode
    );
    const sms = buildSmsLinks(rawPhone, message, defaultCountryCode);

    const logEntry = await recordManualMessagingAuditLog({
      appointmentId,
      channel,
      deliveryStatus,
      templateType,
      recipientPhone: normalized.e164Phone,
      messagePreview: message,
      adminActor: principal?.email || 'SAHS Admin',
    });

    return NextResponse.json({
      success: true,
      deliveryStatus,
      deliveryStatusLabel: MANUAL_DELIVERY_STATUS_LABELS[deliveryStatus],
      channel,
      normalizedPhone: normalized,
      whatsAppUrl: wa.url,
      smsUri: sms.smsUri,
      googleMessagesWebUrl: sms.googleMessagesWebUrl,
      clinicalPrivacyWarning: clinicalCheck.hasSensitiveContent
        ? `Notice: Avoid including clinical terms (${clinicalCheck.matchedTerms.join(', ')}) in external messages.`
        : null,
      logEntry,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to process manual notification action.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
