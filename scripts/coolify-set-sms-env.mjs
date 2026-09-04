#!/usr/bin/env node
/**
 * Coolify uygulamasına Sempico SMS ortam değişkenlerini yazar (upsert + duplicate temizliği).
 *
 * Kullanım (.env.selfhost değerlerini okur):
 *   COOLIFY_TOKEN='1|...' node scripts/coolify-set-sms-env.mjs
 *   COOLIFY_TOKEN='1|...' node scripts/coolify-set-sms-env.mjs --restart
 *   COOLIFY_TOKEN='1|...' node scripts/coolify-set-sms-env.mjs --deploy
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

const SMS_KEYS = ["SMS_API_URL", "SMS_API_TOKEN", "SMS_API_KEY", "SMS_FROM", "SMS_SENDER_ID"];

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

function envEntry(key, value, uuid) {
  const row = {
    key,
    value,
    is_literal: true,
    is_runtime: true,
    is_buildtime: false,
  };
  if (uuid) row.uuid = uuid;
  return row;
}

async function main() {
  if (!TOKEN) {
    console.error("COOLIFY_TOKEN tanımlı değil");
    process.exit(1);
  }

  const sh = loadSelfhost();
  const values = {
    SMS_API_URL: pick("SMS_API_URL", sh, "https://restapi.sempico.solutions"),
    SMS_API_TOKEN: pick("SMS_API_TOKEN", sh) || pick("SMS_API_KEY", sh),
    SMS_API_KEY: pick("SMS_API_KEY", sh) || pick("SMS_API_TOKEN", sh),
    SMS_FROM: pick("SMS_FROM", sh, "VSMS"),
    SMS_SENDER_ID: pick("SMS_SENDER_ID", sh),
  };

  if (!values.SMS_API_TOKEN) {
    console.error("SMS_API_TOKEN veya SMS_API_KEY (.env.selfhost veya env) tanımlı değil");
    process.exit(1);
  }

  const existing = await api(`/applications/${APP}/envs`);
  const byKey = new Map();
  for (const row of existing) {
    if (!SMS_KEYS.includes(row.key)) continue;
    if (!byKey.has(row.key)) byKey.set(row.key, []);
    byKey.get(row.key).push(row);
  }

  const duplicateUuids = [];
  for (const [, rows] of byKey) {
    rows.slice(1).forEach((r) => duplicateUuids.push(r.uuid));
  }

  if (duplicateUuids.length) {
    console.log(`${duplicateUuids.length} yinelenen SMS env siliniyor...`);
    for (const uuid of duplicateUuids) {
      try {
        await api(`/applications/${APP}/envs/${uuid}`, { method: "DELETE" });
      } catch (e) {
        console.warn(`  Silinemedi ${uuid}:`, e.message);
      }
    }
  }

  const vars = [];
  for (const key of SMS_KEYS) {
    const val = values[key];
    if (!val) continue;
    const keep = byKey.get(key)?.[0];
    vars.push(envEntry(key, val, keep?.uuid));
  }

  console.log(`SMS env güncelleniyor (${vars.length} değişken)...`);
  console.log(`  SMS_API_URL=${values.SMS_API_URL}`);
  console.log(`  SMS_FROM=${values.SMS_FROM}`);
  console.log(`  SMS_API_TOKEN=***${values.SMS_API_TOKEN.slice(-4)}`);

  await api(`/applications/${APP}/envs/bulk`, {
    method: "PATCH",
    body: JSON.stringify({ data: vars }),
  });

  console.log("Güncellendi:", vars.map((v) => v.key).join(", "));

  if (DEPLOY) {
    console.log("\nDeploy tetikleniyor...");
    const out = await api("/deploy", { method: "POST", body: JSON.stringify({ uuid: APP, force: true }) });
    console.log("Deploy:", out);
    return;
  }

  if (RESTART) {
    console.log("\nUygulama yeniden başlatılıyor...");
    try {
      const out = await api(`/applications/${APP}/restart`, { method: "POST" });
      console.log("Restart:", out);
    } catch (e) {
      console.warn("Restart API yetkisi yok — Coolify UI → tepkimvar → Restart");
      console.warn(String(e.message || e));
    }
  } else {
    console.log("\nEnv aktif olması için: node scripts/coolify-set-sms-env.mjs --restart");
    console.log("Kod deploy (git push sonrası): node scripts/coolify-set-sms-env.mjs --deploy");
  }
}

main().catch((e) => {
  console.error(e.message);
  if (String(e.message).includes("403")) {
    console.error("\nToken yetkisi yetersiz. Coolify → API Tokens → 'Update Environments' + 'Deploy' işaretleyin.");
  }
  process.exit(1);
});
