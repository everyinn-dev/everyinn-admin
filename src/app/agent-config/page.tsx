"use client";

import { AdminShell } from "@/components/layout/AdminShell";
import { AgentConfig } from "@/components/agent/AgentConfig";

export default function AgentConfigPage() {
  return (
    <AdminShell>
      <AgentConfig />
    </AdminShell>
  );
}
