import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { CoreBookingDto } from "@/lib/coreMappers";
import type { Staff } from "@/types";

export interface TelegramSendResult {
  sent: boolean;
  reason?: string;
}

function escapeHtml(text: string | null | undefined): string {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatVnd(amount: number): string {
  return `${Math.round(amount || 0).toLocaleString("vi-VN")} đ`;
}

function formatVnDateTime(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return iso;
  const vn = new Date(ms + 7 * 3600_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(vn.getUTCHours())}:${pad(vn.getUTCMinutes())} - ${pad(vn.getUTCDate())}/${pad(vn.getUTCMonth() + 1)}/${vn.getUTCFullYear()}`;
}

const BOOKING_TYPE_LABEL: Record<string, string> = {
  hourly: "Theo Giờ",
  overnight: "Qua Đêm",
  dayuse: "Theo Ngày",
  custom: "Tuỳ Chỉnh",
};

async function resolveTelegramCredentials(): Promise<{ botToken: string; chatId: string }> {
  let botToken = process.env.TELEGRAM_BOT_TOKEN?.trim() ?? "";
  let chatId = process.env.TELEGRAM_CHAT_ID?.trim() ?? "";

  try {
    const ctx = await getCloudflareContext({ async: true });
    const env = (ctx?.env ?? {}) as unknown as Record<string, string | undefined>;
    if (env.TELEGRAM_BOT_TOKEN?.trim()) botToken = env.TELEGRAM_BOT_TOKEN.trim();
    if (env.TELEGRAM_CHAT_ID?.trim()) chatId = env.TELEGRAM_CHAT_ID.trim();
  } catch {
    // Fallback to process.env in local Node/test environments
  }

  return { botToken, chatId };
}

export function buildBookingTelegramHtml(
  booking: CoreBookingDto,
  staff: Pick<Staff, "id" | "full_name">,
  holdId?: string
): string {
  const roomLabel = booking.roomName
    ? `${booking.roomName} (${booking.roomClass.toUpperCase()})`
    : booking.roomId;
  const typeLabel = BOOKING_TYPE_LABEL[booking.bookingType] ?? booking.bookingType;

  const socials: string[] = [];
  if (booking.guest.instagram) socials.push(`IG: ${escapeHtml(booking.guest.instagram)}`);
  if (booking.guest.facebook) socials.push(`FB: ${escapeHtml(booking.guest.facebook)}`);
  if (booking.guest.zalo) socials.push(`Zalo: ${escapeHtml(booking.guest.zalo)}`);
  const socialText = socials.length > 0 ? socials.join(" | ") : "—";

  const paymentBadge = booking.financial.isDeposit
    ? `Đặt cọc giữ phòng (Hạn TT: ${escapeHtml(booking.financial.depositDueDate || "Khi nhận phòng")})`
    : "Thanh toán đủ 100%";

  const lines = [
    `🎉 <b>ĐẶT PHÒNG MỚI ĐÃ THANH TOÁN (#${escapeHtml(booking.id)})</b>`,
    `━━━━━━━━━━━━━━━━━━`,
    `🏠 <b>Phòng:</b> ${escapeHtml(roomLabel)} • ${booking.numGuests} khách`,
    `🏷️ <b>Loại hình:</b> ${escapeHtml(typeLabel)}`,
    `📥 <b>Nhận phòng:</b> ${escapeHtml(formatVnDateTime(booking.checkinAt))}`,
    `📤 <b>Trả phòng:</b> ${escapeHtml(formatVnDateTime(booking.checkoutAt))}`,
    `━━━━━━━━━━━━━━━━━━`,
    `👤 <b>Khách hàng:</b> ${escapeHtml(booking.guest.name)}`,
    `📞 <b>SĐT:</b> <code>${escapeHtml(booking.guest.phoneDisplay || booking.guest.contactRaw)}</code>`,
    `📱 <b>MXH:</b> ${socialText}`,
    `💬 <b>Câu chốt:</b> ${escapeHtml(booking.closingNote || "—")}`,
  ];

  if (booking.note) {
    lines.push(`📝 <b>Ghi chú nội bộ:</b> ${escapeHtml(booking.note)}`);
  }

  lines.push(
    `━━━━━━━━━━━━━━━━━━`,
    `💰 <b>Tổng giá trị đơn:</b> <b>${formatVnd(booking.pricing.totalPrice)}</b>`,
    `✅ <b>Đã thanh toán:</b> ${formatVnd(booking.financial.paidAmount)} (${paymentBadge})`,
    `⏳ <b>Còn lại cần thu:</b> ${formatVnd(booking.financial.remainingAmount)}`,
    `👩‍💼 <b>Lễ tân thực hiện:</b> ${escapeHtml(staff.full_name || `#${staff.id}`)}`
  );

  if (holdId) {
    lines.push(`🔒 <b>Mã phiên giữ phòng:</b> <code>${escapeHtml(holdId)}</code>`);
  }

  return lines.join("\n");
}

/**
 * Sends an owner notification message via Telegram Bot API when a booking payment is confirmed.
 * Never throws: if credentials are not configured yet or Telegram API times out, logs a warning and returns `{ sent: false }`.
 */
export async function sendTelegramBookingNotification(
  booking: CoreBookingDto,
  staff: Pick<Staff, "id" | "full_name">,
  opts?: { holdId?: string; botToken?: string; chatId?: string }
): Promise<TelegramSendResult> {
  try {
    const resolved = await resolveTelegramCredentials();
    const botToken = opts?.botToken?.trim() || resolved.botToken;
    const chatId = opts?.chatId?.trim() || resolved.chatId;

    if (!botToken || !chatId) {
      console.warn(
        "[Telegram] TELEGRAM_BOT_TOKEN hoặc TELEGRAM_CHAT_ID chưa được cấu hình — bỏ qua gửi thông báo cho đơn:",
        booking.id
      );
      return { sent: false, reason: "MISSING_CREDENTIALS" };
    }

    const text = buildBookingTelegramHtml(booking, staff, opts?.holdId);
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(3500),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.warn(`[Telegram] Gửi tin nhắn thất bại (${res.status}):`, errBody.slice(0, 300));
      return { sent: false, reason: `HTTP_${res.status}` };
    }

    return { sent: true };
  } catch (err) {
    console.warn("[Telegram] Lỗi khi gửi thông báo đặt phòng:", err instanceof Error ? err.message : String(err));
    return { sent: false, reason: "NETWORK_OR_TIMEOUT_ERROR" };
  }
}
