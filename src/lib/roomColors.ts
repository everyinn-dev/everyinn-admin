/**
 * roomColors.ts — Distinct color themes per room across Every Inn.
 *
 * Each room has a unique color identity for visual recognition on:
 * - Room Selector Cards (booking/new)
 * - Gantt Chart Header (dashboard)
 * - Booking Summary Cards
 */

export interface RoomTheme {
  roomNumber: string;
  name: string;
  badge: string;
  badgeSoft: string;
  borderActive: string;
  borderHover: string;
  accentText: string;
  dotColor: string;
  checkBg: string;
}

export const ROOM_COLOR_THEMES: Record<string, RoomTheme> = {
  "101": {
    roomNumber: "101",
    name: "blue",
    badge: "bg-blue-600 text-white",
    badgeSoft: "bg-blue-50 text-blue-800 border-blue-200",
    borderActive: "border-blue-500 ring-2 ring-blue-500/25 bg-blue-50/40",
    borderHover: "hover:border-blue-300",
    accentText: "text-blue-700",
    dotColor: "bg-blue-500",
    checkBg: "bg-blue-600 text-white",
  },
  "102": {
    roomNumber: "102",
    name: "emerald",
    badge: "bg-emerald-600 text-white",
    badgeSoft: "bg-emerald-50 text-emerald-800 border-emerald-200",
    borderActive: "border-emerald-500 ring-2 ring-emerald-500/25 bg-emerald-50/40",
    borderHover: "hover:border-emerald-300",
    accentText: "text-emerald-700",
    dotColor: "bg-emerald-500",
    checkBg: "bg-emerald-600 text-white",
  },
  "201": {
    roomNumber: "201",
    name: "purple",
    badge: "bg-purple-600 text-white",
    badgeSoft: "bg-purple-50 text-purple-800 border-purple-200",
    borderActive: "border-purple-500 ring-2 ring-purple-500/25 bg-purple-50/40",
    borderHover: "hover:border-purple-300",
    accentText: "text-purple-700",
    dotColor: "bg-purple-500",
    checkBg: "bg-purple-600 text-white",
  },
  "202": {
    roomNumber: "202",
    name: "amber",
    badge: "bg-amber-600 text-white",
    badgeSoft: "bg-amber-50 text-amber-800 border-amber-200",
    borderActive: "border-amber-500 ring-2 ring-amber-500/25 bg-amber-50/40",
    borderHover: "hover:border-amber-300",
    accentText: "text-amber-800",
    dotColor: "bg-amber-500",
    checkBg: "bg-amber-600 text-white",
  },
  "301": {
    roomNumber: "301",
    name: "rose",
    badge: "bg-rose-600 text-white",
    badgeSoft: "bg-rose-50 text-rose-800 border-rose-200",
    borderActive: "border-rose-500 ring-2 ring-rose-500/25 bg-rose-50/40",
    borderHover: "hover:border-rose-300",
    accentText: "text-rose-700",
    dotColor: "bg-rose-500",
    checkBg: "bg-rose-600 text-white",
  },
  "302": {
    roomNumber: "302",
    name: "cyan",
    badge: "bg-cyan-600 text-white",
    badgeSoft: "bg-cyan-50 text-cyan-800 border-cyan-200",
    borderActive: "border-cyan-500 ring-2 ring-cyan-500/25 bg-cyan-50/40",
    borderHover: "hover:border-cyan-300",
    accentText: "text-cyan-700",
    dotColor: "bg-cyan-500",
    checkBg: "bg-cyan-600 text-white",
  },
};

const FALLBACK_PALETTE: Omit<RoomTheme, "roomNumber">[] = [
  {
    name: "indigo",
    badge: "bg-indigo-600 text-white",
    badgeSoft: "bg-indigo-50 text-indigo-800 border-indigo-200",
    borderActive: "border-indigo-500 ring-2 ring-indigo-500/25 bg-indigo-50/40",
    borderHover: "hover:border-indigo-300",
    accentText: "text-indigo-700",
    dotColor: "bg-indigo-500",
    checkBg: "bg-indigo-600 text-white",
  },
  {
    name: "teal",
    badge: "bg-teal-600 text-white",
    badgeSoft: "bg-teal-50 text-teal-800 border-teal-200",
    borderActive: "border-teal-500 ring-2 ring-teal-500/25 bg-teal-50/40",
    borderHover: "hover:border-teal-300",
    accentText: "text-teal-700",
    dotColor: "bg-teal-500",
    checkBg: "bg-teal-600 text-white",
  },
  {
    name: "fuchsia",
    badge: "bg-fuchsia-600 text-white",
    badgeSoft: "bg-fuchsia-50 text-fuchsia-800 border-fuchsia-200",
    borderActive: "border-fuchsia-500 ring-2 ring-fuchsia-500/25 bg-fuchsia-50/40",
    borderHover: "hover:border-fuchsia-300",
    accentText: "text-fuchsia-700",
    dotColor: "bg-fuchsia-500",
    checkBg: "bg-fuchsia-600 text-white",
  },
  {
    name: "sky",
    badge: "bg-sky-600 text-white",
    badgeSoft: "bg-sky-50 text-sky-800 border-sky-200",
    borderActive: "border-sky-500 ring-2 ring-sky-500/25 bg-sky-50/40",
    borderHover: "hover:border-sky-300",
    accentText: "text-sky-700",
    dotColor: "bg-sky-500",
    checkBg: "bg-sky-600 text-white",
  },
];

export function getRoomTheme(roomNumber: string | number, fallbackIdx = 0): RoomTheme {
  const cleanNumber = String(roomNumber).trim();
  if (ROOM_COLOR_THEMES[cleanNumber]) {
    return ROOM_COLOR_THEMES[cleanNumber];
  }
  const fallback = FALLBACK_PALETTE[fallbackIdx % FALLBACK_PALETTE.length];
  return {
    roomNumber: cleanNumber,
    ...fallback,
  };
}

