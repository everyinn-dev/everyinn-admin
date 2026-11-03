"use client";

import { AdminShell } from "@/components/layout/AdminShell";
import { AgentInbox } from "@/components/agent/AgentInbox";

export default function AgentInboxPage() {
  return (
    <AdminShell>
      <AgentInbox />
    </AdminShell>
  );
}
