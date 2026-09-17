"use client";

import { ToastProvider } from "@/hooks/useToast";
import { CalendarApp } from "@/components/CalendarApp";

// The Calendar rendered inside the operator shell (its own branded header
// hidden). ToastProvider is supplied here because the calendar uses the root
// toast hook, which the operator layout doesn't provide.
export default function OperatorCalendarPage() {
  return (
    <ToastProvider>
      <CalendarApp embedded />
    </ToastProvider>
  );
}
