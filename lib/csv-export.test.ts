import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateAppointmentsCsv,
  detectSymptomCategory,
  escapeCsvCell,
} from './csv-export';

test('escapeCsvCell wraps values in quotes and escapes double quotes', () => {
  assert.equal(escapeCsvCell('Siddharth "Admin" Reddy'), '"Siddharth ""Admin"" Reddy"');
  assert.equal(escapeCsvCell(42), '"42"');
  assert.equal(escapeCsvCell(null), '""');
});

test('generateAppointmentsCsv outputs headers and formatted appointment rows', () => {
  const csv = generateAppointmentsCsv([
    {
      id: 101,
      appointmentDate: '2026-11-05',
      timeSlot: '10:00 AM',
      patientName: 'Siddharth Reddy',
      patientEmail: 'siddharthreddy432@gmail.com',
      patientPhone: '+1 415-555-0199',
      doctorName: 'Dr. Kabir Verma',
      doctorSpecialty: 'General Medicine',
      visitType: 'In-Person',
      reason: 'High Fever & Chills',
      status: 'Scheduled',
      noShowProbability: 14,
      noShowRiskLevel: 'Low',
      smsReminder: true,
      clinicalNotes: 'Patient requested morning slot',
    },
  ]);

  const lines = csv.split('\r\n');
  assert.equal(lines.length, 2);
  assert.ok(lines[0].includes('"Appointment ID"'));
  assert.ok(lines[0].includes('"Patient Gmail"'));
  assert.ok(lines[1].includes('"101"'));
  assert.ok(lines[1].includes('"siddharthreddy432@gmail.com"'));
  assert.ok(lines[1].includes('"High Fever & Chills"'));
  assert.ok(lines[1].includes('"Enabled"'));
});

test('detectSymptomCategory accurately maps fever, cold, cough, headache, and checkup', () => {
  assert.equal(detectSymptomCategory('High fever and chills since yesterday'), 'fever');
  assert.equal(detectSymptomCategory('Severe cold and sneezing nonstop'), 'cold');
  assert.equal(detectSymptomCategory('Dry cough and sore throat'), 'cough');
  assert.equal(detectSymptomCategory('Throbbing migraine headache'), 'headache');
  assert.equal(detectSymptomCategory('Stomach ache and nausea'), 'stomach');
  assert.equal(detectSymptomCategory('Routine annual wellness checkup'), 'checkup');
});
