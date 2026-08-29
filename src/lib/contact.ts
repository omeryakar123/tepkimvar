/** Platform genel iletişim e-postası — sitede yalnızca bu adres gösterilir. */
export const SITE_CONTACT_EMAIL = "info@tepkimvar.com";

export function siteContactMailto(subject?: string, body?: string): string {
  const params = new URLSearchParams();
  if (subject) params.set("subject", subject);
  if (body) params.set("body", body);
  const qs = params.toString();
  return qs ? `mailto:${SITE_CONTACT_EMAIL}?${qs}` : `mailto:${SITE_CONTACT_EMAIL}`;
}
