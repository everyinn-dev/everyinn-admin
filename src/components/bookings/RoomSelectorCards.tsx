"use client";

import React from "react";
import { Room } from "@/types";
import { getRoomTheme } from "@/lib/roomColors";

interface RoomSelectorCardsProps {
  rooms: Room[];
  selectedRoomId: string;
  onSelectRoom: (roomId: string) => void;
}

export const RoomSelectorCards: React.FC<RoomSelectorCardsProps> = ({
  rooms,
  selectedRoomId,
  onSelectRoom,
}) => {
  const havenRooms = rooms.filter((r) => r.room_class === "haven");
  const signatureRooms = rooms.filter((r) => r.room_class === "signature");
  // Any other rooms if present
  const otherRooms = rooms.filter((r) => r.room_class !== "haven" && r.room_class !== "signature");

  const renderRoomCard = (room: Room, index: number) => {
    const isSelected = room.id === selectedRoomId;
    const theme = getRoomTheme(room.room_number, index);

    return (
      <button
        key={room.id}
        type="button"
        onClick={() => onSelectRoom(room.id)}
        aria-pressed={isSelected}
        className={`group relative flex flex-col p-3 rounded-2xl border text-left transition-all duration-150 cursor-pointer select-none active:scale-[0.98] ${
          isSelected
            ? `${theme.borderActive} shadow-xs`
            : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/70 shadow-2xs"
        }`}
      >
        {/* Top row: Colored Room Number Badge & Selection Checkmark */}
        <div className="flex items-center justify-between w-full mb-2">
          <span
            className={`px-2.5 py-1 rounded-xl text-xs font-mono font-extrabold tracking-tight flex items-center gap-1 shadow-2xs transition-transform group-hover:scale-105 ${
              isSelected ? theme.badge : theme.badgeSoft
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-white" : theme.dotColor}`} />
            <span>Phòng {room.room_number}</span>
          </span>

          {/* Selection indicator pill */}
          <span
            className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-black transition-all ${
              isSelected
                ? `${theme.checkBg} shadow-xs scale-105`
                : "border border-slate-300 text-transparent bg-slate-50 group-hover:border-slate-400"
            }`}
          >
            ✓
          </span>
        </div>

        {/* Middle: Room Name & Floor */}
        <div className="space-y-0.5">
          <div className="font-bold text-xs text-slate-900 truncate flex items-center gap-1.5">
            <span>{room.name || `Phòng ${room.room_number}`}</span>
          </div>
          <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5">
            <span>Tầng {room.floor}</span>
            <span>•</span>
            <span className="capitalize">{room.room_class}</span>
          </div>
        </div>

        {/* Bottom Specs: Sức chứa & Diện tích */}
        <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[10.5px] text-slate-600">
          <span className="flex items-center gap-1 font-medium">
            <span>👥</span>
            <span>Max {room.max_guests}</span>
          </span>
          <span className="text-[10px] text-slate-500 font-mono">
            {room.room_class === "signature" ? "28m²" : "22m²"}
          </span>
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-3.5">
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <label className="text-xs font-bold text-slate-800 tracking-wide uppercase flex items-center gap-1.5">
          <span>🚪</span>
          <span>Chọn phòng trống</span>
          <span className="text-rose-500">*</span>
        </label>
        <span className="text-[11px] text-slate-500 font-medium">
          Chạm thẻ phòng để chọn nhanh · Mỗi phòng 1 màu trực quan
        </span>
      </div>

      {/* Haven Group */}
      {havenRooms.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <span>Hạng Haven ({havenRooms.length} phòng)</span>
            </span>
            <span className="text-[10.5px] text-slate-500">
              22m² · Cửa sổ thoáng · Tối đa 2 khách
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {havenRooms.map((room, idx) => renderRoomCard(room, idx))}
          </div>
        </div>
      )}

      {/* Signature Group */}
      {signatureRooms.length > 0 && (
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Hạng Signature ({signatureRooms.length} phòng)</span>
            </span>
            <span className="text-[10.5px] text-slate-500">
              28m² · Ban công / Cửa sổ lớn · Tối đa 4 khách
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {signatureRooms.map((room, idx) => renderRoomCard(room, havenRooms.length + idx))}
          </div>
        </div>
      )}

      {/* Other Group (if any) */}
      {otherRooms.length > 0 && (
        <div className="space-y-2 pt-1">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {otherRooms.map((room, idx) =>
              renderRoomCard(room, havenRooms.length + signatureRooms.length + idx)
            )}
          </div>
        </div>
      )}
    </div>
  );
};

