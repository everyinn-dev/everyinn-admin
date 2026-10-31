"use client";

import React, { useEffect, useState, Suspense } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import { BookingWizard } from "@/components/bookings/BookingWizard";
import { Spinner } from "@/components/ui/Spinner";
import type { PricingRule, Room, SurchargeRule } from "@/types";
import {
  getCachedRoomsClient,
  setCachedRoomsClient,
  getCachedPricingRulesClient,
  setCachedPricingRulesClient,
  getCachedConfigsClient,
  setCachedConfigsClient,
} from "@/lib/localCache";

export default function SearchAndBookPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [pricingRules, setPricingRules] = useState<PricingRule[]>([]);
  const [surchargeRules, setSurchargeRules] = useState<SurchargeRule[]>([]);
  const [hourlySlots, setHourlySlots] = useState<number[] | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadMasterData() {
      try {
        const cachedRooms = getCachedRoomsClient();
        const cachedPricing = getCachedPricingRulesClient();
        const cachedConfigs = getCachedConfigsClient();

        if (cachedRooms && cachedPricing && cachedConfigs && cachedConfigs.surchargeRules) {
          setRooms(cachedRooms);
          setPricingRules(cachedPricing);
          setHourlySlots(cachedConfigs.hourlySlots);
          setSurchargeRules(cachedConfigs.surchargeRules);
          setLoading(false);
          return;
        }

        const [roomsRes, rulesRes, configsRes] = await Promise.all([
          cachedRooms ? null : fetch("/api/rooms"),
          cachedPricing ? null : fetch("/api/pricing-rules"),
          cachedConfigs && cachedConfigs.surchargeRules ? null : fetch("/api/configs"),
        ]);

        if (cachedRooms) {
          setRooms(cachedRooms);
        } else if (roomsRes?.ok) {
          const roomsData = (await roomsRes.json()) as any;
          const fetchedRooms: Room[] = roomsData.rooms || [];
          setRooms(fetchedRooms);
          setCachedRoomsClient(fetchedRooms);
        }

        if (cachedPricing) {
          setPricingRules(cachedPricing);
        } else if (rulesRes?.ok) {
          const rulesData = (await rulesRes.json()) as any;
          const fetchedRules: PricingRule[] = rulesData.pricingRules || [];
          setPricingRules(fetchedRules);
          setCachedPricingRulesClient(fetchedRules);
        }

        if (cachedConfigs && cachedConfigs.surchargeRules) {
          setHourlySlots(cachedConfigs.hourlySlots);
          setSurchargeRules(cachedConfigs.surchargeRules);
        } else if (configsRes?.ok) {
          const configsData = (await configsRes.json()) as any;
          setHourlySlots(configsData.hourlySlots);
          setSurchargeRules(configsData.surchargeRules || []);
          setCachedConfigsClient({
            bookingRules: configsData.bookingRules,
            hourlySlots: configsData.hourlySlots,
            surchargeRules: configsData.surchargeRules || [],
          });
        }
      } catch (e) {
        console.error("Failed to load master data for room search:", e);
      } finally {
        setLoading(false);
      }
    }

    loadMasterData();
  }, []);

  return (
    <AdminShell>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Tìm Phòng Trống & Đặt Phòng (Giữ Chỗ 15 Phút)
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Chọn loại hình Theo Giờ / Qua Đêm / Theo Ngày ➔ Xem phòng trống & giá niêm yết ➔ Giữ phòng 15 phút & Thanh toán
            </p>
          </div>
        </div>

        {loading ? (
          <div className="h-96 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col items-center justify-center gap-3">
            <Spinner size="lg" />
            <p className="text-sm text-slate-500 font-medium">Đang tải dữ liệu phòng & bảng giá...</p>
          </div>
        ) : (
          <Suspense fallback={<Spinner size="lg" />}>
            <BookingWizard
              rooms={rooms}
              pricingRules={pricingRules}
              surchargeRules={surchargeRules}
              hourlySlots={hourlySlots}
            />
          </Suspense>
        )}
      </div>
    </AdminShell>
  );
}

