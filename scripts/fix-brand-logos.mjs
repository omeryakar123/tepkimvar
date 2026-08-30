#!/usr/bin/env bun
/**
 * Kırık / düşük kaliteli marka logolarını düzeltir (unavatar, monogram, 404).
 * Öncelik: bilisim-teknoloji + telekomunikasyon; --all ile tüm markalar.
 *
 *   bun scripts/fix-brand-logos.mjs
 *   bun scripts/fix-brand-logos.mjs --all
 */
import postgres from "postgres";

const BAD = [
  "ui-avatars.com",
  "unavatar.io",
  "logo.clearbit.com",
  "via.placeholder",
  "superbonus14.pro/clients/logo",
  "porkbun-logo",
  "googleusercontent.com/a/default",
];

const DOMAIN_OVERRIDES = {
  jojobet: "jojobet.com",
  matbet: "matbet.com",
  mavibet: "mavibet.com",
  holiganbet: "holiganbet.com",
  casibom: "casibom.com",
  meritking: "mrking.com",
  mrking: "mrking.com",
  grandpashabet: "grandpashabet.com",
  marsbahis: "marsbahis.com",
  kazansana: "kazansana.com",
  bovbet: "bovbet.com",
  bahsine: "bahsine.com",
  betnano: "betnano.com",
  exobet: "exobet.org",
  playbet: "playbet.io",
  tekelbet: "tekelbet.net",
  trendyol: "trendyol.com",
  hepsiburada: "hepsiburada.com",
  turkcell: "turkcell.com.tr",
  vodafone: "vodafone.com.tr",
  "turk-telekom": "turktelekom.com.tr",
  migros: "migros.com.tr",
  thy: "turkishairlines.com",
  arcelik: "arcelik.com.tr",
};

const SUPERBONUS = new Set([
  "kazansana", "evetabi", "betnano", "bovbet", "bahsine", "hadibet", "natobet", "exobet",
  "mexiwin", "pulibet", "padisahbet", "galabet", "bahiscasino", "favoribahis", "meritwin",
  "neredebahis", "yasalbahis", "tekelbet", "betmartin", "sanscasino", "marsbahis", "playbet",
  "hizlicasino", "betsmove", "virusbet",
]);

const UA = { "user-agent": "Mozilla/5.0 Chrome/126 Safari/537.36" };
const MIN = 450;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL tanımlı değil");
  process.exit(1);
}

const allBrands = process.argv.includes("--all");
const sql = postgres(process.env.DATABASE_URL, { max: 3 });

function isBad(url) {
  if (!url?.trim()) return true;
  const u = url.toLowerCase();
  return BAD.some((p) => u.includes(p));
}

function domainFor(slug, website) {
  if (DOMAIN_OVERRIDES[slug]) return DOMAIN_OVERRIDES[slug];
  if (website) {
    let d = website.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "");
    d = d.split("/")[0].split("?")[0];
    if (d.includes(".")) return d;
  }
  return `${slug}.com`;
}

async function probe(url, minBytes = MIN) {
  try {
    const r = await fetch(url, { headers: UA, redirect: "follow", signal: AbortSignal.timeout(9000) });
    if (!r.ok) return null;
    const ct = (r.headers.get("content-type") ?? "").toLowerCase();
    if (!ct.includes("image") && !url.endsWith(".ico")) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    return buf.length >= minBytes ? { url, size: buf.length } : null;
  } catch {
    return null;
  }
}

async function bestLogo(slug, name, website) {
  const domains = [domainFor(slug, website)];
  if (!domains.includes(`${slug}.com`)) domains.push(`${slug}.com`);

  if (SUPERBONUS.has(slug)) {
    const sb = await probe(`https://superbonus14.pro/clients/logo/${slug}.png`, 800);
    if (sb) return { ...sb, src: "superbonus" };
  }

  let best = null;
  for (const dom of domains) {
    for (const sz of [256, 128]) {
      const u = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(dom)}&sz=${sz}`;
      const hit = await probe(u, MIN);
      if (hit && (!best || hit.size > best.size)) best = { ...hit, src: "gstatic" };
    }
    const ddg = await probe(`https://icons.duckduckgo.com/ip3/${dom}.ico`, MIN);
    if (ddg && (!best || ddg.size > best.size)) best = { ...ddg, src: "ddg" };
  }

  if (best) return best;
  const q = encodeURIComponent(name);
  return {
    url: `https://ui-avatars.com/api/?name=${q}&size=128&background=1B263B&color=fff&bold=true&length=2&format=png`,
    size: 0,
    src: "monogram",
  };
}

const rows = await sql`
  SELECT b.id, b.slug, b.name, b.website, b.logo_url, c.slug AS cat
  FROM brands b
  JOIN categories c ON c.id = b.category_id
  WHERE ${allBrands ? sql`true` : sql`c.slug IN ('bilisim-teknoloji', 'telekomunikasyon')`}
  ORDER BY b.slug
`;

const toFix = rows.filter((r) => isBad(r.logo_url));
console.log(`Toplam: ${rows.length}, düzeltilecek: ${toFix.length}`);

let updated = 0;
for (const row of toFix) {
  const hit = await bestLogo(row.slug, row.name, row.website);
  if (!hit?.url || hit.url === (row.logo_url ?? "").trim()) continue;
  await sql`UPDATE brands SET logo_url = ${hit.url}, updated_at = now() WHERE id = ${row.id}`;
  updated++;
  if (updated <= 20 || updated % 30 === 0) {
    console.log(`  ${row.slug.padEnd(22)} → ${hit.src} (${hit.size}b)`);
  }
}

console.log(`Güncellenen logo: ${updated}`);
await sql.end();
