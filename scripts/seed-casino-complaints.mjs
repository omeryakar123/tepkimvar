/**
 * Casino/bahis markalarına demo şikayet + firma yanıtı + çözüm kaydı ekler.
 * Dağılım: ~%30 yanıtsız (approved), ~%30 yanıtlı (answered), ~%25 çözüldü
 * (resolved + çözüm kaydı + puan), ~%15 incelemede (in_review).
 * İdempotent: şikayeti olan marka atlanır.  Çalıştır: bun scripts/seed-casino-complaints.mjs
 */
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { max: 3 });
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const daysAgo = (d, h = 0) => new Date(Date.now() - d * 86400_000 - h * 3600_000);
const pubId = () => "SK-" + Math.random().toString(36).slice(2, 8).toUpperCase();

const TEMPLATES = [
  ["Param 10 gündür yatırılmadı", "Çekim talebim onaylandı denildi ama 10 gündür hesabıma para geçmedi. Canlı destek sürekli 'finans birimine iletildi' diyor, somut bir dönüş yok."],
  ["Çekim talebim sebepsiz reddedildi", "Belge doğrulamam tamamlanmış olmasına rağmen çekim talebim 'ek inceleme' bahanesiyle üçüncü kez reddedildi. Yatırım yaparken hiçbir sorun çıkmıyor."],
  ["Hesabım sebepsiz kapatıldı", "İçinde bakiyem varken hesabım hiçbir açıklama yapılmadan kapatıldı. Mail attım, cevap yok. Bakiyemin iadesini istiyorum."],
  ["Bonus şartları sonradan değiştirildi", "Hoş geldin bonusunu alırken belirtilen çevrim şartı 20 katıydı, çekim aşamasında 40 katı olduğu söylendi. Kampanya sayfasındaki bilgiyle destek ekibinin söylediği tutmuyor."],
  ["Kazancım bakiyeme eklenmedi", "Kuponum kazandı olarak görünüyor ama kazanç bakiyeme yansımadı. Ekran görüntüleri bende mevcut, destek 'teknik birim ilgileniyor' deyip geçiştiriyor."],
  ["Canlı destek yanıt vermiyor", "Üç gündür canlı desteğe yazıyorum, ya bağlanmıyor ya da dakikalarca bekletip düşürüyor. Sorunumu iletebileceğim başka bir kanal da yok."],
  ["Belge doğrulama süreci bitmiyor", "Kimlik ve fatura belgelerimi dört kez yükledim, her seferinde 'okunmuyor' denilerek reddedildi. Belgeler net, sorun sistemlerinde ama çekim yapamıyorum."],
  ["Yatırımım hesaba geçmedi", "Havale ile yatırım yaptım, dekont elimde. İki gündür bakiyeme yansımadı, destek dekontu incelemeye aldık deyip dönüş yapmıyor."],
  ["Hesabıma erişemiyorum", "Şifremi doğru girmeme rağmen 'hesap askıya alındı' uyarısı alıyorum. İçeride bakiyem var ve kimse açıklama yapmıyor."],
  ["Promosyon kazancım silindi", "Kurallara uygun tamamladığım promosyon kazancı, çekim talebi verdiğim anda 'kural ihlali' denilerek silindi. Hangi kuralı ihlal ettiğim söylenmiyor."],
  ["Çekim limitleri sonradan düşürüldü", "Üyelikte günlük çekim limiti yüksek gösterildi, kazanınca limitim aniden düşürüldü. Paramı ancak aylar sürecek taksitlerle alabileceğimi söylüyorlar."],
  ["Kuponum iptal edildi", "Maç sonuçlandıktan sonra kuponum 'oran hatası' gerekçesiyle iptal edildi. Kazancım silindi, sadece yatırdığım tutar iade edildi."],
  ["Kimlik bilgilerimin silinmesini istiyorum", "Üyeliğimi kapattım ama kimlik belgelerimin sistemden silinmesi talebime cevap alamıyorum. KVKK kapsamında verilerimin silinmesini istiyorum."],
  ["Farklı hesaptan yatırım bahanesi", "Kendi adıma kayıtlı karttan yatırım yaptığım halde 'üçüncü şahıs yatırımı' gerekçesiyle çekimim reddedildi. Kart benim adıma, ispatı da mevcut."],
];

