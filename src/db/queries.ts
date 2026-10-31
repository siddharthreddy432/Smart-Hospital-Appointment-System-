import { db } from './index.ts';
import {
  users,
  doctors,
  patients,
  doctorSchedules,
  appointments,
  appointmentHistoryLogs,
  bookingDraftSessions,
} from './schema.ts';
import { eq, desc } from 'drizzle-orm';
import { predictNoShowProbability, calculateLeadTimeDays } from '../../lib/no-show-predictor.ts';
import {
  VerifiedSessionPrincipal,
  canAccessPatientRecord,
  canAccessAppointmentRecord,
} from '../../lib/rbac-security.ts';
import {
  SyncSessionState,
  hashPairingToken,
} from '../../lib/dual-device-sync.ts';
import {
  ManualDeliveryStatus,
  MANUAL_DELIVERY_STATUS_LABELS,
} from '../../lib/manual-messaging.ts';

export async function getOrCreateUser(
  uid: string,
  email: string,
  displayName?: string | null,
  role?: string
) {
  try {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = (displayName || cleanEmail.split('@')[0]).trim();

    const result = await db
      .insert(users)
      .values({
        uid,
        email: cleanEmail,
        displayName: cleanName,
        role: role || 'patient',
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email: cleanEmail,
          displayName: cleanName,
          ...(role ? { role } : {}),
        },
      })
      .returning();

    const userRecord = result[0];

    // Check if a patient exists by uid or by email
    const existingByUid = await db
      .select()
      .from(patients)
      .where(eq(patients.userUid, uid));

    let patientRecord = existingByUid[0] || null;

    if (!patientRecord) {
      const existingByEmail = await db
        .select()
        .from(patients)
        .where(eq(patients.email, cleanEmail));
      patientRecord = existingByEmail[0] || null;
    }

    if (patientRecord) {
      const updatedPatients = await db
        .update(patients)
        .set({
          userUid: uid,
          fullName: cleanName,
          email: cleanEmail,
        })
        .where(eq(patients.id, patientRecord.id))
        .returning();
      patientRecord = updatedPatients[0];
    } else {
      const insertedPatients = await db
        .insert(patients)
        .values({
          userUid: uid,
          fullName: cleanName,
          email: cleanEmail,
          phone: '+91 98765 43210',
          age: 30,
          gender: 'Not Specified',
          bloodGroup: 'O+',
          chronicConditions: 0,
          distanceKm: 6,
          totalAppointments: 0,
          missedAppointments: 0,
        })
        .returning();
      patientRecord = insertedPatients[0];
    }

    return { user: userRecord, patient: patientRecord };
  } catch (error) {
    console.error('Database query failed in getOrCreateUser:', error);
    throw new Error('Failed to synchronize user account with database.', { cause: error });
  }
}

export async function getAllHospitalData() {
  try {
    const [allDoctors, allSchedules, allPatients, allAppointments, allHistory] = await Promise.all([
      db.select().from(doctors).orderBy(doctors.id),
      db.select().from(doctorSchedules).orderBy(doctorSchedules.id),
      db.select().from(patients).orderBy(desc(patients.id)),
      db.select().from(appointments).orderBy(desc(appointments.id), desc(appointments.appointmentDate)),
      db.select().from(appointmentHistoryLogs).orderBy(desc(appointmentHistoryLogs.changedAt), desc(appointmentHistoryLogs.id)),
    ]);

    return {
      doctors: allDoctors,
      schedules: allSchedules,
      patients: allPatients,
      appointments: allAppointments,
      historyLogs: allHistory,
    };
  } catch (error) {
    console.error('Database query failed in getAllHospitalData:', error);
    throw new Error('Unable to load hospital data from database.', { cause: error });
  }
}

