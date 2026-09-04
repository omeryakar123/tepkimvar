#!/usr/bin/env node
/**
 * Coolify uygulamasına Sempico SMS ortam değişkenlerini yazar.
 *
 * Kullanım (.env.selfhost değerlerini okur):
 *   COOLIFY_TOKEN='1|...' node scripts/coolify-set-sms-env.mjs
 *   COOLIFY_TOKEN='1|...' node scripts/coolify-set-sms-env.mjs --restart
 *
 * Ortam değişkenleri ile override:
 *   SMS_API_URL, SMS_API_TOKEN, SMS_API_KEY, SMS_FROM, SMS_SENDER_ID
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const TOKEN = process.env.COOLIFY_TOKEN;
const APP = process.env.COOLIFY_APP_UUID || "xqqcmqdtdbpqcieqafypp28o";
const BASE = (process.env.COOLIFY_URL || "http://131.123.39.95:8000").replace(/\/$/, "") + "/api/v1";
const RESTART = process.argv.includes("--restart");
const DEPLOY = process.argv.includes("--deploy");

function loadSelfhost() {
  const p = resolve(__dir, "../.env.selfhost");
  if (!existsSync(p)) return {};
  const out = {};
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

function pick(key, sh, fallback = "") {
  return (process.env[key] ?? sh[key] ?? fallback).trim();
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

function env(key, value) {
  return { key, value, is_literal: true, is_runtime: true, is_buildtime: false };
}

async function main() {
  if (!TOKEN) {
    console.error("COOLIFY_TOKEN tanımlı değil");
    process.exit(1);
  }

  const sh = loadSelfhost();
  const apiUrl = pick("SMS_API_URL", sh, "https://restapi.sempico.solutions");
  const apiToken = pick("SMS_API_TOKEN", sh) || pick("SMS_API_KEY", sh);
  const apiKey = pick("SMS_API_KEY", sh) || apiToken;
  const from = pick("SMS_FROM", sh, "VSMS");
  const senderId = pick("SMS_SENDER_ID", sh);

  if (!apiToken) {
    console.error("SMS_API_TOKEN veya SMS_API_KEY (.env.selfhost veya env) tanımlı değil");
    process.exit(1);
  }

  const vars = [
    env("SMS_API_URL", apiUrl),
    env("SMS_API_TOKEN", apiToken),
    env("SMS_API_KEY", apiKey),
    env("SMS_FROM", from),
  ];
  if (senderId) vars.push(env("SMS_SENDER_ID", senderId));

  console.log(`SMS env güncelleniyor (${vars.length} değişken)...`);
  console.log(`  SMS_API_URL=${apiUrl}`);
  console.log(`  SMS_FROM=${from}`);
  console.log(`  SMS_API_TOKEN=***${apiToken.slice(-4)}`);

  await api(`/applications/${APP}/envs/bulk`, {
    method: "PATCH",
    body: JSON.stringify({ data: vars }),
  });

  console.log("Güncellendi:", vars.map((v) => v.key).join(", "));

  if (DEPLOY) {
    console.log("\nDeploy tetikleniyor (sms.ts kod güncellemesi için)...");
    const out = await api("/deploy", {
      method: "POST",
      body: JSON.stringify({ uuid: APP, force: true }),
    });
    console.log("Deploy:", out);
    return;
  }

  if (RESTART) {
    console.log("\nUygulama yeniden başlatılıyor...");
    try {
      const out = await api(`/applications/${APP}/restart`, { method: "POST" });
      console.log("Restart:", out);
    } catch (e) {
      console.warn("Restart API başarısız — Coolify UI'dan Restart yapın.");
      console.warn(String(e.message || e));
    }
  } else {
    console.log("\nRuntime env aktif olması için:");
    console.log("  node scripts/coolify-set-sms-env.mjs --restart");
    console.log("Kod güncellemesi (sms.ts) için git push sonrası:");
    console.log("  node scripts/coolify-set-sms-env.mjs --deploy");
  }
}

main().catch((e) => {
  console.error(e.message);
  if (String(e.message).includes("403")) {
    console.error("\nCoolify API kapalı veya IP engelli:");
    console.error("  Settings → Advanced → API Access: AÇ");
    console.error("  Security → API Tokens → Update Envs + Deploy yetkisi");
  }
  process.exit(1);
});