const ANSWERS = [
  "Merhaba, talebiniz finans birimimize iletilmiştir. Yoğunluktan kaynaklı gecikme için özür dileriz, en geç 24 saat içinde işleminiz sonuçlandırılacaktır.",
  "Değerli üyemiz, hesabınızla ilgili inceleme tamamlanmıştır. Mağduriyetinizin giderilmesi için gerekli işlem başlatılmıştır, anlayışınız için teşekkür ederiz.",
  "Merhaba, yaşadığınız sorun tarafımıza ulaşmıştır. Üyelik bilgilerinizle canlı destek hattımıza bağlanmanız halinde işleminiz öncelikli olarak sonuçlandırılacaktır.",
  "Sayın üyemiz, bahsettiğiniz işlem güvenlik prosedürlerimiz gereği incelemeye alınmıştır. İnceleme tamamlandığında bakiyeniz hesabınıza yansıtılacaktır.",
  "Merhaba, sistemsel yoğunluk nedeniyle yaşanan gecikme için özür dileriz. Talebiniz işleme alınmış olup kısa süre içinde sonuçlanacaktır.",
];

const THANKS = [
  "Şikayetimi buradan yazdıktan sonra aynı gün dönüş yaptılar, param hesabıma geçti. Teşekkürler.",
  "Sonunda çözüldü. Buraya yazmasam çözülmeyecekti ama sonuç olarak paramı aldım.",
  "İlgilendiler ve sorun giderildi, mağduriyetim telafi edildi.",
  "Geç de olsa çözüm sağlandı, bakiyem iade edildi.",
  null, null,
];

const CITIES = ["İstanbul", "Ankara", "İzmir", "Bursa", "Antalya", "Adana", "Konya", "Mersin", "Gaziantep"];

// Ağırlıklı durum dağılımı
function pickStatus() {
  const r = Math.random();
  if (r < 0.30) return "approved";
  if (r < 0.60) return "answered";
  if (r < 0.85) return "resolved";
  return "in_review";
}

// Casino / bahis seed markaları (bilisim-teknoloji + beyaz-esya-elektronik)
const brands = await sql`
  SELECT b.id, b.slug, b.name, b.category_id FROM brands b
  JOIN categories c ON c.id = b.category_id
  WHERE c.slug IN (${"bilisim-teknoloji"}, ${"beyaz-esya-elektronik"})
  ORDER BY b.slug`;
console.log(`Hedef marka: ${brands.length}`);

const users = await sql`SELECT id FROM "user" WHERE email LIKE ${"%@demo.tepkimvarplus.com"}`;
if (!users.length) { console.error("Demo kullanıcı yok — önce seed-demo çalıştırılmalı"); process.exit(1); }
const uids = users.map((u) => u.id);

let nc = 0, nr = 0, skippedBrands = 0;
for (const b of brands) {
  const [{ n }] = await sql`SELECT count(*)::int n FROM complaints WHERE brand_id=${b.id}`;
  if (n > 0) { skippedBrands++; continue; }

  const used = new Set();
  for (let i = 0, count = rnd(2, 6); i < count; i++) {
    let t;
    do { t = pick(TEMPLATES); } while (used.has(t[0]) && used.size < TEMPLATES.length);
    used.add(t[0]);

    const status = pickStatus();
    const created = daysAgo(rnd(1, 45), rnd(0, 20));
    const anon = Math.random() < 0.45; // bahis şikayetinde anonimlik yüksek — gerçekçi
    const uid = pick(uids);
    const hasResp = status === "answered" || status === "resolved";
    const respAt = hasResp ? new Date(created.getTime() + rnd(4, 72) * 3600_000) : null;
    const rating = status === "resolved" ? rnd(2, 5) : null;

    const [c] = await sql`INSERT INTO complaints
      (user_id, brand_id, category_id, title, body, status, city, rating, views, votes,
       is_anonymous, anon_name, public_id, brand_response, brand_response_at, brand_response_by,
       created_at, updated_at)
      VALUES (${uid}, ${b.id}, ${b.category_id}, ${t[0]}, ${t[1]}, ${status}, ${pick(CITIES)},
              ${rating}, ${rnd(40, 1500)}, ${rnd(0, 60)},
              ${anon}, ${anon ? "Anonim Kullanıcı" : null}, ${pubId()},
              ${hasResp ? pick(ANSWERS) : null}, ${respAt}, ${hasResp ? pick(uids) : null},
              ${created}, ${respAt ?? created})
      RETURNING id`;
    nc++;

    // Çözülenlere çözüm kaydı (+ bazen teşekkür) — "Başarı Hikayeleri" dolsun
    if (status === "resolved") {
      await sql`INSERT INTO complaint_resolutions
        (complaint_id, brand_id, user_id, resolution_rating, thanks_message, created_at)
        VALUES (${c.id}, ${b.id}, ${uid}, ${rating}, ${pick(THANKS)}, ${new Date(created.getTime() + rnd(24, 120) * 3600_000)})`;
      nr++;
    }
  }
}

const [{ total }] = await sql`SELECT count(*)::int total FROM complaints`;
console.log(`Eklendi: ${nc} şikayet, ${nr} çözüm kaydı. Atlanan (zaten şikayetli) marka: ${skippedBrands}. Toplam şikayet: ${total}`);
await sql.end();
