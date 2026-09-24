"use client";

import React, { useState } from "react";
import { Input } from "../ui/Input";
import { Badge } from "../ui/Badge";
import { Member } from "@/types";

interface PhoneLookupFieldProps {
  phone: string;
  onChangePhone: (phone: string) => void;
  onMemberFound: (member: Member) => void;
  onMemberNotFound: () => void;
}

export const PhoneLookupField: React.FC<PhoneLookupFieldProps> = ({
  phone,
  onChangePhone,
  onMemberFound,
  onMemberNotFound,
}) => {
  const [loading, setLoading] = useState(false);
  const [memberData, setMemberData] = useState<Member | null>(null);
  const [lookupAttempted, setLookupAttempted] = useState(false);

  const doLookup = async (phoneNumber: string) => {
    const clean = phoneNumber.trim();
    if (clean.length < 9) {
      setMemberData(null);
      setLookupAttempted(false);
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`/api/members/${clean}`);
      const data = (await res.json()) as any;

      setLookupAttempted(true);
      if (res.ok && data.found && data.member) {
        setMemberData(data.member);
        onMemberFound(data.member);
      } else {
        setMemberData(null);
        onMemberNotFound();
      }
    } catch (e) {
      console.error(e);
      setMemberData(null);
      onMemberNotFound();
    } finally {
      setLoading(false);
    }
  };

  const handleBlur = () => {
    doLookup(phone);
  };

  return (
    <div className="space-y-2">
      <Input
        label="Số điện thoại khách hàng"
        required
        placeholder="09xx xxx xxx"
        value={phone}
        onChange={(e) => {
          onChangePhone(e.target.value);
          setLookupAttempted(false);
        }}
        onBlur={handleBlur}
        rightElement={
          <button
            type="button"
            onClick={() => doLookup(phone)}
            disabled={loading || phone.trim().length < 9}
            className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 disabled:opacity-40 transition-colors text-xs font-semibold flex items-center gap-1"
          >
            {loading ? (
              <span className="animate-spin text-xs">⏳</span>
            ) : (
              <span>🔍 Tìm CDP</span>
            )}
          </button>
        }
      />

      {/* CDP Recognition Alert */}
      {lookupAttempted && (
        <div className="animate-in fade-in duration-200">
          {memberData ? (
            <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/40 flex items-start justify-between gap-3 text-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-emerald-300">
                    Khách quen: {memberData.full_name || memberData.fullName || "Khách hàng"}
                  </span>
                  <Badge tier={memberData.loyalty_tier} size="sm" />
                </div>
                <div className="text-slate-300 text-[11px] flex items-center gap-3">
                  <span>
                    Tổng đặt: <strong className="text-white">{memberData.total_bookings} lần</strong>
                  </span>
                  <span>
                    Chi tiêu:{" "}
                    <strong className="text-emerald-400 font-mono">
                      {Number(memberData.total_spent).toLocaleString("vi-VN")} đ
                    </strong>
                  </span>
                </div>
              </div>
              <span className="text-[10px] text-emerald-400/80 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 shrink-0">
                Tự động điền
              </span>
            </div>
          ) : (
            <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400 flex items-center gap-2">
              <span>✨</span>
              <span>
                Khách mới — hồ sơ thành viên sẽ tự động lưu vào CDP sau khi đặt phòng.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
