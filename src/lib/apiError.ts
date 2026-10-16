import { CoreError } from "./cores.ts";

export interface ApiErrorResponse {
  error: string;
  code: string;
  details?: unknown;
  requestId?: string;
}

/**
 * Standard HTTP error contract for Admin BFF routes (EI-PHASE1-PLAN §2).
 *
 * - 400 / 401 / 403 / 404 / 409 / 422: Pass through to UI with explicit error code/details.
 * - 5xx / timeout / network: Maps to 503 CORE_UNAVAILABLE so UI renders banner + Retry.
 * - Uncaught application errors: 500 INTERNAL_ERROR.
 */
export function toHttpError(err: unknown): Response {
  if (err instanceof CoreError) {
    // Client errors that UI/user must address (validation, conflict, not-found)
    if (err.status >= 400 && err.status < 500) {
      return Response.json(
        {
          error: err.message,
          code: err.code,
          details: err.details,
          requestId: err.requestId,
        },
        { status: err.status }
      );
    }

    // Core 5xx, gateway errors, or binding timeouts -> 503 Service Unavailable
    return Response.json(
      {
        error: "Dịch vụ tạm thời không khả dụng. Vui lòng thử lại sau.",
        code: err.code || "CORE_UNAVAILABLE",
        details: err.details,
        requestId: err.requestId,
      },
      { status: 503 }
    );
  }

  if (err instanceof Error) {
    console.error("Uncaught BFF error:", err);
    return Response.json(
      {
        error: "Lỗi máy chủ nội bộ.",
        code: "INTERNAL_ERROR",
      },
      { status: 500 }
    );
  }

  console.error("Unknown BFF throw:", err);
  return Response.json(
    {
      error: "Lỗi không xác định.",
      code: "UNKNOWN_ERROR",
    },
    { status: 500 }
  );
}
