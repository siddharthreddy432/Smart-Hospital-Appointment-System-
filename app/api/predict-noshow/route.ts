import { NextRequest, NextResponse } from 'next/server';
import { predictNoShowProbability } from '../../../lib/no-show-predictor.ts';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const prediction = predictNoShowProbability({
      leadTimeDays: Number(body.leadTimeDays) || 0,
      priorMissedAppointments: Number(body.priorMissedAppointments) || 0,
      totalPastAppointments: Number(body.totalPastAppointments) || 0,
      patientAge: Number(body.patientAge) || 35,
      smsReminder: Boolean(body.smsReminder),
      distanceKm: Number(body.distanceKm) || 5,
      chronicConditions: Number(body.chronicConditions) || 0,
      visitType: body.visitType === 'Telehealth' ? 'Telehealth' : 'In-Person',
    });

    return NextResponse.json(prediction);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to compute no-show probability.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
