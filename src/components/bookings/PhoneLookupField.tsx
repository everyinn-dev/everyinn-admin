"use client";

import React, { useState } from "react";
import { Input } from "../ui/Input";
import { Badge } from "../ui/Badge";
import { Member } from "@/types";
import { apiFetch } from "@/lib/apiClient";
import { useIsManager } from "@/lib/useIsManager";
import { ChangePhoneModal } from "./ChangePhoneModal";

interface RetiredPhoneHint {
  customerId: string;
  changedAt: string;
  currentPhoneMasked: string | null;
  currentPhoneNational: string | null;
  fullName: string | null;
}

interface PhoneLookupFieldProps {
  phone: string;
  onChangePhone: (phone: string) => void;
  /** Profile currently filled into the form — from this lookup or from the social search dropdown. */
  member: Member | null;
  onMemberFound: (member: Member) => void;
  onMemberNotFound: () => void;
  /** Enables the manager-only "Đổi SĐT" action on the found-guest banner. */
  onPhoneChanged?: (member: Member) => void;
}

export async function lookupMemberByPhone(phone: string): Promise<{ member: Member | null; retiredPhone: RetiredPhoneHint | null }> {
  const res = await apiFetch(`/api/members/${encodeURIComponent(phone.trim())}`);
  const data = (await res.json()) as { found?: boolean; member?: Member; retiredPhone?: RetiredPhoneHint };
  if (res.ok && data.found && data.member) return { member: data.member, retiredPhone: null };
  return { member: null, retiredPhone: data.retiredPhone ?? null };
}

function formatVnDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
}

export const PhoneLookupField: React.FC<PhoneLookupFieldProps> = ({ phone, onChangePhone, member, onMemberFound, onMemberNotFound, onPhoneChanged }) => {
  const isManager = useIsManager();
  const [loading, setLoading] = useState(false);
  const [lookupAttempted, setLookupAttempted] = useState(false);
  const [retired, setRetired] = useState<RetiredPhoneHint | null>(null);
  const [changeOpen, setChangeOpen] = useState(false);

  const doLookup = async (phoneNumber: string) => {
    const clean = phoneNumber.trim();
    if (clean.length < 9) {
      setLookupAttempted(false);
      setRetired(null);
      return;
    }
    try {
      setLoading(true);
      const r = await lookupMemberByPhone(clean);
      setLookupAttempted(true);
      setRetired(r.retiredPhone);
      if (r.member) onMemberFound(r.member);
      else onMemberNotFound();
    } catch (e) {
      console.error(e);
      setRetired(null);
      onMemberNotFound();
    } finally {
      setLoading(false);
    }
  };

  const openRetiredOwner = async () => {
    if (!retired?.currentPhoneNational) return;
    setRetired(null);
    await doLookup(retired.currentPhoneNational);
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
          setRetired(null);
        }}
        onBlur={() => doLookup(phone)}
        rightElement={
          <button
            type="button"
            onClick={() => doLookup(phone)}
            disabled={loading || phone.trim().length < 9}
            className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 hover:text-emerald-800 border border-emerald-200 disabled:opacity-40 transition-colors text-xs font-semibold flex items-center gap-1"
          >
            {loading ? <span className="animate-spin text-xs">⏳</span> : <span>🔍 Tìm CDP</span>}
          </button>
        }
      />

      {member ? (
        <div className="space-y-2 animate-in fade-in duration-200">
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start justify-between gap-3 text-xs shadow-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-emerald-900">Khách quen: {member.full_name || member.fullName || "Khách hàng"}</span>
                <Badge tier={member.loyalty_tier || member.loyaltyTier || "new"} size="sm" />
              </div>
              <div className="text-slate-600 text-[11px] flex items-center gap-3">
                <span>
                  Tổng đặt: <strong className="text-slate-900">{member.total_bookings ?? member.totalBookings ?? 0} lần</strong>
                </span>
                <span>
                  Chi tiêu:{" "}
                  <strong className="text-emerald-700 font-mono">{Number(member.total_spent ?? member.totalSpent ?? 0).toLocaleString("vi-VN")} đ</strong>
                </span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <span className="text-[10px] text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded border border-emerald-200 font-medium">Tự động điền</span>
              {isManager && onPhoneChanged && member.customerId && (
                <button
                  type="button"
                  onClick={() => setChangeOpen(true)}
                  className="text-[10px] font-semibold text-slate-700 hover:text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-300 hover:border-slate-400"
                  title="Chuyển hồ sơ khách sang số điện thoại mới (giữ nguyên lịch sử, hạng, tem, voucher)"
                >
                  ✏️ Đổi SĐT
                </button>
              )}
            </div>
          </div>

          {(member.no_show_count ?? member.noShowCount ?? 0) > 0 && (
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5 animate-in fade-in shadow-xs">
              <span className="text-base shrink-0 leading-tight">⚠️</span>
              <div className="space-y-0.5">
                <div className="font-bold text-rose-900 flex items-center gap-1.5">
                  <span>Cảnh báo lịch sử No-Show:</span>
                  <span className="px-1.5 py-0.2 rounded bg-rose-100 border border-rose-200 text-[11px] font-mono text-rose-800">
                    {member.no_show_count ?? member.noShowCount} lần vi phạm
                  </span>
                </div>
                <p className="text-[11px] text-rose-700 leading-relaxed">
                  Khách từng không đến hoặc hủy vi phạm quy định. Khuyến nghị yêu cầu thanh toán/cọc 100% trước khi xác nhận giữ phòng!
                </p>
              </div>
            </div>
          )}

          {onPhoneChanged && (
            <ChangePhoneModal member={member} isOpen={changeOpen} onClose={() => setChangeOpen(false)} onChanged={onPhoneChanged} />
          )}
        </div>
      ) : retired ? (
        <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1.5 animate-in fade-in duration-200">
          <div>
            Số này đã được đổi sang <strong className="font-mono">{retired.currentPhoneMasked ?? "số khác"}</strong>
            {retired.fullName ? (
              <>
                {" "}
                (hồ sơ <strong>{retired.fullName}</strong>)
              </>
            ) : null}{" "}
            ngày {formatVnDate(retired.changedAt)}.
          </div>
          {retired.currentPhoneNational && (
            <button
              type="button"
              onClick={openRetiredOwner}
              className="font-semibold text-emerald-800 bg-white border border-emerald-200 rounded-lg px-2 py-0.5 hover:bg-emerald-50"
            >
              Dùng hồ sơ này
            </button>
          )}
        </div>
      ) : (
        lookupAttempted && (
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center gap-2">
            <span>✨</span>
            <span>Khách mới — hồ sơ thành viên sẽ tự động lưu vào CDP sau khi đặt phòng.</span>
          </div>
        )
      )}
    </div>
  );
};
