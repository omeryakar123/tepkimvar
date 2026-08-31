import { TELEGRAM_BRAND_CHANNELS } from "../telegram-brand-channels.mjs";

const UA = { "user-agent": "Mozilla/5.0 Chrome/126 Safari/537.36" };

export { TELEGRAM_BRAND_CHANNELS };

export async function telegramPhotoUrl(channel) {
  const url = `https://t.me/${channel.replace(/^@/, "")}`;
  try {
    const r = await fetch(url, { headers: UA, redirect: "follow", signal: AbortSignal.timeout(12000) });
    if (!r.ok) return null;
    const html = await r.text();
    const m = html.match(/tgme_page_photo_image[^>]+src="([^"]+)"/i);
    if (!m) return null;
    const src = m[1].replace(/&amp;/g, "&");
    if (src.startsWith("data:")) return null;
    return src;
  } catch {
    return null;
  }
}

export async function fetchTelegramLogo(slug, minBytes = 1000) {
  const channel = TELEGRAM_BRAND_CHANNELS[slug];
  if (!channel) return null;
  const photoUrl = await telegramPhotoUrl(channel);
  if (!photoUrl) return null;
  try {
    const r = await fetch(photoUrl, { headers: UA, redirect: "follow", signal: AbortSignal.timeout(15000) });
    if (!r.ok) return null;
    const ct = (r.headers.get("content-type") ?? "").toLowerCase();
    if (!ct.includes("image")) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < minBytes) return null;
    return {
      buf,
      type: ct.split(";")[0] || "image/jpeg",
      size: buf.length,
      url: photoUrl,
      src: "telegram",
      channel,
    };
  } catch {
    return null;
  }
}
