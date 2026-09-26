import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { ToastProvider, ToastContainer } from "@/components/ui/Toast";
import "./globals.css";

const jakartaSans = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Every Inn — Admin & Booking Management",
  description: "Hệ thống quản lý phòng và dữ liệu khách hàng Every Inn",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className={`${jakartaSans.variable} dark h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[#0b0f17] text-slate-100 selection:bg-emerald-500 selection:text-white">
        <ToastProvider>
          {children}
          <ToastContainer />
        </ToastProvider>
      </body>
    </html>
  );
}
