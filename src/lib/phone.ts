// Turkish phone helpers
// Stored canonical: +90XXXXXXXXXX (E.164). Display: +90 (5XX) XXX XX XX

export function formatTrPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").replace(/^90/, "").slice(0, 10);
  const d = digits;
  let out = "+90";
  if (d.length > 0) out += ` (${d.slice(0, 3)}`;
  if (d.length >= 3) out += ")";
  if (d.length > 3) out += ` ${d.slice(3, 6)}`;
  if (d.length > 6) out += ` ${d.slice(6, 8)}`;
  if (d.length > 8) out += ` ${d.slice(8, 10)}`;
  return out;
}

export function toE164Tr(raw: string): string | null {
  const digits = raw.replace(/\D/g, "").replace(/^90/, "");
  if (digits.length !== 10) return null;
  if (!digits.startsWith("5")) return null;
  return `+90${digits}`;
}

export function fromE164(stored: string | null | undefined): string {
  if (!stored) return "";
  return formatTrPhone(stored);
}
