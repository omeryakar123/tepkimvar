/** Sahte / şablon platform kullanıcı adı mı? (istemci + sunucu) */
export function looksLikeFakePlatformUsername(raw: string): boolean {
  const s = raw.trim();
  if (!s || s.length < 2) return true;
  const lower = s.toLowerCase();
  if (
    /kay[iı]tl[iı]|registered|kullan[iı]c[iı]|user\d|player|test|demo|fake|oyuncu|magdur|guest|member|hesap|üye\b|uye\b|account|nickname|rumuz/.test(
      lower,
    )
  ) {
    return true;
  }
  if (/^(user|test|demo|player|member|guest|admin|support)\d*$/i.test(s)) return true;
  if (/^[A-ZÇĞİÖŞÜ][a-zçğıöşü]+Kullan/i.test(s)) return true;
  if (/kullanici\d+|kullanıcı\d+/i.test(s)) return true;
  return false;
}
