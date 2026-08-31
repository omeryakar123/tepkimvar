#!/usr/bin/env node
/**
 * Coolify uygulamasına OAuth runtime + build env'lerini yazar ve isteğe bağlı deploy tetikler.
 *
 * Kullanım:
 *   COOLIFY_TOKEN='1|...' node scripts/coolify-set-oauth-env.mjs
 *   COOLIFY_TOKEN='1|...' node scripts/coolify-set-oauth-env.mjs --deploy
 *
 * OAuth credential'ları ortam değişkeni olarak ver (boş olanlar atlanır):
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
 *   FACEBOOK_CLIENT_ID, FACEBOOK_CLIENT_SECRET
 *   APPLE_CLIENT_ID, APPLE_CLIENT_SECRET, APPLE_APP_BUNDLE_IDENTIFIER (ops.)
 *
 * VITE_OAUTH_* build flag'leri her zaman true yapılır (butonlar build'e gömülür).
 * Sunucu tarafı provider yalnızca ilgili CLIENT_ID/SECRET doluysa aktif olur.
 */
const TOKEN = process.env.COOLIFY_TOKEN;
const APP = process.env.COOLIFY_APP_UUID || "xqqcmqdtdbpqcieqafypp28o";
const BASE = (process.env.COOLIFY_URL || "http://131.123.39.95:8000").replace(/\/$/, "") + "/api/v1";
const DEPLOY = process.argv.includes("--deploy");

if (!TOKEN) {
  console.error("COOLIFY_TOKEN tanımlı değil");
  process.exit(1);
}

async function api(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: "application/json",
      ...(opts.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  if (!res.ok) {
    throw new Error(`${opts.method || "GET"} ${path} -> ${res.status}: ${String(JSON.stringify(data)).slice(0, 400)}`);
  }
  return data;
}

function env(key, value, { build = false, runtime = true } = {}) {
  return {
    key,
    value,
    is_literal: true,
    is_runtime: runtime,
    is_buildtime: build,
  };
}

function optionalRuntime(key) {
  const v = process.env[key]?.trim();
  if (!v) return null;
  return env(key, v, { build: false, runtime: true });
}

async function main() {
  const vars = [
    // Build-time: OAuth butonları bundle'a gömülür (redeploy gerekir)
    env("VITE_OAUTH_GOOGLE", "true", { build: true, runtime: false }),
    env("VITE_OAUTH_FACEBOOK", "true", { build: true, runtime: false }),
    env("VITE_OAUTH_APPLE", "true", { build: true, runtime: false }),
    env("VITE_GOOGLE_ENABLED", "true", { build: true, runtime: false }),
    env("VITE_SITE_URL", "https://tepkimvar.com", { build: true, runtime: false }),
  ];

  for (const key of [
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "FACEBOOK_CLIENT_ID",
    "FACEBOOK_CLIENT_SECRET",
    "APPLE_CLIENT_ID",
    "APPLE_CLIENT_SECRET",
    "APPLE_APP_BUNDLE_IDENTIFIER",
  ]) {
    const e = optionalRuntime(key);
    if (e) vars.push(e);
  }

  console.log(`OAuth env güncelleniyor (${vars.length} değişken)...`);
  await api(`/applications/${APP}/envs/bulk`, {
    method: "PATCH",
    body: JSON.stringify({ data: vars }),
  });

  const setKeys = vars.map((v) => v.key);
  console.log("Güncellendi:", setKeys.join(", "));

  const missing = [
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "FACEBOOK_CLIENT_ID",
    "FACEBOOK_CLIENT_SECRET",
    "APPLE_CLIENT_ID",
    "APPLE_CLIENT_SECRET",
  ].filter((k) => !process.env[k]?.trim());
  if (missing.length) {
    console.warn("\nUyarı — runtime credential eksik (buton görünür, giriş çalışmaz):");
    console.warn("  " + missing.join(", "));
    console.warn("  Coolify UI'dan veya env ile tekrar çalıştırın.");
  }

  if (DEPLOY) {
    console.log("\nDeploy tetikleniyor...");
    const out = await api("/deploy", {
      method: "POST",
      body: JSON.stringify({ uuid: APP, force: true }),
    });
    console.log("Deploy:", out);
  } else {
    console.log("\nVITE_* değişti — rebuild için: node scripts/coolify-set-oauth-env.mjs --deploy");
  }
}

main().catch((e) => {
  console.error(e.message);
  if (e.message.includes("403")) {
    console.error("\nCoolify API kapalı veya IP engelli. Şunları yapın:");
    console.error("  Settings → Configuration → Advanced → API Access: AÇ");
    console.error("  Allowed IPs: boş bırakın veya 0.0.0.0");
    console.error("  Security → API Tokens → yeni token (Update Envs + Deploy yetkisi)");
  }
  process.exit(1);
});
