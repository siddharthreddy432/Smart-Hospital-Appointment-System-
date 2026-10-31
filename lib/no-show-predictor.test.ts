import test from 'node:test';
import assert from 'node:assert/strict';
import { predictNoShowProbability, calculateLeadTimeDays } from './no-show-predictor';

test('low-risk patient with SMS reminder and short lead time produces Low risk (< 25%)', () => {
  const result = predictNoShowProbability({
    leadTimeDays: 2,
    priorMissedAppointments: 0,
    totalPastAppointments: 8,
    patientAge: 52,
    smsReminder: true,
    distanceKm: 4,
    chronicConditions: 1,
    visitType: 'In-Person',
  });

  assert.equal(result.riskLevel, 'Low');
  assert.ok(result.probability < 25, `Expected probability < 25, got ${result.probability}`);
});

test('high-risk patient with long lead time, prior misses, and no SMS produces High risk (>= 50%)', () => {
  const result = predictNoShowProbability({
    leadTimeDays: 28,
    priorMissedAppointments: 3,
    totalPastAppointments: 5,
    patientAge: 25,
    smsReminder: false,
    distanceKm: 22,
    chronicConditions: 0,
    visitType: 'In-Person',
  });

  assert.equal(result.riskLevel, 'High');
  assert.ok(result.probability >= 50, `Expected probability >= 50, got ${result.probability}`);
});

test('enabling SMS reminder and switching to Telehealth strictly decreases no-show probability', () => {
  const baseInput = {
    leadTimeDays: 14,
    priorMissedAppointments: 1,
    totalPastAppointments: 4,
    patientAge: 30,
    smsReminder: false,
    distanceKm: 18,
    chronicConditions: 0,
    visitType: 'In-Person' as const,
  };

  const withoutIntervention = predictNoShowProbability(baseInput);
  const withIntervention = predictNoShowProbability({
    ...baseInput,
    smsReminder: true,
    visitType: 'Telehealth',
  });

  assert.ok(
    withIntervention.probability < withoutIntervention.probability,
    `Expected ${withIntervention.probability} < ${withoutIntervention.probability}`
  );
});

test('calculateLeadTimeDays computes non-negative day delta accurately', () => {
  assert.equal(calculateLeadTimeDays('2026-11-10', '2026-10-30'), 11);
  assert.equal(calculateLeadTimeDays('2026-10-20', '2026-10-30'), 0);
});
