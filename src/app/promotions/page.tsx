"use client";

import React, { useState, useEffect, useCallback } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import { PromotionsList } from "@/components/promotions/PromotionsList";
import { CategoriesList } from "@/components/promotions/CategoriesList";
import { SurchargesList } from "@/components/promotions/SurchargesList";
import { PromotionModal } from "@/components/promotions/PromotionModal";
import { CategoryModal } from "@/components/promotions/CategoryModal";
import { SurchargeModal } from "@/components/promotions/SurchargeModal";
import { Promotion, PromotionCategory } from "@/types/promotions";
import { SurchargeRule } from "@/types";
import { useToast } from "@/components/ui/Toast";

export default function PromotionsPage() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<"promotions" | "surcharges" | "categories">("promotions");

  const [categories, setCategories] = useState<PromotionCategory[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [surchargeRules, setSurchargeRules] = useState<SurchargeRule[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [promoModalOpen, setPromoModalOpen] = useState(false);
  const [selectedPromo, setSelectedPromo] = useState<Promotion | null>(null);

  const [catModalOpen, setCatModalOpen] = useState(false);
  const [selectedCat, setSelectedCat] = useState<PromotionCategory | null>(null);

  const [surchargeModalOpen, setSurchargeModalOpen] = useState(false);
  const [selectedSurcharge, setSelectedSurcharge] = useState<SurchargeRule | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [catRes, promoRes, surRes] = await Promise.all([
        fetch("/api/promotions/categories"),
        fetch("/api/promotions"),
        fetch("/api/surcharges"),
      ]);

      if (catRes.ok) {
        const catData = (await catRes.json()) as any;
        setCategories(catData.categories || []);
      }

      if (promoRes.ok) {
        const promoData = (await promoRes.json()) as any;
        setPromotions(promoData.promotions || []);
      }

      if (surRes.ok) {
        const surData = (await surRes.json()) as any;
        setSurchargeRules(surData.surchargeRules || []);
      }
    } catch (err: any) {
      console.error("Failed to load promotions data:", err);
      toast.error("Không thể tải danh sách ưu đãi & phụ thu.", "Lỗi tải dữ liệu");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Statistics calculation
  const totalPromos = promotions.length;
  const activePromos = promotions.filter((p) => p.is_active === 1).length;
  const seasonalPromos = promotions.filter(
    (p) => p.category_code === "seasonal" || p.category_id === "cat_seasonal"
  ).length;
  const loyaltyPromos = promotions.filter(
    (p) => p.category_code === "loyalty" || p.category_id === "cat_loyalty"
  ).length;

  return (
    <AdminShell>
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">🏷️</span>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Quản Lý Ưu Đãi & Phụ Thu
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Quản lý chương trình khuyến mãi, phụ thu ngày lễ / khách thêm và đặc quyền hạng thành viên Mini CDP.
            </p>
          </div>

          {/* Tab Switcher */}
          <div className="flex items-center bg-slate-200/80 p-1 rounded-xl shrink-0 self-start sm:self-auto flex-wrap gap-1">
            <button
              type="button"
              onClick={() => setActiveTab("promotions")}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === "promotions"
                  ? "bg-white text-emerald-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              🎁 Ưu Đãi ({promotions.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("surcharges")}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === "surcharges"
                  ? "bg-white text-amber-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              💰 Phụ Thu Lễ & Khách ({surchargeRules.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("categories")}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === "categories"
                  ? "bg-white text-emerald-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              📁 Danh Mục ({categories.length})
            </button>
          </div>
        </div>

        {/* Quick Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide block">
              Tổng số ưu đãi
            </span>
            <div className="text-2xl font-black text-slate-900 font-mono mt-1">{totalPromos}</div>
            <span className="text-[11px] text-slate-400 font-medium">Toàn hệ thống</span>
          </div>

          <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-white border border-emerald-200 shadow-xs">
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wide block">
              Đang kích hoạt
            </span>
            <div className="text-2xl font-black text-emerald-800 font-mono mt-1">{activePromos}</div>
            <span className="text-[11px] text-emerald-600 font-medium">Sẵn sàng áp dụng</span>
          </div>

          <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-50 to-white border border-amber-200 shadow-xs">
            <span className="text-xs font-bold text-amber-700 uppercase tracking-wide block">
              Quy tắc Phụ thu
            </span>
            <div className="text-2xl font-black text-amber-800 font-mono mt-1">
              {surchargeRules.filter((r) => r.is_active === 1).length}/{surchargeRules.length}
            </div>
            <span className="text-[11px] text-amber-600 font-medium">Lễ Tết & Khách thêm ({seasonalPromos} promo mùa)</span>
          </div>

          <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-50 to-white border border-purple-200 shadow-xs">
            <span className="text-xs font-bold text-purple-700 uppercase tracking-wide block">
              Hạng thành viên
            </span>
            <div className="text-2xl font-black text-purple-800 font-mono mt-1">{loyaltyPromos}</div>
            <span className="text-[11px] text-purple-600 font-medium">Đặc quyền Mini CDP</span>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === "promotions" ? (
          <PromotionsList
            promotions={promotions}
            categories={categories}
            loading={loading}
            onRefresh={loadData}
            onEdit={(p) => {
              setSelectedPromo(p);
              setPromoModalOpen(true);
            }}
            onCreateNew={() => {
              setSelectedPromo(null);
              setPromoModalOpen(true);
            }}
          />
        ) : activeTab === "surcharges" ? (
          <SurchargesList
            rules={surchargeRules}
            loading={loading}
            onRefresh={loadData}
            onEdit={(r) => {
              setSelectedSurcharge(r);
              setSurchargeModalOpen(true);
            }}
            onCreateNew={() => {
              setSelectedSurcharge(null);
              setSurchargeModalOpen(true);
            }}
          />
        ) : (
          <CategoriesList
            categories={categories}
            loading={loading}
            onRefresh={loadData}
            onEdit={(c) => {
              setSelectedCat(c);
              setCatModalOpen(true);
            }}
            onCreateNew={() => {
              setSelectedCat(null);
              setCatModalOpen(true);
            }}
          />
        )}

        {/* Modals */}
        <PromotionModal
          isOpen={promoModalOpen}
          onClose={() => setPromoModalOpen(false)}
          promotion={selectedPromo}
          categories={categories}
          onSaved={loadData}
        />

        <CategoryModal
          isOpen={catModalOpen}
          onClose={() => setCatModalOpen(false)}
          category={selectedCat}
          onSaved={loadData}
        />

        <SurchargeModal
          isOpen={surchargeModalOpen}
          onClose={() => setSurchargeModalOpen(false)}
          rule={selectedSurcharge}
          onSaved={loadData}
        />
      </div>
    </AdminShell>
  );
}