export async function getScopedHospitalData(
  principal: VerifiedSessionPrincipal | null
) {
  const full = await getAllHospitalData();

  if (principal?.role === 'ADMIN') {
    return {
      ...full,
      scope: 'ADMIN',
    };
  }

  if (principal?.role === 'PATIENT') {
    const visiblePatients = full.patients.filter((p) =>
      canAccessPatientRecord(principal, p)
    );
    const visiblePatientIds = new Set(visiblePatients.map((p) => p.id));
    const visibleAppointments = full.appointments.filter((a) => {
      const ownerPat = full.patients.find((p) => p.id === a.patientId);
      return (
        visiblePatientIds.has(a.patientId) ||
        canAccessAppointmentRecord(principal, a, ownerPat?.email)
      );
    });
    const visibleAppointmentIds = new Set(visibleAppointments.map((a) => a.id));
    const visibleHistory = full.historyLogs.filter((h) =>
      visibleAppointmentIds.has(h.appointmentId)
    );

    return {
      doctors: full.doctors,
      schedules: full.schedules,
      patients: visiblePatients,
      appointments: visibleAppointments,
      historyLogs: visibleHistory,
      scope: 'PATIENT',
    };
  }

  if (principal?.role === 'DOCTOR' && principal.doctorId) {
    const docAppts = full.appointments.filter(
      (a) => Number(a.doctorId) === Number(principal.doctorId)
    );
    const patIds = new Set(docAppts.map((a) => a.patientId));
    const apptIds = new Set(docAppts.map((a) => a.id));
    return {
      doctors: full.doctors,
      schedules: full.schedules,
      patients: full.patients.filter((p) => patIds.has(p.id)),
      appointments: docAppts,
      historyLogs: full.historyLogs.filter((h) => apptIds.has(h.appointmentId)),
      scope: 'DOCTOR',
    };
  }

  // Unauthenticated visitor: never expose any patient records, appointments, or logs
  return {
    doctors: full.doctors,
    schedules: full.schedules,
    patients: [],
    appointments: [],
    historyLogs: [],
    scope: 'PUBLIC',
  };
}

export async function getPatientById(patientId: number) {
  const rows = await db
    .select()
    .from(patients)
    .where(eq(patients.id, Number(patientId)));
  return rows[0] || null;
}

export async function getAppointmentById(appointmentId: number) {
  const rows = await db
    .select()
    .from(appointments)
    .where(eq(appointments.id, Number(appointmentId)));
  return rows[0] || null;
}

// ==========================================
// DOCTORS CRUD (Admin + Directory)
// ==========================================
export interface DoctorInput {
  name: string;
  specialty: string;
  department: string;
  qualification: string;
  experienceYears: number;
  consultationFee: number;
  roomNumber: string;
  bio: string;
  availableDays: string;
  rating?: string;
}

export async function createDoctorRecord(input: DoctorInput) {
  try {
    const inserted = await db
      .insert(doctors)
      .values({
        name: input.name.trim(),
        specialty: input.specialty.trim(),
        department: input.department.trim(),
        qualification: input.qualification.trim(),
        experienceYears: Number(input.experienceYears) || 5,
        consultationFee: Number(input.consultationFee) || 800,
        roomNumber: input.roomNumber.trim() || 'Suite 101',
        bio: input.bio.trim() || 'Board-certified attending specialist at SAHS.',
        availableDays: input.availableDays.trim() || 'Monday,Wednesday,Friday',
        rating: input.rating || '4.9',
      })
      .returning();

    const newDoc = inserted[0];
    // Seed a default schedule so the new doctor immediately has slots
    await db.insert(doctorSchedules).values({
      doctorId: newDoc.id,
      dayOfWeek: 'Monday',
      startTime: '09:00',
      endTime: '17:00',
      slotDurationMinutes: 30,
      maxPatients: 12,
      isAvailable: true,
    });

    return newDoc;
  } catch (error) {
    console.error('Database query failed in createDoctorRecord:', error);
    throw new Error('Failed to create doctor record.', { cause: error });
  }
}

export async function updateDoctorRecord(doctorId: number, updates: Partial<DoctorInput>) {
  try {
    const updated = await db
      .update(doctors)
      .set({
        ...(updates.name !== undefined ? { name: updates.name.trim() } : {}),
        ...(updates.specialty !== undefined ? { specialty: updates.specialty.trim() } : {}),
        ...(updates.department !== undefined ? { department: updates.department.trim() } : {}),
        ...(updates.qualification !== undefined ? { qualification: updates.qualification.trim() } : {}),
        ...(updates.experienceYears !== undefined ? { experienceYears: Number(updates.experienceYears) } : {}),
        ...(updates.consultationFee !== undefined ? { consultationFee: Number(updates.consultationFee) } : {}),
        ...(updates.roomNumber !== undefined ? { roomNumber: updates.roomNumber.trim() } : {}),
        ...(updates.bio !== undefined ? { bio: updates.bio.trim() } : {}),
        ...(updates.availableDays !== undefined ? { availableDays: updates.availableDays.trim() } : {}),
        ...(updates.rating !== undefined ? { rating: updates.rating } : {}),
      })
      .where(eq(doctors.id, Number(doctorId)))
      .returning();
    return updated[0];
  } catch (error) {
    console.error('Database query failed in updateDoctorRecord:', error);
    throw new Error('Failed to update doctor record.', { cause: error });
  }
}

