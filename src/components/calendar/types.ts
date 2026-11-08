/** LSB-6 — Booking Core GET /calendar/matrix (contract schema CalendarMatrix). */
export type CalendarPlan = "combo3h" | "overnight" | "dayroom";
export type BlockType = "stop_sell" | "maintenance" | "owner_stay" | "deep_cleaning";

export interface CalendarRate {
  price: number | null;
  listPrice: number | null;
  override: { id: string; scope: "room" | "class"; note: string | null } | null;
}

export interface CalendarDay {
  date: string;
  bookable: boolean;
  rates: Record<CalendarPlan, CalendarRate>;
  closures: { id: string; blockType: BlockType; reason: string; from: string; to: string; version: number }[];
  bookings: number;
  holds: number;
  occupancyPct: number;
}

export interface CalendarRoom {
  id: string;
  name: string;
  roomNumber: string;
  roomClass: "haven" | "signature";
  days: CalendarDay[];
}

export interface CalendarMatrix {
  from: string;
  to: string;
  today: string;
  bookingWindow: { maxAdvanceDays: number; maxDate: string };
  ratePlans: CalendarPlan[];
  blockTypes: { code: BlockType; label: string }[];
  rooms: CalendarRoom[];
}

/** a rectangle of the grid: rooms × consecutive dates */
export interface CalendarSelection {
  rooms: CalendarRoom[];
  from: string;
  to: string;
}

export const PLAN_LABEL: Record<CalendarPlan, string> = { overnight: "Qua đêm", combo3h: "Combo 3h", dayroom: "Theo ngày" };
export const CLASS_LABEL: Record<CalendarRoom["roomClass"], string> = { haven: "Haven", signature: "Signature" };
export const WEEKDAY = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

export const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
export const weekdayOf = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();
export const dm = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}`;
/** VN wall-clock (UTC+7, no DST) → ISO instant */
export const vnInstant = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00+07:00`).toISOString();
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000) + 1;
