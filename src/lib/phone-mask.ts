import { formatTrPhone } from "@/lib/phone";

/** Herkese açık görünüm: +90 (5**) *** ** 34 */
export function maskPhoneE164(stored: string | null | undefined): string | null {
  if (!stored) return null;
  const digits = stored.replace(/\D/g, "");
  const local = digits.startsWith("90") ? digits.slice(2) : digits;
  if (local.length < 10) return "+90 *** *** ** **";
  return `+90 (${local.slice(0, 1)}**) *** ** ${local.slice(8, 10)}`;
}

export function displayPhone(
  stored: string | null | undefined,
  mode: "full" | "masked",
): string | null {
  if (!stored) return null;
  return mode === "full" ? formatTrPhone(stored) : maskPhoneE164(stored);
}
