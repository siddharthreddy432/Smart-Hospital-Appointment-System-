import { NextRequest, NextResponse } from 'next/server';
import { verifyBearerToken } from '../../../src/lib/firebase-admin.ts';
import {
  getAllHospitalData,
  getPatientById,
  createPatientRecord,
  updatePatientRecord,
  deletePatientRecord,
} from '../../../src/db/queries.ts';
import {
  extractTokenFromHeadersAndCookies,
  verifySignedSessionToken,
  requireAdminAccess,
  canAccessPatientRecord,
} from '../../../lib/rbac-security.ts';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const rawToken = extractTokenFromHeadersAndCookies(
      req.headers,
      req.cookies.get('sahs_session')?.value
    );
    const principal = verifySignedSessionToken(rawToken);

    if (!principal) {
      return NextResponse.json(
        {
          error:
            'Unauthorized: Authentication is required to view patient records.',
        },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const requestedPatientId = searchParams.get('patientId') || searchParams.get('id');

    if (requestedPatientId) {
      const targetPatient = await getPatientById(Number(requestedPatientId));
      if (!targetPatient) {
        if (principal.role !== 'ADMIN') {
          return NextResponse.json(
            { error: 'Forbidden: You cannot access another patient record.' },
            { status: 403 }
          );
        }
        return NextResponse.json({ error: 'Patient not found.' }, { status: 404 });
      }

      if (!canAccessPatientRecord(principal, targetPatient)) {
        return NextResponse.json(
          {
            error:
              'Forbidden: Patients can only access their own personal record.',
          },
          { status: 403 }
        );
      }

      return NextResponse.json({ patient: targetPatient });
    }

    // Full patient list is strictly Admin-only; patients only receive their own record
    const all = await getAllHospitalData();
    if (principal.role === 'ADMIN') {
      return NextResponse.json({ patients: all.patients });
    }

    const ownPatients = all.patients.filter((p) =>
      canAccessPatientRecord(principal, p)
    );
    return NextResponse.json({ patients: ownPatients });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Failed to load patient records.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const rawToken = extractTokenFromHeadersAndCookies(
      req.headers,
      req.cookies.get('sahs_session')?.value
    );
    const principal = verifySignedSessionToken(rawToken);
    const authHeader = req.headers.get('authorization');
    const decoded = await verifyBearerToken(authHeader);

    if (!principal && !decoded) {
      return NextResponse.json(
        { error: 'Unauthorized: Sign in required to register patient profile.' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const fullName = String(body.fullName || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const phone = String(body.phone || '').trim();
    const age = Number(body.age);

    if (
      principal &&
      principal.role !== 'ADMIN' &&
      email &&
      email !== principal.email.toLowerCase()
    ) {
      return NextResponse.json(
        {
          error:
            'Forbidden: Patients may only register or update their own email profile.',
        },
        { status: 403 }
      );
    }

    if (!fullName || !email || !phone || !age || age < 1 || age > 120) {
      return NextResponse.json(
        {
          error:
            'Please provide valid patient name, email, phone, and age (1-120).',
        },
        { status: 400 }
      );
    }

    const patient = await createPatientRecord({
      fullName,
      email,
      phone,
      age,
      gender: String(body.gender || 'Not Specified'),
      bloodGroup: String(body.bloodGroup || 'O+'),
      chronicConditions: Number(body.chronicConditions) || 0,
      distanceKm: Number(body.distanceKm) || 5,
      userUid: decoded?.uid || principal?.uid || null,
    });

    return NextResponse.json({ patient }, { status: 201 });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Failed to create patient record.';
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

    if (!principal) {
      return NextResponse.json(
        { error: 'Unauthorized: Please sign in first.' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const patientId = Number(body.patientId || body.id);
    if (!patientId) {
      return NextResponse.json(
        { error: 'Valid patientId is required.' },
        { status: 400 }
      );
    }

    const existing = await getPatientById(patientId);
    if (!existing) {
      if (principal.role !== 'ADMIN') {
        return NextResponse.json(
          { error: 'Forbidden: Access denied to requested patient record.' },
          { status: 403 }
        );
      }
      return NextResponse.json({ error: 'Patient not found.' }, { status: 404 });
    }

    if (!canAccessPatientRecord(principal, existing)) {
      return NextResponse.json(
        {
          error:
            'Forbidden: You are not authorized to modify another patient record.',
        },
        { status: 403 }
      );
    }

    const patient = await updatePatientRecord(patientId, body);
    return NextResponse.json({ patient });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Failed to update patient record.';
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
    const patientId = Number(
      body.patientId || body.id || searchParams.get('id')
    );
    if (!patientId) {
      return NextResponse.json(
        { error: 'Valid patientId is required.' },
        { status: 400 }
      );
    }
    const result = await deletePatientRecord(patientId);
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Failed to delete patient record.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
