/**
 * Eksik kolonları ilk API çağrısında idempotent ekler (deploy beklemeden).
 */
import postgres from "postgres";
import { applyDbPatches } from "./db-patches";

let done = false;
let running: Promise<void> | null = null;

export async function ensureDbPatches(): Promise<void> {
  if (done) return;
  if (running) return running;
  const url = process.env.DATABASE_URL;
  if (!url) return;

  running = (async () => {
    const pg = postgres(url, { max: 1 });
    try {
      await applyDbPatches(pg);
      await pg`
        UPDATE complaints c SET votes = COALESCE((
          SELECT count(*)::int FROM complaint_supports s WHERE s.complaint_id = c.id
        ), 0)
      `.catch(() => {});

      // Çözülen sayaç formülü: answered + resolved — tüm markaları toplu tazele.
      await pg`
        CREATE TABLE IF NOT EXISTS app_meta (key text PRIMARY KEY, value text)
      `.catch(() => {});
      const patched = await pg<{ key: string }[]>`
        SELECT key FROM app_meta WHERE key = 'brand_aggregates_v3' LIMIT 1
      `.catch(() => []);
      if (patched.length === 0) {
        const { recomputeAllBrandAggregatesBulk } = await import("./brand-stats");
        await recomputeAllBrandAggregatesBulk().catch((e) =>
          console.error("[ensure-db-patches] marka sayaçları tazelenemedi:", e),
        );
        await pg`
          INSERT INTO app_meta (key, value) VALUES ('brand_aggregates_v3', '1')
          ON CONFLICT (key) DO NOTHING
        `.catch(() => {});
      }

      const blogSeed = await pg<{ key: string }[]>`
        SELECT key FROM app_meta WHERE key = 'blog_seed_v1' LIMIT 1
      `.catch(() => []);
      if (blogSeed.length === 0) {
        const body = `tepkimvar, Türkiye'nin bağımsız şikayet ve çözüm platformudur. Amacımız tüketicinin sesini duyurmak, markaların resmi yanıt vermesini sağlamak ve çözüm sürecini şeffaf biçimde takip etmektir.

## Biz kimiz?

tepkimvar; kullanıcılar, markalar ve moderasyon ekibinden oluşan bağımsız bir topluluktur. Taraf tutmayız — yalnızca gerçek deneyimleri ve çözüm süreçlerini kayda geçiririz.

## Nasıl çalışır?

1. **Şikayet yaz:** Platform kullanıcı adınız ve telefon numaranızla birlikte yaşadığınız sorunu anlatın.
2. **Moderasyon:** İçerik ekibimiz şikayeti inceler; uygun bulunanlar yayına alınır.
3. **Marka yanıtı:** Doğrulanmış markalar panel üzerinden resmi yanıt verir.
4. **Çözüm takibi:** Süreç adım adım şikayet sayfasında görünür; memnun kaldığınızda değerlendirme yapabilirsiniz.

## Şikayet ve çözüm kültürü

Bir şikayet yalnızca "şikayet etmek" değildir — çözüm için resmi bir kayıt oluşturur. Markalar hızlı yanıt verdikçe çözüm oranları yükselir; kullanıcılar alışveriş öncesi bu verilere bakarak bilinçli karar verir.

## Gizlilik

Telefon numaranız yalnızca admin ve ilgili firma tarafından görülür. Diğer ziyaretçiler yıldızlı formatta görür.

## Marka takibi

Beğendiğiniz veya takip etmek istediğiniz markaları profilinizden takip edebilir; o markalara yeni şikayet geldiğinde bildirim alırsınız.

Sorularınız için iletişim sayfamızdan bize ulaşabilirsiniz.`;

        await pg`
          INSERT INTO blogs (slug, title, body, excerpt, category, status, published_at, seo_title, seo_description)
          SELECT
            'tepkimvar-nedir-sikayet-ve-cozum-rehberi',
            'tepkimvar Nedir? Şikayet, Çözüm ve Haklarınız',
            ${body},
            'tepkimvar''ın nasıl çalıştığını, şikayet sürecini ve çözüm kültürünü anlatan rehber yazı.',
            'Rehber',
            'published',
            now(),
            'tepkimvar Nedir? Şikayet ve Çözüm Rehberi',
            'tepkimvar kimdir, şikayet nasıl yazılır, moderasyon ve marka yanıtı süreci nasıl işler?'
          WHERE NOT EXISTS (
            SELECT 1 FROM blogs WHERE slug = 'tepkimvar-nedir-sikayet-ve-cozum-rehberi'
          )
        `.catch(() => {});
        await pg`
          INSERT INTO app_meta (key, value) VALUES ('blog_seed_v1', '1')
          ON CONFLICT (key) DO NOTHING
        `.catch(() => {});
      }

      done = true;
    } finally {
      await pg.end({ timeout: 5 });
      running = null;
    }
  })();
  return running;
}