export async function deleteDoctorRecord(doctorId: number) {
  try {
    const id = Number(doctorId);
    const docAppts = await db.select().from(appointments).where(eq(appointments.doctorId, id));
    for (const appt of docAppts) {
      await db.delete(appointmentHistoryLogs).where(eq(appointmentHistoryLogs.appointmentId, appt.id));
    }
    await db.delete(appointments).where(eq(appointments.doctorId, id));
    await db.delete(doctorSchedules).where(eq(doctorSchedules.doctorId, id));
    await db.delete(doctors).where(eq(doctors.id, id));
    return { deletedId: id };
  } catch (error) {
    console.error('Database query failed in deleteDoctorRecord:', error);
    throw new Error('Failed to delete doctor record.', { cause: error });
  }
}

// ==========================================
// PATIENTS CRUD
// ==========================================
export interface CreatePatientInput {
  fullName: string;
  email: string;
  phone: string;
  age: number;
  gender: string;
  bloodGroup: string;
  chronicConditions: number;
  distanceKm: number;
  userUid?: string | null;
}

export async function createPatientRecord(input: CreatePatientInput) {
  try {
    const inserted = await db
      .insert(patients)
      .values({
        userUid: input.userUid || null,
        fullName: input.fullName.trim(),
        email: input.email.trim().toLowerCase(),
        phone: input.phone.trim(),
        age: Number(input.age) || 35,
        gender: input.gender || 'Other',
        bloodGroup: input.bloodGroup || 'O+',
        chronicConditions: Number(input.chronicConditions) || 0,
        distanceKm: Number(input.distanceKm) || 5,
        totalAppointments: 0,
        missedAppointments: 0,
      })
      .returning();
    return inserted[0];
  } catch (error) {
    console.error('Database query failed in createPatientRecord:', error);
    throw new Error('Unable to create patient record.', { cause: error });
  }
}

export async function updatePatientRecord(
  patientId: number,
  updates: Partial<CreatePatientInput & { totalAppointments: number; missedAppointments: number }>
) {
  try {
    const updated = await db
      .update(patients)
      .set({
        ...(updates.fullName !== undefined ? { fullName: updates.fullName.trim() } : {}),
        ...(updates.email !== undefined ? { email: updates.email.trim().toLowerCase() } : {}),
        ...(updates.phone !== undefined ? { phone: updates.phone.trim() } : {}),
        ...(updates.age !== undefined ? { age: Number(updates.age) } : {}),
        ...(updates.gender !== undefined ? { gender: updates.gender } : {}),
        ...(updates.bloodGroup !== undefined ? { bloodGroup: updates.bloodGroup } : {}),
        ...(updates.chronicConditions !== undefined
          ? { chronicConditions: Number(updates.chronicConditions) }
          : {}),
        ...(updates.distanceKm !== undefined ? { distanceKm: Number(updates.distanceKm) } : {}),
        ...(updates.totalAppointments !== undefined
          ? { totalAppointments: Number(updates.totalAppointments) }
          : {}),
        ...(updates.missedAppointments !== undefined
          ? { missedAppointments: Number(updates.missedAppointments) }
          : {}),
      })
      .where(eq(patients.id, Number(patientId)))
      .returning();
    return updated[0];
  } catch (error) {
    console.error('Database query failed in updatePatientRecord:', error);
    throw new Error('Unable to update patient record.', { cause: error });
  }
}

export async function deletePatientRecord(patientId: number) {
  try {
    const id = Number(patientId);
    const patAppts = await db.select().from(appointments).where(eq(appointments.patientId, id));
    for (const appt of patAppts) {
      await db.delete(appointmentHistoryLogs).where(eq(appointmentHistoryLogs.appointmentId, appt.id));
    }
    await db.delete(appointments).where(eq(appointments.patientId, id));
    await db.delete(patients).where(eq(patients.id, id));
    return { deletedId: id };
  } catch (error) {
    console.error('Database query failed in deletePatientRecord:', error);
    throw new Error('Unable to delete patient record.', { cause: error });
  }
}

