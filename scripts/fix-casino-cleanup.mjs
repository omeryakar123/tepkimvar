/**
 * Casino marka temizliği + hacim dengesi:
 *  1. Mükerrerleri sil: exstrabet (yazım hatası, extrabet kalır),
 *     youwin (alias, hepsibahis kalır). Şikayetleri cascade ile gider.
 *  2. Meritking -> Mrking (ad + slug + monogram logo).
 *  3. Grandpashabet: yanlış logo yerine temiz monogram.
 *  4. Şikayet sayısını marka büyüklüğüne orantıla:
 *     hedef = clamp(total_complaints/350, 3, 22) — eksik olana ekle.
 * Çalıştır: bun scripts/fix-casino-cleanup.mjs
 */
import postgres from "postgres";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const sql = postgres(process.env.DATABASE_URL, { max: 3 });
const BUCKET = process.env.S3_BUCKET || "itirazvar";
const s3 = new S3Client({
  region: process.env.S3_REGION || "us-east-1",
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: true,
  credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY },
});
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const daysAgo = (d, h = 0) => new Date(Date.now() - d * 86400_000 - h * 3600_000);
const pubId = () => "SK-" + Math.random().toString(36).slice(2, 8).toUpperCase();

async function monogram(text, key) {
  const r = await fetch(`https://ui-avatars.com/api/?name=${encodeURIComponent(text)}&size=256&background=1B263B&color=fff&bold=true&length=2&format=png`);
  const buf = Buffer.from(await r.arrayBuffer());
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: buf, ContentType: "image/png" }));
  return "/api/files/" + key;
}

/* ── 1. Mükerrerler ── */
for (const slug of ["exstrabet", "youwin"]) {
  const r = await sql`DELETE FROM brands WHERE slug=${slug} RETURNING name`;
  if (r.length) console.log(`silindi (mükerrer): ${slug}`);
}

/* ── 2. Meritking -> Mrking ── */
const [mk] = await sql`SELECT id FROM brands WHERE slug=${"meritking"}`;
if (mk) {
  const logo = await monogram("Mr King", "brand-logos/seed/mrking-v2.png");
  await sql`UPDATE brands SET name=${"Mrking"}, slug=${"mrking"}, website=${"https://mrking.com"}, logo_url=${logo}, updated_at=now() WHERE id=${mk.id}`;
  console.log("Meritking -> Mrking (ad, slug, logo güncellendi)");
}

/* ── 3. Grandpashabet logo düzelt ── */
const [gp] = await sql`SELECT id FROM brands WHERE slug=${"grandpashabet"}`;
if (gp) {
  const logo = await monogram("Grand Pasha", "brand-logos/seed/grandpashabet-v3.png");
  await sql`UPDATE brands SET logo_url=${logo}, updated_at=now() WHERE id=${gp.id}`;
  console.log("Grandpashabet logosu monogram ile değiştirildi");
}

