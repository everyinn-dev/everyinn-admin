"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function LoginPage() {
  const router = useRouter();
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

      router.push("/dashboard");
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || "Lỗi kết nối máy chủ.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080d16] flex flex-col justify-center items-center px-4 sm:px-6 relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md space-y-8 z-10">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 items-center justify-center text-white font-extrabold text-2xl shadow-xl shadow-emerald-500/20 mb-2">
            EI
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            EVERY INN ADMIN
          </h1>
          <p className="text-xs text-slate-400 font-medium">
            Hệ thống Quản lý Bảng Phòng & Khách Hàng (CDP)
          </p>
        </div>

        {/* Login Card */}
        <div className="p-6 sm:p-8 rounded-3xl bg-[#0e1625]/80 border border-slate-800 shadow-2xl backdrop-blur-xl space-y-6">
          <div className="border-b border-slate-800/80 pb-3">
            <h2 className="text-base font-bold text-slate-100">Đăng nhập tài khoản</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Dành riêng cho Lễ tân và Quản lý khách sạn
            </p>
          </div>

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
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
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 text-[11px] text-slate-400 space-y-1">
            <div className="font-semibold text-slate-300">Tài khoản mặc định:</div>
            <div className="flex justify-between">
              <span>Quản lý: <strong className="text-emerald-400 font-mono">0901234567</strong></span>
              <span>MK: <strong className="text-slate-200 font-mono">everyinn2024</strong></span>
            </div>
            <div className="flex justify-between">
              <span>Lễ tân: <strong className="text-sky-400 font-mono">0909998888</strong></span>
              <span>MK: <strong className="text-slate-200 font-mono">everyinn2024</strong></span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-500">
          Every Inn Hospitality Management System · Cloudflare D1
        </p>
      </div>
    </div>
  );
}