// ==========================================
// APPOINTMENTS CRUD (with Gmail Matching)
// ==========================================
export interface BookAppointmentInput {
  patientId?: number;
  userEmail?: string;
  userName?: string;
  userPhone?: string;
  age?: number;
  gender?: string;
  bloodGroup?: string;
  doctorId?: number;
  doctorName?: string;
  doctorSpecialty?: string;
  appointmentDate: string;
  timeSlot: string;
  visitType: 'In-Person' | 'Telehealth';
  reason: string;
  clinicalNotes?: string;
  smsReminder: boolean;
  bookedByUid?: string | null;
  actorName?: string;
}

export async function createAppointmentRecord(input: BookAppointmentInput) {
  try {
    let patient = null;

    if (input.userEmail && input.userEmail.trim()) {
      const cleanEmail = input.userEmail.trim().toLowerCase();
      const cleanName = (input.userName || cleanEmail.split('@')[0]).trim();
      const cleanPhone = (input.userPhone || '+91 98765 43210').trim();
      const cleanAge = Number(input.age) || 30;
      const cleanGender = input.gender || 'Not Specified';
      const cleanBlood = input.bloodGroup || 'O+';

      const existingByEmail = await db
        .select()
        .from(patients)
        .where(eq(patients.email, cleanEmail));

      if (existingByEmail[0]) {
        const updated = await db
          .update(patients)
          .set({
            fullName: input.userName ? cleanName : existingByEmail[0].fullName,
            email: cleanEmail,
            ...(input.userPhone ? { phone: cleanPhone } : {}),
            ...(input.age ? { age: cleanAge } : {}),
            ...(input.gender ? { gender: cleanGender } : {}),
            ...(input.bloodGroup ? { bloodGroup: cleanBlood } : {}),
          })
          .where(eq(patients.id, existingByEmail[0].id))
          .returning();
        patient = updated[0];
      } else if (input.patientId) {
        const byId = await db
          .select()
          .from(patients)
          .where(eq(patients.id, Number(input.patientId)));
        if (byId[0] && byId[0].email.toLowerCase() === cleanEmail) {
          patient = byId[0];
        } else {
          const inserted = await db
            .insert(patients)
            .values({
              userUid: input.bookedByUid || null,
              fullName: cleanName,
              email: cleanEmail,
              phone: cleanPhone,
              age: cleanAge,
              gender: cleanGender,
              bloodGroup: cleanBlood,
              chronicConditions: 0,
              distanceKm: 5,
              totalAppointments: 0,
              missedAppointments: 0,
            })
            .returning();
          patient = inserted[0];
        }
      } else {
        const inserted = await db
          .insert(patients)
          .values({
            userUid: input.bookedByUid || null,
            fullName: cleanName,
            email: cleanEmail,
            phone: cleanPhone,
            age: cleanAge,
            gender: cleanGender,
            bloodGroup: cleanBlood,
            chronicConditions: 0,
            distanceKm: 5,
            totalAppointments: 0,
            missedAppointments: 0,
          })
            .returning();
        patient = inserted[0];
      }
    }

    if (!patient && input.patientId) {
      const patientRows = await db
        .select()
        .from(patients)
        .where(eq(patients.id, Number(input.patientId)));
      patient = patientRows[0];
    }

    if (!patient) {
      throw new Error('Patient profile or Gmail ID is required to book.');
    }

    let doctor = null;
    if (input.doctorId) {
      const doctorRows = await db
        .select()
        .from(doctors)
        .where(eq(doctors.id, Number(input.doctorId)));
      doctor = doctorRows[0] || null;
    }

    if (!doctor) {
      const allDocs = await db.select().from(doctors).orderBy(doctors.id);
      if (allDocs.length > 0 && !input.doctorName) {
        doctor = allDocs[0];
      } else {
        doctor = await createDoctorRecord({
          name: input.doctorName?.trim() || 'Dr. Attending Specialist',
          specialty: input.doctorSpecialty?.trim() || 'General Medicine',
          department: `${input.doctorSpecialty?.trim() || 'General'} Clinic`,
          qualification: 'MD',
          experienceYears: 10,
          consultationFee: 800,
          roomNumber: 'Suite 101',
          bio: 'Attending physician at SAHS.',
          availableDays: 'Monday,Tuesday,Wednesday,Thursday,Friday',
          rating: '4.9',
        });
      }
    }

    const leadTimeDays = calculateLeadTimeDays(input.appointmentDate);
    const prediction = predictNoShowProbability({
      leadTimeDays,
      priorMissedAppointments: patient.missedAppointments,
      totalPastAppointments: patient.totalAppointments,
      patientAge: patient.age,
      smsReminder: input.smsReminder,
      distanceKm: patient.distanceKm,
      chronicConditions: patient.chronicConditions,
      visitType: input.visitType,
    });

    const bookingMailNote = `Booked via Gmail (${patient.email}) · ${
      input.clinicalNotes || prediction.recommendation
    }`;

    const insertedAppts = await db
      .insert(appointments)
      .values({
        patientId: patient.id,
        doctorId: doctor.id,
        appointmentDate: input.appointmentDate,
        timeSlot: input.timeSlot,
        visitType: input.visitType,
        status: 'Scheduled',
        reason: input.reason,
        clinicalNotes: bookingMailNote,
        leadTimeDays,
        smsReminder: input.smsReminder,
        noShowProbability: prediction.probability,
        noShowRiskLevel: prediction.riskLevel,
        bookedByUid: input.bookedByUid || patient.email,
      })
      .returning();

    const newAppt = insertedAppts[0];

    await db
      .update(patients)
      .set({
        totalAppointments: patient.totalAppointments + 1,
      })
      .where(eq(patients.id, patient.id));

    await db.insert(appointmentHistoryLogs).values({
      appointmentId: newAppt.id,
      previousStatus: 'New',
      newStatus: 'Scheduled',
      note: `Booked for ${patient.fullName} (${patient.email}) with ${doctor.name} (${prediction.riskLevel} Risk: ${prediction.probability}%)`,
      changedBy: input.actorName || `${patient.fullName} (${patient.email})`,
    });

    return { appointment: newAppt, prediction, patient, doctor };
  } catch (error) {
    console.error('Database query failed in createAppointmentRecord:', error);
    throw new Error('Failed to book appointment in database.', { cause: error });
  }
}

