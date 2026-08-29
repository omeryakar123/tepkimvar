import { getStorageBackend, storageConfigSummary, testStorageWrite } from "@/lib/server/storage";

export async function storageHealthReport() {
  const backend = await getStorageBackend();
  const config = storageConfigSummary();
  try {
    await testStorageWrite();
    return { ok: true as const, backend, ...config };
  } catch (e) {
    return {
      ok: false as const,
      backend,
      ...config,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