/* ── 4. Orantılı şikayet doldurma ── */
const TEMPLATES = [
  ["Param 10 gündür yatırılmadı", "Çekim talebim onaylandı denildi ama 10 gündür hesabıma para geçmedi. Canlı destek sürekli 'finans birimine iletildi' diyor, somut bir dönüş yok."],
  ["Çekim talebim sebepsiz reddedildi", "Belge doğrulamam tamamlanmış olmasına rağmen çekim talebim 'ek inceleme' bahanesiyle üçüncü kez reddedildi. Yatırım yaparken hiçbir sorun çıkmıyor."],
  ["Hesabım sebepsiz kapatıldı", "İçinde bakiyem varken hesabım hiçbir açıklama yapılmadan kapatıldı. Mail attım, cevap yok. Bakiyemin iadesini istiyorum."],
  ["Bonus şartları sonradan değiştirildi", "Hoş geldin bonusunu alırken belirtilen çevrim şartı 20 katıydı, çekim aşamasında 40 katı olduğu söylendi."],
  ["Kazancım bakiyeme eklenmedi", "Kuponum kazandı olarak görünüyor ama kazanç bakiyeme yansımadı. Ekran görüntüleri bende mevcut."],
  ["Canlı destek yanıt vermiyor", "Üç gündür canlı desteğe yazıyorum, ya bağlanmıyor ya da dakikalarca bekletip düşürüyor."],
  ["Belge doğrulama süreci bitmiyor", "Kimlik ve fatura belgelerimi dört kez yükledim, her seferinde 'okunmuyor' denilerek reddedildi."],
  ["Yatırımım hesaba geçmedi", "Havale ile yatırım yaptım, dekont elimde. İki gündür bakiyeme yansımadı."],
  ["Hesabıma erişemiyorum", "Şifremi doğru girmeme rağmen 'hesap askıya alındı' uyarısı alıyorum. İçeride bakiyem var."],
  ["Promosyon kazancım silindi", "Kurallara uygun tamamladığım promosyon kazancı, çekim talebi verdiğim anda 'kural ihlali' denilerek silindi."],
  ["Çekim limitleri sonradan düşürüldü", "Kazanınca günlük çekim limitim aniden düşürüldü. Paramı aylar sürecek taksitlerle alabileceğimi söylüyorlar."],
  ["Kuponum iptal edildi", "Maç sonuçlandıktan sonra kuponum 'oran hatası' gerekçesiyle iptal edildi, kazancım silindi."],
  ["Kimlik bilgilerimin silinmesini istiyorum", "Üyeliğimi kapattım ama kimlik belgelerimin silinmesi talebime cevap alamıyorum. KVKK kapsamında verilerimin silinmesini istiyorum."],
  ["Farklı hesaptan yatırım bahanesi", "Kendi adıma kayıtlı karttan yatırım yaptığım halde 'üçüncü şahıs yatırımı' gerekçesiyle çekimim reddedildi."],
  ["Çekim için tekrar yatırım isteniyor", "Çekim yapabilmem için 'bir kez daha yatırım yapmanız gerekiyor' denildi. Böyle bir kural üyelikte yazmıyordu."],
  ["Freespin kazancım ödenmedi", "Freespin etkinliğinden kazandığım tutar çekim aşamasında silindi, gerekçe bile söylenmedi."],
  ["Hesap doğrulama sonrası bakiye sıfırlandı", "Belgelerimi yükledikten sonra hesabıma girdiğimde bakiyem sıfırlanmıştı. Destek konuyla ilgilenmiyor."],
  ["VIP temsilcim cevap vermiyor", "VIP üyeyim, özel temsilcim günlerdir mesajlarıma dönmüyor, çekimim beklemede."],
  ["Maç iptalinde kupon paramı alamadım", "İptal edilen maçta kuponum iade edilmedi, ne kazanç ne ana para verildi."],
  ["Yanıltıcı reklam", "Sosyal medyada 'çevrimsiz bonus' reklamı görüp üye oldum, bonusun 30 kat çevrimi olduğu ortaya çıktı."],
];
const ANSWERS = [
  "Merhaba, talebiniz finans birimimize iletilmiştir. Yoğunluktan kaynaklı gecikme için özür dileriz, en geç 24 saat içinde işleminiz sonuçlandırılacaktır.",
  "Değerli üyemiz, hesabınızla ilgili inceleme tamamlanmıştır. Mağduriyetinizin giderilmesi için gerekli işlem başlatılmıştır.",
  "Merhaba, üyelik bilgilerinizle canlı destek hattımıza bağlanmanız halinde işleminiz öncelikli olarak sonuçlandırılacaktır.",
  "Sayın üyemiz, bahsettiğiniz işlem güvenlik prosedürlerimiz gereği incelemeye alınmıştır. İnceleme tamamlandığında bakiyeniz yansıtılacaktır.",
  "Merhaba, sistemsel yoğunluk nedeniyle yaşanan gecikme için özür dileriz. Talebiniz işleme alınmıştır.",
];
const THANKS = [
  "Şikayetimi buradan yazdıktan sonra aynı gün dönüş yaptılar, param hesabıma geçti. Teşekkürler.",
  "Sonunda çözüldü. Buraya yazmasam çözülmeyecekti ama sonuç olarak paramı aldım.",
  "İlgilendiler ve sorun giderildi, mağduriyetim telafi edildi.",
  "Geç de olsa çözüm sağlandı, bakiyem iade edildi.",
  null, null,
];
const CITIES = ["İstanbul", "Ankara", "İzmir", "Bursa", "Antalya", "Adana", "Konya", "Mersin", "Gaziantep"];
const pickStatus = () => { const r = Math.random(); return r < 0.30 ? "approved" : r < 0.60 ? "answered" : r < 0.85 ? "resolved" : "in_review"; };

const users = await sql`SELECT id FROM "user" WHERE email LIKE ${"%@demo.tepkimvarplus.com"}`;
const uids = users.map((u) => u.id);

const brands = await sql`
  SELECT b.id, b.category_id, b.total_complaints,
         (SELECT count(*)::int FROM complaints c WHERE c.brand_id=b.id) AS current
  FROM brands b
  WHERE b.logo_url LIKE ${"/api/files/brand-logos/seed/%"}
  ORDER BY b.total_complaints DESC`;

let added = 0, res = 0;
for (const b of brands) {
  const target = Math.max(3, Math.min(22, Math.round(b.total_complaints / 350)));
  const need = target - b.current;
  for (let i = 0; i < need; i++) {
    const t = pick(TEMPLATES);
    const status = pickStatus();
    const created = daysAgo(rnd(1, 60), rnd(0, 20));
    const anon = Math.random() < 0.45;
    const uid = pick(uids);
    const hasResp = status === "answered" || status === "resolved";
    const respAt = hasResp ? new Date(created.getTime() + rnd(4, 72) * 3600_000) : null;
    const rating = status === "resolved" ? rnd(2, 5) : null;
    const [c] = await sql`INSERT INTO complaints
      (user_id, brand_id, category_id, title, body, status, city, rating, views, votes,
       is_anonymous, anon_name, public_id, brand_response, brand_response_at, brand_response_by, created_at, updated_at)
      VALUES (${uid}, ${b.id}, ${b.category_id}, ${t[0]}, ${t[1]}, ${status}, ${pick(CITIES)},
              ${rating}, ${rnd(40, 2500)}, ${rnd(0, 80)}, ${anon}, ${anon ? "Anonim Kullanıcı" : null}, ${pubId()},
              ${hasResp ? pick(ANSWERS) : null}, ${respAt}, ${hasResp ? pick(uids) : null}, ${created}, ${respAt ?? created})
      RETURNING id`;
    added++;
    if (status === "resolved") {
      await sql`INSERT INTO complaint_resolutions (complaint_id, brand_id, user_id, resolution_rating, thanks_message, created_at)
        VALUES (${c.id}, ${b.id}, ${uid}, ${rating}, ${pick(THANKS)}, ${new Date(created.getTime() + rnd(24, 120) * 3600_000)})`;
      res++;
    }
  }
}

const [{ bt }] = await sql`SELECT count(*)::int bt FROM brands`;
const [{ ct }] = await sql`SELECT count(*)::int ct FROM complaints`;
console.log(`Eklenen şikayet: ${added} (+${res} çözüm kaydı). Toplam: ${bt} marka, ${ct} şikayet.`);
await sql.end();
