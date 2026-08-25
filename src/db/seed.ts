/**
 * Lokal geliştirme için örnek veri. Çalıştır: `bun run src/db/seed.ts`
 * Idempotent: içerik tablolarını temizleyip yeniden doldurur.
 */
import { eq } from "drizzle-orm";
import { db, schema } from "./index";
import { recomputeAllBrandAggregates } from "@/lib/server/brand-stats";

const now = new Date();
const daysAgo = (d: number) => new Date(now.getTime() - d * 86400_000);
const CITIES = ["İstanbul", "Ankara", "İzmir", "Bursa", "Antalya", "Adana", "Konya", "Gaziantep", "Kayseri", "Samsun"];

async function main() {
  console.log("Seed başlıyor…");

  // Temizle (FK sırasına dikkat). Seed kullanıcısı da silinir; cascade ile
  // ona bağlı profil/şikayetler gider, böylece script tekrar tekrar çalışabilir.
  await db.delete(schema.comments);
  await db.delete(schema.complaintResolutions);
  await db.delete(schema.complaints);
  await db.delete(schema.brands);
  await db.delete(schema.categories);
  await db.delete(schema.user).where(eq(schema.user.email, "seed@tepkimvar.local"));

  // --- Kategoriler ---
  const cats = [
    { name: "E-Ticaret", slug: "e-ticaret", icon: "ShoppingCart", sortOrder: 1 },
    { name: "Telekomünikasyon", slug: "telekomunikasyon", icon: "Phone", sortOrder: 2 },
    { name: "Bankacılık", slug: "bankacilik", icon: "Landmark", sortOrder: 3 },
    { name: "Kargo", slug: "kargo", icon: "Truck", sortOrder: 4 },
    { name: "Market", slug: "market", icon: "Store", sortOrder: 5 },
  ];
  const insertedCats = await db.insert(schema.categories).values(cats).returning();
  const catBySlug = Object.fromEntries(insertedCats.map((c) => [c.slug, c.id]));

  // --- Markalar ---
  // Puan ve sayaçlar BURADA YAZILMAZ: seed sonunda gerçek satırlardan
  // (oylar, çözüm notları, şikayetler) hesaplanır. Aksi halde ekrandaki
  // ortalama hiçbir veriye dayanmayan bir sayı olurdu.
  const brands = [
    { slug: "trendyol", name: "Trendyol", categoryId: catBySlug["e-ticaret"], city: "İstanbul", verified: true, premium: true, about: "Türkiye'nin önde gelen e-ticaret platformu." },
    { slug: "hepsiburada", name: "Hepsiburada", categoryId: catBySlug["e-ticaret"], city: "İstanbul", verified: true, premium: false, about: "E-ticaret pazaryeri." },
    { slug: "turkcell", name: "Turkcell", categoryId: catBySlug["telekomunikasyon"], city: "İstanbul", verified: true, premium: false, about: "Mobil operatör." },
    { slug: "aras-kargo", name: "Aras Kargo", categoryId: catBySlug["kargo"], city: "İstanbul", verified: false, premium: false, about: "Kargo ve lojistik." },
    { slug: "yemeksepeti", name: "Yemeksepeti", categoryId: catBySlug["market"], city: "İstanbul", verified: true, premium: false, about: "Online yemek ve market." },
  ];
  const insertedBrands = await db.insert(schema.brands).values(brands).returning();
  const brandBySlug = Object.fromEntries(insertedBrands.map((b) => [b.slug, b]));

  // --- Seed kullanıcı + profil ---
  const [seedUser] = await db
    .insert(schema.user)
    .values({ name: "Test Kullanıcı", email: "seed@tepkimvar.local", emailVerified: true })
    .returning();
  await db.insert(schema.profiles).values({
    id: seedUser.id,
    fullName: "Test Kullanıcı",
    username: "testkullanici",
    city: "İstanbul",
    emailVerified: true,
  });

  // --- Şikayetler (herkese açık; status public filtreye takılmayan değerler) ---
  const complaints = [
    { brand: "trendyol", title: "Siparişim kargoya verilmedi", body: "3 gündür siparişim hazırlanıyor durumunda, kargoya verilmedi ve müşteri hizmetlerine ulaşamıyorum.", status: "answered" as const, city: "İstanbul", rating: 2, views: 340, votes: 12, createdAt: daysAgo(1), brandResponse: "Merhaba, siparişiniz bugün kargoya verilecektir. İlginiz için teşekkürler.", brandResponseAt: daysAgo(0) },
    { brand: "trendyol", title: "İade param 15 gündür yatmadı", body: "Ürünü iade ettim, kargo teslim edildi ama iade tutarı hâlâ hesabıma geçmedi.", status: "resolved" as const, city: "Ankara", rating: 4, views: 210, votes: 8, createdAt: daysAgo(4), isAnonymous: true, anonName: "Anonim" },
    { brand: "hepsiburada", title: "Yanlış ürün gönderildi", body: "Telefon kılıfı sipariş ettim, kulaklık geldi. Değişim talebim yanıtsız.", status: "approved" as const, city: "İzmir", rating: 2, views: 156, votes: 5, createdAt: daysAgo(2) },
    { brand: "turkcell", title: "Faturama tanımadığım ek ücret", body: "Bu ay faturamda hiç kullanmadığım bir servis için ücret yansıtılmış.", status: "answered" as const, city: "Bursa", rating: 3, views: 98, votes: 3, createdAt: daysAgo(3), brandResponse: "Konuyu inceliyoruz, en kısa sürede dönüş yapacağız.", brandResponseAt: daysAgo(2) },
    { brand: "aras-kargo", title: "Kargom kayıp", body: "Gönderi 10 gündür şubede görünüyor, teslim edilmiyor ve kimse ilgilenmiyor.", status: "approved" as const, city: "Adana", rating: 1, views: 420, votes: 22, createdAt: daysAgo(5) },
    { brand: "aras-kargo", title: "Teslimat sürekli erteleniyor", body: "Üç kez teslimat randevusu verildi, hiçbirinde gelinmedi.", status: "approved" as const, city: "İstanbul", rating: 2, views: 130, votes: 6, createdAt: daysAgo(6), isAnonymous: true, anonName: "Mağdur Müşteri" },
    { brand: "yemeksepeti", title: "Eksik ürün geldi", body: "Market siparişimde 3 ürün eksikti, iade süreci çok yavaş.", status: "resolved" as const, city: "İstanbul", rating: 4, views: 76, votes: 2, createdAt: daysAgo(7), brandResponse: "Eksik ürün bedeli cüzdanınıza iade edilmiştir.", brandResponseAt: daysAgo(6) },
    { brand: "turkcell", title: "Numara taşıma mağduriyeti", body: "Numaramı taşımak istedim, işlem bir haftadır tamamlanmadı.", status: "approved" as const, city: "Konya", rating: 2, views: 88, votes: 4, createdAt: daysAgo(8) },
  ];

  let seq = 1001;
  const minutesBetween = (from: Date, to: Date) =>
    Math.max(1, Math.round((to.getTime() - from.getTime()) / 60_000));

  const rows = complaints.map((c) => {
    const brand = brandBySlug[c.brand];
    const code = `SK-${seq++}`;
    return {
      userId: seedUser.id,
      brandId: brand.id,
      categoryId: brand.categoryId,
      title: c.title,
      body: c.body,
      status: c.status,
      city: c.city,
      rating: c.rating,
      views: c.views,
      votes: c.votes,
      isPublic: true,
      isAnonymous: c.isAnonymous ?? false,
      anonName: c.anonName ?? null,
      publicId: code,
      shortId: code.toLowerCase(),
      brandResponse: c.brandResponse ?? null,
      brandResponseAt: c.brandResponseAt ?? null,
      brandResponseBy: c.brandResponse ? seedUser.id : null,
      // Ortalama yanıt süresi bu alandan hesaplanır; yanıt varsa doldurulur.
      firstResponseAt: c.brandResponseAt ?? null,
      firstResponseMinutes: c.brandResponseAt
        ? minutesBetween(c.createdAt, c.brandResponseAt)
        : null,
      createdAt: c.createdAt,
    };
  });
  const insertedComplaints = await db
    .insert(schema.complaints)
    .values(rows)
    .returning({
      id: schema.complaints.id,
      brandId: schema.complaints.brandId,
      status: schema.complaints.status,
      rating: schema.complaints.rating,
    });

  // --- Hacim: sayfalama/filtreleri gerçekten test edebilmek için toplu kayıt ---
  // (PAGE_SIZE 12; Trendyol tek başına birkaç sayfa olacak kadar alıyor.)
  const TEMPLATES = [
    ["Sipariş kargoya verilmedi", "Sipariş verdiğim ürün günlerdir hazırlanıyor durumunda kaldı, kargoya verilmedi."],
    ["İade süreci çok yavaş", "Ürünü iade ettim ancak iade tutarı hâlâ hesabıma yansımadı, destek yanıt vermiyor."],
    ["Yanlış ürün gönderildi", "Sipariş ettiğim üründen tamamen farklı bir ürün elime ulaştı."],
    ["Müşteri hizmetlerine ulaşamıyorum", "Günlerdir arıyorum, çağrı merkezinde sıra bir türlü bana gelmiyor."],
    ["Ürün hasarlı geldi", "Paket ezilmiş halde teslim edildi, içindeki ürün kullanılamaz durumda."],
    ["Kampanya indirimi uygulanmadı", "Sepette görünen indirim ödeme adımında kayboldu, tam ücret tahsil edildi."],
    ["Teslimat tarihi sürekli erteleniyor", "Üç kez teslimat randevusu verildi, hiçbirinde gelinmedi."],
    ["Fatura tutarı hatalı", "Bu ay faturama hiç kullanmadığım bir hizmet için ücret yansıtılmış."],
    ["Hesabım izinsiz işlem gördü", "Onayım olmadan hesabımdan işlem yapıldı, açıklama bekliyorum."],
    ["Eksik ürün teslim edildi", "Siparişimdeki üç kalem ürün pakette yoktu."],
  ] as const;
  const STATUSES = ["approved", "answered", "resolved", "in_review"] as const;
  const VOLUME: Record<string, number> = {
    trendyol: 34, "aras-kargo": 21, turkcell: 16, hepsiburada: 11, yemeksepeti: 7,
  };

  // Tip şemadan alınır; rows'tan türetilse status birliği daralıyor.
  const bulk: (typeof schema.complaints.$inferInsert)[] = [];
  for (const [slug, count] of Object.entries(VOLUME)) {
    const brand = brandBySlug[slug];
    for (let i = 0; i < count; i++) {
      const [title, body] = TEMPLATES[i % TEMPLATES.length];
      const status = STATUSES[i % STATUSES.length];
      const code = `SK-${seq++}`;
      const anon = i % 5 === 0;
      const createdAt = daysAgo(2 + (i % 40));
      const answered = status === "answered" || status === "resolved";
      const respondedAt = answered ? daysAgo(i % 9) : null;
      bulk.push({
        userId: seedUser.id,
        brandId: brand.id,
        categoryId: brand.categoryId,
        title: `${title} #${i + 1}`,
        body: `${body} (${brand.name} — kayıt ${i + 1})`,
        status,
        city: CITIES[i % CITIES.length],
        rating: (i % 5) + 1,
        views: 40 + ((i * 37) % 500),
        votes: (i * 7) % 40,
        isPublic: true,
        isAnonymous: anon,
        anonName: anon ? "Anonim" : null,
        publicId: code,
        shortId: code.toLowerCase(),
        brandResponse: answered ? "Konuyu inceledik, ilgili birim sizinle iletişime geçecek." : null,
        brandResponseAt: respondedAt,
        brandResponseBy: answered ? seedUser.id : null,
        firstResponseAt: respondedAt,
        // Yanıt tarihi kayıt tarihinden önce düşerse süre negatif olmasın.
        firstResponseMinutes:
          respondedAt && respondedAt > createdAt ? minutesBetween(createdAt, respondedAt) : null,
        createdAt,
      });
    }
  }
  const insertedBulk = await db.insert(schema.complaints).values(bulk).returning({
    id: schema.complaints.id,
    brandId: schema.complaints.brandId,
    status: schema.complaints.status,
    rating: schema.complaints.rating,
  });

  // --- Çözüm notları: markanın yıldız ortalamasının ilk kaynağı ---
  const resolved = [...insertedComplaints, ...insertedBulk].filter(
    (c) => c.status === "resolved" && c.rating != null,
  );
  if (resolved.length > 0) {
    await db.insert(schema.complaintResolutions).values(
      resolved.map((c) => ({
        complaintId: c.id,
        brandId: c.brandId,
        userId: seedUser.id,
        resolutionRating: c.rating as number,
        thanksMessage: "Sorun çözüldü, ilgilenen ekibe teşekkürler.",
      })),
    );
  }

  // --- Marka oyları (kullanıcı başına tek oy) ---
  const votes: Record<string, number> = {
    trendyol: 4, hepsiburada: 3, turkcell: 3, "aras-kargo": 2, yemeksepeti: 4,
  };
  await db.insert(schema.brandRatings).values(
    Object.entries(votes).map(([slug, rating]) => ({
      brandId: brandBySlug[slug].id,
      userId: seedUser.id,
      rating,
    })),
  );

  // Puan ve sayaçlar yalnızca burada, gerçek satırlardan yazılır.
  const refreshed = await recomputeAllBrandAggregates();

  console.log(
    `Bitti: ${insertedCats.length} kategori, ${insertedBrands.length} marka, ${rows.length + bulk.length} şikayet, ${resolved.length} çözüm notu, 1 kullanıcı. ${refreshed} markanın puanı hesaplandı.`,
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
