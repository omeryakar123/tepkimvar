#!/usr/bin/env python3
"""
Tüm markaların logo_url alanını tarar; eksik, kırık veya monogram logoları düzeltir.

  DATABASE_URL=... python3 scripts/fix-all-brand-logos.py
  DATABASE_URL=... python3 scripts/fix-all-brand-logos.py --dry-run
  DATABASE_URL=... python3 scripts/fix-all-brand-logos.py --retry-monograms
"""
from __future__ import annotations

import argparse
import os
import re
import ssl
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

URL = os.environ.get("DATABASE_URL")
if not URL:
    raise SystemExit("DATABASE_URL tanımlı değil")

import psycopg2
import psycopg2.extras

SITE_ORIGIN = os.environ.get("SITE_URL", "https://tepkimvar.com").rstrip("/")
CTX = ssl.create_default_context()
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126 Safari/537.36"
MIN_BYTES = 200

GAMBLING_RE = re.compile(r"bet|bahis|casino|slot|poker|rulet|kumar|gambling|win|oyna", re.I)

DOMAIN_OVERRIDES: dict[str, list[str]] = {
    "meritking": ["mrking.com", "meritkinggiris.com"],
    "mrking": ["mrking.com"],
    "mostbet": ["mostbet.com"],
    "1xbet": ["1xbet.com"],
    "arcelik": ["arcelik.com.tr", "arcelik.com"],
    "playbet": ["playbet.io", "playbet.com"],
    "trendyol": ["trendyol.com"],
    "hepsiburada": ["hepsiburada.com"],
    "turkcell": ["turkcell.com.tr"],
    "vodafone": ["vodafone.com.tr"],
    "turk-telekom": ["turktelekom.com.tr"],
    "migros": ["migros.com.tr"],
    "bim": ["bim.com.tr"],
    "a101": ["a101.com.tr"],
    "sok": ["sokmarket.com.tr"],
    "getir": ["getir.com"],
    "yemeksepeti": ["yemeksepeti.com"],
    "papara": ["papara.com"],
    "n11": ["n11.com"],
    "gittigidiyor": ["gittigidiyor.com"],
    "sahibinden": ["sahibinden.com"],
    "pegasus": ["flypgs.com", "pegasus.com"],
    "thy": ["turkishairlines.com"],
    "anadolu-jet": ["anadolujet.com"],
    "casifix": ["casifixgirisi.com", "casifix.com"],
    "casival": ["casivalgiris.com", "casival.com"],
    "meritqueen": ["meritqueengiris.com", "meritqueen.com"],
    "bovbet": ["bovbet.com"],
    "exobet": ["exobet.org", "exobetgiris.com", "exobet.com"],
    "etrobet": ["etrobet.org", "etrobetgiris.com", "etrobet.com"],
    "huhubeet": ["huhubet.com", "huhubetgiris.com"],
    "meritliman": ["meritlimanbet.com", "meritlimangiris.com", "meritliman.com"],
    "meybet": ["meybetgir.com", "meybetgiris.com", "meybet.com"],
    "mobiloyna": ["mobiloynatr.com", "mobiloynagiris.com", "mobiloyna.com"],
    "tekelbet": ["tekelbet.net", "tekelbet.com"],
}

BAD_PATTERNS = (
    "ui-avatars.com",
    "superbonus14.pro/clients/logo",
    "unavatar.io",
    "logo.clearbit.com",
    "clearbit.com",
    "via.placeholder",
    "placeholder.com",
    "googleusercontent.com/a/default",
    "porkbun-logo",
)


def domain_from_website(website: str | None, slug: str) -> str | None:
    if website:
        d = re.sub(r"^https?://", "", website.strip().lower())
        d = re.sub(r"^www\.", "", d).split("/")[0].split("?")[0]
        if "." in d:
            return d
    return None


def fetch(url: str, timeout: int = 12) -> bytes | None:
    try:
        req_url = url
        if req_url.startswith("/"):
            req_url = f"{SITE_ORIGIN}{req_url}"
        req = urllib.request.Request(req_url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=timeout, context=CTX) as r:
            data = r.read(120_000)
            ct = (r.headers.get("content-type") or "").lower()
            if r.status != 200:
                return None
            if "image" not in ct and not req_url.endswith((".ico", ".png", ".jpg", ".jpeg", ".webp")):
                return None
            if any(b in req_url.lower() for b in ("porkbun-logo",)):
                return None
            return data if len(data) >= MIN_BYTES else None
    except Exception:
        return None


def scrape_page_assets(domain: str) -> list[str]:
    out: list[str] = []
    for page in (f"https://{domain}", f"https://www.{domain}"):
        try:
            req = urllib.request.Request(page, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=10, context=CTX) as r:
                html = r.read(180_000).decode("utf-8", "ignore")
            for pat in (
                r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)',
                r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image',
                r'<link[^>]+rel=["\']apple-touch-icon["\'][^>]+href=["\']([^"\']+)',
                r'<link[^>]+href=["\']([^"\']+)["\'][^>]+rel=["\']apple-touch-icon',
            ):
                for m in re.finditer(pat, html, re.I):
                    u = m.group(1).strip()
                    if u.startswith("//"):
                        u = "https:" + u
                    elif u.startswith("/"):
                        u = f"https://{domain}{u}"
                    if u.startswith("http") and u not in out:
                        out.append(u)
            if out:
                break
        except Exception:
            continue
    return out


def is_obviously_bad(logo: str | None) -> bool:
    if not logo or not logo.strip():
        return True
    u = logo.lower()
    return any(p in u for p in BAD_PATTERNS)


