import { bookingCore, cdpCore } from "./cores.ts";

export interface HealthCheckOptions {
  db?: { prepare: (sql: string) => { first: () => Promise<unknown> } } | null;
  timeoutMs?: number;
}

export interface HealthReport {
  status: "ok" | "degraded";
  worker: string;
  durationMs: number;
  checks: {
    adminDb: string;
    bookingCore: string;
    cdpCore: string;
  };
}

export async function checkHealth(options: HealthCheckOptions = {}): Promise<HealthReport> {
  const startedAt = Date.now();
  let adminDb = "ok";
  let bookingCoreStatus = "ok";
  let cdpCoreStatus = "ok";

  if (options.db) {
    try {
      await options.db.prepare("SELECT 1").first();
    } catch {
      adminDb = "down";
    }
  } else {
    adminDb = "ok";
  }

  const systemStaff = { id: 0, role: "system" as any, full_name: "Health Probe" };
  const timeoutMs = options.timeoutMs ?? 3000;

  try {
    const res = await bookingCore.get<{ status: string }>("/health", {
      staff: systemStaff,
      timeoutMs,
    });
    bookingCoreStatus = res.data?.status === "ok" ? "ok" : "degraded";
  } catch {
    bookingCoreStatus = "down";
  }

  try {
    const res = await cdpCore.get<{ status: string }>("/health", {
      staff: systemStaff,
      timeoutMs,
    });
    cdpCoreStatus = res.data?.status === "ok" ? "ok" : "degraded";
  } catch {
    cdpCoreStatus = "down";
  }

  const allOk = adminDb === "ok" && bookingCoreStatus === "ok" && cdpCoreStatus === "ok";

  return {
    status: allOk ? "ok" : "degraded",
    worker: "everyinn-admin",
    durationMs: Date.now() - startedAt,
    checks: {
      adminDb,
      bookingCore: bookingCoreStatus,
      cdpCore: cdpCoreStatus,
    },
  };
}
