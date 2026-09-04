import { createFileRoute } from "@tanstack/react-router";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { count } from "drizzle-orm";
import { db, schema } from "@/db";
import { errorResponse, requireStaff } from "@/lib/server/guard";
import { seedUserRequestedBrands } from "@/lib/server/seed-user-requested-brands";

/** Opsiyonel: sunucuda scripts/ varsa logo senkronu dener; başarısız olursa seed yine geçerli sayılır. */
function runScript(name: string, args: string[] = []) {
  return new Promise<{ stdout: string; stderr: string; code: number; skipped?: boolean }>(
    (resolve) => {
      const script = join(process.cwd(), "scripts", name);
      if (!existsSync(script)) {
        resolve({
          stdout: "",
          stderr: `Script bulunamadı: ${script}`,
          code: 0,
          skipped: true,
        });
        return;
      }

      const child = spawn("bun", [script, ...args], {
        env: process.env,
        cwd: process.cwd(),
      });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (d) => (stdout += d.toString()));
      child.stderr.on("data", (d) => (stderr += d.toString()));
      child.on("error", (err) => {
        resolve({ stdout, stderr: err.message, code: 1 });
      });
      child.on("close", (code) => resolve({ stdout, stderr, code: code ?? 1 }));
    },
  );
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

          const seed = await seedUserRequestedBrands();

          const telegram = await runScript("sync-telegram-logos.mjs");
          const logos = await runScript("fix-brand-logos.mjs", ["--all", "--force"]);

          const [{ after }] = await db.select({ after: count() }).from(schema.brands);

          const logoWarnings: string[] = [];
          if (telegram.code !== 0 && !telegram.skipped) {
            logoWarnings.push(`Telegram logo: ${telegram.stderr || telegram.stdout || "hata"}`);
          }
          if (logos.code !== 0 && !logos.skipped) {
            logoWarnings.push(`Logo düzeltme: ${logos.stderr || logos.stdout || "hata"}`);
          }

          return Response.json({
            ok: true,
            before,
            after,
            added: after - before,
            seed: {
              listSize: seed.listSize,
              added: seed.added,
              skipped: seed.skipped,
              addedNames: seed.addedNames,
              skippedSlugs: seed.skippedSlugs,
            },
            logos: {
              telegramSkipped: Boolean(telegram.skipped),
              logosSkipped: Boolean(logos.skipped),
              warnings: logoWarnings,
            },
            message:
              seed.added > 0
                ? `${seed.added} marka eklendi, ${seed.skipped} zaten vardı.`
                : seed.skipped > 0
                  ? `Tüm markalar zaten kayıtlı (${seed.skipped} adet).`
                  : "Liste boş — eklenecek marka yok.",
          });
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
