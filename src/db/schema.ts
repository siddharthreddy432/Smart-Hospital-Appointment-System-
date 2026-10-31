import { relations } from 'drizzle-orm';
import { boolean, integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name'),
  role: text('role').default('patient').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const doctors = pgTable('doctors', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  specialty: text('specialty').notNull(),
  department: text('department').notNull(),
  qualification: text('qualification').notNull(),
  experienceYears: integer('experience_years').notNull(),
  consultationFee: integer('consultation_fee').notNull(),
  roomNumber: text('room_number').notNull(),
  bio: text('bio').notNull(),
  availableDays: text('available_days').notNull(),
  rating: text('rating').notNull(),
});

export const patients = pgTable('patients', {
  id: serial('id').primaryKey(),
  userUid: text('user_uid'),
  fullName: text('full_name').notNull(),
  email: text('email').notNull(),
  phone: text('phone').notNull(),
  age: integer('age').notNull(),
  gender: text('gender').notNull(),
  bloodGroup: text('blood_group').notNull(),
  chronicConditions: integer('chronic_conditions').default(0).notNull(),
  distanceKm: integer('distance_km').default(5).notNull(),
  totalAppointments: integer('total_appointments').default(0).notNull(),
  missedAppointments: integer('missed_appointments').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const doctorSchedules = pgTable('doctor_schedules', {
  id: serial('id').primaryKey(),
  doctorId: integer('doctor_id')
    .references(() => doctors.id)
    .notNull(),
  dayOfWeek: text('day_of_week').notNull(),
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
  slotDurationMinutes: integer('slot_duration_minutes').default(30).notNull(),
  maxPatients: integer('max_patients').default(12).notNull(),
  isAvailable: boolean('is_available').default(true).notNull(),
});

export const appointments = pgTable('appointments', {
  id: serial('id').primaryKey(),
  patientId: integer('patient_id')
    .references(() => patients.id)
    .notNull(),
  doctorId: integer('doctor_id')
    .references(() => doctors.id)
    .notNull(),
  appointmentDate: text('appointment_date').notNull(),
  timeSlot: text('time_slot').notNull(),
  visitType: text('visit_type').default('In-Person').notNull(),
  status: text('status').default('Scheduled').notNull(),
  reason: text('reason').notNull(),
  clinicalNotes: text('clinical_notes').default('').notNull(),
  leadTimeDays: integer('lead_time_days').default(3).notNull(),
  smsReminder: boolean('sms_reminder').default(true).notNull(),
  noShowProbability: integer('no_show_probability').default(15).notNull(),
  noShowRiskLevel: text('no_show_risk_level').default('Low').notNull(),
  bookedByUid: text('booked_by_uid'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const appointmentHistoryLogs = pgTable('appointment_history_logs', {
  id: serial('id').primaryKey(),
  appointmentId: integer('appointment_id')
    .references(() => appointments.id)
    .notNull(),
  previousStatus: text('previous_status').notNull(),
  newStatus: text('new_status').notNull(),
  note: text('note').notNull(),
  changedBy: text('changed_by').notNull(),
  changedAt: timestamp('changed_at').defaultNow(),
});

export const bookingDraftSessions = pgTable('booking_draft_sessions', {
  id: serial('id').primaryKey(),
  sessionId: text('session_id').notNull().unique(),
  tokenHash: text('token_hash').notNull().unique(),
  channelSecretHash: text('channel_secret_hash').notNull(),
  mobileDeviceSecretHash: text('mobile_device_secret_hash'),
  ownerEmail: text('owner_email'),
  pairingStatus: text('pairing_status').default('Waiting for scan').notNull(),
  isTokenConsumed: boolean('is_token_consumed').default(false).notNull(),
  isRevoked: boolean('is_revoked').default(false).notNull(),
  revision: integer('revision').default(1).notNull(),
  draftPayload: text('draft_payload').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const doctorsRelations = relations(doctors, ({ many }) => ({
  schedules: many(doctorSchedules),
  appointments: many(appointments),
}));

export const patientsRelations = relations(patients, ({ many }) => ({
  appointments: many(appointments),
}));

export const doctorSchedulesRelations = relations(doctorSchedules, ({ one }) => ({
  doctor: one(doctors, {
    fields: [doctorSchedules.doctorId],
    references: [doctors.id],
  }),
}));

export const appointmentsRelations = relations(appointments, ({ one, many }) => ({
  patient: one(patients, {
    fields: [appointments.patientId],
    references: [patients.id],
  }),
  doctor: one(doctors, {
    fields: [appointments.doctorId],
    references: [doctors.id],
  }),
  historyLogs: many(appointmentHistoryLogs),
}));

export const appointmentHistoryLogsRelations = relations(appointmentHistoryLogs, ({ one }) => ({
  appointment: one(appointments, {
    fields: [appointmentHistoryLogs.appointmentId],
    references: [appointments.id],
  }),
}));
