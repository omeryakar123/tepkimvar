#!/usr/bin/env node
/**
 * Coolify uygulamasına MinIO/S3 ortam değişkenlerini yazar.
 *
 * Kullanım (.env.selfhost veya env'den):
 *   COOLIFY_TOKEN='1|...' node scripts/coolify-set-s3-env.mjs
 *
 * MinIO stack (docker-compose.minio.yml) deploy edilmiş ve app aynı
 * Docker ağına (tepkimvar-internal) bağlı olmalı.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const TOKEN = process.env.COOLIFY_TOKEN;
const APP = process.env.COOLIFY_APP_UUID || "xqqcmqdtdbpqcieqafypp28o";
const BASE = (process.env.COOLIFY_URL || "http://131.123.39.95:8000").replace(/\/$/, "") + "/api/v1";

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

async function main() {
  if (!TOKEN) {
    console.error("COOLIFY_TOKEN tanımlı değil");
    process.exit(1);
  }

  const sh = loadSelfhost();
  const user = sh.MINIO_ROOT_USER || process.env.MINIO_ROOT_USER || "tepkimvar";
  const pass = sh.MINIO_ROOT_PASSWORD || process.env.MINIO_ROOT_PASSWORD;
  if (!pass) {
    console.error("MINIO_ROOT_PASSWORD (.env.selfhost veya env) tanımlı değil");
    process.exit(1);
  }

  const endpoint = process.env.S3_ENDPOINT || "http://minio:9000";
  const vars = [
    { key: "S3_ENDPOINT", value: endpoint, is_literal: true, is_runtime: true },
    { key: "S3_ACCESS_KEY_ID", value: user, is_literal: true, is_runtime: true },
    { key: "S3_SECRET_ACCESS_KEY", value: pass, is_literal: true, is_runtime: true },
    { key: "S3_BUCKET", value: "itirazvar", is_literal: true, is_runtime: true },
    { key: "S3_REGION", value: "us-east-1", is_literal: true, is_runtime: true },
    { key: "STORAGE_BACKEND", value: "s3", is_literal: true, is_runtime: true },
  ];

  await api(`/applications/${APP}/envs/bulk`, {
    method: "PATCH",
    body: JSON.stringify({ data: vars }),
  });

  console.log("S3 env güncellendi. Uygulamayı yeniden başlatın (Restart).");
  console.log(`  S3_ENDPOINT=${endpoint}`);
  console.log(`  S3_ACCESS_KEY_ID=${user}`);
  console.log("  MinIO stack deploy + app → tepkimvar-internal ağına bağlı olmalı.");
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
