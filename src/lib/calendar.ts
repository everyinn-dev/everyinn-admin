/** LSB-6 — shared helpers for the calendar BFF routes. */

/** Shape-checks the calendar scope; Booking Core validates the rest (room ↔ class, past dates, manager role). */
export function overrideScope(body: Record<string, unknown>) {
  return {
    roomClass: body.roomClass,
    roomId: typeof body.roomId === "string" && body.roomId ? body.roomId : null,
    ratePlanCodes: Array.isArray(body.ratePlanCodes) ? body.ratePlanCodes : [],
    fromDate: body.fromDate,
    toDate: body.toDate,
    ...(Array.isArray(body.weekdays) && body.weekdays.length ? { weekdays: body.weekdays } : {}),
  };
}
