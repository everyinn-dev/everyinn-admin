"use client";

import React, { useState, useEffect, useCallback } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import { PromotionsList } from "@/components/promotions/PromotionsList";
import { CategoriesList } from "@/components/promotions/CategoriesList";
import { PromotionModal } from "@/components/promotions/PromotionModal";
import { CategoryModal } from "@/components/promotions/CategoryModal";
import { Promotion, PromotionCategory } from "@/types/promotions";
import { useToast } from "@/components/ui/Toast";

export default function PromotionsPage() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<"promotions" | "categories">("promotions");

  const [categories, setCategories] = useState<PromotionCategory[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [promoModalOpen, setPromoModalOpen] = useState(false);
  const [selectedPromo, setSelectedPromo] = useState<Promotion | null>(null);

  const [catModalOpen, setCatModalOpen] = useState(false);
  const [selectedCat, setSelectedCat] = useState<PromotionCategory | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [catRes, promoRes] = await Promise.all([
        fetch("/api/promotions/categories"),
        fetch("/api/promotions"),
      ]);

      if (catRes.ok) {
        const catData = (await catRes.json()) as any;
        setCategories(catData.categories || []);
      }

      if (promoRes.ok) {
        const promoData = (await promoRes.json()) as any;
        setPromotions(promoData.promotions || []);
      }
    } catch (err: any) {
      console.error("Failed to load promotions data:", err);
      toast.error("Không thể tải danh sách ưu đãi.", "Lỗi tải dữ liệu");
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
                Quản Lý Ưu Đãi & Khuyến Mãi
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Quản lý danh mục loại ưu đãi, ưu đãi theo mùa (Seasonal) và đặc quyền hạng thành viên Mini CDP.
            </p>
          </div>

          {/* Tab Switcher */}
          <div className="flex items-center bg-slate-200/80 p-1 rounded-xl shrink-0 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setActiveTab("promotions")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === "promotions"
                  ? "bg-white text-emerald-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              🎁 Chương Trình Ưu Đãi ({promotions.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("categories")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === "categories"
                  ? "bg-white text-emerald-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              📁 Danh Mục Loại ({categories.length})
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
              Ưu đãi Seasonal
            </span>
            <div className="text-2xl font-black text-amber-800 font-mono mt-1">{seasonalPromos}</div>
            <span className="text-[11px] text-amber-600 font-medium">Theo mùa & Dịp lễ</span>
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
      </div>
    </AdminShell>
  );
}
