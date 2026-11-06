"use client";

import { AdminShell } from "@/components/layout/AdminShell";
import { TraceScreen } from "@/components/agent/trace/TraceScreen";

/** Truy vết AI (AI-9): full-screen trace of Home's turns, opened from Hộp thư AI; ✕ returns there. */
export default function TracePage() {
  return (
    <AdminShell bare>
      <TraceScreen />
    </AdminShell>
  );
}
