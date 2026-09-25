export interface TimelineSlot {
  id: string;
  hour: number;
  label: string;
  subLabel?: string;
  isNight: boolean;
  hoursSpan: number;
}

// 19 slots per day: 00h, 01h-07h (night block), 07h..23h
export const TIMELINE_SLOTS: TimelineSlot[] = [
  { id: "00", hour: 0, label: "00h", isNight: false, hoursSpan: 1 },
  { id: "night", hour: 1, label: "01h - 07h", subLabel: "Đêm khuya", isNight: true, hoursSpan: 6 },
  ...Array.from({ length: 17 }).map((_, i) => {
    const h = i + 7;
    return {
      id: String(h).padStart(2, "0"),
      hour: h,
      label: `${String(h).padStart(2, "0")}h`,
      isNight: false,
      hoursSpan: 1,
    };
  }),
];

// Desktop Month View sizing
export const MONTH_SLOT_WIDTH_NORMAL = 44; // px
export const MONTH_SLOT_WIDTH_NIGHT = 80; // px (prominent for 01h-07h)
export const MONTH_DAY_WIDTH = 18 * MONTH_SLOT_WIDTH_NORMAL + MONTH_SLOT_WIDTH_NIGHT; // 872px

// Desktop Single Day View sizing
export const DAY_SLOT_WIDTH_NORMAL = 56; // px
export const DAY_SLOT_WIDTH_NIGHT = 104; // px
export const SINGLE_DAY_TOTAL_WIDTH = 18 * DAY_SLOT_WIDTH_NORMAL + DAY_SLOT_WIDTH_NIGHT; // 1112px

// Mobile Vertical Sizing
export const MOBILE_SLOT_HEIGHT_NORMAL = 52; // px
export const MOBILE_SLOT_HEIGHT_NIGHT = 84; // px
export const MOBILE_TOTAL_DAY_HEIGHT = 18 * MOBILE_SLOT_HEIGHT_NORMAL + MOBILE_SLOT_HEIGHT_NIGHT; // 1020px

/**
 * Calculate offset in pixels within a single day for a given time
 */
export function timeToDayOffset(
  timeMs: number,
  dayStartMs: number,
  slotNormal: number,
  slotNight: number
): number {
  const elapsedHours = Math.max(0, Math.min(24, (timeMs - dayStartMs) / (3600 * 1000)));

  if (elapsedHours <= 1) {
    return elapsedHours * slotNormal;
  }
  if (elapsedHours <= 7) {
    return slotNormal + ((elapsedHours - 1) / 6) * slotNight;
  }
  return slotNormal + slotNight + (elapsedHours - 7) * slotNormal;
}

/**
 * Get current Vietnam date (UTC+7) in YYYY-MM-DD
 */
export function getVnToday(): string {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

/**
 * Get current Vietnam month (UTC+7) in YYYY-MM
 */
export function getVnCurrentMonth(): string {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 7);
}

/**
 * Format ISO datetime string to HH:mm
 */
export function formatTimeShort(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

/**
 * Format ISO datetime string to DD/MM HH:mm
 */
export function formatDateTimeShort(iso: string): string {
  try {
    const d = new Date(iso);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const time = d.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${day}/${month} ${time}`;
  } catch {
    return "";
  }
}

/**
 * Format YYYY-MM-DD to friendly Vietnamese Day Header (e.g. "T6, 25/09")
 */
export function formatDayHeaderShort(dateStr: string): { weekday: string; dateFormatted: string } {
  try {
    const d = new Date(`${dateStr}T12:00:00`);
    const weekdays = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
    const weekday = weekdays[d.getDay()];
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    return {
      weekday,
      dateFormatted: `${day}/${month}`,
    };
  } catch {
    return { weekday: "", dateFormatted: dateStr };
  }
}
