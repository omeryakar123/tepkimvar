/**
 * DEMO verisi — SaaS gösterimi için ünlü Türk markaları + logolar + dolu şikayetler.
 * Self-contained (drizzle importu yok, sadece `postgres`), raw SQL.
 * Çalıştır (app container'ında):  bun scripts/seed-demo.mjs
 * İdempotent: var olan markanın şikayetlerini tekrar eklemez.
 *
 * Logolar: https://logo.clearbit.com/<domain>  (dış URL; proxyImage olduğu gibi geçirir)
 */
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { max: 3 });
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const daysAgo = (d) => new Date(Date.now() - d * 86400_000);
const pubId = () => "SK-" + Math.random().toString(36).slice(2, 8).toUpperCase();

// slug: name, category slug, city, domain, verified, premium, rating, resolvedPct, about
const BRANDS = [
  ["trendyol", "Trendyol", "alisveris-e-ticaret", "İstanbul", "trendyol.com", true, true, 3.8, 79, "Türkiye'nin önde gelen e-ticaret platformu."],
  ["hepsiburada", "Hepsiburada", "alisveris-e-ticaret", "İstanbul", "hepsiburada.com", true, true, 3.6, 74, "Teknolojiden modaya geniş ürün yelpazeli pazaryeri."],
  ["n11", "n11", "alisveris-e-ticaret", "İstanbul", "n11.com", true, false, 3.3, 66, "Online alışveriş pazaryeri."],
  ["amazon-turkiye", "Amazon Türkiye", "alisveris-e-ticaret", "İstanbul", "amazon.com.tr", true, false, 3.9, 82, "Global e-ticaret devinin Türkiye operasyonu."],
  ["sahibinden", "sahibinden.com", "alisveris-e-ticaret", "İstanbul", "sahibinden.com", true, false, 3.4, 61, "İlan ve alışveriş platformu."],
  ["getir", "Getir", "market-supermarket", "İstanbul", "getir.com", true, true, 3.7, 77, "Dakikalar içinde market teslimatı."],
  ["migros", "Migros", "market-supermarket", "İstanbul", "migros.com.tr", true, false, 3.9, 80, "Türkiye'nin köklü market zinciri."],
  ["a101", "A101", "market-supermarket", "İstanbul", "a101.com.tr", false, false, 3.2, 58, "İndirim market zinciri."],
  ["turkcell", "Turkcell", "telekomunikasyon", "İstanbul", "turkcell.com.tr", true, true, 3.2, 63, "Türkiye'nin lider mobil operatörü."],
  ["vodafone", "Vodafone", "telekomunikasyon", "İstanbul", "vodafone.com.tr", true, false, 3.1, 60, "Mobil ve internet operatörü."],
  ["turk-telekom", "Türk Telekom", "telekomunikasyon", "Ankara", "turktelekom.com.tr", true, false, 3.0, 57, "Sabit hat, internet ve mobil hizmetler."],
  ["garanti-bbva", "Garanti BBVA", "bankacilik-finans", "İstanbul", "garantibbva.com.tr", true, true, 3.6, 72, "Özel sektör bankası."],
  ["yapi-kredi", "Yapı Kredi", "bankacilik-finans", "İstanbul", "yapikredi.com.tr", true, false, 3.4, 68, "Bireysel ve kurumsal bankacılık."],
  ["akbank", "Akbank", "bankacilik-finans", "İstanbul", "akbank.com", true, false, 3.7, 75, "Dijital bankacılıkta öncü."],
  ["ziraat-bankasi", "Ziraat Bankası", "bankacilik-finans", "Ankara", "ziraatbank.com.tr", true, false, 3.3, 64, "Türkiye'nin en büyük kamu bankası."],
  ["thy", "Türk Hava Yolları", "ulasim", "İstanbul", "turkishairlines.com", true, true, 3.8, 78, "Bayrak taşıyıcı havayolu."],
  ["pegasus", "Pegasus Hava Yolları", "ulasim", "İstanbul", "flypgs.com", true, false, 3.2, 62, "Ekonomik havayolu taşımacılığı."],
  ["aras-kargo", "Aras Kargo", "kargo-lojistik", "İstanbul", "araskargo.com.tr", false, false, 2.9, 51, "Kargo ve lojistik hizmetleri."],
  ["yurtici-kargo", "Yurtiçi Kargo", "kargo-lojistik", "İstanbul", "yurticikargo.com", true, false, 3.1, 59, "Ülke geneli kargo taşımacılığı."],
  ["mng-kargo", "MNG Kargo", "kargo-lojistik", "İstanbul", "mngkargo.com.tr", false, false, 2.8, 49, "Kargo ve dağıtım."],
  ["yemeksepeti", "Yemeksepeti", "restoran-yeme-icme", "İstanbul", "yemeksepeti.com", true, true, 3.6, 76, "Online yemek siparişi platformu."],
  ["enerjisa", "Enerjisa", "enerji", "İstanbul", "enerjisa.com.tr", true, false, 3.0, 55, "Elektrik dağıtım ve perakende."],
  ["arcelik", "Arçelik", "beyaz-esya-elektronik", "İstanbul", "arcelik.com.tr", true, false, 3.8, 81, "Beyaz eşya ve elektronik üreticisi."],
  ["lcwaikiki", "LC Waikiki", "giyim-moda-tekstil", "İstanbul", "lcwaikiki.com", true, false, 3.5, 70, "Uygun fiyatlı hazır giyim markası."],
];

