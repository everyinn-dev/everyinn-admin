import { NextRequest, NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { logEvent } from "@/lib/audit";
import { agentCore, coreErrorResponse } from "@/lib/cores";
import { matchAgentRoute, type AgentMethod as Method } from "@/lib/agentRoutes";
import {
  buildDoorCodeAuditDescriptor,
  isManagerOnlyDoorCodeRoute,
  isReceptionistAllowedAgentRoute,
} from "@/lib/doorCodeUtils";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function writeDoorCodeAudit(input: {
  method: Method;
  path: string;
  status: number;
  body?: Record<string, unknown> | null;
  responseData?: Record<string, unknown> | null;
  staff: { id: number; role: string; full_name?: string | null };
}) {
  const descriptor = buildDoorCodeAuditDescriptor(input);
  if (!descriptor) return;
  try {
    const db = await getDb();
    await logEvent(db, descriptor.eventType, descriptor.entityType, descriptor.entityId, descriptor.payload, input.staff.id);
  } catch (err) {
    console.error("Door code BFF audit failed (non-blocking):", err);
  }
}

/**
 * BFF proxy for the AI receptionist & Door-code vault (everyinn-agent-core AdminApi).
 * Explicit allow-list of path shapes + methods, staff auth + manager write/audit defense-in-depth,
 * plus secret-safe BFF audit logging in admin-db event_logs (never storing plaintext codes).
 */
async function proxy(req: NextRequest, method: Method, params: Promise<{ path: string[] }>) {
  try {
    const staff = await getCurrentStaff();
    if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const path = (await params).path.map(encodeURIComponent).join("/");
    const route = matchAgentRoute(method, path);
    if (!route) return NextResponse.json({ error: "Không tìm thấy endpoint AI Lễ Tân.", code: "ROUTE_NOT_FOUND" }, { status: 404 });

    let body: unknown = undefined;
    if (method !== "GET" && method !== "DELETE") {
      const text = await req.text();
      body = text ? JSON.parse(text) : {};
    }

    // Defense-in-depth RBAC guard at BFF edge: receptionists may only read/resolve door codes.
    if (staff.role !== "manager" && !isReceptionistAllowedAgentRoute(method, path)) {
      if (isManagerOnlyDoorCodeRoute(method, path)) {
        await writeDoorCodeAudit({
          method,
          path,
          status: 403,
          body: (body && typeof body === "object" ? (body as Record<string, unknown>) : null),
          staff,
        });
      }
      return NextResponse.json(
        { error: "Chỉ quản lý (manager) được phép thực hiện thao tác hoặc truy cập tính năng này.", code: "FORBIDDEN_ROLE" },
        { status: 403 },
      );
    }

    const url = new URL(req.url);
    const query = Object.fromEntries(url.searchParams.entries());
    const res = await agentCore[method === "GET" ? "get" : method === "POST" ? "post" : method === "PUT" ? "put" : "delete"]<unknown>(`/internal/v1/${path}`, {
      staff,
      query,
      body,
      ifNoneMatch: req.headers.get("if-none-match"),
      timeoutMs: route.timeoutMs,
      maxAttempts: 1,
    });

    await writeDoorCodeAudit({
      method,
      path,
      status: res.status,
      body: (body && typeof body === "object" ? (body as Record<string, unknown>) : null),
      responseData: (res.data && typeof res.data === "object" ? (res.data as Record<string, unknown>) : null),
      staff,
    });

    if (res.status === 304) return new NextResponse(null, { status: 304, headers: { ETag: res.etag ?? "", "Cache-Control": "no-cache" } });
    const headers: Record<string, string> = { "Cache-Control": "no-store" };
    if (res.etag) headers.ETag = res.etag;
    return NextResponse.json(res.data, { status: res.status, headers });
  } catch (error) {
    return coreErrorResponse(error);
  }
}

type Ctx = { params: Promise<{ path: string[] }> };
export const GET = (req: NextRequest, ctx: Ctx) => proxy(req, "GET", ctx.params);
export const POST = (req: NextRequest, ctx: Ctx) => proxy(req, "POST", ctx.params);
export const PUT = (req: NextRequest, ctx: Ctx) => proxy(req, "PUT", ctx.params);
export const DELETE = (req: NextRequest, ctx: Ctx) => proxy(req, "DELETE", ctx.params);
