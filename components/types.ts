export interface Doctor {
  id: number;
  name: string;
  specialty: string;
  department: string;
  qualification: string;
  experienceYears: number;
  consultationFee: number;
  roomNumber: string;
  bio: string;
  availableDays: string;
  rating: string;
}

export interface Patient {
  id: number;
  userUid: string | null;
  fullName: string;
  email: string;
  phone: string;
  age: number;
  gender: string;
  bloodGroup: string;
  chronicConditions: number;
  distanceKm: number;
  totalAppointments: number;
  missedAppointments: number;
  createdAt?: string;
}

export interface DoctorSchedule {
  id: number;
  doctorId: number;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  slotDurationMinutes: number;
  maxPatients: number;
  isAvailable: boolean;
}

export interface Appointment {
  id: number;
  patientId: number;
  doctorId: number;
  appointmentDate: string;
  timeSlot: string;
  visitType: 'In-Person' | 'Telehealth';
  status: 'Scheduled' | 'Completed' | 'Cancelled' | 'No-Show';
  reason: string;
  clinicalNotes: string;
  leadTimeDays: number;
  smsReminder: boolean;
  noShowProbability: number;
  noShowRiskLevel: 'Low' | 'Moderate' | 'High';
  bookedByUid: string | null;
  createdAt?: string;
}

export interface AppointmentHistoryLog {
  id: number;
  appointmentId: number;
  previousStatus: string;
  newStatus: string;
  note: string;
  changedBy: string;
  changedAt?: string;
}
