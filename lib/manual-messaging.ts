export type MessageTemplateType =
  | 'CONFIRMATION'
  | 'REMINDER'
  | 'RESCHEDULED'
  | 'CANCELLED';

export type MessagingChannel = 'WHATSAPP' | 'SMS';

export type ManualDeliveryStatus =
  | 'PREPARED'
  | 'APP_OPENED'
  | 'MANUALLY_SENT';

export const MANUAL_DELIVERY_STATUS_LABELS: Record<
  ManualDeliveryStatus,
  'Message prepared' | 'Messaging application opened' | 'Message manually sent'
> = {
  PREPARED: 'Message prepared',
  APP_OPENED: 'Messaging application opened',
  MANUALLY_SENT: 'Message manually sent',
};

export interface NormalizedPhoneResult {
  isValid: boolean;
  e164Phone: string;
  waMeDigits: string;
  countryCode: string;
  nationalNumber: string;
  error?: string;
}

export interface AppointmentMessageContext {
  appointmentId: number;
  patientName: string;
  hospitalName?: string;
  doctorName: string;
  department: string;
  appointmentDate: string;
  timeSlot: string;
  roomNumber?: string;
  visitType?: string;
}

export interface MessageTemplateDefinition {
  id: MessageTemplateType;
  label: string;
  description: string;
}

export const MESSAGE_TEMPLATES: MessageTemplateDefinition[] = [
  {
    id: 'CONFIRMATION',
    label: 'Appointment confirmation',
    description: 'Confirms scheduled date, time, doctor, and department.',
  },
  {
    id: 'REMINDER',
    label: 'Appointment reminder',
    description: 'Upcoming visit reminder with arrival time and room details.',
  },
  {
    id: 'RESCHEDULED',
    label: 'Appointment rescheduled',
    description: 'Notifies patient of updated appointment date and time slot.',
  },
  {
    id: 'CANCELLED',
    label: 'Appointment cancelled',
    description: 'Informs patient that the appointment has been cancelled.',
  },
];

export const GOOGLE_MESSAGES_WEB_URL =
  'https://messages.google.com/web/conversations';

/**
 * Validates and normalizes phone numbers for WhatsApp click-to-chat and SMS links.
 * Default country code is +91 (India), while preserving international numbers (+1, +44, etc.).
 */
