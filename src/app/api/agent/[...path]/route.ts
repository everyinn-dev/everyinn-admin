import { NextRequest, NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/auth";
import { agentCore, coreErrorResponse } from "@/lib/cores";
import { matchAgentRoute, type AgentMethod as Method } from "@/lib/agentRoutes";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * BFF proxy for the AI receptionist (everyinn-agent-core AdminApi). One route instead of ~30 thin ones:
 * an explicit allow-list of path shapes + methods, staff auth here, role checks in agent-core (x-ei-actor-role).
 * Browser → /api/agent/<path> → AGENT_CORE (entrypoint AdminApi) → /internal/v1/<path>.
 */
async function proxy(req: NextRequest, method: Method, params: Promise<{ path: string[] }>) {
  try {
    const staff = await getCurrentStaff();
    if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const path = (await params).path.map(encodeURIComponent).join("/");
    const route = matchAgentRoute(method, path);
    if (!route) return NextResponse.json({ error: "Không tìm thấy endpoint AI Lễ Tân.", code: "ROUTE_NOT_FOUND" }, { status: 404 });
    const url = new URL(req.url);
    const query = Object.fromEntries(url.searchParams.entries());
    let body: unknown = undefined;
    if (method !== "GET" && method !== "DELETE") {
      const text = await req.text();
      body = text ? JSON.parse(text) : {};
    }
    const res = await agentCore[method === "GET" ? "get" : method === "POST" ? "post" : method === "PUT" ? "put" : "delete"]<unknown>(`/internal/v1/${path}`, {
      staff,
      query,
      body,
      ifNoneMatch: req.headers.get("if-none-match"),
      timeoutMs: route.timeoutMs,
      maxAttempts: 1,
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
