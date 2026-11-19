/**
 * Business times in Asia/Ho_Chi_Minh (UTC+7, no DST) built WITHOUT the browser's timezone (B8, review S7):
 * a receptionist on a laptop set to another zone must still save the hour the guest was told.
 */
const VN_OFFSET = "+07:00";
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

/** `date` (YYYY-MM-DD) at `hour`:`minute` VN time, `plusDays` later. Hours ≥ 24 roll over like Date#setHours. */
export function vnInstant(date: string, hour: number, minute = 0, plusDays = 0): Date {
  return new Date(Date.parse(`${date}T00:00:00${VN_OFFSET}`) + plusDays * DAY_MS + hour * HOUR_MS + minute * 60_000);
}

/** `date` + `time` (HH:mm) read as VN time. */
export function vnDateTime(date: string, time: string): Date {
  return new Date(`${date}T${time}:00${VN_OFFSET}`);
}

/** YYYY-MM-DD in VN time of an instant. */
export function vnDateOf(d: Date | string | number): string {
  return new Date(new Date(d).getTime() + 7 * HOUR_MS).toISOString().slice(0, 10);
}

/** Calendar arithmetic on a YYYY-MM-DD date (no timezone involved). */
export function addDaysToDate(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** <input type="datetime-local"> value (YYYY-MM-DDTHH:mm) shown in VN time. */
export function vnLocalInputValue(d: Date | string | number): string {
  return new Date(new Date(d).getTime() + 7 * HOUR_MS).toISOString().slice(0, 16);
}

/** A datetime-local value read as VN time → ISO instant. */
export function vnLocalInputToIso(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const ms = Date.parse(`${value}:00${VN_OFFSET}`);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}
