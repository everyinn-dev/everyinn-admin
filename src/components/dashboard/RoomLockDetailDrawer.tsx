"use client";

import React, { useState } from "react";
import { GanttBlockItem, GanttRoomData } from "@/types";
import { useToast } from "@/components/ui/Toast";
import { Spinner } from "@/components/ui/Spinner";
import { Badge } from "@/components/ui/Badge";
import { notifyDataChanged } from "@/lib/syncEvents";

interface RoomLockDetailDrawerProps {
  block: GanttBlockItem | null;
  room?: GanttRoomData;
  onClose: () => void;
  onBlockDeleted: () => void;
}

function formatDateTimeVi(isoString: string): string {
  try {
    const d = new Date(isoString);
    const time = d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    const date = d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
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
}) => {
  const toast = useToast();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  if (!block) return null;

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      const res = await fetch(`/api/room-blocks/${block.id}`, {
        method: "DELETE",
      });

      const data = await res.json() as any;

      if (!res.ok) {
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
                <span className="px-2 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-[10px] text-amber-900 font-bold uppercase">
                  Đang khóa
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
            <span className="text-amber-900 block text-[10px] uppercase font-bold tracking-wider">
              Lý do khóa phòng
            </span>
            <div className="text-sm font-bold text-amber-950 flex items-center gap-1.5">
              <span>⚠️</span>
              <span>{block.reason || "Bảo trì phòng"}</span>
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
            {block.createdByStaffId && (
              <div className="flex items-center justify-between">
                <span>Nhân viên tạo khóa:</span>
                <span className="font-mono text-slate-900 font-semibold">NV #{block.createdByStaffId}</span>
              </div>
            )}
            {block.createdAt && (
              <div className="flex items-center justify-between">
                <span>Thời gian tạo:</span>
                <span className="text-slate-800 font-medium">{formatDateTimeVi(block.createdAt)}</span>
              </div>
            )}
          </div>

          {/* Business notice */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 leading-relaxed shadow-xs">
            💡 <strong className="text-slate-800">Quy tắc nghiệp vụ:</strong> Khi mở khóa phòng, phòng sẽ ngay lập tức chuyển về trạng thái sẵn sàng đón khách mà không cần cộng thêm 1 giờ dọn phòng.
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
              <button
                type="button"
                onClick={() => setShowConfirmDelete(true)}
                className="flex-1 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-300 text-rose-800 font-bold transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <span>🔓</span>
                <span>Mở khóa phòng</span>
              </button>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 space-y-2 animate-in fade-in shadow-xs">
              <p className="text-rose-900 font-bold text-[11px]">
                Bạn có chắc chắn muốn mở khóa phòng {room ? room.name : block.roomId} ngay bây giờ?
              </p>
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
