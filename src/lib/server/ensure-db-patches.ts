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
      done = true;
    } finally {
      await pg.end({ timeout: 5 });
      running = null;
    }
  })();
  return running;
}
