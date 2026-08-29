/**
 * Prodüksiyon migration çalıştırıcı — deploy başında koşar.
 * `drizzle/` altındaki versiyonlu SQL migration'ları uygular (idempotent:
 * uygulanmış olanlar atlanır). drizzle-kit toolchain'ine gerek yok; yalnızca
 * drizzle-orm + postgres (ikisi de bağımlılıksız) yeter.
 *   bun run src/db/migrate.ts
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("[migrate] DATABASE_URL tanımlı değil");
  process.exit(1);
}

const sql = postgres(url, { max: 1 });
try {
  await migrate(drizzle(sql), { migrationsFolder: "./drizzle" });
  console.log("[migrate] Tamam.");
} catch (e) {
  console.error("[migrate] Hata:", e);
  process.exit(1);
} finally {
  await sql.end();
}

try {
  const { logStorageBackendOnce, testStorageWrite, getStorageBackend } = await import(
    "../lib/server/storage"
  );
  await logStorageBackendOnce();
  await testStorageWrite();
  console.log(`[storage] Yazma testi OK (${await getStorageBackend()})`);
} catch (e) {
  console.warn("[storage] Yazma testi başarısız — görsel yükleme çalışmayabilir:", e);
}