export async function clearAllHospitalData() {
  try {
    await db.delete(appointmentHistoryLogs);
    await db.delete(appointments);
    await db.delete(doctorSchedules);
    await db.delete(patients);
    await db.delete(doctors);
    return { cleared: true };
  } catch (error) {
    console.error('Database query failed in clearAllHospitalData:', error);
    throw new Error('Failed to clear hospital data.', { cause: error });
  }
}

export async function updateAppointmentStatusRecord(params: {
  appointmentId: number;
  newStatus?: 'Scheduled' | 'Completed' | 'Cancelled' | 'No-Show';
  appointmentDate?: string;
  timeSlot?: string;
  visitType?: 'In-Person' | 'Telehealth';
  smsReminder?: boolean;
  reason?: string;
  clinicalNotes?: string;
  doctorId?: number;
  changedBy: string;
}) {
  try {
    const existingRows = await db
      .select()
      .from(appointments)
      .where(eq(appointments.id, Number(params.appointmentId)));
    const existing = existingRows[0];
    if (!existing) {
      throw new Error('Appointment not found.');
    }

    const nextStatus = params.newStatus || (existing.status as 'Scheduled' | 'Completed' | 'Cancelled' | 'No-Show');
    const nextDate = params.appointmentDate || existing.appointmentDate;
    const nextTime = params.timeSlot || existing.timeSlot;
    const nextVisitType = (params.visitType || existing.visitType) as 'In-Person' | 'Telehealth';
    const nextSms = params.smsReminder !== undefined ? params.smsReminder : existing.smsReminder;
    const nextReason = params.reason !== undefined ? params.reason : existing.reason;
    const nextDoctorId = params.doctorId ? Number(params.doctorId) : existing.doctorId;

    const patientRows = await db
      .select()
      .from(patients)
      .where(eq(patients.id, existing.patientId));
    const pat = patientRows[0];

    const leadTimeDays = calculateLeadTimeDays(nextDate);
    const prediction = predictNoShowProbability({
      leadTimeDays,
      priorMissedAppointments: pat?.missedAppointments ?? 0,
      totalPastAppointments: pat?.totalAppointments ?? 1,
      patientAge: pat?.age ?? 35,
      smsReminder: nextSms,
      distanceKm: pat?.distanceKm ?? 5,
      chronicConditions: pat?.chronicConditions ?? 0,
      visitType: nextVisitType,
    });

    const updatedRows = await db
      .update(appointments)
      .set({
        status: nextStatus,
        appointmentDate: nextDate,
        timeSlot: nextTime,
        visitType: nextVisitType,
        smsReminder: nextSms,
        reason: nextReason,
        doctorId: nextDoctorId,
        leadTimeDays,
        noShowProbability: prediction.probability,
        noShowRiskLevel: prediction.riskLevel,
        clinicalNotes:
          params.clinicalNotes !== undefined ? params.clinicalNotes : existing.clinicalNotes,
      })
      .where(eq(appointments.id, existing.id))
      .returning();

    if (nextStatus === 'No-Show' && existing.status !== 'No-Show' && pat) {
      await db
        .update(patients)
        .set({ missedAppointments: pat.missedAppointments + 1 })
        .where(eq(patients.id, pat.id));
    }

    await db.insert(appointmentHistoryLogs).values({
      appointmentId: existing.id,
      previousStatus: existing.status,
      newStatus: nextStatus,
      note:
        params.clinicalNotes ||
        `Updated appointment (#${existing.id}): ${existing.status} → ${nextStatus} on ${nextDate} at ${nextTime}`,
      changedBy: params.changedBy || 'SAHS Admin',
    });

    return updatedRows[0];
  } catch (error) {
    console.error('Database query failed in updateAppointmentStatusRecord:', error);
    throw new Error('Failed to update appointment in database.', { cause: error });
  }
}

