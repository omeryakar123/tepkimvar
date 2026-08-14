/**
 * Online bahis/casino markalarını ekler (şikayet hedefi olarak).
 * Kategori: beyaz-esya-elektronik. Logo: unavatar (gerçek favicon) →
 * bulunamazsa ui-avatars monogram fallback (kırık görsel kalmaz).
 * İdempotent: var olan slug atlanır.  Çalıştır: bun scripts/seed-casino-brands.mjs
 */
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { max: 3 });
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

const NAMES = [
  "Alobet","Aresbet","Bahislion","Betbox","Betcasper","Betcool","Betkare","Betkolik",
  "Betlivo","Betlike","Betmabet","Betmoney","Betnixe","Betnis","Betosfer","Betovis",
  "Betpipo","Betpon","Betra","Betrabet","Betticket","Betvoy","Betverse","Betyap",
  "Casifix","Casinoas","CasinoBonanza","CasinoDior","Casinomilyon","Casinoroyal",
  "Casinowon","Casival","Casivera","Celtabet","Chamadabet","Editorbet","Efesbet",
  "Enbet","Enobahis","Etrobet","Exstrabet","EyfelCasino","Fiksturbet","Galabet",
  "GallerBahis","GanyanBet","Gobahis","Golbet","Gonebet","Grandoperabet","Hanedabet",
  "Hazbet","Hilarionbet","Huhubeet","İbizabet","Kafacasino","Kareasbet","Kingbetting",
  "Kupawin","Lagoncasino","Livebahis","Lordpalace","Lüxbet","Luxbet","Maritbet",
  "Marjınbet","Markaj","Maxibet","Medusabahis","Meritliman","MeritQueen","Meybet",
  "Millibahis","Milosbet","Mislibet","Modelbahis","Mobiloyna","Nesiller","Netbahis",
  "Nitrobahis","Norabahis","Orisbet","Oslobet","Padişahbet","Plazabet","palacebet",
  "Poliwin","Prensbet","Rinabet","Roketbet","Romabet","Rotabet","SaltBahis","Seteabet",
  "Sohobet","Sovabet","SmartBahis","Sonbahis","Stonebahis","Süratbet","Teosbet",
  "Tiklabet","Tikobet","Tlcasino","Trendbet","Tuccobet","Ultrabet","Vizyonbet",
  "WinxBet","Wojobet",
];

const TR = { "ç":"c","Ç":"c","ğ":"g","Ğ":"g","ı":"i","I":"i","İ":"i","ö":"o","Ö":"o","ş":"s","Ş":"s","ü":"u","Ü":"u" };
const slugify = (s) => s.replace(/[çÇğĞıIİöÖşŞüÜ]/g, (c) => TR[c] ?? c).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

function logoUrl(name, domain) {
  const fb = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&size=128&background=1B263B&color=fff&bold=true&length=2`;
  return `https://unavatar.io/${domain}?fallback=${encodeURIComponent(fb)}`;
}

const [cat] = await sql`SELECT id FROM categories WHERE slug=${"beyaz-esya-elektronik"}`;
if (!cat) { console.error("Kategori bulunamadı: beyaz-esya-elektronik"); process.exit(1); }

let added = 0, skipped = 0;
const seen = new Set();
for (const name of NAMES) {
  const slug = slugify(name);
  if (seen.has(slug)) { skipped++; continue; } // Lüxbet/Luxbet gibi çakışanlar
  seen.add(slug);

  const [exists] = await sql`SELECT 1 FROM brands WHERE slug=${slug}`;
  if (exists) { skipped++; continue; }

  const domain = `${slug}.com`;
  const total = rnd(15, 220);
  const resolvedPct = rnd(10, 45); // bahis sitelerinde düşük çözüm oranı gerçekçi
  await sql`INSERT INTO brands
    (slug, name, category_id, website, city, logo_url, verified, premium,
     rating, rating_count, total_complaints, complaints_resolved, resolution_rate, avg_response_minutes)
    VALUES (${slug}, ${name}, ${cat.id}, ${"https://" + domain}, ${"İstanbul"}, ${logoUrl(name, domain)},
            false, false, ${(rnd(15, 32) / 10).toFixed(2)}, ${rnd(5, 180)}, ${total},
            ${Math.round((total * resolvedPct) / 100)}, ${resolvedPct}, ${rnd(120, 2000)})`;
  added++;
}

const [{ n }] = await sql`SELECT count(*)::int n FROM brands`;
console.log(`Eklendi: ${added}, atlandı (mevcut/mükerrer): ${skipped}. Toplam marka: ${n}`);
await sql.end();