export function normalizePhoneForMessaging(
  rawPhone: string,
  defaultCountryCode: string = '+91'
): NormalizedPhoneResult {
  const trimmed = (rawPhone || '').trim();
  const cleanDefaultCcDigits =
    defaultCountryCode.replace(/\D/g, '') || '91';

  if (!trimmed) {
    return {
      isValid: false,
      e164Phone: '',
      waMeDigits: '',
      countryCode: `+${cleanDefaultCcDigits}`,
      nationalNumber: '',
      error: 'Recipient phone number is required.',
    };
  }

  // Detect explicit international prefix (+ or 00)
  const hasPlusPrefix = trimmed.startsWith('+');
  const hasDoubleZeroPrefix = trimmed.startsWith('00');
  const digitsOnly = trimmed.replace(/\D/g, '');

  if (!digitsOnly) {
    return {
      isValid: false,
      e164Phone: '',
      waMeDigits: '',
      countryCode: `+${cleanDefaultCcDigits}`,
      nationalNumber: '',
      error: 'Phone number must contain numeric digits.',
    };
  }

  let fullDigits = digitsOnly;
  let detectedCountryCode = cleanDefaultCcDigits;
  let nationalNumber = digitsOnly;

  if (hasPlusPrefix) {
    fullDigits = digitsOnly;
    // Special case: US/Canada +1 followed by 10 digits, or India +91 followed by 10 digits
    if (fullDigits.startsWith('91') && fullDigits.length === 12) {
      detectedCountryCode = '91';
      nationalNumber = fullDigits.slice(2);
    } else if (fullDigits.startsWith('1') && fullDigits.length === 11) {
      detectedCountryCode = '1';
      nationalNumber = fullDigits.slice(1);
    } else if (fullDigits.length > 10) {
      const ccLen = Math.min(3, fullDigits.length - 10);
      detectedCountryCode = fullDigits.slice(0, ccLen);
      nationalNumber = fullDigits.slice(ccLen);
    }
  } else if (hasDoubleZeroPrefix) {
    fullDigits = digitsOnly.slice(2);
    if (fullDigits.length > 10) {
      const ccLen = Math.min(3, fullDigits.length - 10);
      detectedCountryCode = fullDigits.slice(0, ccLen);
      nationalNumber = fullDigits.slice(ccLen);
    }
  } else {
    // No explicit + or 00 prefix:
    // Strip a single leading trunk '0' if followed by 10 digits (e.g. 09876543210 in India)
    if (digitsOnly.length === 11 && digitsOnly.startsWith('0')) {
      nationalNumber = digitsOnly.slice(1);
      detectedCountryCode = cleanDefaultCcDigits;
      fullDigits = `${detectedCountryCode}${nationalNumber}`;
    } else if (digitsOnly.length === 10) {
      nationalNumber = digitsOnly;
      detectedCountryCode = cleanDefaultCcDigits;
      fullDigits = `${detectedCountryCode}${nationalNumber}`;
    } else if (
      digitsOnly.length === 12 &&
      digitsOnly.startsWith(cleanDefaultCcDigits)
    ) {
      detectedCountryCode = cleanDefaultCcDigits;
      nationalNumber = digitsOnly.slice(cleanDefaultCcDigits.length);
      fullDigits = digitsOnly;
    } else if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
      detectedCountryCode = '1';
      nationalNumber = digitsOnly.slice(1);
      fullDigits = digitsOnly;
    } else {
      fullDigits =
        digitsOnly.length < 10
          ? digitsOnly
          : `${cleanDefaultCcDigits}${digitsOnly}`;
    }
  }

  // E.164 requires between 7 and 15 total digits (including country code)
  if (fullDigits.length < 8 || fullDigits.length > 15) {
    return {
      isValid: false,
      e164Phone: `+${fullDigits}`,
      waMeDigits: fullDigits,
      countryCode: `+${detectedCountryCode}`,
      nationalNumber,
      error:
        'Enter a valid phone number (10-digit local number or international format e.g. +91 98765 43210).',
    };
  }

  return {
    isValid: true,
    e164Phone: `+${fullDigits}`,
    waMeDigits: fullDigits,
    countryCode: `+${detectedCountryCode}`,
    nationalNumber,
  };
}

/**
 * Generates a privacy-safe appointment message from a reusable template.
 * Strictly excludes diagnoses, medical reports, visit reasons, or clinical notes.
 */
export function generateAppointmentMessage(
  template: MessageTemplateType,
  ctx: AppointmentMessageContext
): string {
  const patientName = (ctx.patientName || 'Patient').trim();
  const hospitalName = (
    ctx.hospitalName || 'SAHS (Smart Appointment & Hospital System)'
  ).trim();
  const doctorName = (ctx.doctorName || 'Attending Physician').trim();
  const department = (ctx.department || 'General Medicine').trim();
  const date = (ctx.appointmentDate || 'Scheduled Date').trim();
  const time = (ctx.timeSlot || 'Scheduled Time').trim();
  const room = ctx.roomNumber ? ` (${ctx.roomNumber.trim()})` : '';

  switch (template) {
    case 'CONFIRMATION':
      return `Hello ${patientName}, your appointment at ${hospitalName} is confirmed with ${doctorName} (${department}${room}) on ${date} at ${time}. Please arrive 10 minutes early. Reply if you need assistance.`;

    case 'REMINDER':
      return `Reminder from ${hospitalName}: Hello ${patientName}, you have an upcoming appointment with ${doctorName} (${department}${room}) on ${date} at ${time}. Please bring your appointment ID #${ctx.appointmentId} for reception check-in.`;

    case 'RESCHEDULED':
      return `Hello ${patientName}, your appointment at ${hospitalName} with ${doctorName} (${department}${room}) has been rescheduled to ${date} at ${time} (Ref #${ctx.appointmentId}). Please contact reception if you require another slot.`;

    case 'CANCELLED':
      return `Hello ${patientName}, your appointment #${ctx.appointmentId} at ${hospitalName} with ${doctorName} (${department}) scheduled for ${date} at ${time} has been cancelled. You may book a new slot anytime on the SAHS portal.`;

    default:
      return `Hello ${patientName}, update from ${hospitalName} regarding your appointment #${ctx.appointmentId} with ${doctorName} (${department}) on ${date} at ${time}.`;
  }
}

/**
 * Checks whether a message draft contains sensitive clinical terms or patient diagnoses
 * so the Admin Portal can warn or prevent clinical leakage.
 */
