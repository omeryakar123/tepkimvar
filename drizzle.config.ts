import { defineConfig } from "drizzle-kit";

// Faz 1: DATABASE_URL mevcut Supabase Postgres'i gösterir -> `bun db:pull` ile
//         tüm şema src/db/schema.ts içine introspect edilir (elle yazmaya gerek yok).
// Faz 2: DATABASE_URL Coolify'daki kendi Postgres'ine çevrilir; `bun db:migrate`
//         ile şema oraya uygulanır.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  // Sadece uygulama tablolarını çek; Supabase'in iç şemalarını dışarıda bırak.
  schemaFilter: ["public"],
  casing: "snake_case",
});
