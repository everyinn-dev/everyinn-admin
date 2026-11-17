/**
 * Room blocks ("Khoá phòng") — shared rules for the Gantt modal / drawer, mobile cards and the calendar.
 * Mirrors Booking Core (handlers/blocks.ts): stop_sell and owner_stay are manager-only (create, edit, release);
 * maintenance and deep_cleaning are open to every staff member.
 */
export type RoomBlockType = "stop_sell" | "maintenance" | "owner_stay" | "deep_cleaning";

export const ROOM_BLOCK_TYPES: readonly { code: RoomBlockType; label: string; icon: string; hint: string; managerOnly: boolean }[] = [
  { code: "maintenance", label: "Bảo trì / chưa sẵn sàng", icon: "🛠️", hint: "Sửa chữa, thiếu tạp vụ, phòng chưa dọn kịp.", managerOnly: false },
  { code: "deep_cleaning", label: "Dọn sâu", icon: "🧽", hint: "Tổng vệ sinh, sơn tường, xử lý mùi.", managerOnly: false },
  { code: "stop_sell", label: "Đóng bán", icon: "⛔", hint: "Quyết định kinh doanh: ngừng bán phòng (chỉ quản lý).", managerOnly: true },
  { code: "owner_stay", label: "Chủ ở", icon: "🏠", hint: "Chủ nhà / người nhà sử dụng (chỉ quản lý).", managerOnly: true },
];

export function roomBlockTypeOf(code: string | null | undefined) {
  return ROOM_BLOCK_TYPES.find((t) => t.code === code) ?? ROOM_BLOCK_TYPES[0]!;
}

/** Whether this staff member may create / edit / release a block of this type. */
export function canManageBlockType(code: string | null | undefined, isManager: boolean): boolean {
  return isManager || !roomBlockTypeOf(code).managerOnly;
}

export type RoomBlockPhase = "upcoming" | "active" | "ended";

export function blockPhase(b: { blockedFrom: string; blockedTo: string }, now = Date.now()): RoomBlockPhase {
  if (now < Date.parse(b.blockedFrom)) return "upcoming";
  if (now >= Date.parse(b.blockedTo)) return "ended";
  return "active";
}

/** The block (if any) that covers `now` for a room. */
export function activeBlockNow<T extends { blockedFrom: string; blockedTo: string }>(blocks: T[] | undefined, now = Date.now()): T | undefined {
  return (blocks ?? []).find((b) => blockPhase(b, now) === "active");
}

const VN_OFFSET_MS = 7 * 3600 * 1000;

/** "YYYY-MM-DD" + "HH:mm" in Vietnam time → ISO instant (never the browser's own timezone). */
export function vnLocalToIso(date: string, time: string): string {
  return new Date(`${date}T${time}:00+07:00`).toISOString();
}

/** Next 30-minute slot from now, in Vietnam time: { date: YYYY-MM-DD, time: HH:mm }. */
export function vnNextSlot(now = Date.now()): { date: string; time: string } {
  const slotMs = 30 * 60 * 1000;
  const next = Math.ceil((now + VN_OFFSET_MS) / slotMs) * slotMs; // shifted "VN wall clock" as UTC
  const d = new Date(next);
  return { date: d.toISOString().slice(0, 10), time: d.toISOString().slice(11, 16) };
}

/** YYYY-MM-DD + n days (pure date arithmetic, timezone-free). */
export function addDaysStr(date: string, n: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

/** Display an instant in Vietnam time. */
export function formatVn(iso: string, opts: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }): string {
  return new Date(iso).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", ...opts });
}
