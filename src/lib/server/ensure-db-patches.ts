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

      const fakeNamesPatched = await pg<{ key: string }[]>`
        SELECT key FROM app_meta WHERE key = 'fake_usernames_v1' LIMIT 1
      `.catch(() => []);
      if (fakeNamesPatched.length === 0) {
        const {
          pickTurkishDisplayName,
          pickRealisticPlatformUsername,
          normalizeBotDisplayName,
          looksLikeFakePlatformUsername,
        } = await import("./ai/prompts");

        const platformRows = await pg<{ id: string; platform_username: string | null }[]>`
          SELECT id, platform_username FROM complaints
          WHERE platform_username IS NOT NULL
            AND (
              platform_username ~* 'kay[iı]tl[iı]|registered|kullan[iı]c[iı]|user[0-9]|player|test|demo|fake|oyuncu|magdur|guest|member'
              OR platform_username ~* '^kullanici[0-9]+'
              OR platform_username ~* '^kullanıcı[0-9]+'
            )
        `.catch(() => []);

        const usedPlatform = new Set<string>();
        for (const row of platformRows) {
          const next = pickRealisticPlatformUsername([...usedPlatform]);
          usedPlatform.add(next);
          await pg`
            UPDATE complaints SET platform_username = ${next} WHERE id = ${row.id}
          `.catch(() => {});
        }

        const anonRows = await pg<{ id: string; anon_name: string | null }[]>`
          SELECT id, anon_name FROM complaints
          WHERE anon_name IS NOT NULL
            AND (
              anon_name ~* 'kay[iı]tl[iı]|kullan[iı]c[iı]|registered|user[0-9]|player|test|magdur|mağdur|guest|member|anonim'
              OR anon_name IN ('Mağdur Müşteri', 'Magdur Musteri', 'Test Kullanıcı', 'Test Kullanici')
            )
        `.catch(() => []);

        const usedAnon = new Set<string>();
        for (const row of anonRows) {
          const next = normalizeBotDisplayName(row.anon_name, [...usedAnon]);
          usedAnon.add(next);
          await pg`UPDATE complaints SET anon_name = ${next} WHERE id = ${row.id}`.catch(() => {});
        }

        const syntheticNoPlatform = await pg<{ id: string }[]>`
          SELECT id FROM complaints
          WHERE is_synthetic = true AND (platform_username IS NULL OR platform_username = '')
        `.catch(() => []);
        const usedSynth = new Set([...usedPlatform]);
        for (const row of syntheticNoPlatform) {
          const next = pickRealisticPlatformUsername([...usedSynth]);
          usedSynth.add(next);
          await pg`UPDATE complaints SET platform_username = ${next} WHERE id = ${row.id}`.catch(() => {});
        }

        const profileRows = await pg<{ id: string; username: string | null; full_name: string | null }[]>`
          SELECT id, username, full_name FROM profiles
          WHERE (username IS NOT NULL AND (
              username ~* 'kay[iı]tl[iı]|registered|kullan[iı]c[iı]|user[0-9]|player|test'
            ))
            OR (full_name IS NOT NULL AND (
              full_name ~* 'kay[iı]tl[iı]|kullan[iı]c[iı]|registered|user[0-9]|player|test|magdur|mağdur'
            ))
        `.catch(() => []);
        for (const row of profileRows) {
          if (row.username && looksLikeFakePlatformUsername(row.username)) {
            await pg`UPDATE profiles SET username = NULL WHERE id = ${row.id}`.catch(() => {});
          }
          if (row.full_name && !/^[A-ZÇĞİÖŞÜ][a-zçğıöşü]+(\s+[A-ZÇĞİÖŞÜ][a-zçğıöşü]+|\s+[A-ZÇĞİÖŞÜ]\.)?$/.test(row.full_name.trim())) {
            const next = pickTurkishDisplayName([]);
            await pg`UPDATE profiles SET full_name = ${next} WHERE id = ${row.id}`.catch(() => {});
          }
        }

        await pg`
          INSERT INTO app_meta (key, value) VALUES ('fake_usernames_v1', '1')
          ON CONFLICT (key) DO NOTHING
        `.catch(() => {});
      }

      const manualLogoRestore = await pg<{ key: string }[]>`
        SELECT key FROM app_meta WHERE key = 'manual_logos_restore_v1' LIMIT 1
      `.catch(() => []);
      if (manualLogoRestore.length === 0) {
        const { listObjects } = await import("./storage");
        const { isManualBrandLogoUrl, timestampFromBrandLogoKey } = await import(
          "@/lib/brand-logo-manual"
        );

        const brands = await pg<{ id: string; logo_url: string | null }[]>`
          SELECT id, logo_url FROM brands
        `.catch(() => []);

        let restored = 0;
        for (const b of brands) {
          if (isManualBrandLogoUrl(b.logo_url)) continue;

          let objects: { key: string; size: number; lastModified: Date }[] = [];
          try {
            objects = await listObjects(`brand-logos/${b.id}/`, 100);
          } catch {
            continue;
          }

          const files = objects.filter((o) => o.size > 0);
          if (files.length === 0) continue;

          files.sort((a, b) => {
            const ta = timestampFromBrandLogoKey(a.key) || a.lastModified.getTime();
            const tb = timestampFromBrandLogoKey(b.key) || b.lastModified.getTime();
            return tb - ta;
          });

          const logoUrl = `/api/files/${files[0].key}`;
          await pg`
            UPDATE brands SET logo_url = ${logoUrl}, updated_at = now() WHERE id = ${b.id}
          `.catch(() => {});
          restored++;
        }

        if (restored > 0) {
          console.log(`[ensure-db-patches] ${restored} manuel marka logosu depodan geri yüklendi`);
        }

        await pg`
          INSERT INTO app_meta (key, value) VALUES ('manual_logos_restore_v1', '1')
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