const COMPLAINTS = [
  ["Siparişim kargoya verilmedi", "3 gündür siparişim 'hazırlanıyor' durumunda, kargoya verilmedi ve müşteri hizmetlerine ulaşamıyorum."],
  ["İade param hâlâ yatmadı", "Ürünü iade ettim, kargo teslim edildi ama iade tutarı 15 gündür hesabıma geçmedi."],
  ["Yanlış ürün gönderildi", "Sipariş ettiğim ürün yerine tamamen farklı bir ürün geldi, değişim talebim yanıtsız kaldı."],
  ["Müşteri hizmetlerine ulaşamıyorum", "Günlerdir arıyorum, çağrı merkezi sürekli meşgul ya da bağlanınca hat düşüyor."],
  ["Faturama tanımadığım ücret yansıdı", "Bu ay faturamda hiç kullanmadığım bir servis için ek ücret var, iptal edilmesini istiyorum."],
  ["Teslimat sürekli erteleniyor", "Üç kez teslimat randevusu verildi, hiçbirinde gelinmedi. Mağdur durumdayım."],
  ["Ürün hasarlı geldi", "Paket açıldığında ürünün kırık olduğunu gördüm, kutuda da ezilme vardı."],
  ["Kampanya sözü tutulmadı", "Alışverişte vaat edilen indirim/hediye uygulanmadı, destek ekibi konuyu geçiştiriyor."],
  ["Hesabım haksız yere kısıtlandı", "Herhangi bir ihlal yapmadığım halde hesabım aniden kısıtlandı, sebep bildirilmedi."],
  ["Eksik ürün teslim edildi", "Siparişimde 2 ürün eksik geldi, iade/telafi süreci çok yavaş ilerliyor."],
  ["Randevuya gelinmedi", "Servis/teslimat için verilen randevuda kimse gelmedi, bilgi de verilmedi."],
  ["Abonelik iptali yapılmıyor", "Aboneliğimi iptal etmek istiyorum ama sistem sürekli hata veriyor, destek de çözmüyor."],
];

const RESPONSES = [
  "Merhaba, yaşadığınız olumsuzluk için üzgünüz. Konuyu ilgili birime ilettik, en kısa sürede dönüş yapacağız.",
  "Talebinizi aldık ve inceliyoruz. Mağduriyetinizin giderilmesi için işlem başlatıldı.",
  "Değerli geri bildiriminiz için teşekkürler. Sorununuz çözüme kavuşturulmuştur, ilginiz için teşekkür ederiz.",
  "Konuyla ilgilenen ekibimiz sizinle iletişime geçecektir. Anlayışınız için teşekkür ederiz.",
];

const NAMES = [
  ["Ahmet Yılmaz", "ahmety"], ["Elif Demir", "elifd"], ["Mehmet Kaya", "mehmetk"],
  ["Zeynep Şahin", "zeyneps"], ["Can Öztürk", "canozturk"], ["Ayşe Çelik", "aysec"],
  ["Burak Arslan", "buraka"], ["Deniz Aydın", "deniza"],
];

