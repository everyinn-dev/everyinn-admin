"use client";

import React, { useState } from "react";
import { GanttBlockItem, GanttRoomData } from "@/types";
import { useToast } from "@/components/ui/Toast";
import { Spinner } from "@/components/ui/Spinner";
import { Badge } from "@/components/ui/Badge";
import { notifyDataChanged } from "@/lib/syncEvents";
import { addDaysStr, blockPhase, canManageBlockType, ROOM_BLOCK_TYPES, roomBlockTypeOf, vnLocalToIso, type RoomBlockType } from "@/lib/roomBlocks";
import { TIME_SLOTS_30MIN } from "@/lib/timelineUtils";

/** ISO instant → { date, time } on the Vietnam wall clock. */
function vnParts(iso: string): { date: string; time: string } {
  const d = new Date(Date.parse(iso) + 7 * 3600 * 1000).toISOString();
  return { date: d.slice(0, 10), time: d.slice(11, 16) };
}

interface RoomLockDetailDrawerProps {
  block: GanttBlockItem | null;
  room?: GanttRoomData;
  onClose: () => void;
  onBlockDeleted: () => void;
  /** stop_sell / owner_stay can only be reopened by a manager (Booking Core enforces it too). */
  isManager?: boolean;
}

const PHASE_BADGE = {
  upcoming: { label: "Sắp khoá", cls: "bg-sky-50 border-sky-300 text-sky-900" },
  active: { label: "Đang khoá", cls: "bg-amber-100 border-amber-300 text-amber-900" },
  ended: { label: "Đã hết hạn", cls: "bg-slate-100 border-slate-300 text-slate-600" },
  released: { label: "Đã mở khoá", cls: "bg-emerald-50 border-emerald-300 text-emerald-800" },
} as const;

function formatDateTimeVi(isoString: string): string {
  try {
    // Always Vietnam time, whatever the device timezone is.
    const d = new Date(isoString);
    const time = d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" });
    const date = d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" });
    return `${time} • ${date}`;
  } catch {
    return isoString;
  }
}

function calculateDurationHours(fromIso: string, toIso: string): string {
  try {
    const fromMs = new Date(fromIso).getTime();
    const toMs = new Date(toIso).getTime();
    const diffHours = (toMs - fromMs) / (1000 * 60 * 60);
    if (diffHours < 1) {
      const mins = Math.round((toMs - fromMs) / (1000 * 60));
      return `${mins} phút`;
    }
    return `${Math.round(diffHours * 10) / 10} giờ`;
  } catch {
    return "";
  }
}

