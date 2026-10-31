import { NextRequest, NextResponse } from 'next/server';
import {
  toggleScheduleAvailabilityRecord,
  createScheduleRecord,
  deleteScheduleRecord,
} from '../../../src/db/queries.ts';
import {
  extractTokenFromHeadersAndCookies,
  verifySignedSessionToken,
  requireAdminAccess,
} from '../../../lib/rbac-security.ts';

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
    if (!body.doctorId || !body.dayOfWeek) {
      return NextResponse.json(
        { error: 'doctorId and dayOfWeek are required.' },
        { status: 400 }
      );
    }
    const schedule = await createScheduleRecord({
      doctorId: Number(body.doctorId),
      dayOfWeek: String(body.dayOfWeek),
      startTime: String(body.startTime || '09:00'),
      endTime: String(body.endTime || '17:00'),
      slotDurationMinutes: Number(body.slotDurationMinutes) || 30,
      maxPatients: Number(body.maxPatients) || 12,
      isAvailable:
        body.isAvailable !== undefined ? Boolean(body.isAvailable) : true,
    });
    return NextResponse.json({ schedule }, { status: 201 });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Failed to create schedule.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
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
    const scheduleId = Number(body.scheduleId || body.id);
    const isAvailable = Boolean(body.isAvailable);

    if (!scheduleId) {
      return NextResponse.json(
        { error: 'Valid scheduleId is required.' },
        { status: 400 }
      );
    }

    const schedule = await toggleScheduleAvailabilityRecord(
      scheduleId,
      isAvailable,
      {
        dayOfWeek: body.dayOfWeek,
        startTime: body.startTime,
        endTime: body.endTime,
        slotDurationMinutes: body.slotDurationMinutes,
        maxPatients: body.maxPatients,
      }
    );
    return NextResponse.json({ schedule });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Failed to update schedule.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
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

    const body = await req.json().catch(() => ({}));
    const { searchParams } = new URL(req.url);
    const scheduleId = Number(
      body.scheduleId || body.id || searchParams.get('id')
    );
    if (!scheduleId) {
      return NextResponse.json(
        { error: 'Valid scheduleId is required.' },
        { status: 400 }
      );
    }
    const result = await deleteScheduleRecord(scheduleId);
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Failed to delete schedule.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