export async function deleteAppointmentRecord(appointmentId: number) {
  try {
    const id = Number(appointmentId);
    await db.delete(appointmentHistoryLogs).where(eq(appointmentHistoryLogs.appointmentId, id));
    await db.delete(appointments).where(eq(appointments.id, id));
    return { deletedId: id };
  } catch (error) {
    console.error('Database query failed in deleteAppointmentRecord:', error);
    throw new Error('Failed to delete appointment.', { cause: error });
  }
}

// ==========================================
// SCHEDULES CRUD
// ==========================================
export async function toggleScheduleAvailabilityRecord(
  scheduleId: number,
  isAvailable: boolean,
  updates?: {
    dayOfWeek?: string;
    startTime?: string;
    endTime?: string;
    slotDurationMinutes?: number;
    maxPatients?: number;
  }
) {
  try {
    const updated = await db
      .update(doctorSchedules)
      .set({
        isAvailable,
        ...(updates?.dayOfWeek ? { dayOfWeek: updates.dayOfWeek } : {}),
        ...(updates?.startTime ? { startTime: updates.startTime } : {}),
        ...(updates?.endTime ? { endTime: updates.endTime } : {}),
        ...(updates?.slotDurationMinutes
          ? { slotDurationMinutes: Number(updates.slotDurationMinutes) }
          : {}),
        ...(updates?.maxPatients ? { maxPatients: Number(updates.maxPatients) } : {}),
      })
      .where(eq(doctorSchedules.id, Number(scheduleId)))
      .returning();
    return updated[0];
  } catch (error) {
    console.error('Database query failed in toggleScheduleAvailabilityRecord:', error);
    throw new Error('Failed to update schedule.', { cause: error });
  }
}

export async function createScheduleRecord(input: {
  doctorId: number;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  slotDurationMinutes: number;
  maxPatients: number;
  isAvailable?: boolean;
}) {
  try {
    const inserted = await db
      .insert(doctorSchedules)
      .values({
        doctorId: Number(input.doctorId),
        dayOfWeek: input.dayOfWeek,
        startTime: input.startTime,
        endTime: input.endTime,
        slotDurationMinutes: Number(input.slotDurationMinutes) || 30,
        maxPatients: Number(input.maxPatients) || 12,
        isAvailable: input.isAvailable !== undefined ? Boolean(input.isAvailable) : true,
      })
      .returning();
    return inserted[0];
  } catch (error) {
    console.error('Database query failed in createScheduleRecord:', error);
    throw new Error('Failed to create schedule.', { cause: error });
  }
}

