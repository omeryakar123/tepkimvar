/** Şikayet detay URL'sinde kullanılacak tanımlayıcı (paylaşım için SK- kodu tercih edilir). */
export function complaintLinkId(c: {
  id: string;
  publicId?: string | null;
  public_id?: string | null;
}): string {
  const raw = c.publicId ?? c.public_id ?? c.id;
  if (typeof raw !== "string" || !raw) return c.id ?? "";
  return raw.trim();
}

export function complaintPath(c: Parameters<typeof complaintLinkId>[0]): string {
  return `/sikayet/${encodeURIComponent(complaintLinkId(c))}`;
}