export const RoomLockDetailDrawer: React.FC<RoomLockDetailDrawerProps> = ({
  block,
  room,
  onClose,
  onBlockDeleted,
  isManager = false,
}) => {
  const toast = useToast();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [releaseReason, setReleaseReason] = useState("");
  // "Gia hạn / Sửa giờ"
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editErr, setEditErr] = useState<string | null>(null);
  const [toDate, setToDate] = useState("");
  const [toTime, setToTime] = useState("");
  const [editReason, setEditReason] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editType, setEditType] = useState<RoomBlockType>("maintenance");

  if (!block) return null;

  const openEdit = () => {
    const end = vnParts(block.blockedTo);
    setToDate(end.date);
    setToTime(end.time);
    setEditReason(block.reason ?? "");
    setEditNote(block.note ?? "");
    setEditType((block.blockType ?? "maintenance") as RoomBlockType);
    setEditErr(null);
    setEditing(true);
  };

  /** Quick extend from the current planned end (VN wall clock, 30' slots). */
  const extendBy = (hours: number) => {
    const ms = Date.parse(vnLocalToIso(toDate, toTime)) + hours * 3600 * 1000;
    const p = vnParts(new Date(ms).toISOString());
    setToDate(p.date);
    setToTime(p.time);
  };

  const handleSave = async () => {
    setEditErr(null);
    const newTo = vnLocalToIso(toDate, toTime);
    if (Date.parse(newTo) <= Math.max(Date.now(), Date.parse(block.blockedFrom))) {
      setEditErr("Giờ mở phòng mới phải sau giờ bắt đầu khoá và sau thời điểm hiện tại.");
      return;
    }
    const payload: Record<string, unknown> = { expectedVersion: block.version };
    if (newTo !== new Date(block.blockedTo).toISOString()) payload.blockedTo = newTo;
    if (editReason.trim() !== (block.reason ?? "")) payload.reason = editReason.trim();
    if (editNote.trim() !== (block.note ?? "")) payload.note = editNote.trim();
    if (editType !== (block.blockType ?? "maintenance")) payload.blockType = editType;
    if (Object.keys(payload).length === 1) {
      setEditing(false);
      return;
    }
    try {
      setSaving(true);
      const res = await fetch(`/api/room-blocks/${block.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { error?: string; code?: string; message?: string };
      if (!res.ok) {
        setEditErr(data.error || "Không thể cập nhật lịch khoá.");
        if (data.code === "VERSION_CONFLICT" || data.code === "INVALID_STATE") {
          onBlockDeleted();
          notifyDataChanged("ROOM_BLOCKS_CHANGED");
        }
        return;
      }
      toast.success(data.message || "Đã cập nhật lịch khoá phòng.");
      onBlockDeleted();
      notifyDataChanged("ROOM_BLOCKS_CHANGED");
      onClose();
    } catch {
      setEditErr("Lỗi kết nối máy chủ.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      const res = await fetch(`/api/room-blocks/${block.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedVersion: block.version,
          reason: releaseReason.trim() || undefined,
        }),
      });

      const data = (await res.json()) as any;

      if (!res.ok) {
        if (res.status === 409) {
          // VERSION_CONFLICT = edited by someone else; INVALID_STATE = already reopened. Show Core's own reason.
          toast.warning(
            data.error || "Khóa phòng đã được cập nhật hoặc mở bởi phiên làm việc khác.",
            data.code === "INVALID_STATE" ? "Khoá đã được mở trước đó" : "Dữ liệu đã thay đổi",
          );
          onBlockDeleted();
          notifyDataChanged("ROOM_BLOCKS_CHANGED");
          onClose();
          return;
        }
        toast.error(data.error || "Không thể mở khóa phòng.");
        return;
      }

      toast.success(data.message || `Đã mở khóa phòng thành công.`);
      onBlockDeleted();
      notifyDataChanged("ROOM_BLOCKS_CHANGED");
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Lỗi kết nối máy chủ khi mở khóa phòng.");
    } finally {
      setIsDeleting(false);
    }
  };

  const durationStr = calculateDurationHours(block.blockedFrom, block.blockedTo);
  const type = roomBlockTypeOf(block.blockType);
  const released = block.status === "released";
  const phase = PHASE_BADGE[released ? "released" : blockPhase(block)];
  const phaseKey = released ? "ended" : blockPhase(block);
  // An ended block has nothing to reopen (Core answers 409 BLOCK_ENDED); it stays visible as history.
  const canRelease = canManageBlockType(block.blockType, isManager) && phaseKey !== "ended";
  const canEdit = canManageBlockType(block.blockType, isManager) && phaseKey !== "ended";

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white border-l border-slate-200 shadow-2xl h-full flex flex-col z-50 text-xs">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-800 text-sm shadow-xs">
              🔒
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                  Khóa Phòng #{block.id}
                </h2>
                <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase ${phase.cls}`}>
                  {phase.label}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                {room ? `Phòng ${room.roomNumber} • Tầng ${room.floor}` : `Phòng ID: ${block.roomId}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-slate-200 text-slate-600 hover:text-slate-900 flex items-center justify-center transition-colors font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 p-5 overflow-y-auto space-y-4">
          {/* Room info card */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between shadow-xs">
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Phòng</span>
              <span className="text-base font-extrabold text-slate-900">
                {room ? `Phòng ${room.roomNumber}` : block.roomId}
              </span>
            </div>
            {room && (
              <Badge roomClass={room.roomClass} size="sm" />
            )}
          </div>

          {/* Reason & Notes */}
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 space-y-2 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-amber-900 block text-[10px] uppercase font-bold tracking-wider">
                Lý do khóa phòng
              </span>
              <span className="px-2 py-0.5 rounded-full bg-white border border-amber-300 text-[10px] font-bold text-amber-900" title={type.hint}>
                {type.icon} {type.label}
              </span>
            </div>
            <div className="text-sm font-bold text-amber-950 flex items-center gap-1.5">
              <span>⚠️</span>
              <span>{block.reason || type.label}</span>
            </div>
            {block.note && (
              <div className="pt-2 border-t border-amber-200 text-slate-700 text-xs italic bg-white p-2.5 rounded-lg">
                <span className="text-slate-500 font-bold not-italic">Ghi chú: </span>
                {block.note}
              </div>
            )}
          </div>

          {/* Time range */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 uppercase font-bold text-[10px]">
                Thời gian áp dụng
              </span>
              {durationStr && (
                <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-emerald-800 font-mono text-[10px] font-bold shadow-xs">
                  {durationStr}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="p-2.5 rounded-lg bg-white border border-slate-200 shadow-xs">
                <span className="text-slate-500 block text-[10px] mb-0.5 font-medium">Bắt đầu khóa:</span>
                <span className="text-slate-900 font-bold font-mono text-[11px]">
                  {formatDateTimeVi(block.blockedFrom)}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-white border border-slate-200 shadow-xs">
                <span className="text-slate-500 block text-[10px] mb-0.5 font-medium">Dự kiến mở:</span>
                <span className="text-slate-900 font-bold font-mono text-[11px]">
                  {formatDateTimeVi(block.blockedTo)}
                </span>
              </div>
            </div>
          </div>

          {/* Metadata */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 space-y-1 text-[11px] shadow-xs">
            {(block.createdByStaffName || block.createdByStaffId) && (
              <div className="flex items-center justify-between">
                <span>Nhân viên tạo khóa:</span>
                <span className="text-slate-900 font-semibold">{block.createdByStaffName || `NV #${block.createdByStaffId}`}</span>
              </div>
            )}
            {block.createdAt && (
              <div className="flex items-center justify-between">
                <span>Thời gian tạo:</span>
                <span className="text-slate-800 font-medium">{formatDateTimeVi(block.createdAt)}</span>
              </div>
            )}
          </div>

          {/* Gia hạn / Sửa giờ */}
          {canEdit && !editing && (
            <button
              type="button"
              onClick={openEdit}
              className="w-full py-2 rounded-xl bg-white border border-amber-300 hover:bg-amber-50 text-amber-900 font-bold text-[11px] cursor-pointer shadow-xs"
            >
              ⏱️ Gia hạn / Sửa giờ mở phòng
            </button>
          )}
          {editing && (
            <div className="p-3.5 rounded-xl bg-white border border-amber-300 space-y-2.5 shadow-xs">
              <div className="text-[10px] uppercase font-bold text-amber-900">Gia hạn / Sửa lịch khoá</div>
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-0.5">
                  <span className="text-[10px] text-slate-500 font-semibold">Ngày mở phòng</span>
                  <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full px-2 py-1.5 rounded-lg border border-slate-300 text-xs" />
                </label>
                <label className="space-y-0.5">
                  <span className="text-[10px] text-slate-500 font-semibold">Giờ mở (giờ VN)</span>
                  <select value={toTime} onChange={(e) => setToTime(e.target.value)} className="w-full px-2 py-1.5 rounded-lg border border-slate-300 text-xs bg-white">
                    {TIME_SLOTS_30MIN.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="flex flex-wrap gap-1">
                {[1, 2, 4].map((h) => (
                  <button key={h} type="button" onClick={() => extendBy(h)} className="px-2 py-0.5 rounded-lg bg-amber-50 border border-amber-300 text-[10px] font-bold text-amber-900 cursor-pointer">
                    +{h} giờ
                  </button>
                ))}
                <button type="button" onClick={() => { setToDate(addDaysStr(toDate, 1)); setToTime("09:00"); }} className="px-2 py-0.5 rounded-lg bg-amber-50 border border-amber-300 text-[10px] font-bold text-amber-900 cursor-pointer">
                  09:00 hôm sau
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {ROOM_BLOCK_TYPES.map((t) => {
                  const allowed = canManageBlockType(t.code, isManager);
                  return (
                    <button
                      key={t.code}
                      type="button"
                      disabled={!allowed}
                      onClick={() => setEditType(t.code)}
                      className={`px-2 py-1 rounded-lg border text-[10px] text-left ${editType === t.code ? "bg-amber-100 border-amber-500 font-bold" : allowed ? "bg-white border-slate-200 cursor-pointer" : "bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed"}`}
                    >
                      {t.icon} {t.label}
                    </button>
                  );
                })}
              </div>
              <input value={editReason} onChange={(e) => setEditReason(e.target.value)} placeholder="Lý do khoá" className="w-full px-2 py-1.5 rounded-lg border border-slate-300 text-xs" />
              <input value={editNote} onChange={(e) => setEditNote(e.target.value)} placeholder="Ghi chú (tuỳ chọn)" className="w-full px-2 py-1.5 rounded-lg border border-slate-300 text-xs" />
              {editErr && <p className="text-[11px] text-rose-700 font-semibold">{editErr}</p>}
              <div className="flex gap-2">
                <button type="button" onClick={() => setEditing(false)} disabled={saving} className="flex-1 py-1.5 rounded-lg bg-white border border-slate-300 text-[11px] font-semibold cursor-pointer">
                  Huỷ sửa
                </button>
                <button type="button" onClick={handleSave} disabled={saving} className="flex-1 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold cursor-pointer flex items-center justify-center">
                  {saving ? <Spinner size="sm" /> : "Lưu thay đổi"}
                </button>
              </div>
            </div>
          )}

          {/* Business notice */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 leading-relaxed shadow-xs">
            💡 <strong className="text-slate-800">Quy tắc nghiệp vụ:</strong> Mở khoá khi đang khoá sẽ chốt giờ kết thúc về hiện tại (lịch sử vẫn được giữ). Khoá đã kết thúc thì phòng tự mở lại.
            {block.blockType === "owner_stay" ? " Khoá “Chủ ở” giữ thêm 60 phút dọn phòng sau giờ mở, như một lượt khách." : " Khoá loại này không cộng thêm giờ dọn phòng."}
          </div>
        </div>

        {/* Action Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 space-y-2">
          {!showConfirmDelete ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold transition-colors text-center cursor-pointer shadow-xs"
              >
                Đóng
              </button>
              {phaseKey === "ended" ? (
                <span className="flex-1 py-2 text-center text-[11px] text-slate-500 italic">
                  {released ? "Lịch khoá đã được mở — chỉ xem." : "Lịch khoá đã kết thúc — phòng đã tự mở lại."}
                </span>
              ) : canRelease ? (
                <button
                  type="button"
                  onClick={() => setShowConfirmDelete(true)}
                  className="flex-1 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-300 text-rose-800 font-bold transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <span>🔓</span>
                  <span>Mở khóa phòng</span>
                </button>
              ) : (
                <span className="flex-1 py-2 text-center text-[11px] text-slate-500 italic" title="Đóng bán / Chủ ở do quản lý quyết định">
                  🔒 Chỉ quản lý được mở khoá loại “{type.label}”
                </span>
              )}
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 space-y-2 animate-in fade-in shadow-xs">
              <p className="text-rose-900 font-bold text-[11px]">
                Bạn có chắc chắn muốn mở khóa phòng {room ? room.name : block.roomId} ngay bây giờ?
              </p>
              <input
                value={releaseReason}
                onChange={(e) => setReleaseReason(e.target.value)}
                placeholder="Lý do mở sớm (tuỳ chọn), vd: đã sửa xong"
                className="w-full px-2 py-1.5 rounded-lg border border-rose-200 bg-white text-[11px]"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmDelete(false)}
                  disabled={isDeleting}
                  className="flex-1 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors font-semibold text-[11px] cursor-pointer shadow-xs"
                >
                  Không, giữ khóa
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="flex-1 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold transition-colors text-[11px] flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                >
                  {isDeleting ? <Spinner size="sm" /> : <span>Xác nhận mở khóa</span>}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
