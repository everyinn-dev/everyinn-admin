"use client";

import { AdminShell } from "@/components/layout/AdminShell";
import { ManagerOnly } from "@/components/layout/ManagerOnly";
import { AgentConfig } from "@/components/agent/AgentConfig";

export default function AgentConfigPage() {
  return (
    <AdminShell>
      <ManagerOnly featureName="Cấu hình AI Lễ Tân">
        <AgentConfig />
      </ManagerOnly>
    </AdminShell>
  );
}
