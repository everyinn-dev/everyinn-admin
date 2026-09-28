"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Promotion } from "@/types/promotions";
import { BookingType, LoyaltyTier, RoomClass } from "@/types";
import { evaluatePromotion } from "@/lib/promotions";

interface PromotionSelectorProps {
  roomClass: RoomClass;
  bookingType: BookingType;
  checkinAt: Date;
  rawSubtotal: number;
  memberTier: LoyaltyTier;
  selectedPromotion: Promotion | null;
  onSelectPromotion: (promo: Promotion | null, discountAmount: number) => void;
}

export const PromotionSelector: React.FC<PromotionSelectorProps> = ({
  roomClass,
  bookingType,
  checkinAt,
  rawSubtotal,
  memberTier,
  selectedPromotion,
  onSelectPromotion,
}) => {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [manualError, setManualError] = useState<string | null>(null);

  // Fetch active promotions
  useEffect(() => {
    let ignore = false;
    async function loadPromos() {
      try {
        setLoading(true);
        const res = await fetch("/api/promotions?active_only=true");
        if (res.ok) {
          const data = (await res.json()) as any;
          if (!ignore) {
            setPromotions(data.promotions || []);
          }
        }
      } catch (err) {
        console.error("Failed to load active promotions:", err);
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadPromos();
    return () => {
      ignore = true;
    };
  }, []);

  // Evaluate promotions in real-time against current booking context
  const evaluatedPromotions = useMemo(() => {
    return promotions.map((p) => {
      const evaluation = evaluatePromotion(p, {
        roomClass,
        bookingType,
        checkinAt,
        rawSubtotal,
        memberTier,
      });

      return {
        promotion: p,
        eligible: evaluation.eligible,
        reason: evaluation.reason,
        discountAmount: evaluation.discountAmount,
      };
    });
  }, [promotions, roomClass, bookingType, checkinAt, rawSubtotal, memberTier]);

  // Recalculate discount if currently selected promotion's discount changes with subtotal
  useEffect(() => {
    if (!selectedPromotion) return;

    const currentEval = evaluatedPromotions.find(
      (ep) => ep.promotion.id === selectedPromotion.id
    );

    if (currentEval) {
      if (currentEval.eligible) {
        onSelectPromotion(selectedPromotion, currentEval.discountAmount);
      } else {
        // No longer eligible due to room/date/subtotal change
        onSelectPromotion(null, 0);
      }
    }
  }, [evaluatedPromotions, selectedPromotion, onSelectPromotion]);

  const handleApplyManualCode = () => {
    setManualError(null);
    const clean = manualCode.trim().toUpperCase();
    if (!clean) return;

    const match = evaluatedPromotions.find(
      (ep) => ep.promotion.code?.toUpperCase() === clean
    );

    if (!match) {
      setManualError(`Không tìm thấy mã ưu đãi '${clean}' hoặc mã đã hết hạn.`);
      return;
    }

    if (!match.eligible) {
      setManualError(match.reason || "Mã không đủ điều kiện áp dụng cho đơn này.");
      return;
    }

    onSelectPromotion(match.promotion, match.discountAmount);
    setManualCode("");
  };

  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-xs space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
          <span>🏷️</span>
          <span>Ưu Đãi & Khuyến Mãi Áp Dụng</span>
        </label>

        {selectedPromotion && (
          <button
            type="button"
            onClick={() => onSelectPromotion(null, 0)}
            className="text-xs font-bold text-rose-600 hover:text-rose-800"
          >
            Bỏ chọn ưu đãi ✕
          </button>
        )}
      </div>

      {/* Manual Voucher Code Input */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder="Nhập mã voucher (VD: THUVANG10, GOLDVIP15)..."
          value={manualCode}
          onChange={(e) => {
            setManualCode(e.target.value.toUpperCase());
            setManualError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleApplyManualCode();
            }
          }}
          className="flex-1 rounded-xl bg-slate-50 border border-slate-300 px-3.5 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-emerald-600 uppercase shadow-2xs"
        />
        <button
          type="button"
          onClick={handleApplyManualCode}
          className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-xs shrink-0 cursor-pointer"
        >
          Áp Dụng
        </button>
      </div>

      {manualError && (
        <p className="text-[11px] text-rose-600 font-semibold">{manualError}</p>
      )}

      {/* Suggested & Available Promotions */}
      {loading ? (
        <p className="text-xs text-slate-500 py-1">Đang kiểm tra ưu đãi khả dụng...</p>
      ) : (
        <div className="space-y-2 pt-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            Gợi ý ưu đãi cho đơn phòng này:
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {evaluatedPromotions.map(({ promotion, eligible, reason, discountAmount }) => {
              const isSelected = selectedPromotion?.id === promotion.id;
              const isLoyaltyDeal =
                promotion.applicable_loyalty_tiers &&
                promotion.applicable_loyalty_tiers.includes(memberTier) &&
                promotion.applicable_loyalty_tiers.length < 4;

              return (
                <div
                  key={promotion.id}
                  onClick={() => {
                    if (eligible) {
                      if (isSelected) {
                        onSelectPromotion(null, 0);
                      } else {
                        onSelectPromotion(promotion, discountAmount);
                      }
                    }
                  }}
                  className={`p-3 rounded-xl border text-left transition-all relative select-none cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? "bg-emerald-50 border-emerald-600 ring-2 ring-emerald-600/20 shadow-xs"
                      : eligible
                      ? "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/70 shadow-2xs"
                      : "bg-slate-50/60 border-slate-200 opacity-60 cursor-not-allowed"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-xs font-extrabold text-slate-900 truncate">
                        {promotion.category_icon || "🎁"} {promotion.name}
                      </span>

                      {isLoyaltyDeal && (
                        <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-900 text-[10px] font-bold shrink-0">
                          👑 Hạng {memberTier.toUpperCase()}
                        </span>
                      )}
                    </div>

                    <div className="flex items-baseline justify-between pt-0.5">
                      <span className="text-xs font-mono font-black text-emerald-700">
                        {promotion.discount_type === "percentage"
                          ? `Giảm ${promotion.discount_value}%`
                          : `Giảm ${promotion.discount_value.toLocaleString("vi-VN")} đ`}
                      </span>

                      {promotion.code && (
                        <span className="text-[10px] font-mono font-bold bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                          {promotion.code}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Eligibility or Estimated Discount */}
                  <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                    {eligible ? (
                      <span className="font-semibold text-emerald-800">
                        Tiết kiệm:{" "}
                        <strong className="font-mono">
                          {discountAmount.toLocaleString("vi-VN")} đ
                        </strong>
                      </span>
                    ) : (
                      <span className="text-rose-600 font-medium text-[10px] line-clamp-1">
                        ⚠️ {reason}
                      </span>
                    )}

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isSelected
                          ? "bg-emerald-600 text-white"
                          : eligible
                          ? "bg-slate-100 text-slate-700 hover:bg-emerald-100 hover:text-emerald-800"
                          : "text-slate-400"
                      }`}
                    >
                      {isSelected ? "Đang chọn ✓" : eligible ? "Chọn" : "Không áp dụng"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
