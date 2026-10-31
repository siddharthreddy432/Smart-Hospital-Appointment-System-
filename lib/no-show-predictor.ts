export interface NoShowFeatures {
  leadTimeDays: number;
  priorMissedAppointments: number;
  totalPastAppointments: number;
  patientAge: number;
  smsReminder: boolean;
  distanceKm: number;
  chronicConditions: number;
  visitType: 'In-Person' | 'Telehealth';
}

export interface FactorContribution {
  label: string;
  impact: string;
  direction: 'increase' | 'decrease' | 'neutral';
  weight: number;
}

export interface NoShowPredictionResult {
  probability: number; // 1 - 98
  riskLevel: 'Low' | 'Moderate' | 'High';
  logOdds: number;
  factors: FactorContribution[];
  recommendation: string;
}

/**
 * Calibrated clinical logistic regression model for predicting hospital appointment no-show probability.
 * Mirrors the coefficients and feature engineering in python/no_show_predictor.py.
 */
export function predictNoShowProbability(input: NoShowFeatures): NoShowPredictionResult {
  const leadTime = Math.max(0, Math.min(180, Number(input.leadTimeDays) || 0));
  const missed = Math.max(0, Number(input.priorMissedAppointments) || 0);
  const total = Math.max(missed, Number(input.totalPastAppointments) || 0);
  const age = Math.max(0, Math.min(120, Number(input.patientAge) || 35));
  const distance = Math.max(0, Math.min(250, Number(input.distanceKm) || 5));
  const chronic = Math.max(0, Math.min(10, Number(input.chronicConditions) || 0));
  const sms = Boolean(input.smsReminder);
  const visitType = input.visitType === 'Telehealth' ? 'Telehealth' : 'In-Person';

  // Intercept (baseline ~14% no-show rate)
  let z = -1.85;
  const factors: FactorContribution[] = [];

  // 1. Lead Time impact
  const leadContribution = leadTime * 0.052;
  z += leadContribution;
  factors.push({
    label: `Lead time (${leadTime}d)`,
    impact: leadTime > 14 ? `+${Math.round(leadContribution * 18)}% risk` : 'Short booking window',
    direction: leadTime > 7 ? 'increase' : 'neutral',
    weight: Number(leadContribution.toFixed(2)),
  });

  // 2. Historical No-Show ratio & count
  const priorRate = total > 0 ? missed / total : 0;
  const historyContribution = priorRate * 2.15 + Math.min(missed, 6) * 0.24;
  z += historyContribution;
  factors.push({
    label: `Prior attendance (${missed}/${total} missed)`,
    impact: missed > 0 ? `${Math.round(priorRate * 100)}% historical miss rate` : 'Clean attendance record',
    direction: missed > 0 ? 'increase' : 'decrease',
    weight: Number(historyContribution.toFixed(2)),
  });

  // 3. SMS Reminder
  const smsContribution = sms ? -0.62 : 0.38;
  z += smsContribution;
  factors.push({
    label: sms ? 'SMS & Email Reminder Active' : 'No Automated SMS Reminder',
    impact: sms ? 'Reduces forgetfulness (-38% rel.)' : 'Unconfirmed slot (+22% risk)',
    direction: sms ? 'decrease' : 'increase',
    weight: Number(smsContribution.toFixed(2)),
  });

  // 4. Age Cohort
  let ageContribution = 0;
  if (age >= 18 && age <= 32) {
    ageContribution = 0.28;
  } else if (age >= 60) {
    ageContribution = -0.18;
  }
  z += ageContribution;
  factors.push({
    label: `Patient age (${age} yrs)`,
    impact:
      age >= 18 && age <= 32
        ? 'Young adult mobility cohort'
        : age >= 60
        ? 'High adherence senior cohort'
        : 'Baseline adult cohort',
    direction: ageContribution > 0 ? 'increase' : ageContribution < 0 ? 'decrease' : 'neutral',
    weight: Number(ageContribution.toFixed(2)),
  });

  // 5. Travel Distance & Modality
  const distanceContribution = visitType === 'Telehealth' ? -0.35 : distance * 0.022;
  z += distanceContribution;
  factors.push({
    label: visitType === 'Telehealth' ? 'Telehealth Video Visit' : `Transit distance (${distance} km)`,
    impact:
      visitType === 'Telehealth'
        ? 'Zero commute barrier'
        : distance > 15
        ? 'Longer transit friction'
        : 'Local catchment area',
    direction: distanceContribution > 0.25 ? 'increase' : distanceContribution < 0 ? 'decrease' : 'neutral',
    weight: Number(distanceContribution.toFixed(2)),
  });

  // 6. Chronic condition adherence
  const chronicContribution = chronic > 0 ? -0.16 * Math.min(chronic, 3) : 0;
  z += chronicContribution;
  if (chronic > 0) {
    factors.push({
      label: `Chronic care continuity (${chronic})`,
      impact: 'Higher routine follow-up adherence',
      direction: 'decrease',
      weight: Number(chronicContribution.toFixed(2)),
    });
  }

  const rawProb = 1 / (1 + Math.exp(-z));
  const probability = Math.max(2, Math.min(96, Math.round(rawProb * 100)));

  let riskLevel: 'Low' | 'Moderate' | 'High' = 'Low';
  let recommendation =
    'Standard workflow: Dispatch automated 24-hour SMS reminder and digital check-in link.';

  if (probability >= 50) {
    riskLevel = 'High';
    recommendation =
      'High no-show risk: Trigger nurse coordinator phone confirmation 48h prior and flag slot for waitlist backup.';
  } else if (probability >= 25) {
    riskLevel = 'Moderate';
    recommendation =
      'Moderate risk: Send dual SMS reminders (72h and 6h prior) with one-tap reschedule option.';
  }

  return {
    probability,
    riskLevel,
    logOdds: Number(z.toFixed(3)),
    factors,
    recommendation,
  };
}

export function calculateLeadTimeDays(appointmentDateStr: string, referenceDateStr?: string): number {
  const ref = referenceDateStr ? new Date(referenceDateStr) : new Date();
  const target = new Date(appointmentDateStr);
  if (Number.isNaN(target.getTime()) || Number.isNaN(ref.getTime())) {
    return 3;
  }
  const diffMs = target.getTime() - ref.getTime();
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(0, days);
}