export async function deleteScheduleRecord(scheduleId: number) {
  try {
    const id = Number(scheduleId);
    await db.delete(doctorSchedules).where(eq(doctorSchedules.id, id));
    return { deletedId: id };
  } catch (error) {
    console.error('Database query failed in deleteScheduleRecord:', error);
    throw new Error('Failed to delete schedule.', { cause: error });
  }
}

// ==========================================
// MANUAL MESSAGING AUDIT LOG (ADMIN ONLY)
// ==========================================
export async function recordManualMessagingAuditLog(params: {
  appointmentId: number;
  channel: 'WHATSAPP' | 'SMS';
  deliveryStatus: ManualDeliveryStatus;
  templateType?: string;
  recipientPhone: string;
  messagePreview: string;
  adminActor: string;
}) {
  const existing = await getAppointmentById(params.appointmentId);
  if (!existing) {
    throw new Error('Appointment not found.');
  }

  const statusLabel = MANUAL_DELIVERY_STATUS_LABELS[params.deliveryStatus];
  const note = `[Manual ${params.channel} · ${statusLabel}] (${
    params.templateType || 'CUSTOM'
  } → ${params.recipientPhone}): ${params.messagePreview.slice(0, 220)}`;

  const inserted = await db
    .insert(appointmentHistoryLogs)
    .values({
      appointmentId: existing.id,
      previousStatus: existing.status,
      newStatus: `${existing.status} (${statusLabel})`,
      note,
      changedBy: params.adminActor || 'SAHS Admin',
    })
    .returning();

  return inserted[0];
}

// ==========================================
// CLOUD SQL QR BOOKING DRAFT SESSIONS
// ==========================================
export async function upsertBookingDraftSessionInDb(params: {
  session: SyncSessionState;
  tokenHash: string;
  channelSecretHash: string;
  mobileDeviceSecretHash?: string | null;
  ownerEmail?: string | null;
}) {
  const payloadStr = JSON.stringify(params.session);
  const expiresAtDate = new Date(params.session.expiresAt);

  const existing = await db
    .select()
    .from(bookingDraftSessions)
    .where(eq(bookingDraftSessions.sessionId, params.session.sessionId));

  if (existing[0]) {
    const updated = await db
      .update(bookingDraftSessions)
      .set({
        tokenHash: params.tokenHash,
        channelSecretHash: params.channelSecretHash,
        ...(params.mobileDeviceSecretHash !== undefined
          ? { mobileDeviceSecretHash: params.mobileDeviceSecretHash }
          : {}),
        ...(params.ownerEmail !== undefined
          ? { ownerEmail: params.ownerEmail }
          : {}),
        pairingStatus: params.session.pairingStatus,
        isTokenConsumed: Boolean(params.session.isTokenConsumed),
        isRevoked: Boolean(params.session.isRevoked),
        revision: params.session.revision,
        draftPayload: payloadStr,
        expiresAt: expiresAtDate,
        updatedAt: new Date(),
      })
      .where(eq(bookingDraftSessions.sessionId, params.session.sessionId))
      .returning();
    return updated[0];
  }

  const inserted = await db
    .insert(bookingDraftSessions)
    .values({
      sessionId: params.session.sessionId,
      tokenHash: params.tokenHash,
      channelSecretHash: params.channelSecretHash,
      mobileDeviceSecretHash: params.mobileDeviceSecretHash || null,
      ownerEmail: params.ownerEmail || null,
      pairingStatus: params.session.pairingStatus,
      isTokenConsumed: Boolean(params.session.isTokenConsumed),
      isRevoked: Boolean(params.session.isRevoked),
      revision: params.session.revision,
      draftPayload: payloadStr,
      expiresAt: expiresAtDate,
    })
    .returning();
  return inserted[0];
}

export async function getBookingDraftRowBySessionId(sessionId: string) {
  const rows = await db
    .select()
    .from(bookingDraftSessions)
    .where(eq(bookingDraftSessions.sessionId, sessionId));
  return rows[0] || null;
}

export async function getBookingDraftRowByRawToken(rawToken: string) {
  const tokenHash = hashPairingToken(rawToken);
  const rows = await db
    .select()
    .from(bookingDraftSessions)
    .where(eq(bookingDraftSessions.tokenHash, tokenHash));
  return rows[0] || null;
}

