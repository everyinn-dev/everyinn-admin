"use client";

import React, { useRef, useState } from "react";
import type { Member } from "@/types";
import { apiFetch } from "@/lib/apiClient";
import { Modal } from "../ui/Modal";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { useToast } from "../ui/Toast";

const REASONS = ["Khách đổi số mới", "Nhập sai số lúc đặt trước", "Khách dùng số khác để liên hệ"];

interface Props {
  member: Member;
  isOpen: boolean;
  onClose: () => void;
  onChanged: (member: Member) => void;
}

/**
 * Manager-only: move the guest profile to a new phone number. The CDP profile (history, tier, stamps,
 * vouchers) stays the same; the old number stops resolving to it for new bookings.
 */
export const ChangePhoneModal: React.FC<Props> = ({ member, isOpen, onClose, onChanged }) => {
  const toast = useToast();
  const [newPhone, setNewPhone] = useState("");
  const [reason, setReason] = useState(REASONS[0]!);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // One key per intent: a double click / retry replays instead of failing.
  const keyRef = useRef<string | null>(null);

  const close = () => {
    if (saving) return;
    setNewPhone("");
    setNote("");
    setError(null);
    keyRef.current = null;
    onClose();
  };

  const submit = async () => {
    if (!member.customerId || !member.version) {
      setError("Thiếu thông tin hồ sơ, vui lòng tìm lại khách.");
      return;
    }
    if (newPhone.replace(/\D/g, "").length < 9) {
      setError("Vui lòng nhập số điện thoại mới hợp lệ.");
      return;
    }
    setSaving(true);
    setError(null);
    keyRef.current ??= `adm.customer-phone-change.${crypto.randomUUID()}`;
    try {
      const res = await apiFetch(`/api/customers/${encodeURIComponent(member.customerId)}/phone`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": keyRef.current },
        body: JSON.stringify({
          newPhone: newPhone.trim(),
          expectedVersion: member.version,
          reason: note.trim() ? `${reason}: ${note.trim()}` : reason,
        }),
      });
      const data = (await res.json()) as { member?: Member; error?: string; code?: string };
      if (!res.ok || !data.member) {
        const msg =
          data.code === "PHONE_TAKEN"
            ? "Số này đã thuộc hồ sơ khách khác. Hệ thống chưa hỗ trợ gộp hai hồ sơ."
            : data.code === "VERSION_CONFLICT"
              ? "Hồ sơ vừa được người khác cập nhật. Đóng lại, tìm lại khách rồi thử lần nữa."
              : data.error || "Không đổi được số điện thoại.";
        keyRef.current = null;
        setError(msg);
        return;
      }
      toast.success(`Hồ sơ ${member.fullName || member.full_name || ""} đã chuyển sang số ${data.member.phone}.`, "Đã đổi SĐT");
      keyRef.current = null;
      setNewPhone("");
      setNote("");
      onChanged(data.member);
      onClose();
    } catch {
      setError("Lỗi kết nối, vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={close} title="Đổi số điện thoại khách" maxWidth="md">
      <div className="space-y-4 text-sm">
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1">
          <div>
            Khách: <strong className="text-slate-900">{member.fullName || member.full_name || "—"}</strong>
          </div>
          <div>
            Số hiện tại: <span className="font-mono font-semibold">{member.phone}</span>
          </div>
        </div>

        <Input label="Số điện thoại mới" required placeholder="09xx xxx xxx" inputMode="tel" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />

        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-700 tracking-wide uppercase">
            Lý do<span className="text-rose-500 ml-1">*</span>
          </label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-xl bg-white border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
          >
            {REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Ghi chú thêm (không bắt buộc)"
            value={note}
            maxLength={200}
            onChange={(e) => setNote(e.target.value)}
            className="w-full rounded-xl bg-white border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-600 focus:outline-none"
          />
        </div>

        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
          <div className="font-bold">Lưu ý</div>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>Lịch sử đặt phòng, hạng thành viên, tem và voucher được giữ nguyên.</li>
            <li>Số cũ sẽ ngừng dùng cho hồ sơ này. Đơn mới đặt bằng số cũ sẽ tạo hồ sơ khách khác.</li>
            <li>Không gộp được nếu số mới đã thuộc một khách khác.</li>
          </ul>
        </div>

        {error && <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">{error}</div>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={close} disabled={saving}>
            Hủy
          </Button>
          <Button type="button" onClick={submit} disabled={saving}>
            {saving ? "Đang đổi..." : "Xác nhận đổi số"}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
