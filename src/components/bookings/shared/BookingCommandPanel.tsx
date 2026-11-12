"use client";

import React from "react";
import { Button } from "@/components/ui/Button";

type Tone = "rose" | "amber" | "emerald";

const TONES: Record<Tone, { box: string; title: string; text: string }> = {
  rose: { box: "bg-rose-50 border-rose-300", title: "text-rose-900", text: "text-rose-800" },
  amber: { box: "bg-amber-50 border-amber-300", title: "text-amber-900", text: "text-amber-800" },
  emerald: { box: "bg-emerald-50 border-emerald-300", title: "text-emerald-900", text: "text-emerald-800" },
};

interface BookingCommandPanelProps {
  tone: Tone;
  title: string;
  intro?: React.ReactNode;
  children: React.ReactNode;
  error?: string;
  submitting: boolean;
  confirmLabel: string;
  /** Why the confirm button is off (shown as the visible hint above the buttons). */
  blockedReason?: string;
  onConfirm: () => void;
  onDismiss: () => void;
  confirmVariant?: "danger" | "primary";
}

/**
 * Frame shared by every money action in the booking drawer (cancel, add a charge, void a charge): title + one
 * sentence of what will happen, the fields, the Core error, then Confirm / Close. Same look, same behaviour.
 */
export const BookingCommandPanel: React.FC<BookingCommandPanelProps> = ({
  tone,
  title,
  intro,
  children,
  error,
  submitting,
  confirmLabel,
  blockedReason,
  onConfirm,
  onDismiss,
  confirmVariant = "danger",
}) => {
  const t = TONES[tone];
  return (
    <div className={`p-4 rounded-xl border space-y-3.5 animate-in fade-in duration-200 shadow-xs ${t.box}`}>
      <div>
        <h4 className={`text-xs font-bold uppercase tracking-wide ${t.title}`}>{title}</h4>
        {intro && <p className={`text-[11px] mt-1 leading-relaxed font-medium ${t.text}`}>{intro}</p>}
      </div>
      {children}
      {(error || blockedReason) && <p className="text-xs text-rose-700 font-semibold">{error || blockedReason}</p>}
      <div className="flex gap-2 pt-1">
        <Button size="sm" variant={confirmVariant} className="flex-1 font-semibold" isLoading={submitting} disabled={submitting || !!blockedReason} onClick={onConfirm}>
          {confirmLabel}
        </Button>
        <Button size="sm" variant="secondary" disabled={submitting} onClick={onDismiss}>
          Đóng
        </Button>
      </div>
    </div>
  );
};