export function detectSensitiveClinicalContent(
  message: string,
  appointmentReason?: string
): { hasSensitiveContent: boolean; matchedTerms: string[] } {
  const lower = (message || '').toLowerCase();
  const defaultClinicalKeywords = [
    'diagnosis',
    'biopsy',
    'hiv',
    'psychiatric',
    'pathology report',
    'lab result',
    'prescription dosage',
    'malignancy',
  ];

  const matched: string[] = [];
  for (const term of defaultClinicalKeywords) {
    if (lower.includes(term)) {
      matched.push(term);
    }
  }

  const cleanReason = (appointmentReason || '').trim().toLowerCase();
  if (cleanReason && cleanReason.length >= 4 && lower.includes(cleanReason)) {
    matched.push(`clinical reason ("${appointmentReason?.trim()}")`);
  }

  return {
    hasSensitiveContent: matched.length > 0,
    matchedTerms: matched,
  };
}

/**
 * Builds the official WhatsApp Click-to-Chat URL:
 * https://wa.me/{country_code_and_phone}?text={url_encoded_message}
 */
export function buildWhatsAppClickToChatUrl(
  rawPhone: string,
  message: string,
  defaultCountryCode: string = '+91'
): { url: string | null; normalizedPhone: NormalizedPhoneResult } {
  const normalizedPhone = normalizePhoneForMessaging(
    rawPhone,
    defaultCountryCode
  );
  const trimmedMsg = (message || '').trim();

  if (!normalizedPhone.isValid || !trimmedMsg) {
    return { url: null, normalizedPhone };
  }

  const encodedText = encodeURIComponent(trimmedMsg);
  const url = `https://wa.me/${normalizedPhone.waMeDigits}?text=${encodedText}`;
  return { url, normalizedPhone };
}

/**
 * Builds the standard SMS URI (sms:{phone}?body={encoded_message}) and Google Messages Web link.
 */
export function buildSmsLinks(
  rawPhone: string,
  message: string,
  defaultCountryCode: string = '+91'
): {
  smsUri: string | null;
  googleMessagesWebUrl: string;
  normalizedPhone: NormalizedPhoneResult;
} {
  const normalizedPhone = normalizePhoneForMessaging(
    rawPhone,
    defaultCountryCode
  );
  const trimmedMsg = (message || '').trim();

  if (!normalizedPhone.isValid || !trimmedMsg) {
    return {
      smsUri: null,
      googleMessagesWebUrl: GOOGLE_MESSAGES_WEB_URL,
      normalizedPhone,
    };
  }

  const encodedBody = encodeURIComponent(trimmedMsg);
  const smsUri = `sms:${normalizedPhone.e164Phone}?body=${encodedBody}`;

  return {
    smsUri,
    googleMessagesWebUrl: GOOGLE_MESSAGES_WEB_URL,
    normalizedPhone,
  };
}

/**
 * Enforces honest delivery status transitions.
 * Opening WhatsApp or SMS NEVER sets status to 'MANUALLY_SENT'.
 * Only explicit admin confirmation transitions to 'MANUALLY_SENT'.
 */
export function transitionManualDeliveryStatus(
  currentStatus: ManualDeliveryStatus,
  action:
    | 'PREPARE'
    | 'EDIT'
    | 'OPEN_WHATSAPP'
    | 'OPEN_SMS'
    | 'CONFIRM_MANUAL_SEND'
): {
  status: ManualDeliveryStatus;
  label: 'Message prepared' | 'Messaging application opened' | 'Message manually sent';
} {
  switch (action) {
    case 'PREPARE':
    case 'EDIT':
      return {
        status: 'PREPARED',
        label: MANUAL_DELIVERY_STATUS_LABELS.PREPARED,
      };
    case 'OPEN_WHATSAPP':
    case 'OPEN_SMS':
      return {
        status: 'APP_OPENED',
        label: MANUAL_DELIVERY_STATUS_LABELS.APP_OPENED,
      };
    case 'CONFIRM_MANUAL_SEND':
      return {
        status: 'MANUALLY_SENT',
        label: MANUAL_DELIVERY_STATUS_LABELS.MANUALLY_SENT,
      };
    default:
      return {
        status: currentStatus,
        label: MANUAL_DELIVERY_STATUS_LABELS[currentStatus],
      };
  }
}
