/**
 * Tüm markaların puanını ve şikayet sayaçlarını gerçek satırlardan yeniden
 * hesaplar. Eskiden puan artımlı ("kayan ortalama") güncellendiği için
 * mevcut kayıtlarda sapma olabilir; bu script onları tek seferde düzeltir.
 *
 *   bun run src/db/recompute-brand-stats.ts
 */
import { recomputeAllBrandAggregates } from "@/lib/server/brand-stats";

async function main() {
  const count = await recomputeAllBrandAggregates();
  console.log(`${count} markanın puanı ve sayaçları yeniden hesaplandı.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
