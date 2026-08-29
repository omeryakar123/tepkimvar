#!/usr/bin/env node
/**
 * Coolify deploy yardımcısı.
 * Kullanım:
 *   COOLIFY_TOKEN='1|...' node scripts/coolify-deploy.mjs
 *
 * Token'da `deploy` yetkisi olmalı (Coolify → Keys & Tokens).
 * Yetki yoksa GitHub push ile auto-deploy tetiklenir (repo ayarı açıksa).
 */
const TOKEN = process.env.COOLIFY_TOKEN;
const APP = process.env.COOLIFY_APP_UUID || "xqqcmqdtdbpqcieqafypp28o";
const BASE = (process.env.COOLIFY_URL || "http://131.123.39.95:8000").replace(/\/$/, "") + "/api/v1";

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
      ...opts.headers,
    },
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  if (!res.ok) throw new Error(`${opts.method || "GET"} ${path} -> ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
  return data;
}

async function main() {
  const app = await api(`/applications/${APP}`);
  console.log(`App: ${app.name} | status: ${app.status} | branch: ${app.git_branch}`);

  try {
    const out = await api("/deploy", {
      method: "POST",
      body: JSON.stringify({ uuid: APP, force: true }),
    });
    console.log("Deploy tetiklendi:", out);
    return;
  } catch (e) {
    console.warn("Deploy API başarısız:", e.message);
  }

  // Fallback: runtime env bump (restart gerekebilir)
  await api(`/applications/${APP}/envs/bulk`, {
    method: "PATCH",
    body: JSON.stringify({
      data: [{ key: "DEPLOY_STAMP", value: String(Date.now()), is_literal: true, is_runtime: true }],
    }),
  });
  console.log("DEPLOY_STAMP güncellendi. Token'a deploy yetkisi verip tekrar deneyin veya GitHub push yapın.");
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
