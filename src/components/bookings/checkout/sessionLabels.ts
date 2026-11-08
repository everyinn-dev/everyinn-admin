/** LSB-5 — Vietnamese labels for booking-session audit events (agent-core src/sessions/machine.ts event names). */
export const EVENT_LABEL: Record<string, string> = {
  HOLD_CREATED: "Giữ phòng",
  GUEST_SAVED: "Lưu thông tin khách",
  GUEST_CLAIMED_PAID: "Khách báo đã chuyển khoản",
  PAYMENT_RECEIVED: "Ghi nhận tiền",
  OWNER_CONFIRMED: "Xác nhận đã nhận tiền",
  OWNER_REJECTED: "Báo chưa nhận được tiền",
  OWNER_ACCEPT_SHORT: "Chốt dạng cọc",
  OWNER_REQUEST_TOPUP: "Yêu cầu khách chuyển bù",
  CONFIRM_SUCCEEDED: "Lên đơn thành công",
  OWNER_REVOKED: "Thu hồi phòng",
  EXPIRED: "Hết thời gian giữ",
  SHARE_LINK_ISSUED: "Tạo link thanh toán cho khách",
};

export const eventLabel = (event: string): string => EVENT_LABEL[event] ?? event;