const VISIBLE = ["approved", "answered", "answered", "resolved", "resolved", "in_review"];

async function main() {
  // 1) Kategori id haritası
  const catRows = await sql`SELECT id, slug FROM categories`;
  const catId = Object.fromEntries(catRows.map((c) => [c.slug, c.id]));

  // 2) Demo kullanıcılar (user + profiles), yoksa oluştur
  const userIds = [];
  for (const [full, uname] of NAMES) {
    const email = `${uname}@demo.itirazvarplus.com`;
    let [u] = await sql`SELECT id FROM "user" WHERE email=${email}`;
    if (!u) {
      [u] = await sql`INSERT INTO "user" (name, email, email_verified) VALUES (${full}, ${email}, true) RETURNING id`;
      await sql`INSERT INTO profiles (id, full_name, username, email_verified) VALUES (${u.id}, ${full}, ${uname}, true) ON CONFLICT (id) DO NOTHING`;
    }
    userIds.push(u.id);
  }

  let newBrands = 0, newComplaints = 0;

  for (const [slug, name, cat, city, domain, verified, premium, rating, resolvedPct, about] of BRANDS) {
    const logo = `https://logo.clearbit.com/${domain}`;
    const total = rnd(80, 1400);
    const resolved = Math.round((total * resolvedPct) / 100);
    const rc = rnd(60, 1200);
    const avg = rnd(45, 260);

    // Marka (slug unique) — yoksa ekle
    let [b] = await sql`SELECT id FROM brands WHERE slug=${slug}`;
    if (!b) {
      [b] = await sql`INSERT INTO brands
        (slug, name, category_id, about, website, city, logo_url, verified, premium,
         rating, rating_count, total_complaints, complaints_resolved, resolution_rate, avg_response_minutes)
        VALUES (${slug}, ${name}, ${catId[cat] ?? null}, ${about}, ${"https://" + domain}, ${city}, ${logo},
                ${verified}, ${premium}, ${rating}, ${rc}, ${total}, ${resolved}, ${resolvedPct}, ${avg})
        RETURNING id`;
      newBrands++;
    }

    // Bu markanın hiç şikayeti yoksa demo şikayet ekle (idempotent)
    const [{ n }] = await sql`SELECT count(*)::int n FROM complaints WHERE brand_id=${b.id}`;
    if (n > 0) continue;

    const howMany = rnd(4, 7);
    const used = new Set();
    for (let i = 0; i < howMany; i++) {
      let t;
      do { t = pick(COMPLAINTS); } while (used.has(t[0]) && used.size < COMPLAINTS.length);
      used.add(t[0]);
      const status = pick(VISIBLE);
      const created = daysAgo(rnd(1, 60));
      const anon = Math.random() < 0.25;
      const uid = pick(userIds);
      const hasResp = status === "answered" || status === "resolved";
      const respAt = hasResp ? daysAgo(rnd(0, 3)) : null;
      const respBy = hasResp ? pick(userIds) : null;
      const ratingVal = status === "resolved" ? rnd(3, 5) : null;

      await sql`INSERT INTO complaints
        (user_id, brand_id, category_id, title, body, status, city, rating, views, votes,
         is_anonymous, anon_name, public_id, brand_response, brand_response_at, brand_response_by,
         created_at, updated_at)
        VALUES (${uid}, ${b.id}, ${catId[cat] ?? null}, ${t[0]},
                ${t[1] + ` (${name})`}, ${status}, ${pick(["İstanbul","Ankara","İzmir","Bursa","Antalya","Adana"])},
                ${ratingVal}, ${rnd(20, 800)}, ${rnd(0, 40)},
                ${anon}, ${anon ? "Anonim Kullanıcı" : null}, ${pubId()},
                ${hasResp ? pick(RESPONSES) : null}, ${respAt}, ${respBy},
                ${created}, ${created})`;
      newComplaints++;
    }
  }

  const [{ bc }] = await sql`SELECT count(*)::int bc FROM brands`;
  const [{ cc }] = await sql`SELECT count(*)::int cc FROM complaints`;
  console.log(`Eklendi: ${newBrands} marka, ${newComplaints} şikayet.`);
  console.log(`Toplam: ${bc} marka, ${cc} şikayet.`);
  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
