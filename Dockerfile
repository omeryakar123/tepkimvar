# tepkimvar — production image (TanStack Start + Nitro node-server)
# Çok aşamalı: bun ile build, sonra ince bir bun runtime.

# ---------- 1) Bağımlılıklar + build ----------
FROM oven/bun:1 AS builder
WORKDIR /app

# Önce sadece manifest'ler -> katman cache
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Kaynak
COPY . .

# VITE_* değişkenleri build sırasında bundle'a gömülür. Coolify bunları
# otomatik enjekte eder; saf Docker'da --build-arg ile ver (compose halleder).
ARG VITE_SITE_URL
ARG VITE_GOOGLE_ENABLED
ARG VITE_OAUTH_GOOGLE
ARG VITE_OAUTH_FACEBOOK
ARG VITE_OAUTH_APPLE
ENV VITE_SITE_URL=$VITE_SITE_URL
ENV VITE_GOOGLE_ENABLED=$VITE_GOOGLE_ENABLED
ENV VITE_OAUTH_GOOGLE=$VITE_OAUTH_GOOGLE
ENV VITE_OAUTH_FACEBOOK=$VITE_OAUTH_FACEBOOK
ENV VITE_OAUTH_APPLE=$VITE_OAUTH_APPLE

# Nitro'yu Node sunucusu olarak build et (varsayılan cloudflare DEĞİL).
ENV NITRO_PRESET=node-server
ENV SERVER_PRESET=node-server
RUN bun run build

# ---------- 2) Runtime ----------
FROM oven/bun:1-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# .output nitro tarafından kendi kendine yeten şekilde bundle'lanır.
COPY --from=builder /app/.output ./.output
# Migration için: SQL dosyaları + minimal script + bağımlılıksız iki paket.
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/src/db/migrate.ts ./src/db/migrate.ts
COPY --from=builder /app/src/lib/server/db-patches.ts ./src/lib/server/db-patches.ts
COPY --from=builder /app/src/lib/server/ensure-db-patches.ts ./src/lib/server/ensure-db-patches.ts
COPY --from=builder /app/node_modules/drizzle-orm ./node_modules/drizzle-orm
COPY --from=builder /app/node_modules/postgres ./node_modules/postgres
# Prod bakım: marka/kategori seed scriptleri (DATABASE_URL ile çalıştırılır).
COPY --from=builder /app/scripts ./scripts

# MinIO yoksa yerel depolama (Coolify'da volume bağlayın: /app/data/storage)
RUN mkdir -p /app/data/storage
ENV STORAGE_LOCAL_PATH=/app/data/storage

# Nitro node-server PORT'u dinler (Coolify enjekte eder).
ENV PORT=3000
EXPOSE 3000

# Başlangıçta migration + sunucu. Migration idempotenttir.
CMD ["sh", "-c", "bun run src/db/migrate.ts && bun .output/server/index.mjs"]
