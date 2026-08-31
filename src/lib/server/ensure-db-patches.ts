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

      done = true;
    } finally {
      await pg.end({ timeout: 5 });
      running = null;
    }
  })();
  return running;
}
