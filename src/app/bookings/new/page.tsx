"use client";

import React, { useEffect, useState, Suspense } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import { BookingForm } from "@/components/bookings/BookingForm";
import { Spinner } from "@/components/ui/Spinner";
import { BookingRulesConfig, PricingRule, Room } from "@/types";
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
  const [bookingRules, setBookingRules] = useState<BookingRulesConfig | undefined>(undefined);
  const [hourlySlots, setHourlySlots] = useState<number[] | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadMasterData() {
      try {
        // Fast-path: serve all 3 datasets from localStorage cache (TTL 60 min)
        const cachedRooms = getCachedRoomsClient();
        const cachedPricing = getCachedPricingRulesClient();
        const cachedConfigs = getCachedConfigsClient();

        if (cachedRooms && cachedPricing && cachedConfigs) {
          setRooms(cachedRooms);
          setPricingRules(cachedPricing);
          setBookingRules(cachedConfigs.bookingRules);
          setHourlySlots(cachedConfigs.hourlySlots);
          setLoading(false);
          return; // Zero fetch calls — instant form ready!
        }

        // Cache miss: fetch in parallel only what's missing
        const [roomsRes, rulesRes, configsRes] = await Promise.all([
          cachedRooms ? null : fetch("/api/rooms"),
          cachedPricing ? null : fetch("/api/pricing-rules"),
          cachedConfigs ? null : fetch("/api/configs"),
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

        if (cachedConfigs) {
          setBookingRules(cachedConfigs.bookingRules);
          setHourlySlots(cachedConfigs.hourlySlots);
        } else if (configsRes?.ok) {
          const configsData = (await configsRes.json()) as any;
          setBookingRules(configsData.bookingRules);
          setHourlySlots(configsData.hourlySlots);
          setCachedConfigsClient({
            bookingRules: configsData.bookingRules,
            hourlySlots: configsData.hourlySlots,
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
          <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
            Tạo Đặt Phòng Mới
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Nhập thông tin khách, tự động kiểm tra Mini CDP và chốt phòng theo giờ/đêm/ngày
          </p>
        </div>

        {loading ? (
          <div className="h-96 rounded-2xl bg-[#0d131f] border border-slate-800 flex flex-col items-center justify-center gap-3">
            <Spinner size="lg" />
            <p className="text-sm text-slate-400 font-medium">Đang tải danh sách phòng...</p>
          </div>
        ) : (
          <Suspense fallback={<Spinner size="lg" />}>
            <BookingForm
              initialRooms={rooms}
              initialPricingRules={pricingRules}
              bookingRules={bookingRules}
              hourlySlots={hourlySlots}
            />
          </Suspense>
        )}
      </div>
    </AdminShell>
  );
}
