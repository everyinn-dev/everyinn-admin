/**
 * Guest-block autofill rules shared by the create-booking forms (BookingForm, HoldBookingFormStep).
 * Pure functions so they are unit-testable (test/guestAutofill.test.mjs); the React glue lives in
 * src/components/bookings/useGuestAutofill.ts.
 *
 * Rules:
 * - Picking a guest (social search or phone lookup) REPLACES the whole guest block with that profile;
 *   blanks in the profile clear the field, so nothing of the previous guest survives.
 * - Re-finding the profile that is already filled in never overwrites what staff typed since.
 * - Switching to a phone that is not in CDP clears only the fields that still hold autofilled values;
 *   anything staff typed or edited by hand stays.
 * - Every fill can be undone (restores the block as it was right before the fill).
 */

export interface GuestFields {
  phone: string;
  name: string;
  instagram: string;
  facebook: string;
  zalo: string;
}

export const GUEST_KEYS = ["phone", "name", "instagram", "facebook", "zalo"] as const;

/** Minimal profile shape (subset of `Member`). */
export interface AutofillProfile {
  customerId?: string;
  phone?: string | null;
  full_name?: string | null;
  fullName?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  zalo?: string | null;
}

export interface AutofillSnapshot {
  customerId: string | null;
  fields: GuestFields;
}

export interface AutofillUndo {
  label: string;
  fields: GuestFields;
  snapshot: AutofillSnapshot | null;
}

export function emptyGuest(): GuestFields {
  return { phone: "", name: "", instagram: "", facebook: "", zalo: "" };
}

export function profileToFields(p: AutofillProfile): GuestFields {
  return {
    phone: p.phone ?? "",
    name: p.fullName ?? p.full_name ?? "",
    instagram: (p.instagram ?? "").replace(/^@/, ""),
    facebook: p.facebook ?? "",
    zalo: p.zalo ?? "",
  };
}

/** "+84 912.345.678" / "84912345678" / "0912345678" → "0912345678" (digits only, national). */
export function nationalDigits(phone: string | null | undefined): string {
  const d = (phone ?? "").replace(/\D/g, "");
  if (d.startsWith("84") && d.length === 11) return `0${d.slice(2)}`;
  return d;
}

export function samePhone(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = nationalDigits(a);
  return x.length > 0 && x === nationalDigits(b);
}

export interface ApplyResult {
  fields: GuestFields;
  snapshot: AutofillSnapshot;
  undo: AutofillUndo | null;
  /** false when the profile was already the one filled in (fields left untouched). */
  replaced: boolean;
}

/** Fill the guest block from a profile (see rules above). */
export function applyProfile(current: GuestFields, snapshot: AutofillSnapshot | null, profile: AutofillProfile): ApplyResult {
  const customerId = profile.customerId ?? null;
  if (customerId && snapshot?.customerId === customerId) {
    // Same guest found again (e.g. phone blur right after picking from the dropdown): keep staff edits.
    return { fields: current, snapshot, undo: null, replaced: false };
  }
  const next = profileToFields(profile);
  if (!next.phone) next.phone = current.phone;
  const label = next.name || next.phone || "khách quen";
  return {
    fields: next,
    snapshot: { customerId, fields: { ...next } },
    undo: { label, fields: { ...current }, snapshot },
    replaced: true,
  };
}

/**
 * Phone now points at no CDP profile: drop the previous guest's autofilled values, keep hand-typed ones.
 * The phone itself is what staff just typed, so it always stays.
 */
export function clearAutofill(current: GuestFields, snapshot: AutofillSnapshot | null): GuestFields {
  if (!snapshot) return current;
  const next = { ...current };
  for (const k of GUEST_KEYS) {
    if (k === "phone") continue;
    if (next[k] === snapshot.fields[k]) next[k] = "";
  }
  return next;
}

// ── Search display helpers ───────────────────────────────────────────────────

/** Same folding as CDP search (lowercase, no diacritics, đ→d) — one char in → at most one char out. */
export function foldChar(ch: string): string {
  const f = ch.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d");
  return /^[a-z0-9]$/.test(f) ? f : " ";
}

export function queryTokens(q: string): string[] {
  return Array.from(q)
    .map(foldChar)
    .join("")
    .split(" ")
    .filter(Boolean);
}

/**
 * Splits `value` into segments, marking the word prefixes that match a query token, so the dropdown
 * can bold "Ngọc Tr" in "Ngọc Trâm" for the query "ngoc tr".
 */
export function highlightSegments(value: string, tokens: string[]): { text: string; hit: boolean }[] {
  const chars = Array.from(value);
  const folded = chars.map(foldChar);
  const hit = new Array<boolean>(chars.length).fill(false);
  let i = 0;
  while (i < chars.length) {
    if (folded[i] === " ") {
      i++;
      continue;
    }
    let end = i;
    while (end < chars.length && folded[end] !== " ") end++;
    const word = folded.slice(i, end).join("");
    const best = tokens.filter((t) => word.startsWith(t)).reduce((m, t) => Math.max(m, t.length), 0);
    for (let k = i; k < i + best; k++) hit[k] = true;
    i = end;
  }
  const out: { text: string; hit: boolean }[] = [];
  chars.forEach((c, k) => {
    const last = out[out.length - 1];
    if (last && last.hit === hit[k]) last.text += c;
    else out.push({ text: c, hit: hit[k]! });
  });
  return out;
}

/** "0912345678" → "0912 ••• 678" (enough to confirm with the guest, not enough to copy). */
export function maskNational(phone: string | null | undefined): string {
  const d = nationalDigits(phone);
  if (d.length < 7) return d ? "•••" : "";
  return `${d.slice(0, 4)} ••• ${d.slice(-3)}`;
}
