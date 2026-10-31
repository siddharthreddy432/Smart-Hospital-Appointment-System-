export interface ExportableAppointmentRow {
  id: number;
  appointmentDate: string;
  timeSlot: string;
  patientName: string;
  patientEmail: string;
  patientPhone: string;
  doctorName: string;
  doctorSpecialty: string;
  visitType: string;
  reason: string;
  status: string;
  noShowProbability: number;
  noShowRiskLevel: string;
  smsReminder: boolean;
  clinicalNotes?: string | null;
}

export function escapeCsvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '""';
  const str = String(value);
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

export function generateAppointmentsCsv(rows: ExportableAppointmentRow[]): string {
  const headers = [
    'Appointment ID',
    'Date',
    'Time Slot',
    'Patient Name',
    'Patient Gmail',
    'Patient Phone',
    'Doctor Name',
    'Specialty',
    'Visit Type',
    'Symptom / Reason',
    'Status',
    'No-Show Probability (%)',
    'No-Show Risk Level',
    'SMS/WhatsApp Reminder',
    'Clinical Notes',
  ];

  const headerLine = headers.map((h) => escapeCsvCell(h)).join(',');

  const dataLines = rows.map((row) =>
    [
      row.id,
      row.appointmentDate,
      row.timeSlot,
      row.patientName,
      row.patientEmail,
      row.patientPhone,
      row.doctorName,
      row.doctorSpecialty,
      row.visitType,
      row.reason,
      row.status,
      row.noShowProbability,
      row.noShowRiskLevel,
      row.smsReminder ? 'Enabled' : 'Disabled',
      row.clinicalNotes || '',
    ]
      .map((cell) => escapeCsvCell(cell))
      .join(',')
  );

  return [headerLine, ...dataLines].join('\r\n');
}

export type SymptomCategory =
  | 'fever'
  | 'cold'
  | 'cough'
  | 'headache'
  | 'stomach'
  | 'heart'
  | 'pain'
  | 'rash'
  | 'checkup';

export function detectSymptomCategory(input: string): SymptomCategory {
  const text = (input || '').toLowerCase();
  if (
    text.includes('fever') ||
    text.includes('temperature') ||
    text.includes('chills') ||
    text.includes('hot') ||
    text.includes('viral')
  ) {
    return 'fever';
  }
  if (
    text.includes('cold') ||
    text.includes('sneez') ||
    text.includes('runny nose') ||
    text.includes('flu') ||
    text.includes('sinus') ||
    text.includes('congestion')
  ) {
    return 'cold';
  }
  if (
    text.includes('cough') ||
    text.includes('throat') ||
    text.includes('bronch') ||
    text.includes('wheez') ||
    text.includes('asthma')
  ) {
    return 'cough';
  }
  if (
    text.includes('headache') ||
    text.includes('migraine') ||
    text.includes('dizzy') ||
    text.includes('vertigo') ||
    text.includes('neuro')
  ) {
    return 'headache';
  }
  if (
    text.includes('stomach') ||
    text.includes('nausea') ||
    text.includes('vomit') ||
    text.includes('abdom') ||
    text.includes('digestion') ||
    text.includes('gastric')
  ) {
    return 'stomach';
  }
  if (
    text.includes('heart') ||
    text.includes('chest') ||
    text.includes('cardio') ||
    text.includes('blood pressure') ||
    text.includes('palpitation') ||
    text.includes('ecg')
  ) {
    return 'heart';
  }
  if (
    text.includes('pain') ||
    text.includes('joint') ||
    text.includes('back') ||
    text.includes('knee') ||
    text.includes('fracture') ||
    text.includes('sprain') ||
    text.includes('ortho')
  ) {
    return 'pain';
  }
  if (
    text.includes('rash') ||
    text.includes('skin') ||
    text.includes('allergy') ||
    text.includes('itch') ||
    text.includes('eczema') ||
    text.includes('acne')
  ) {
    return 'rash';
  }
  return 'checkup';
}
