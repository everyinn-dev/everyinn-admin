"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { DailyRosterItem, DailyRosterResponse, GanttBookingItem } from "@/types";
import { apiFetch } from "@/lib/apiClient";
import { getVnToday, formatTimeShort, formatDateTimeShort } from "@/lib/timelineUtils";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";

interface DailyRosterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectBooking?: (booking: GanttBookingItem) => void;
}

const PROPERTY_INFO = {
  name: "Every Inn Phan Xích Long",
  address: "Phan Xích Long, Phường Cầu Kiệu (Phú Nhuận cũ), TP. Hồ Chí Minh",
  wifiSsid: "EveryInn_Guest",
  wifiPassword: "everyinn2024",
  hotline: "0909 998 888",
  checkinInstruction: "Bấm chuông lễ tân tầng G hoặc mở cửa bằng mã số điện tử.",
};

export const DailyRosterModal: React.FC<DailyRosterModalProps> = ({
  isOpen,
  onClose,
  onSelectBooking,
}) => {
  const toast = useToast();
  const vnToday = useMemo(() => getVnToday(), []);
  const [selectedDate, setSelectedDate] = useState<string>(vnToday);
  const [data, setData] = useState<DailyRosterResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [viewTab, setViewTab] = useState<"both" | "checkin" | "checkout">("both");
  const [searchFilter, setSearchFilter] = useState<string>("");

  // Fetch roster data for selectedDate
  const fetchRoster = useCallback(async (dateStr: string) => {
    try {
      setLoading(true);
      const res = await apiFetch(`/api/bookings/daily-roster?date=${dateStr}`);
      if (res.ok) {
        const json = (await res.json()) as DailyRosterResponse;
        setData(json);
      } else {
        toast.error("Không thể tải lịch điều phối ngày.", "Lỗi tải dữ liệu");
      }
    } catch (err) {
      console.error(err);
      toast.error("Lỗi kết nối khi tải lịch điều phối.", "Lỗi mạng");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (isOpen) {
      fetchRoster(selectedDate);
    }
  }, [isOpen, selectedDate, fetchRoster]);

  // Keyboard shortcut: Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Quick Date Jump Handlers
  const handlePrevDay = () => {
    const current = new Date(`${selectedDate}T12:00:00+07:00`);
    current.setDate(current.getDate() - 1);
    setSelectedDate(current.toISOString().slice(0, 10));
  };

  const handleNextDay = () => {
    const current = new Date(`${selectedDate}T12:00:00+07:00`);
    current.setDate(current.getDate() + 1);
    setSelectedDate(current.toISOString().slice(0, 10));
  };

  const handleToday = () => {
    setSelectedDate(vnToday);
  };

  // Filtered checkins and checkouts based on search filter
  const filteredCheckins = useMemo(() => {
    if (!data?.checkins) return [];
    if (!searchFilter.trim()) return data.checkins;
    const q = searchFilter.toLowerCase().trim();
    return data.checkins.filter(
      (c) =>
        c.roomName.toLowerCase().includes(q) ||
        c.guestName.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        c.instagram?.toLowerCase().includes(q) ||
        c.facebook?.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q)
    );
  }, [data?.checkins, searchFilter]);

  const filteredCheckouts = useMemo(() => {
    if (!data?.checkouts) return [];
    if (!searchFilter.trim()) return data.checkouts;
    const q = searchFilter.toLowerCase().trim();
    return data.checkouts.filter(
      (c) =>
        c.roomName.toLowerCase().includes(q) ||
        c.guestName.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        c.instagram?.toLowerCase().includes(q) ||
        c.facebook?.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q)
    );
  }, [data?.checkouts, searchFilter]);

  // Format pre-arrival check-in instruction message for guest
  const copyCheckinGuide = (item: DailyRosterItem) => {
    const checkinTimeFormatted = formatDateTimeShort(item.checkinAt);
    const checkoutTimeFormatted = formatDateTimeShort(item.checkoutAt);
    const doorCodeText = item.doorCode
      ? `🔑 Mã mở khóa phòng của bạn: ${item.doorCode}`
      : `🔑 Mã khóa phòng: Lễ tân sẽ cung cấp ngay khi bạn đến sảnh`;

    const message = `🏨 ${PROPERTY_INFO.name.toUpperCase()} — HƯỚNG DẪN NHẬN PHÒNG
Chào bạn ${item.guestName || "quý khách"}, Every Inn xin gửi bạn thông tin nhận phòng:

📍 Địa chỉ: ${PROPERTY_INFO.address}
🚪 Phòng: ${item.roomName} (${item.roomClass === "signature" ? "Signature" : "Haven"} - Tầng ${item.floor})
⏰ Nhận phòng (Check-in): ${checkinTimeFormatted}
⏰ Trả phòng (Check-out): ${checkoutTimeFormatted}

${doorCodeText}
📶 WiFi: ${PROPERTY_INFO.wifiSsid} (Mật khẩu: ${PROPERTY_INFO.wifiPassword})
ℹ️ Hướng dẫn: ${PROPERTY_INFO.checkinInstruction}
📞 Hotline hỗ trợ 24/7: ${PROPERTY_INFO.hotline}

Chúc bạn có một trải nghiệm lưu trú thật ấm cúng và thoải mái tại Every Inn! ✨`;

    navigator.clipboard.writeText(message);
    toast.success(
      `Đã sao chép hướng dẫn nhận phòng cho khách ${item.guestName}!`,
      "Đã sao chép tin nhắn"
    );
  };

  // Format turnover cleaning briefing for Housekeeping
  const copyHousekeepingBriefing = (item: DailyRosterItem) => {
    const checkoutTime = formatTimeShort(item.checkoutAt);
    const turnoverStart = formatTimeShort(item.turnoverStartAt || item.checkoutAt);
    const turnoverEnd = formatTimeShort(item.turnoverEndAt || item.checkoutAt);

    const message = `🧹 LỊCH DỌN PHÒNG — ${PROPERTY_INFO.name.toUpperCase()}
📅 Ngày: ${selectedDate}
- Phòng: ${item.roomName} (Tầng ${item.floor})
- Khách trả phòng lúc: ${checkoutTime} ${item.lateCheckoutHours > 0 ? `(Khách trễ +${item.lateCheckoutHours}h)` : ""}
- Khung dọn dẹp: ${turnoverStart} đến ${turnoverEnd} (Đệm 1 tiếng)
- Trạng thái: Cần dọn phòng & thay drap mới đón lượt khách kế tiếp`;

    navigator.clipboard.writeText(message);
    toast.success(
      `Đã sao chép thông tin dọn phòng ${item.roomName} cho Buồng phòng!`,
      "Đã sao chép lịch dọn"
    );
  };

  // Copy full daily summary report for Internal Telegram/Zalo Staff Group
  const copyFullDailyReport = () => {
    if (!data) return;

    let text = `📋 BẢNG ĐIỀU PHỐI VẬN HÀNH NGÀY ${selectedDate} — ${PROPERTY_INFO.name.toUpperCase()}\n`;
    text += `Tổng quan: ${data.summary.totalCheckins} Check-in • ${data.summary.totalCheckouts} Check-out\n\n`;

    text += `📥 DANH SÁCH NHẬN PHÒNG (CHECK-IN):\n`;
    if (data.checkins.length === 0) {
      text += `(Không có lượt check-in nào)\n`;
    } else {
      data.checkins.forEach((c, idx) => {
        text += `${idx + 1}. [${formatTimeShort(c.checkinAt)}] ${c.roomName} — ${c.guestName} (${c.phone}) • ${c.bookingType} • Mã cửa: ${c.doorCode || "Chưa có"}\n`;
      });
    }

    text += `\n📤 DANH SÁCH TRẢ PHÒNG & DỌN PHÒNG (CHECK-OUT):\n`;
    if (data.checkouts.length === 0) {
      text += `(Không có lượt check-out nào)\n`;
    } else {
      data.checkouts.forEach((c, idx) => {
        text += `${idx + 1}. [${formatTimeShort(c.checkoutAt)}] ${c.roomName} — ${c.guestName} • Dọn phòng: ${formatTimeShort(c.turnoverStartAt || c.checkoutAt)} - ${formatTimeShort(c.turnoverEndAt || c.checkoutAt)}\n`;
      });
    }

    navigator.clipboard.writeText(text);
    toast.success(
      `Đã sao chép báo cáo điều phối ngày ${selectedDate} vào bộ nhớ tạm!`,
      "Đã sao chép báo cáo ngày"
    );
  };

  // Convert DailyRosterItem to GanttBookingItem to open drawer
  const openDetailDrawer = (item: DailyRosterItem) => {
    if (!onSelectBooking) return;
    const ganttItem: GanttBookingItem = {
      id: item.id,
      roomId: item.roomId,
      guestName: item.guestName,
      phone: item.phone,
      bookingType: item.bookingType,
      checkinAt: item.checkinAt,
      checkoutAt: item.checkoutAt,
      totalPrice: item.totalPrice,
      status: item.status,
      instagram: item.instagram,
      facebook: item.facebook,
      closingNote: item.closingNote,
      note: item.note,
      createdAt: item.createdAt,
      createdByStaffId: item.createdByStaffId,
      createdByStaffName: item.createdByStaffName,
      updatedAt: item.updatedAt,
      updatedByStaffId: item.updatedByStaffId,
      updatedByStaffName: item.updatedByStaffName,
      modNo: item.modNo,
    };
    onSelectBooking(ganttItem);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-6xl max-h-[92vh] flex flex-col rounded-3xl bg-[#0d131f] border border-slate-800 shadow-2xl overflow-hidden">
        {/* Top Header */}
        <div className="px-5 py-4 border-b border-slate-800 bg-[#121927]/90 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 text-emerald-400 text-lg">
                🗓️
              </span>
              <div>
                <h2 className="text-base sm:text-lg font-extrabold text-white tracking-tight flex items-center gap-2">
                  <span>Điều Phối Khách Vào & Ra Hằng Ngày</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    Operation Hub
                  </span>
                </h2>
                <p className="text-xs text-slate-400">
                  Gửi hướng dẫn trước giờ khách đến • Canh lịch khách trả phòng để điều phối buồng phòng
                </p>
              </div>
            </div>
          </div>

          {/* Quick Date Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs">
              <button
                onClick={handlePrevDay}
                className="px-2.5 py-1 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors font-medium"
                title="Ngày hôm trước"
              >
                ◀ Trước
              </button>
              <button
                onClick={handleToday}
                className={`px-3 py-1 rounded-lg font-bold transition-colors ${
                  selectedDate === vnToday
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm"
                    : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                Hôm nay
              </button>
              <button
                onClick={handleNextDay}
                className="px-2.5 py-1 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors font-medium"
                title="Ngày hôm sau"
              >
                Sau ▶
              </button>
            </div>

            {/* Custom Date Picker */}
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:border-emerald-500 transition-colors cursor-pointer"
            />

            {/* Copy Full Report Button */}
            <button
              onClick={copyFullDailyReport}
              disabled={loading || !data}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all active:scale-95 shrink-0"
              title="Sao chép toàn bộ lịch ngày để gửi nhóm Zalo/Telegram"
            >
              <span>📋</span>
              <span className="hidden sm:inline">Sao chép báo cáo ngày</span>
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-slate-700 flex items-center justify-center transition-colors text-sm font-bold"
              title="Đóng cửa sổ (ESC)"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Operational KPI Ribbon & View Switcher */}
        <div className="px-5 py-3 border-b border-slate-800 bg-[#0e1625] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          {/* Quick Metrics */}
          <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto text-xs pb-1 sm:pb-0">
            <div className="px-3 py-1.5 rounded-xl bg-[#131c2c] border border-slate-800 shrink-0">
              <span className="text-slate-400 text-[10px] uppercase font-semibold block">
                Khách Check-in
              </span>
              <span className="text-emerald-400 font-extrabold text-sm font-mono">
                {data?.summary.totalCheckins || 0} lượt
              </span>
            </div>

            <div className="px-3 py-1.5 rounded-xl bg-[#131c2c] border border-slate-800 shrink-0">
              <span className="text-slate-400 text-[10px] uppercase font-semibold block">
                Khách Check-out
              </span>
              <span className="text-amber-400 font-extrabold text-sm font-mono">
                {data?.summary.totalCheckouts || 0} lượt
              </span>
            </div>

            <div className="px-3 py-1.5 rounded-xl bg-[#131c2c] border border-slate-800 shrink-0 hidden md:block">
              <span className="text-slate-400 text-[10px] uppercase font-semibold block">
                Phân bổ loại hình
              </span>
              <span className="text-slate-300 font-medium text-xs">
                {data?.summary.hourlyCount || 0} Giờ • {data?.summary.overnightCount || 0} Đêm • {data?.summary.dayuseCount || 0} Ngày
              </span>
            </div>

            {data?.summary.doorCodeMissingCount ? (
              <div className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 shrink-0 text-amber-300">
                <span className="text-[10px] uppercase font-semibold block">Cần tạo mã cửa</span>
                <span className="font-bold text-xs">
                  {data.summary.doorCodeMissingCount} đơn chưa có mã
                </span>
              </div>
            ) : null}
          </div>

          {/* Search & Tabs */}
          <div className="flex items-center gap-2">
            {/* Quick search input */}
            <div className="relative">
              <input
                type="text"
                placeholder="Tìm khách, phòng, SĐT..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="bg-[#131b28] border border-slate-700/80 rounded-xl px-3 py-1.5 pl-8 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 w-36 sm:w-48 transition-all"
              />
              <span className="absolute left-2.5 top-1.5 text-xs text-slate-400">🔍</span>
              {searchFilter && (
                <button
                  onClick={() => setSearchFilter("")}
                  className="absolute right-2 top-1.5 text-slate-400 hover:text-slate-200 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-0.5 text-xs shrink-0">
              <button
                onClick={() => setViewTab("both")}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                  viewTab === "both"
                    ? "bg-slate-800 text-emerald-300 shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Toàn Cảnh
              </button>
              <button
                onClick={() => setViewTab("checkin")}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                  viewTab === "checkin"
                    ? "bg-slate-800 text-emerald-300 shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                📥 Check-in ({filteredCheckins.length})
              </button>
              <button
                onClick={() => setViewTab("checkout")}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                  viewTab === "checkout"
                    ? "bg-slate-800 text-amber-300 shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                📤 Check-out ({filteredCheckouts.length})
              </button>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {loading ? (
            <div className="py-24 flex flex-col items-center justify-center gap-3">
              <Spinner size="lg" />
              <p className="text-sm text-slate-400 font-medium">
                Đang chuẩn bị lịch điều phối ngày {selectedDate}...
              </p>
            </div>
          ) : (
            <div
              className={`grid gap-6 ${
                viewTab === "both" ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"
              }`}
            >
              {/* Column 1: Check-in (Khách Nhận Phòng) */}
              {(viewTab === "both" || viewTab === "checkin") && (
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                      <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">
                        Khách Nhận Phòng (Check-in)
                      </h3>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      {filteredCheckins.length} lượt
                    </span>
                  </div>

                  {filteredCheckins.length === 0 ? (
                    <div className="p-8 rounded-2xl bg-slate-900/40 border border-slate-800/80 text-center space-y-1">
                      <div className="text-2xl">🌿</div>
                      <p className="text-xs font-semibold text-slate-400">
                        Không có lượt khách nhận phòng nào trong ngày này
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredCheckins.map((item) => (
                        <CheckinCard
                          key={`in-${item.id}`}
                          item={item}
                          onCopyGuide={() => copyCheckinGuide(item)}
                          onOpenDetail={() => openDetailDrawer(item)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Column 2: Check-out (Khách Trả Phòng & Dọn Phòng) */}
              {(viewTab === "both" || viewTab === "checkout") && (
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                      <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">
                        Khách Trả Phòng & Buồng Phòng (Check-out)
                      </h3>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      {filteredCheckouts.length} lượt
                    </span>
                  </div>

                  {filteredCheckouts.length === 0 ? (
                    <div className="p-8 rounded-2xl bg-slate-900/40 border border-slate-800/80 text-center space-y-1">
                      <div className="text-2xl">✨</div>
                      <p className="text-xs font-semibold text-slate-400">
                        Không có lượt khách trả phòng nào trong ngày này
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredCheckouts.map((item) => (
                        <CheckoutCard
                          key={`out-${item.id}`}
                          item={item}
                          onCopyBriefing={() => copyHousekeepingBriefing(item)}
                          onOpenDetail={() => openDetailDrawer(item)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer info note */}
        <div className="px-5 py-3 border-t border-slate-800 bg-[#0e1625] flex items-center justify-between text-[11px] text-slate-400 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Đệm giờ dọn phòng tiêu chuẩn: 1 tiếng tự động sau mỗi lượt trả phòng</span>
          </div>
          <span className="hidden sm:inline text-slate-500 font-mono">
            Every Inn Operational Hub v1.0
          </span>
        </div>
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// Component Thẻ Check-in Đón Khách
// -------------------------------------------------------------
interface CheckinCardProps {
  item: DailyRosterItem;
  onCopyGuide: () => void;
  onOpenDetail: () => void;
}

const CheckinCard: React.FC<CheckinCardProps> = ({ item, onCopyGuide, onOpenDetail }) => {
  const checkinTime = formatTimeShort(item.checkinAt);
  const checkoutTime = formatTimeShort(item.checkoutAt);

  const bookingTypeBadge: Record<string, { label: string; color: string }> = {
    hourly: { label: "Theo Giờ", color: "bg-sky-500/15 text-sky-300 border-sky-500/30" },
    overnight: { label: "Qua Đêm", color: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30" },
    dayuse: { label: "Theo Ngày", color: "bg-purple-500/15 text-purple-300 border-purple-500/30" },
    custom: { label: "Tuỳ Chỉnh", color: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  };

  const typeConfig = bookingTypeBadge[item.bookingType] || {
    label: item.bookingType,
    color: "bg-slate-700 text-slate-300",
  };

  return (
    <div className="p-4 rounded-2xl bg-[#121927] border border-slate-800 hover:border-slate-700/80 transition-all shadow-md space-y-3 group">
      {/* Top row: Time + Room + Type */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          {/* Check-in Time Badge */}
          <div className="px-3 py-1 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-mono font-extrabold text-sm flex items-center gap-1.5 shadow-sm">
            <span>⏰</span>
            <span>{checkinTime}</span>
          </div>

          {/* Room Badge */}
          <span className="px-2.5 py-1 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 font-bold text-xs">
            {item.roomName}
          </span>

          {/* Class Pill */}
          <span
            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
              item.roomClass === "signature"
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                : "bg-teal-500/20 text-teal-300 border border-teal-500/30"
            }`}
          >
            {item.roomClass === "signature" ? "Signature" : "Haven"}
          </span>
        </div>

        {/* Booking Type Pill */}
        <span
          className={`text-[11px] font-semibold px-2 py-0.5 rounded-lg border ${typeConfig.color}`}
        >
          {typeConfig.label}
        </span>
      </div>

      {/* Guest Details & Social Channels */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
        {/* Guest name & Tier */}
        <div>
          <span className="text-[10px] text-slate-400 block">Khách hàng:</span>
          <div className="flex items-center gap-1.5 font-bold text-slate-100">
            <span>{item.guestName || "Khách vãng lai"}</span>
            {item.loyaltyTier === "gold" && <span title="Thành viên Vàng">🌟</span>}
            {item.loyaltyTier === "silver" && <span title="Thành viên Bạc">🥈</span>}
            {item.loyaltyTier === "bronze" && <span title="Thành viên Đồng">🥉</span>}
          </div>
          <div className="text-[11px] font-mono text-slate-300 mt-0.5">{item.phone}</div>
        </div>

        {/* Social & Contact */}
        <div className="space-y-0.5 sm:text-right">
          <span className="text-[10px] text-slate-400 block">Kênh kết nối:</span>
          <div className="flex items-center sm:justify-end gap-2 text-[11px]">
            {item.instagram && (
              <a
                href={`https://instagram.com/${item.instagram.replace(/^@/, "")}`}
                target="_blank"
                rel="noreferrer"
                className="text-pink-400 hover:text-pink-300 underline font-medium truncate max-w-[130px]"
                title="Mở Instagram"
              >
                @{item.instagram.replace(/^@/, "")}
              </a>
            )}
            {item.facebook && (
              <span className="text-blue-400 font-medium truncate max-w-[130px]">
                FB: {item.facebook}
              </span>
            )}
            {!item.instagram && !item.facebook && (
              <span className="text-slate-500 italic">Chưa lưu social</span>
            )}
          </div>
          <div className="text-[11px] text-slate-400">
            Out: <strong className="text-slate-200 font-mono">{checkoutTime}</strong>
          </div>
        </div>
      </div>

      {/* Door Code Status Box */}
      <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="text-sm">🔑</span>
          <div>
            <span className="text-[10px] text-slate-400 block leading-tight">Mã khoá cửa:</span>
            {item.doorCode ? (
              <span className="font-mono font-extrabold text-emerald-400 tracking-wider text-xs">
                {item.doorCode}
              </span>
            ) : (
              <span className="text-amber-400 font-medium text-[11px]">
                Chưa tạo mã cửa
              </span>
            )}
          </div>
        </div>

        <div className="text-right">
          <span className="text-[10px] text-slate-400 block leading-tight">Tổng thanh toán:</span>
          <span className="font-mono font-bold text-teal-300 text-xs">
            {item.totalPrice.toLocaleString("vi-VN")} đ
          </span>
        </div>
      </div>

      {/* Action Toolbar */}
      <div className="flex items-center gap-2 pt-1 border-t border-slate-800/80">
        <button
          onClick={onCopyGuide}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 font-bold text-xs transition-all active:scale-95 shadow-sm"
          title="Sao chép toàn bộ mẫu tin nhắn hướng dẫn nhận phòng để gửi khách"
        >
          <span>📋</span>
          <span>Copy Tin Nhắn Hướng Dẫn</span>
        </button>

        <button
          onClick={onOpenDetail}
          className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
          title="Xem chi tiết hoặc chỉnh sửa đơn"
        >
          Chi Tiết
        </button>
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// Component Thẻ Check-out Canh Giờ Dọn Phòng
// -------------------------------------------------------------
interface CheckoutCardProps {
  item: DailyRosterItem;
  onCopyBriefing: () => void;
  onOpenDetail: () => void;
}

const CheckoutCard: React.FC<CheckoutCardProps> = ({ item, onCopyBriefing, onOpenDetail }) => {
  const checkoutTime = formatTimeShort(item.checkoutAt);
  const turnoverStart = formatTimeShort(item.turnoverStartAt || item.checkoutAt);
  const turnoverEnd = formatTimeShort(item.turnoverEndAt || item.checkoutAt);

  return (
    <div className="p-4 rounded-2xl bg-[#121927] border border-slate-800 hover:border-slate-700/80 transition-all shadow-md space-y-3 group">
      {/* Top row: Time + Room + Late Checkout */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          {/* Check-out Time Badge */}
          <div className="px-3 py-1 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 font-mono font-extrabold text-sm flex items-center gap-1.5 shadow-sm">
            <span>📤</span>
            <span>{checkoutTime}</span>
          </div>

          {/* Room Badge */}
          <span className="px-2.5 py-1 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 font-bold text-xs">
            {item.roomName}
          </span>

          {/* Floor */}
          <span className="text-[11px] text-slate-400 font-medium">Tầng {item.floor}</span>
        </div>

        {/* Late checkout alert if present */}
        {item.lateCheckoutHours > 0 && (
          <span className="px-2 py-0.5 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[11px] font-bold">
            Trễ +{item.lateCheckoutHours}h
          </span>
        )}
      </div>

      {/* Guest Details */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
        <div>
          <span className="text-[10px] text-slate-400 block">Khách đang ở:</span>
          <span className="font-bold text-slate-200">{item.guestName || "Khách"}</span>
          <div className="text-[11px] font-mono text-slate-400">{item.phone}</div>
        </div>

        <div className="sm:text-right">
          <span className="text-[10px] text-slate-400 block">Check-in từ:</span>
          <span className="text-slate-300 font-mono text-xs">
            {formatDateTimeShort(item.checkinAt)}
          </span>
        </div>
      </div>

      {/* Turnover Cleaning Buffer Banner (1 Hour) */}
      <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/30 space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-amber-300 flex items-center gap-1.5">
            <span>🧹</span>
            <span>Khung dọn phòng (1h Turnover)</span>
          </span>
          <span className="font-mono font-extrabold text-amber-200">
            {turnoverStart} ➔ {turnoverEnd}
          </span>
        </div>
        <p className="text-[11px] text-amber-400/80">
          Buồng phòng tiến hành vệ sinh & thay drap để sẵn sàng đón khách tiếp theo.
        </p>
      </div>

      {/* Action Toolbar */}
      <div className="flex items-center gap-2 pt-1 border-t border-slate-800/80">
        <button
          onClick={onCopyBriefing}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold text-xs transition-all active:scale-95 shadow-sm"
          title="Sao chép thông tin phòng cần dọn gửi cho bộ phận Buồng phòng"
        >
          <span>📋</span>
          <span>Copy Lịch Dọn Housekeeping</span>
        </button>

        <button
          onClick={onOpenDetail}
          className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
          title="Mở để xem chi tiết hoặc gia hạn trả phòng (+1h)"
        >
          Gia Hạn / Sửa
        </button>
      </div>
    </div>
  );
};
