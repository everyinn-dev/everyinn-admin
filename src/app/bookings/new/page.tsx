"use client";

import React, { useEffect, useState, Suspense } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import { BookingForm } from "@/components/bookings/BookingForm";
import { Spinner } from "@/components/ui/Spinner";
import { BookingRulesConfig, PricingRule, Room, SurchargeRule } from "@/types";
import {
  getCachedRoomsClient,
  setCachedRoomsClient,
  getCachedPricingRulesClient,
  setCachedPricingRulesClient,
  getCachedConfigsClient,
  setCachedConfigsClient,
} from "@/lib/localCache";

export default function NewBookingPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [pricingRules, setPricingRules] = useState<PricingRule[]>([]);
  const [surchargeRules, setSurchargeRules] = useState<SurchargeRule[]>([]);
  const [bookingRules, setBookingRules] = useState<BookingRulesConfig | undefined>(undefined);
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
          setBookingRules(cachedConfigs.bookingRules);
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
          setBookingRules(cachedConfigs.bookingRules);
          setHourlySlots(cachedConfigs.hourlySlots);
          setSurchargeRules(cachedConfigs.surchargeRules);
        } else if (configsRes?.ok) {
          const configsData = (await configsRes.json()) as any;
          setBookingRules(configsData.bookingRules);
          setHourlySlots(configsData.hourlySlots);
          setSurchargeRules(configsData.surchargeRules || []);
          setCachedConfigsClient({
            bookingRules: configsData.bookingRules,
            hourlySlots: configsData.hourlySlots,
            surchargeRules: configsData.surchargeRules || [],
          });
        }
      } catch (e) {
        console.error("Failed to load master data:", e);
      } finally {
        setLoading(false);
      }
    }

    loadMasterData();
  }, []);

  return (
    <AdminShell>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-5xl mx-auto">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            Tạo Đặt Phòng Mới
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Nhập thông tin khách, tự động kiểm tra Mini CDP và chốt phòng theo giờ/đêm/ngày
          </p>
        </div>

        {loading ? (
          <div className="h-96 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col items-center justify-center gap-3">
            <Spinner size="lg" />
            <p className="text-sm text-slate-500 font-medium">Đang tải danh sách phòng...</p>
          </div>
        ) : (
          <Suspense fallback={<Spinner size="lg" />}>
            <BookingForm
              initialRooms={rooms}
              initialPricingRules={pricingRules}
              initialSurchargeRules={surchargeRules}
              bookingRules={bookingRules}
              hourlySlots={hourlySlots}
            />
          </Suspense>
        )}
      </div>
    </AdminShell>
  );
}
