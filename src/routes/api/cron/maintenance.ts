import { createFileRoute } from "@tanstack/react-router";
import { spawn } from "node:child_process";
import { join } from "node:path";
import postgres from "postgres";
import { applyDbPatches } from "@/lib/server/db-patches";
import { ensureDbPatches } from "@/lib/server/ensure-db-patches";
import { HttpError, errorResponse, isStaff, optionalUser } from "@/lib/server/guard";

/**
 * Prod bakım: migration patch + marka seed + cevap temizliği.
 *   curl -X POST https://tepkimvar.com/api/cron/maintenance \
 *     -H "Authorization: Bearer $CRON_SECRET"
 */

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function authorize(request: Request): Promise<void> {
  const secret = (process.env.CRON_SECRET ?? "").trim();
  const header = request.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  if (secret && token && safeEqual(token, secret)) return;
  const user = await optionalUser(request);
  if (user && (await isStaff(user.id))) return;
  throw new HttpError(401, "Yetkisiz");
}

function runScript(name: string): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const script = join(process.cwd(), "scripts", name);
    const child = spawn("bun", [script], {
      env: process.env,
      cwd: process.cwd(),
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("close", (code) => resolve({ stdout, stderr, code: code ?? 1 }));
  });
}

export const Route = createFileRoute("/api/cron/maintenance")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          await authorize(request);
          await ensureDbPatches();
          const url = process.env.DATABASE_URL;
          if (!url) throw new HttpError(500, "DATABASE_URL tanımlı değil");

          const sql = postgres(url, { max: 1 });
          const patches = await applyDbPatches(sql);
          await sql.end();

          const seed = await runScript("seed-bilisim-brands-bulk.mjs");
          const clear = await runScript("clear-synthetic-responses.mjs");

          const ok = seed.code === 0 && clear.code === 0;
          return Response.json(
            {
              ok,
              patches,
              seed: { code: seed.code, out: seed.stdout.trim(), err: seed.stderr.trim() },
              clear: { code: clear.code, out: clear.stdout.trim(), err: clear.stderr.trim() },
            },
            { status: ok ? 200 : 502 },
          );
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
