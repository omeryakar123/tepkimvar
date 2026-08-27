# tepkimvar — Coolify'sız kurulum (SSH + Docker Compose)

Tek sunucuda app + Postgres + MinIO + Caddy (otomatik HTTPS). Coolify gerekmez.

## 0. Ön koşul
- Ubuntu/Debian sunucu, SSH erişimi (root ya da sudo).
- Domain'in **A kaydı** sunucu IP'sine yönlenmiş olmalı (TLS için şart).
- 80 ve 443 portları boş olmalı (başka web sunucusu çalışmıyor olacak).

## 1. Docker kur (tek satır)
```bash
curl -fsSL https://get.docker.com | sh
```

## 2. Projeyi çek
```bash
git clone <REPO_URL> tepkimvar && cd tepkimvar
```
(Ya da yereldekini kopyala: `rsync -av --exclude node_modules --exclude .output . root@SUNUCU:/opt/tepkimvar/`)

## 3. Env doldur
```bash
cp .env.selfhost.example .env.selfhost
nano .env.selfhost     # DOMAIN + üretilen parolalar (openssl komutları dosyada yazıyor)
```

## 4. Başlat
```bash
docker compose -f docker-compose.selfhost.yml --env-file .env.selfhost up -d --build
```
İlk build birkaç dakika sürer. Container açılırken migration otomatik koşar
(boş DB'ye 33 tablo kurulur), Caddy TLS sertifikasını kendisi alır.

Kontrol:
```bash
docker compose -f docker-compose.selfhost.yml --env-file .env.selfhost ps
docker compose -f docker-compose.selfhost.yml --env-file .env.selfhost logs -f app
curl -I https://SENİN_DOMAİNİN/robots.txt   # 200 bekle
```

## 5. İlk admin (siteden kayıt olduktan sonra)
```bash
docker compose -f docker-compose.selfhost.yml --env-file .env.selfhost exec app bun -e '
import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL);
const email = "SENIN@MAILIN.com";
await sql`INSERT INTO user_roles (user_id, role)
  SELECT id, ${"super_admin"}::app_role FROM "user" WHERE email=${email}
  ON CONFLICT DO NOTHING`;
await sql`UPDATE "user" SET email_verified=true WHERE email=${email}`;
console.log("super_admin verildi"); await sql.end();
'
```

## 6. Güncelleme (yeni sürüm deploy)
```bash
git pull
docker compose -f docker-compose.selfhost.yml --env-file .env.selfhost up -d --build
```
Migration'lar başlangıçta otomatik uygulanır.

## Notlar
- RESEND_API_KEY boşsa OTP kodları `logs app` çıktısına yazılır (test için yeterli).
- `.env.selfhost` içindeki `AI_API_KEY` / `CRON_SECRET` ancak `docker-compose.selfhost.yml`
  `environment:` bloğunda listelenirse konteynere girer. Anahtarı ekledikten sonra
  rebuild gerekmez, konteyneri yenilemek yeter:
  `docker compose -f docker-compose.selfhost.yml --env-file .env.selfhost up -d --force-recreate`
- Konteynerde anahtarın göründüğünü doğrula:
  `docker compose -f docker-compose.selfhost.yml --env-file .env.selfhost exec app printenv AI_API_KEY`
- Google girişi için Google Console'a redirect URI ekle:
  `https://DOMAIN/api/auth/callback/google`
- Yedek: `pgdata` ve `minio-data` volume'ları. Dump almak için:
  `docker compose ... exec postgres pg_dump -U postgres postgres > yedek.sql`
- Kategori/demo verisi istersen `scripts/` altındaki seed scriptleri lokalden,
  DATABASE_URL'i geçici public port/SSH tüneliyle vererek çalıştırılabilir.
