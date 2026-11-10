"use client";

import { AdminShell } from "@/components/layout/AdminShell";
import { ManagerOnly } from "@/components/layout/ManagerOnly";
import { AgentOps } from "@/components/agent/ops/AgentOps";

/** Vận hành AI (AI-7 W4): full-screen workspace opened from Cấu hình AI; ✕ returns there. */
export default function AgentOpsPage() {
  return (
    <AdminShell bare>
      <ManagerOnly featureName="Vận hành AI">
        <AgentOps />
      </ManagerOnly>
    </AdminShell>
  );
}
