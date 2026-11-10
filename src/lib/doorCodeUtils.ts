/**
 * Pure door-code utilities, VN timezone range conversions, batch chunking, and secret-safe BFF audit helpers.
 * Kept alias-free so unit tests running with `node --test` can import it directly.
 */

export const DOOR_CODE_PATTERN = /^[0-9*#]{3,12}$/;

export interface RoomDisplayMeta {
  id: string;
  number: string;
  label: string;
  roomClass: "haven" | "signature";
}

export const ROOM_CATALOG: readonly RoomDisplayMeta[] = [
  { id: "haven-101", number: "101", label: "Haven 101", roomClass: "haven" },
  { id: "sig-102", number: "102", label: "Signature 102", roomClass: "signature" },
  { id: "haven-201", number: "201", label: "Haven 201", roomClass: "haven" },
  { id: "sig-202", number: "202", label: "Signature 202", roomClass: "signature" },
  { id: "haven-301", number: "301", label: "Haven 301", roomClass: "haven" },
  { id: "sig-302", number: "302", label: "Signature 302", roomClass: "signature" },
];

export const ROOM_BY_ID: ReadonlyMap<string, RoomDisplayMeta> = new Map(ROOM_CATALOG.map((r) => [r.id, r]));

export function normalizeDoorCode(raw: string): string | null {
  const cleaned = raw.replace(/\s+/g, "");
  return DOOR_CODE_PATTERN.test(cleaned) ? cleaned : null;
}

/** Secret-safe mask matching agent-core's `maskCode`: "2580#" -> "•••0#". */
export function maskDoorCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw.replace(/\s+/g, "");
  if (!cleaned) return null;
  if (cleaned.length <= 2) return "••";
  return `${"•".repeat(Math.max(2, cleaned.length - 2))}${cleaned.slice(-2)}`;
}

/** Convert VN (+07:00) YYYY-MM-DD + optional HH:mm bounds into UTC ISO strings. */
export function vnDateRangeToIso(
  fromDate: string,
  toDate: string,
  fromTime = "00:00",
  toTime = "23:59",
): { validFrom: string; validUntil: string } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(toDate)) return null;
  if (!/^\d{2}:\d{2}$/.test(fromTime) || !/^\d{2}:\d{2}$/.test(toTime)) return null;
  const fromMs = Date.parse(`${fromDate}T${fromTime}:00+07:00`);
  const untilMs = Date.parse(`${toDate}T${toTime}:59+07:00`);
  if (!Number.isFinite(fromMs) || !Number.isFinite(untilMs) || untilMs <= fromMs) return null;
  return {
    validFrom: new Date(fromMs).toISOString(),
    validUntil: new Date(untilMs).toISOString(),
  };
}

export function addDaysYmd(ymd: string, deltaDays: number): string {
  const ms = Date.parse(`${ymd}T12:00:00Z`);
  if (!Number.isFinite(ms)) return ymd;
  return new Date(ms + deltaDays * 86_400_000).toISOString().slice(0, 10);
}

