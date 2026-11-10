"use client";

import { AdminShell } from "@/components/layout/AdminShell";
import { ManagerOnly } from "@/components/layout/ManagerOnly";
import { AgentInbox } from "@/components/agent/AgentInbox";

export default function AgentInboxPage() {
  return (
    <AdminShell>
      <ManagerOnly featureName="Hộp Thư AI">
        <AgentInbox />
      </ManagerOnly>
    </AdminShell>
  );
}
