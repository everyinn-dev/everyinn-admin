"use client";

import { useState } from "react";
import type { Member } from "@/types";
import {
  applyProfile,
  clearAutofill,
  emptyGuest,
  samePhone,
  type AutofillSnapshot,
  type GuestFields,
} from "@/lib/guestAutofill";

interface UndoState {
  label: string;
  fields: GuestFields;
  snapshot: AutofillSnapshot | null;
  member: Member | null;
}

/**
 * One source of truth for the guest block of a create-booking form. Both entry points — the social /
 * name dropdown and the phone lookup — go through `selectMember`, so they refill the block the same
 * way (rules in src/lib/guestAutofill.ts). State transitions are computed outside React updaters so
 * StrictMode double-invocation cannot apply them twice.
 */
export function useGuestAutofill(initial: Partial<GuestFields> = {}) {
  const [fields, setFields] = useState<GuestFields>(() => ({ ...emptyGuest(), ...initial }));
  const [member, setMember] = useState<Member | null>(null);
  const [snapshot, setSnapshot] = useState<AutofillSnapshot | null>(null);
  const [undo, setUndo] = useState<UndoState | null>(null);

  const setField = <K extends keyof GuestFields>(key: K, value: GuestFields[K]) => {
    setFields((prev) => ({ ...prev, [key]: value }));
    setUndo(null);
    // The banner must never show a profile for a number that is no longer in the field.
    if (key === "phone" && member && !samePhone(member.phone, value)) setMember(null);
  };

  /** Dropdown pick or phone-lookup hit. Returns true when the block was refilled. */
  const selectMember = (m: Member): boolean => {
    const r = applyProfile(fields, snapshot, m);
    if (r.replaced) {
      setFields(r.fields);
      setSnapshot(r.snapshot);
      setUndo(r.undo ? { ...r.undo, member } : null);
    }
    setMember(m);
    return r.replaced;
  };

  /** Phone lookup found nobody: forget the previous guest's autofilled values. */
  const memberNotFound = () => {
    setFields(clearAutofill(fields, snapshot));
    setSnapshot(null);
    setMember(null);
    setUndo(null);
  };

  /** After a manager moved the profile to a new number: only the phone changes. */
  const phoneChanged = (m: Member) => {
    setFields((prev) => ({ ...prev, phone: m.phone }));
    setSnapshot((s) => (s ? { ...s, fields: { ...s.fields, phone: m.phone } } : s));
    setMember(m);
  };

  /** Profile saved from the form (e.g. "Cập nhật hồ sơ khách"): the current values now ARE the profile. */
  const profileSaved = (update: (m: Member) => Member) => {
    setMember((m) => (m ? update(m) : m));
    setSnapshot((s) => (s ? { ...s, fields: { ...fields } } : s));
  };

  const undoAutofill = () => {
    if (!undo) return;
    setFields(undo.fields);
    setSnapshot(undo.snapshot);
    setMember(undo.member);
    setUndo(null);
  };

  return {
    fields,
    setField,
    member,
    selectMember,
    memberNotFound,
    phoneChanged,
    profileSaved,
    undoLabel: undo?.label ?? null,
    undoAutofill,
    dismissUndo: () => setUndo(null),
  };
}