export function chunkArray<T>(items: readonly T[], size = 20): T[][] {
  if (size <= 0) return [Array.from(items)];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

export interface GateCodeWindowLike {
  id: string;
  code: string;
  label: string | null;
  validFrom: string;
  validUntil: string | null;
  state: "current" | "scheduled" | "expired" | "inactive";
  source: string;
}

/** Finds active (non-inactive) gate codes overlapping the VN day `YYYY-MM-DD`, newest validFrom first. */
export function findGateCodesForVnDate<T extends GateCodeWindowLike>(gates: readonly T[], targetDate: string): T[] {
  const dayStartMs = Date.parse(`${targetDate}T00:00:00+07:00`);
  const dayEndMs = dayStartMs + 86_400_000;
  if (!Number.isFinite(dayStartMs)) return [];
  return gates
    .filter((g) => {
      if (g.state === "inactive") return false;
      const fromMs = Date.parse(g.validFrom);
      const untilMs = g.validUntil ? Date.parse(g.validUntil) : Number.POSITIVE_INFINITY;
      return fromMs < dayEndMs && untilMs > dayStartMs;
    })
    .sort((a, b) => Date.parse(b.validFrom) - Date.parse(a.validFrom));
}

export function formatBookingDoorCodeCopyText(input: {
  roomNumber: string;
  gateCode: string | null;
  lockboxCode: string | null;
}): string {
  const parts = [`Phòng ${input.roomNumber}`];
  if (input.gateCode) parts.push(`Mã cổng: ${input.gateCode}`);
  if (input.lockboxCode) parts.push(`Hộp khóa: ${input.lockboxCode}`);
  return parts.join(" | ");
}

export interface DoorCodeAuditDescriptor {
  eventType: string;
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
}

/**
 * Checks whether a /api/agent/* request requires manager privileges before modifying/auditing door codes.
 * Notice read/resolve routes (`GET door-codes`, `GET bookings/:id/door-code`, `POST door-codes/resolve-batch`) are open to receptionists.
 */
export function isManagerOnlyDoorCodeRoute(method: string, path: string): boolean {
  if (method === "POST" && /^door-codes\/gate$/.test(path)) return true;
  if (method === "POST" && /^door-codes\/gate\/[^/]+\/deactivate$/.test(path)) return true;
  if (method === "PUT" && /^door-codes\/lockbox\/[^/]+$/.test(path)) return true;
  if ((method === "PUT" || method === "DELETE") && /^bookings\/[^/]+\/door-code$/.test(path)) return true;
  if (method === "GET" && /^door-codes\/audit$/.test(path)) return true;
  return false;
}

/**
 * Builds an `admin-db` `event_logs` audit descriptor for door-code actions and 403 denials.
 * Strict security invariant: NEVER includes plaintext PINs in the payload.
 */
export function buildDoorCodeAuditDescriptor(input: {
  method: string;
  path: string;
  status: number;
  body?: Record<string, unknown> | null;
  responseData?: Record<string, unknown> | null;
  staff: { id: number; role: string; full_name?: string | null };
}): DoorCodeAuditDescriptor | null {
  const { method, path, status, body, responseData, staff } = input;
  const actorMeta = {
    role: staff.role,
    staffName: staff.full_name ?? null,
    status,
  };

  const gateCreate = method === "POST" && /^door-codes\/gate$/.test(path);
  const gateDeactivate = method === "POST" && /^door-codes\/gate\/([^/]+)\/deactivate$/.exec(path);
  const lockboxPut = method === "PUT" && /^door-codes\/lockbox\/([^/]+)$/.exec(path);
  const overrideMut = (method === "PUT" || method === "DELETE") && /^bookings\/([^/]+)\/door-code$/.exec(path);
  const auditRead = method === "GET" && /^door-codes\/audit$/.test(path);

  if (!gateCreate && !gateDeactivate && !lockboxPut && !overrideMut && !auditRead) {
    return null;
  }

  if (status === 403) {
    const entityId = gateDeactivate
      ? decodeURIComponent(gateDeactivate[1]!)
      : lockboxPut
        ? decodeURIComponent(lockboxPut[1]!)
        : overrideMut
          ? decodeURIComponent(overrideMut[1]!)
          : gateCreate
            ? "gate"
            : "audit";
    return {
      eventType: "door_code.access_denied",
      entityType: "door_code_rbac",
      entityId,
      payload: {
        ...actorMeta,
        method,
        path,
      },
    };
  }

  if (status < 200 || status >= 300) {
    return null;
  }

  if (gateCreate) {
    const rawCode = typeof body?.code === "string" ? body.code : null;
    const gateCodeObj = (responseData?.gateCode as Record<string, unknown> | undefined) ?? undefined;
    const gateId = typeof gateCodeObj?.id === "string" ? gateCodeObj.id : "unknown";
    return {
      eventType: "door_code.gate_create",
      entityType: "gate_code",
      entityId: gateId,
      payload: {
        ...actorMeta,
        codeMasked: maskDoorCode(rawCode),
        codeLength: rawCode ? rawCode.replace(/\s+/g, "").length : null,
        label: typeof body?.label === "string" ? body.label : null,
        validFrom: gateCodeObj?.validFrom ?? body?.validFrom ?? null,
        validUntil: gateCodeObj?.validUntil ?? body?.validUntil ?? null,
        releasedSchedules: typeof responseData?.releasedSchedules === "number" ? responseData.releasedSchedules : 0,
      },
    };
  }

  if (gateDeactivate) {
    return {
      eventType: "door_code.gate_deactivate",
      entityType: "gate_code",
      entityId: decodeURIComponent(gateDeactivate[1]!),
      payload: { ...actorMeta },
    };
  }

  if (lockboxPut) {
    const rawCode = typeof body?.code === "string" ? body.code : null;
    return {
      eventType: "door_code.lockbox_upsert",
      entityType: "room_lockbox",
      entityId: decodeURIComponent(lockboxPut[1]!),
      payload: {
        ...actorMeta,
        codeMasked: maskDoorCode(rawCode),
        codeLength: rawCode ? rawCode.replace(/\s+/g, "").length : null,
        releasedSchedules: typeof responseData?.releasedSchedules === "number" ? responseData.releasedSchedules : 0,
      },
    };
  }

  if (overrideMut) {
    const bookingId = decodeURIComponent(overrideMut[1]!);
    if (method === "PUT") {
      const rawCode = typeof body?.gateCode === "string" ? body.gateCode : null;
      return {
        eventType: "door_code.override_upsert",
        entityType: "booking_door_code",
        entityId: bookingId,
        payload: {
          ...actorMeta,
          codeMasked: maskDoorCode(rawCode),
          codeLength: rawCode ? rawCode.replace(/\s+/g, "").length : null,
          note: typeof body?.note === "string" ? body.note : null,
          releasedSchedules: typeof responseData?.releasedSchedules === "number" ? responseData.releasedSchedules : 0,
        },
      };
    }
    return {
      eventType: "door_code.override_delete",
      entityType: "booking_door_code",
      entityId: bookingId,
      payload: { ...actorMeta },
    };
  }

  return null;
}
