# tepkimvar — Coolify Deploy Rehberi

Uygulama: **TanStack Start + Nitro (node-server) + Drizzle/Postgres + BetterAuth + S3/MinIO**.
Build ve migration `Dockerfile` içinde otomatik; sen sadece servisleri ve env'leri kurarsın.

## 1. Coolify'da gerekli servisler

| Servis | Not |
|---|---|
| **PostgreSQL** | Coolify "Databases → PostgreSQL". Bağlantı URL'ini kopyala → `DATABASE_URL`. |
| **MinIO** (veya S3/R2) | Dosya/görsel yükleme için. Access/secret key üret. Alternatif: Cloudflare R2. |
| **Uygulama** | Bu repo → "Application → Dockerfile". Port **3000**. |

## 2. Uygulama servisi ayarı
- **Build Pack:** Dockerfile (repo kökündeki `Dockerfile` otomatik bulunur).
- **Port:** `3000` (Nitro node-server bunu dinler).
- **Domain:** `tepkimvar.com` bağla, Coolify otomatik HTTPS (Let's Encrypt) verir.
- **Health check path:** `/robots.txt` (hafif, hızlı 200 döner).

## 3. Environment Variables (Coolify → Environment)

**Zorunlu:**
```
DATABASE_URL=postgresql://...        # Coolify Postgres servisinden
BETTER_AUTH_SECRET=<openssl rand -base64 32 ile ÜRET>
BETTER_AUTH_URL=https://tepkimvar.com
TRUSTED_ORIGINS=https://tepkimvar.com
SITE_URL=https://tepkimvar.com
VITE_SITE_URL=https://tepkimvar.com
INTERNAL_API_URL=http://localhost:3000
PORT=3000
S3_ENDPOINT=<minio/r2 endpoint>
S3_ACCESS_KEY_ID=<...>
S3_SECRET_ACCESS_KEY=<...>
S3_BUCKET=itirazvar
S3_REGION=us-east-1
RESEND_API_KEY=<Resend anahtarı>     # gerçek e-posta doğrulaması için
```

**SMS / Telefon OTP (Sempico — şikayet gönderimi için zorunlu):**
```
SMS_API_URL=https://restapi.sempico.solutions
SMS_API_TOKEN=<Sempico REST API token>
SMS_API_KEY=<aynı token (opsiyonel yedek)>
SMS_FROM=VSMS
SMS_SENDER_ID=              # opsiyonel: legacy API sayısal sender ID
```
Runtime değişkenleridir — **Restart** yeter, rebuild gerekmez (env için).
Kod güncellemesi (`src/lib/server/sms.ts`) için **Deploy** gerekir.

**Otomatik (API token ile):**
```bash
COOLIFY_TOKEN='1|...' node scripts/coolify-set-sms-env.mjs --restart
# git push sonrası kod deploy:
COOLIFY_TOKEN='1|...' node scripts/coolify-set-sms-env.mjs --deploy
```

**AI / şikayet asistanı + Complaint Bot (fal.ai):**
```bash
COOLIFY_TOKEN='1|...' node scripts/coolify-set-ai-env.mjs --restart
```
Değerler `.env.selfhost` içindeki `AI_*` satırlarından okunur.

> **Not:** `VITE_*` değişkenleri build sırasında gömülür. Coolify'da bunları
> "Build Variable" olarak da işaretle (yalnızca runtime değil).

**Opsiyonel (Google / Facebook / Apple ile giriş):**

Runtime (container):
```
GOOGLE_CLIENT_ID=<...>
GOOGLE_CLIENT_SECRET=<...>
FACEBOOK_CLIENT_ID=<...>
FACEBOOK_CLIENT_SECRET=<...>
APPLE_CLIENT_ID=<...>
APPLE_CLIENT_SECRET=<...>
APPLE_APP_BUNDLE_IDENTIFIER=<opsiyonel>
```

Build-time (**Build Variable** işaretle, redeploy gerekir):
```
VITE_OAUTH_GOOGLE=true
VITE_OAUTH_FACEBOOK=true
VITE_OAUTH_APPLE=true
VITE_GOOGLE_ENABLED=true
VITE_SITE_URL=https://tepkimvar.com
```

Callback URI'ler (OAuth konsollarında):
- `https://tepkimvar.com/api/auth/callback/google`
- `https://tepkimvar.com/api/auth/callback/facebook`
- `https://tepkimvar.com/api/auth/callback/apple`

**Otomatik (API açıksa):**
```bash
COOLIFY_TOKEN='1|...' \
GOOGLE_CLIENT_ID='...' GOOGLE_CLIENT_SECRET='...' \
node scripts/coolify-set-oauth-env.mjs --deploy
```

**Terminalden**
Environment Variables'a yazmazsan panel "AI_API_KEY tanımlı değil" der ve
bot şablon metin üretir.
```
AI_PROVIDER=openrouter
AI_API_KEY=<OpenRouter sk-or-v1-... anahtarı — openrouter.ai/keys>
AI_BASE_URL=https://openrouter.ai/api/v1
AI_MODEL=openai/gpt-4o-mini
CRON_SECRET=<openssl rand -hex 32>
SYNTHETIC_CONTENT_PUBLIC=false
```
Coolify'da runtime değişkenidir (VITE_ değil); kaydettikten sonra **Restart** yeter, rebuild şart değil.

## 4. Deploy
1. Repo'yu Coolify'a bağla (GitHub veya git push).
2. Yukarıdaki env'leri gir.
3. **Deploy**. Container başlarken önce migration'ları uygular
   (`bun run src/db/migrate.ts`), sonra sunucuyu başlatır. İlk deploy'da
   33 tablo boş DB'ye kurulur; sonraki deploy'larda sadece yeni migration'lar.

### Değişiklikler sitede görünmüyorsa

Kod GitHub'da güncel olsa bile **Coolify yeniden build etmediyse** eski arayüz
kalır (farklı JS/CSS dosya hash'leri).

**Hemen (1 dk):** Coolify → **tepkimvar** uygulaması → **Deploy** (Force rebuild).

**Otomatik (önerilen):**
1. Coolify → Keys & Tokens → `deploy` yetkili token oluştur
2. GitHub repo → Settings → Secrets → Actions → `COOLIFY_TOKEN` ekle
3. `main`'e her push'ta `.github/workflows/deploy-coolify.yml` deploy tetikler

**Terminalden:**
```bash
COOLIFY_TOKEN='1|...' ./scripts/deploy-now.sh
```

**Doğrulama:** Deploy bittikten sonra ana sayfa kaynağında yeni asset hash'leri
görünür (`/assets/index-XXXX.js` değişir). Hard refresh: Cmd+Shift+R.

**Not:** `VITE_*` değişkenleri build'e gömülür; runtime env yeterli değildir —
mutlaka **rebuild** gerekir.

## 5. İlk kurulum (deploy sonrası, tek seferlik)
```bash
# Kategoriler/markalar boş gelir. İstersen tohum verisiyle başla:
#   (lokalde çalıştır, prod DATABASE_URL'i vererek — ya da kendi verini gir)
DATABASE_URL=<prod-url> bun run src/db/seed.ts

# İlk admin: siteden kayıt ol, sonra:
DATABASE_URL=<prod-url> bun run src/db/make-admin.ts senin@mailin.com super_admin
```

## 6. Şema değişince (sonraki güncellemeler)
```bash
bun run db:generate        # schema.ts'ten yeni SQL migration üret
git commit && push         # Coolify redeploy -> migrate otomatik koşar
```

## Bağımlılıklar / dış servisler (senin sağlaman gerekenler)
- **Domain + DNS:** `tepkimvar.com` A kaydı Coolify sunucusuna.
- **Resend hesabı:** e-posta doğrulama/OTP için (domain doğrulaması gerekir).
- **Google OAuth (ops.):** kendi Client ID/Secret'ın.
- **S3/MinIO:** Coolify MinIO ya da Cloudflare R2 (R2 önerilir: egress ücretsiz).

## Notlar
- SSR, sayfa verisini kendi API'sinden çeker; `INTERNAL_API_URL=http://localhost:3000`
  sayesinde bu istek konteyner içinde kalır (public proxy'ye çıkmaz).
- Rate limit şu an **in-memory** (tek replica için). Birden fazla replica
  çalıştıracaksan `src/lib/server/guard.ts`'i Redis'e taşı.
- Eski `supabase/` klasörü kullanılmıyor; `.dockerignore`'da image'a girmiyor.
