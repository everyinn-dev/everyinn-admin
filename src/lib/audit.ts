export async function logEvent(
  db: D1Database,
  eventType: string,
  entityType: string,
  entityId: string,
  payload: Record<string, any>,
  staffId?: number
): Promise<void> {
  try {
    await db
      .prepare(
        `INSERT INTO event_logs (event_type, entity_type, entity_id, payload, staff_id)
         VALUES (?, ?, ?, ?, ?)`
      )
      .bind(
        eventType,
        entityType,
        entityId,
        JSON.stringify(payload),
        staffId ?? null
      )
      .run();
  } catch (error) {
    console.error("Failed to write audit event log:", error);
  }
}
