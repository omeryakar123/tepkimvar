import { createFileRoute } from "@tanstack/react-router";
import { spawn } from "node:child_process";
import { join } from "node:path";
import { count } from "drizzle-orm";
import { db, schema } from "@/db";
import { errorResponse, requireStaff } from "@/lib/server/guard";

/** Admin: bilisim-brand-names.txt → DB seed + Telegram logolar + logo düzeltme */

function runScript(name: string, args: string[] = []) {
  return new Promise<{ stdout: string; stderr: string; code: number }>((resolve) => {
    const script = join(process.cwd(), "scripts", name);
    const child = spawn("bun", [script, ...args], {
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

export const Route = createFileRoute("/api/admin/brands-seed")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          await requireStaff(request);
          if (!process.env.DATABASE_URL) {
            return Response.json({ error: "DATABASE_URL tanımlı değil" }, { status: 500 });
          }

          const [{ before }] = await db.select({ before: count() }).from(schema.brands);

          const seed = await runScript("seed-bilisim-brands-bulk.mjs");
          const telegram = await runScript("sync-telegram-logos.mjs");
          const logos = await runScript("fix-brand-logos.mjs", ["--all", "--force"]);

          const [{ after }] = await db.select({ after: count() }).from(schema.brands);

          const ok = seed.code === 0 && telegram.code === 0 && logos.code === 0;

          return Response.json(
            {
              ok,
              before,
              after,
              added: after - before,
              seed: { code: seed.code, out: seed.stdout.trim(), err: seed.stderr.trim() },
              telegram: { code: telegram.code, out: telegram.stdout.trim(), err: telegram.stderr.trim() },
              logos: { code: logos.code, out: logos.stdout.trim(), err: logos.stderr.trim() },
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
