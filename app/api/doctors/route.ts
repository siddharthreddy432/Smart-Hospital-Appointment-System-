import { NextRequest, NextResponse } from 'next/server';
import {
  createDoctorRecord,
  updateDoctorRecord,
  deleteDoctorRecord,
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
    if (!body.name || !body.specialty) {
      return NextResponse.json(
        { error: 'Doctor name and specialty are required.' },
        { status: 400 }
      );
    }
    const doctor = await createDoctorRecord({
      name: String(body.name),
      specialty: String(body.specialty),
      department: String(body.department || `${body.specialty} Department`),
      qualification: String(body.qualification || 'MD, Board Certified'),
      experienceYears: Number(body.experienceYears) || 8,
      consultationFee: Number(body.consultationFee) || 800,
      roomNumber: String(body.roomNumber || 'Suite 200'),
      bio: String(body.bio || 'Attending specialist at SAHS.'),
      availableDays: String(body.availableDays || 'Monday,Wednesday,Friday'),
      rating: String(body.rating || '4.9'),
    });
    return NextResponse.json({ doctor }, { status: 201 });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Failed to create doctor.';
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
    const doctorId = Number(body.doctorId || body.id);
    if (!doctorId) {
      return NextResponse.json(
        { error: 'Valid doctorId is required.' },
        { status: 400 }
      );
    }
    const doctor = await updateDoctorRecord(doctorId, body);
    return NextResponse.json({ doctor });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Failed to update doctor.';
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
    const doctorId = Number(
      body.doctorId || body.id || searchParams.get('id')
    );
    if (!doctorId) {
      return NextResponse.json(
        { error: 'Valid doctorId is required.' },
        { status: 400 }
      );
    }
    const result = await deleteDoctorRecord(doctorId);
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Failed to delete doctor.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
