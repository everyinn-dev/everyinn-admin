"use client";

import React, { useState } from "react";
import { GanttBlockItem, GanttRoomData } from "@/types";
import { useToast } from "@/components/ui/Toast";
import { Spinner } from "@/components/ui/Spinner";

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
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-[#0d131f] border-l border-slate-800 shadow-2xl h-full flex flex-col z-50 text-xs">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-[#121927]/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 text-sm shadow-sm">
              🔒
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white tracking-tight">
                  Khóa Phòng #{block.id}
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-[10px] text-amber-300 font-bold uppercase">
                  Đang khóa
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {room ? `${room.name} (Phòng ${room.roomNumber})` : `Phòng ID: ${block.roomId}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-slate-800/80 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 p-5 overflow-y-auto space-y-4">
          {/* Room info card */}
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Phòng</span>
              <span className="text-base font-extrabold text-white">
                {room ? room.name : block.roomId}
              </span>
            </div>
            {room && (
              <span className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 uppercase font-mono text-[10px] font-bold">
                {room.roomClass}
              </span>
            )}
          </div>

          {/* Reason & Notes */}
          <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/30 space-y-2">
            <span className="text-amber-400 block text-[10px] uppercase font-bold tracking-wider">
              Lý do khóa phòng
            </span>
            <div className="text-sm font-bold text-amber-100 flex items-center gap-1.5">
              <span>⚠️</span>
              <span>{block.reason || "Bảo trì phòng"}</span>
            </div>
            {block.note && (
              <div className="pt-2 border-t border-amber-500/20 text-slate-300 text-xs italic">
                <span className="text-slate-400 font-medium not-italic">Ghi chú: </span>
                {block.note}
              </div>
            )}
          </div>

          {/* Time range */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 uppercase font-semibold text-[10px]">
                Thời gian áp dụng
              </span>
              {durationStr && (
                <span className="px-2 py-0.5 rounded bg-slate-800 text-teal-300 font-mono text-[10px] font-bold">
                  {durationStr}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
                <span className="text-slate-400 block text-[10px] mb-0.5">Bắt đầu khóa:</span>
                <span className="text-white font-medium font-mono text-[11px]">
                  {formatDateTimeVi(block.blockedFrom)}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
                <span className="text-slate-400 block text-[10px] mb-0.5">Dự kiến mở:</span>
                <span className="text-white font-medium font-mono text-[11px]">
                  {formatDateTimeVi(block.blockedTo)}
                </span>
              </div>
            </div>
          </div>

          {/* Metadata */}
          <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800/60 text-slate-400 space-y-1 text-[11px]">
            {block.createdByStaffId && (
              <div className="flex items-center justify-between">
                <span>Nhân viên tạo khóa:</span>
                <span className="font-mono text-slate-200">NV #{block.createdByStaffId}</span>
              </div>
            )}
            {block.createdAt && (
              <div className="flex items-center justify-between">
                <span>Thời gian tạo:</span>
                <span className="text-slate-300">{formatDateTimeVi(block.createdAt)}</span>
              </div>
            )}
          </div>

          {/* Business notice */}
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 text-[11px] text-slate-400 leading-relaxed">
            💡 <strong className="text-slate-300">Quy tắc nghiệp vụ:</strong> Khi mở khóa phòng, phòng sẽ ngay lập tức chuyển về trạng thái sẵn sàng đón khách mà không cần cộng thêm 1 giờ dọn phòng.
          </div>
        </div>

        {/* Action Footer */}
        <div className="p-4 border-t border-slate-800 bg-[#121927]/60 space-y-2">
          {!showConfirmDelete ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition-colors text-center"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={() => setShowConfirmDelete(true)}
                className="flex-1 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 font-bold transition-all text-center flex items-center justify-center gap-1.5"
              >
                <span>🔓</span>
                <span>Mở khóa phòng</span>
              </button>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 space-y-2 animate-in fade-in">
              <p className="text-rose-200 font-medium text-[11px]">
                Bạn có chắc chắn muốn mở khóa phòng {room ? room.name : block.roomId} ngay bây giờ?
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmDelete(false)}
                  disabled={isDeleting}
                  className="flex-1 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors font-medium text-[11px]"
                >
                  Không, giữ khóa
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="flex-1 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold transition-colors text-[11px] flex items-center justify-center gap-1 shadow-sm"
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