def is_stored_broken(logo: str | None) -> bool:
    if is_obviously_bad(logo):
        return True
    return fetch(logo or "") is None


def domain_candidates(slug: str, name: str, website: str | None) -> list[str]:
    out: list[str] = []
    primary = domain_from_website(website, slug)
    base = slug.replace("_", "-")

    for d in DOMAIN_OVERRIDES.get(slug, []):
        if d not in out:
            out.append(d)

    if primary and primary not in out:
        out.append(primary)

    for tld in (".com", ".com.tr", ".net", ".org", ".io"):
        d = f"{base}{tld}"
        if d not in out:
            out.append(d)

    if GAMBLING_RE.search(slug) or GAMBLING_RE.search(name):
        for suffix in ("giris", "girisi", "gir", "bet", "casino", "tr"):
            d = f"{base}{suffix}.com"
            if d not in out:
                out.append(d)
        # yaygın yazım hataları
        if "huhubeet" in slug:
            for d in ("huhubet.com", "huhubetgiris.com"):
                if d not in out:
                    out.append(d)

    return out


def logo_candidates(dom: str) -> list[str]:
    enc = urllib.parse.quote(f"https://{dom}", safe="")
    urls = [
        f"https://www.google.com/s2/favicons?domain={dom}&sz=128",
        f"https://www.google.com/s2/favicons?domain={dom}&sz=256",
        f"https://icons.duckduckgo.com/ip3/{dom}.ico",
        f"https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&size=256&url={enc}",
        f"https://{dom}/apple-touch-icon.png",
        f"https://www.{dom}/favicon.ico",
        f"https://{dom}/favicon.ico",
    ]
    for asset in scrape_page_assets(dom):
        urls.insert(0, asset)
    return urls


def monogram(name: str) -> str:
    q = urllib.parse.quote(name)
    return (
        f"https://ui-avatars.com/api/?name={q}&size=128"
        f"&background=1B263B&color=fff&bold=true&length=2&format=png"
    )


def best_logo_url(slug: str, name: str, website: str | None) -> tuple[str, str]:
    best_size = 0
    best_url = ""
    for dom in domain_candidates(slug, name, website):
        for cand in logo_candidates(dom):
            data = fetch(cand)
            if data and len(data) > best_size:
                best_size = len(data)
                best_url = cand

    if best_url:
        return best_url, f"ok({best_size}b)"
    return monogram(name), "monogram"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="DB güncelleme yapma")
    parser.add_argument("--retry-monograms", action="store_true", help="Monogram olanları zorla yeniden dene")
    parser.add_argument("--workers", type=int, default=10)
    args = parser.parse_args()

    conn = psycopg2.connect(URL)
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute(
        """
        SELECT b.id, b.slug, b.name, b.website, b.logo_url, c.slug AS cat
        FROM brands b
        LEFT JOIN categories c ON c.id = b.category_id
        ORDER BY b.slug
        """
    )
    rows = cur.fetchall()
    print(f"Toplam marka: {len(rows)}")

    print("Mevcut logolar doğrulanıyor…")
    to_fix: list[dict] = []
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futs = {pool.submit(is_stored_broken, r["logo_url"]): r for r in rows}
        for fut in as_completed(futs):
            row = futs[fut]
            if fut.result():
                to_fix.append(row)

    if args.retry_monograms:
        mono_slugs = {r["slug"] for r in rows if (r["logo_url"] or "").find("ui-avatars.com") >= 0}
        for r in rows:
            if r["slug"] in mono_slugs and r not in to_fix:
                to_fix.append(r)

    print(f"Düzeltilecek: {len(to_fix)}")

    updated = 0
    stats: dict[str, int] = {}
    skipped = 0

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {
            pool.submit(best_logo_url, r["slug"], r["name"], r["website"]): r for r in to_fix
        }
        for fut in as_completed(futures):
            row = futures[fut]
            new_url, src = fut.result()
            old = (row["logo_url"] or "").strip()
            # Monogram → monogram atlamayı engelle; gerçek logo bulunduysa yaz
            if new_url == old:
                skipped += 1
                continue
            if src == "monogram" and "ui-avatars.com" in old:
                skipped += 1
                continue
            tag = src.split("(")[0]
            stats[tag] = stats.get(tag, 0) + 1
            print(f"  {row['slug']:24} [{row['cat'] or '-':20}] → {src}")
            if not args.dry_run:
                cur.execute(
                    "UPDATE brands SET logo_url = %s, updated_at = now() WHERE id = %s",
                    (new_url, row["id"]),
                )
            updated += 1

    if not args.dry_run:
        conn.commit()

    print(f"\n{'Dry-run: ' if args.dry_run else ''}Güncellendi: {updated} | atlandı: {skipped} | kaynak: {stats}")

    cur.execute(
        """
        SELECT
          count(*) FILTER (WHERE logo_url LIKE '%ui-avatars.com%') AS monogram,
          count(*) FILTER (WHERE logo_url LIKE '%google.com/s2/favicons%') AS s2,
          count(*) FILTER (WHERE logo_url LIKE '%duckduckgo.com%') AS ddg,
          count(*) FILTER (WHERE logo_url LIKE '%gstatic.com%') AS gstatic,
          count(*) FILTER (WHERE logo_url LIKE '/api/files/%') AS minio,
          count(*) AS total
        FROM brands
        """
    )
    s = cur.fetchone()
    print(
        f"Son durum — toplam: {s['total']}, s2: {s['s2']}, ddg: {s['ddg']}, "
        f"gstatic: {s['gstatic']}, minio: {s['minio']}, monogram: {s['monogram']}"
    )

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
