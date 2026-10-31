'use client';

import React, { Suspense } from 'react';
import BookingWorkspace from '../../components/BookingWorkspace';

export default function BookAppointmentPage() {
  return (
    <Suspense
      fallback={
        <div className="sahs-card p-6 text-xs font-semibold text-[#64748B]">
          Loading SAHS Appointment Booking Workspace...
        </div>
      }
    >
      <BookingWorkspace />
    </Suspense>
  );
}
