#!/usr/bin/env node
/**
 * Mevcut sentetik (bot) şikayetlerin yazar adını düzeltir.
 * "Şikayet Botu" veya boş isim → rastgele Türk ismi + is_anonymous=true
 *
 *   DATABASE_URL=... node scripts/fix-synthetic-author-names.mjs
 */
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { max: 3 });
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL tanımlı değil");
  process.exit(1);
}

const TR_FIRST = [
  "Ahmet", "Mehmet", "Mustafa", "Ali", "Hakan", "Burak", "Emre", "Can", "Oğuz", "Serkan",
  "Kerem", "Tolga", "Murat", "Cem", "Barış", "Volkan", "Kaan", "Onur", "Yusuf", "Enes",
  "Ayşe", "Fatma", "Elif", "Zeynep", "Selin", "Deniz", "Merve", "Esra", "Gamze", "Buse",
  "Seda", "Pınar", "Derya", "Gizem", "Cansu", "Tuğba", "Hande", "Melis", "İrem", "Yasemin",
];
const TR_LAST = ["A", "B", "C", "D", "E", "K", "M", "S", "T", "Y", "Ö", "Ü", "Ş"];
const BLOCK = new Set(["şikayet botu", "sikayet botu", "sikayet-botu", "complaint bot", "bot", "anonim", "kullanici", "kullanıcı"]);

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randName = () =>
  Math.random() > 0.3 ? `${pick(TR_FIRST)} ${pick(TR_LAST)}.` : pick(TR_FIRST);

const rows = await sql`
  SELECT c.id, c.anon_name, c.is_anonymous, p.full_name, u.email
  FROM complaints c
  LEFT JOIN profiles p ON p.id = c.user_id
  LEFT JOIN "user" u ON u.id = c.user_id
  WHERE c.is_synthetic = true
`;

let updated = 0;
const used = new Set(
  rows
    .map((r) => r.anon_name?.trim().toLowerCase())
    .filter((n) => n && !BLOCK.has(n) && !/bot|sikayet|şikayet/i.test(n)),
);

for (const row of rows) {
  const current = (row.anon_name || row.full_name || "").trim();
  const bad =
    !row.is_anonymous ||
    !current ||
    BLOCK.has(current.toLowerCase()) ||
    /bot|sikayet|şikayet/i.test(current) ||
    row.email === "complaint-bot@system.local";

  if (!bad && row.anon_name?.trim()) continue;

  let name;
  for (let i = 0; i < 20; i++) {
    name = randName();
    if (!used.has(name.toLowerCase())) break;
  }
  used.add(name.toLowerCase());

  await sql`
    UPDATE complaints
       SET is_anonymous = true,
           anon_name = ${name}
     WHERE id = ${row.id}`;
  updated++;
}

console.log(`Güncellendi: ${updated} / ${rows.length} sentetik şikayet`);
await sql.end();
