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
            className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 hover:text-emerald-800 border border-emerald-200 disabled:opacity-40 transition-colors text-xs font-semibold flex items-center gap-1"
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
        <div className="space-y-2 animate-in fade-in duration-200">
          {memberData ? (
            <>
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start justify-between gap-3 text-xs shadow-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-emerald-900">
                      Khách quen: {memberData.full_name || memberData.fullName || "Khách hàng"}
                    </span>
                    <Badge tier={memberData.loyalty_tier || memberData.loyaltyTier || "new"} size="sm" />
                  </div>
                  <div className="text-slate-600 text-[11px] flex items-center gap-3">
                    <span>
                      Tổng đặt: <strong className="text-slate-900">{memberData.total_bookings ?? memberData.totalBookings ?? 0} lần</strong>
                    </span>
                    <span>
                      Chi tiêu:{" "}
                      <strong className="text-emerald-700 font-mono">
                        {Number(memberData.total_spent ?? memberData.totalSpent ?? 0).toLocaleString("vi-VN")} đ
                      </strong>
                    </span>
                  </div>
                </div>
                <span className="text-[10px] text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded border border-emerald-200 shrink-0 font-medium">
                  Tự động điền
                </span>
              </div>

              {/* No-Show Warning Alert */}
              {((memberData.no_show_count ?? memberData.noShowCount ?? 0) > 0) && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5 animate-in fade-in shadow-xs">
                  <span className="text-base shrink-0 leading-tight">⚠️</span>
                  <div className="space-y-0.5">
                    <div className="font-bold text-rose-900 flex items-center gap-1.5">
                      <span>Cảnh báo lịch sử No-Show:</span>
                      <span className="px-1.5 py-0.2 rounded bg-rose-100 border border-rose-200 text-[11px] font-mono text-rose-800">
                        {memberData.no_show_count ?? memberData.noShowCount} lần vi phạm
                      </span>
                    </div>
                    <p className="text-[11px] text-rose-700 leading-relaxed">
                      Khách từng không đến hoặc hủy vi phạm quy định. Khuyến nghị yêu cầu thanh toán/cọc 100% trước khi xác nhận giữ phòng!
                    </p>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center gap-2">
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
