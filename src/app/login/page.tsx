"use client";

import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { clearAllCache, setCachedStaffIdentity } from "@/lib/localCache";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reason = searchParams.get("reason");

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!phone.trim() || !password) {
      setErrorMsg("Vui lòng nhập đầy đủ số điện thoại và mật khẩu.");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim(), password }),
      });

      const data = (await res.json()) as any;
      if (!res.ok) {
        throw new Error(data.error || "Đăng nhập thất bại.");
      }

      // Purge any stale cache from a previous session and store new user immediately
      clearAllCache();
      if (data.staff) {
        setCachedStaffIdentity({
          id: data.staff.id,
          phone: data.staff.phone,
          fullName: data.staff.fullName,
          role: data.staff.role,
          expiresAt: data.staff.expiresAt || (Date.now() + 86400 * 1000),
        });
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || "Lỗi kết nối máy chủ.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md space-y-8 z-10">
      {/* Brand Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex w-14 h-14 rounded-2xl bg-emerald-600 items-center justify-center text-white font-extrabold text-2xl shadow-lg shadow-emerald-600/20 mb-2">
          EI
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
          EVERY INN ADMIN
        </h1>
        <p className="text-xs text-slate-500 font-medium">
          Hệ thống Quản lý Bảng Phòng & Khách Hàng (CDP)
        </p>
      </div>

      {/* Login Card */}
      <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-xl space-y-6">
        <div className="border-b border-slate-100 pb-3">
          <h2 className="text-base font-bold text-slate-900">Đăng nhập tài khoản</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Dành riêng cho Lễ tân và Quản lý khách sạn
          </p>
        </div>

        {/* Expired Session Alert */}
        {reason && (
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
            <span>⏰</span>
            <span>
              {reason === "expired"
                ? "Phiên làm việc đã hết hạn (24 giờ). Vui lòng đăng nhập lại."
                : "Phiên làm việc không hợp lệ hoặc đã kết thúc. Vui lòng đăng nhập lại."}
            </span>
          </div>
        )}

        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
            <span>⚠</span>
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Số điện thoại nhân viên"
            required
            placeholder="09xx xxx xxx"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="username"
          />

          <Input
            label="Mật khẩu"
            type="password"
            required
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full mt-2"
            isLoading={loading}
          >
            Đăng Nhập Hệ Thống
          </Button>
        </form>

        {/* Quick test credentials reminder */}
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-500 space-y-1">
          <div className="font-semibold text-slate-700">Tài khoản mặc định:</div>
          <div className="flex justify-between">
            <span>Quản lý: <strong className="text-emerald-700 font-mono">0901234567</strong></span>
            <span>MK: <strong className="text-slate-800 font-mono">everyinn2024</strong></span>
          </div>
          <div className="flex justify-between">
            <span>Lễ tân: <strong className="text-sky-700 font-mono">0909998888</strong></span>
            <span>MK: <strong className="text-slate-800 font-mono">everyinn2024</strong></span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <p className="text-center text-xs text-slate-400">
        Every Inn Hospitality Management System · Cloudflare D1
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center px-4 sm:px-6 relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />

      <Suspense fallback={<div className="text-slate-400 text-sm">Đang tải...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
