import { NextRequest, NextResponse } from 'next/server';
import {
  deleteDoctorRecord,
  deleteScheduleRecord,
  deletePatientRecord,
  deleteAppointmentRecord,
  clearAllHospitalData,
} from '../../../src/db/queries.ts';
import {
  extractTokenFromHeadersAndCookies,
  verifySignedSessionToken,
  requireAdminAccess,
} from '../../../lib/rbac-security.ts';

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

    const { searchParams } = new URL(req.url);
    const entity = (searchParams.get('entity') || '').toLowerCase();
    const id = Number(searchParams.get('id'));

    if (entity === 'all') {
      const res = await clearAllHospitalData();
      return NextResponse.json(res);
    }

    if (!id) {
      return NextResponse.json(
        { error: 'Valid record id is required.' },
        { status: 400 }
      );
    }

    if (entity === 'doctor') {
      const res = await deleteDoctorRecord(id);
      return NextResponse.json(res);
    }
    if (entity === 'schedule') {
      const res = await deleteScheduleRecord(id);
      return NextResponse.json(res);
    }
    if (entity === 'patient') {
      const res = await deletePatientRecord(id);
      return NextResponse.json(res);
    }
    if (entity === 'appointment') {
      const res = await deleteAppointmentRecord(id);
      return NextResponse.json(res);
    }

    return NextResponse.json(
      { error: `Unsupported entity type: ${entity}` },
      { status: 400 }
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Admin delete action failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
