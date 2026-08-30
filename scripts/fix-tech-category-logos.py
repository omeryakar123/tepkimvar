#!/usr/bin/env python3
"""
Elektronik + Bilişim/Teknoloji kategorilerindeki marka logolarını düzeltir.
Kırık gstatic / superbonus URL'lerini çalışan favicon kaynaklarıyla değiştirir.

  DATABASE_URL=... python3 scripts/fix-tech-category-logos.py
"""
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

CTX = ssl.create_default_context()
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126 Safari/537.36"
MIN_BYTES = 450

# Bilinen slug → gerçek favicon domain (DNS çözülmeyen / farklı marka domaini)
DOMAIN_OVERRIDES = {
    "meritking": ["meritkinggiris.com", "mrking.com"],
    "mrking": ["mrking.com"],
    "mostbet": ["mostbet.com"],
    "1xbet": ["1xbet.com"],
    "21-com": ["21.com"],
    "arcelik": ["arcelik.com.tr", "arcelik.com"],
    "playbet": ["playbet.io", "playbet.com"],
    "grandpashabet": ["grandpashabet.com"],
    "sans-casino": ["sanscasino.com"],
    "lord-palace-casino": ["lordpalacecasino.com"],
    "istanbulbahis": ["istanbulbahis.com"],
    "jojobet": ["jojobet.com"],
    "matbet": ["matbet.com"],
    "mavibet": ["mavibet.com"],
    "holiganbet": ["holiganbet.com"],
    "casibom": ["casibom.com"],
    "marsbahis": ["marsbahis.com"],
    "stake": ["stake.com"],
}

GSTATIC_BAD = "t3.gstatic.com/faviconV2"
SUPERBONUS = "superbonus14.pro/clients/logo"
UNAVATAR = "unavatar.io"


def domain_from_website(website, slug):
    if website:
        d = re.sub(r"^https?://", "", website.strip().lower())
        d = re.sub(r"^www\.", "", d).split("/")[0].split("?")[0]
        if "." in d:
            return d
    return f"{slug}.com"


def fetch(url, timeout=12):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=timeout, context=CTX) as r:
            data = r.read(80_000)
            ct = (r.headers.get("content-type") or "").lower()
            if r.status != 200:
                return None
            if "image" not in ct and not url.endswith(".ico"):
                return None
            return data if len(data) >= MIN_BYTES else None
    except Exception:
        return None


def logo_candidates(dom):
    enc = urllib.parse.quote(f"https://{dom}", safe="")
    return [
        f"https://www.google.com/s2/favicons?domain={dom}&sz=128",
        f"https://icons.duckduckgo.com/ip3/{dom}.ico",
        f"https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&size=256&url={enc}",
        f"https://www.google.com/s2/favicons?domain={dom}&sz=256",
    ]


def monogram(name):
    q = urllib.parse.quote(name)
    return (
        f"https://ui-avatars.com/api/?name={q}&size=128"
        f"&background=1B263B&color=fff&bold=true&length=2&format=png"
    )


def is_stored_broken(logo):
    if not logo or not logo.strip():
        return True
    u = logo.lower()
    if SUPERBONUS in u or GSTATIC_BAD in u or UNAVATAR in u:
        return True
    if "ui-avatars.com" in u or "logo.clearbit.com" in u:
        return True
    return fetch(logo) is None


def best_logo_url(slug, name, website):
    primary = domain_from_website(website, slug)
    domains: list[str] = []
    for d in DOMAIN_OVERRIDES.get(slug, []) + [primary, f"{slug}.com"]:
        if d not in domains:
            domains.append(d)

    best_size = 0
    best_url = ""
    for dom in domains:
        for cand in logo_candidates(dom):
            data = fetch(cand)
            if data and len(data) > best_size:
                best_size = len(data)
                best_url = cand

    if best_url:
        return best_url, f"ok({best_size}b)"
    return monogram(name), "monogram"


conn = psycopg2.connect(URL)
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
cur.execute(
    """
    SELECT b.id, b.slug, b.name, b.website, b.logo_url, c.slug AS cat
    FROM brands b
    JOIN categories c ON c.id = b.category_id
    WHERE c.slug IN ('elektronik', 'bilisim-teknoloji', 'beyaz-esya-elektronik', 'telekomunikasyon')
    ORDER BY c.slug, b.slug
    """
)
rows = cur.fetchall()
print(f"Toplam marka: {len(rows)}")

to_fix = [r for r in rows if is_stored_broken(r["logo_url"])]
print(f"Düzeltilecek: {len(to_fix)}")

updated = 0
stats = {}

with ThreadPoolExecutor(max_workers=8) as pool:
    futures = {
        pool.submit(best_logo_url, r["slug"], r["name"], r["website"]): r for r in to_fix
    }
    for fut in as_completed(futures):
        row = futures[fut]
        new_url, src = fut.result()
        if new_url == (row["logo_url"] or "").strip():
            continue
        cur.execute(
            "UPDATE brands SET logo_url = %s, updated_at = now() WHERE id = %s",
            (new_url, row["id"]),
        )
        updated += 1
        stats[src.split("(")[0]] = stats.get(src.split("(")[0], 0) + 1
        if updated <= 15 or updated % 25 == 0:
            print(f"  {row['slug']:22} → {src}")

conn.commit()
print(f"\nGüncellendi: {updated} marka | kaynak: {stats}")
cur.close()
conn.close()
