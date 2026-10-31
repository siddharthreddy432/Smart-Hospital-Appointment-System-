import { NextRequest, NextResponse } from 'next/server';
import { verifyBearerToken } from '../../../src/lib/firebase-admin.ts';
import {
  getAllHospitalData,
  getAppointmentById,
  getPatientById,
  createAppointmentRecord,
  updateAppointmentStatusRecord,
  deleteAppointmentRecord,
} from '../../../src/db/queries.ts';
import {
  extractTokenFromHeadersAndCookies,
  verifySignedSessionToken,
  issueSignedSessionToken,
  requireAdminAccess,
  canAccessAppointmentRecord,
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
            'Unauthorized: Authentication is required to view appointments.',
        },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const requestedAppointmentId =
      searchParams.get('appointmentId') || searchParams.get('id');
    const requestedPatientId = searchParams.get('patientId');

    if (requestedAppointmentId) {
      const targetAppt = await getAppointmentById(Number(requestedAppointmentId));
      if (!targetAppt) {
        if (principal.role !== 'ADMIN') {
          return NextResponse.json(
            { error: 'Forbidden: You cannot access another patient appointment.' },
            { status: 403 }
          );
        }
        return NextResponse.json(
          { error: 'Appointment not found.' },
          { status: 404 }
        );
      }

      const ownerPatient = await getPatientById(targetAppt.patientId);
      if (
        !canAccessAppointmentRecord(principal, targetAppt, ownerPatient?.email)
      ) {
        return NextResponse.json(
          {
            error:
              'Forbidden: You are not authorized to view another patient appointment.',
          },
          { status: 403 }
        );
      }

      return NextResponse.json({ appointment: targetAppt });
    }

    if (
      requestedPatientId &&
      principal.role === 'PATIENT' &&
      principal.patientId !== null &&
      Number(requestedPatientId) !== Number(principal.patientId)
    ) {
      return NextResponse.json(
        {
          error:
            'Forbidden: Patients cannot query appointments belonging to another patientId.',
        },
        { status: 403 }
      );
    }

    const all = await getAllHospitalData();
    if (principal.role === 'ADMIN') {
      return NextResponse.json({ appointments: all.appointments });
    }

    const visibleAppointments = all.appointments.filter((a) => {
      const ownerPat = all.patients.find((p) => p.id === a.patientId);
      return canAccessAppointmentRecord(principal, a, ownerPat?.email);
    });

    return NextResponse.json({ appointments: visibleAppointments });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Failed to fetch appointments.';
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

    const body = await req.json();
    const patientId = body.patientId ? Number(body.patientId) : undefined;
    const userEmail = String(
      body.userEmail || principal?.email || decoded?.email || ''
    )
      .trim()
      .toLowerCase();
    const userName = String(
      body.userName || principal?.userName || decoded?.name || ''
    ).trim();
    const userPhone = body.userPhone ? String(body.userPhone).trim() : undefined;
    const doctorId = body.doctorId ? Number(body.doctorId) : undefined;
    const doctorName = body.doctorName
      ? String(body.doctorName).trim()
      : undefined;
    const doctorSpecialty = body.doctorSpecialty
      ? String(body.doctorSpecialty).trim()
      : undefined;
    const appointmentDate = String(body.appointmentDate || '').trim();
    const timeSlot = String(body.timeSlot || '').trim();
    const reason = String(body.reason || '').trim();

    // Prevent a logged-in PATIENT from booking under another patient's ID
    if (
      principal &&
      principal.role === 'PATIENT' &&
      patientId &&
      principal.patientId &&
      Number(patientId) !== Number(principal.patientId)
    ) {
      return NextResponse.json(
        {
          error:
            'Forbidden: Cannot book an appointment on behalf of another patientId.',
        },
        { status: 403 }
      );
    }

    if ((!patientId && !userEmail) || !appointmentDate || !timeSlot || !reason) {
      return NextResponse.json(
        {
          error:
            'User Gmail ID (or patient profile), date, time slot, and symptom/reason are required.',
        },
        { status: 400 }
      );
    }

    const result = await createAppointmentRecord({
      patientId,
      userEmail,
      userName,
      userPhone,
      age: body.age ? Number(body.age) : undefined,
      gender: body.gender ? String(body.gender) : undefined,
      bloodGroup: body.bloodGroup ? String(body.bloodGroup) : undefined,
      doctorId,
      doctorName,
      doctorSpecialty,
      appointmentDate,
      timeSlot,
      visitType: body.visitType === 'Telehealth' ? 'Telehealth' : 'In-Person',
      reason,
      clinicalNotes: body.clinicalNotes
        ? String(body.clinicalNotes)
        : undefined,
      smsReminder: Boolean(body.smsReminder),
      bookedByUid: decoded?.uid || principal?.uid || userEmail || null,
      actorName:
        userName ||
        principal?.userName ||
        decoded?.name ||
        userEmail ||
        body.actorName,
    });

    const res = NextResponse.json(result, { status: 201 });

    // If the booking user is a patient or not logged in as admin, set the sahs_session cookie
    if (!principal || principal.role !== 'ADMIN') {
      const sessionToken = issueSignedSessionToken({
        uid: result.patient.userUid || result.patient.email,
        email: result.patient.email,
        userName: result.patient.fullName,
        role: 'PATIENT',
        patientId: result.patient.id,
      });

      res.cookies.set('sahs_session', sessionToken, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 12 * 60 * 60,
      });
    }

    return res;
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Failed to book appointment.';
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
    const authHeader = req.headers.get('authorization');
    const decoded = await verifyBearerToken(authHeader);

    if (!principal && !decoded) {
      return NextResponse.json(
        { error: 'Unauthorized: Sign in is required to update appointments.' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const appointmentId = Number(body.appointmentId || body.id);

    if (!appointmentId) {
      return NextResponse.json(
        { error: 'Valid appointmentId is required.' },
        { status: 400 }
      );
    }

    const existingAppt = await getAppointmentById(appointmentId);
    if (!existingAppt) {
      if (principal?.role !== 'ADMIN') {
        return NextResponse.json(
          { error: 'Forbidden: Cannot access or modify this appointment.' },
          { status: 403 }
        );
      }
      return NextResponse.json(
        { error: 'Appointment not found.' },
        { status: 404 }
      );
    }

    const ownerPatient = await getPatientById(existingAppt.patientId);
    if (
      principal &&
      !canAccessAppointmentRecord(principal, existingAppt, ownerPatient?.email)
    ) {
      return NextResponse.json(
        {
          error:
            'Forbidden: You can only modify or cancel your own appointments.',
        },
        { status: 403 }
      );
    }

    const requestedStatus = body.newStatus || body.status;
    // Patients may cancel or reschedule their own appointment, while ADMIN can set any status
    if (
      principal?.role === 'PATIENT' &&
      requestedStatus === 'No-Show'
    ) {
      return NextResponse.json(
        { error: 'Forbidden: Only administrators can mark No-Show status.' },
        { status: 403 }
      );
    }

    const updated = await updateAppointmentStatusRecord({
      appointmentId,
      newStatus: requestedStatus,
      appointmentDate: body.appointmentDate,
      timeSlot: body.timeSlot,
      visitType: body.visitType,
      smsReminder: body.smsReminder,
      reason: body.reason,
      clinicalNotes: body.clinicalNotes,
      doctorId: body.doctorId ? Number(body.doctorId) : undefined,
      changedBy:
        principal?.email ||
        decoded?.email ||
        body.performedBy ||
        body.changedBy ||
        'SAHS Admin',
    });

    return NextResponse.json({ appointment: updated });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Failed to update appointment.';
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
    const appointmentId = Number(
      body.appointmentId || body.id || searchParams.get('id')
    );
    if (!appointmentId) {
      return NextResponse.json(
        { error: 'Valid appointmentId is required.' },
        { status: 400 }
      );
    }
    const result = await deleteAppointmentRecord(appointmentId);
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Failed to delete appointment.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
