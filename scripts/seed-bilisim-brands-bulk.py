#!/usr/bin/env python3
"""
Bilişim teknoloji kategorisine toplu marka ekler + logo taraması tetikler.

  DATABASE_URL=... python3 scripts/seed-bilisim-brands-bulk.py
"""
from __future__ import annotations

import os
import random
import re
import ssl
import urllib.parse
import urllib.request
from pathlib import Path

URL = os.environ.get("DATABASE_URL")
if not URL:
    raise SystemExit("DATABASE_URL tanımlı değil")

import psycopg2

TR = str.maketrans("çÇğĞıİöÖşŞüÜ", "cCgGiIoOsSuU")
NAMES_FILE = Path(__file__).with_name("bilisim-brand-names.txt")

DOMAIN_OVERRIDES: dict[str, str] = {
    "21-com": "21.com",
    "1xbet": "1xbet.com",
    "mostbet": "mostbet.com",
    "grandpashabet": "grandpashabet.com",
    "playbet": "playbet.io",
    "sans-casino": "sanscasino.com",
    "lord-palace-casino": "lordpalacecasino.com",
    "istanbulbahis": "istanbulbahis.com",
    "jojobet": "jojobet.com",
    "matbet": "matbet.com",
    "mavibet": "mavibet.com",
    "holiganbet": "holiganbet.com",
}


def slugify(name: str) -> str:
    s = name.translate(TR).lower()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s or "marka"


def logo_url(name: str, slug: str) -> str:
    dom = DOMAIN_OVERRIDES.get(slug, f"{slug.replace('-', '')}.com")
    return f"https://www.google.com/s2/favicons?domain={urllib.parse.quote(dom)}&sz=128"


def load_names() -> list[str]:
    raw = NAMES_FILE.read_text(encoding="utf-8")
    out: list[str] = []
    seen_slugs: set[str] = set()
    for line in raw.splitlines():
        name = line.strip()
        if not name:
            continue
        slug = slugify(name)
        if slug in seen_slugs:
            continue
        seen_slugs.add(slug)
        out.append(name)
    return out


def main() -> None:
    names = load_names()
    conn = psycopg2.connect(URL)
    cur = conn.cursor()
    cur.execute("SELECT id FROM categories WHERE slug = %s", ("bilisim-teknoloji",))
    row = cur.fetchone()
    if not row:
        raise SystemExit("Kategori bulunamadi: bilisim-teknoloji")
    cat_id = row[0]

    added = skipped = 0
    for name in names:
        slug = slugify(name)
        cur.execute("SELECT 1 FROM brands WHERE slug = %s", (slug,))
        if cur.fetchone():
            skipped += 1
            continue
        dom = DOMAIN_OVERRIDES.get(slug, f"{slug.replace('-', '')}.com")
        website = f"https://{dom}" if not dom.startswith("http") else dom
        total = random.randint(20, 180)
        resolved_pct = random.randint(8, 35)
        resolved = round(total * resolved_pct / 100)
        rating = round(random.uniform(1.8, 3.4), 2)
        cur.execute(
            """
            INSERT INTO brands (
              slug, name, category_id, website, city, logo_url, verified, premium,
              rating, rating_count, total_complaints, complaints_resolved,
              resolution_rate, avg_response_minutes, is_active
            ) VALUES (%s,%s,%s,%s,%s,%s,false,false,%s,%s,%s,%s,%s,%s,true)
            """,
            (
                slug,
                name,
                cat_id,
                website,
                "İstanbul",
                logo_url(name, slug),
                rating,
                random.randint(8, 120),
                total,
                resolved,
                resolved_pct,
                random.randint(90, 1800),
            ),
        )
        added += 1

    conn.commit()
    cur.execute("SELECT count(*) FROM brands WHERE category_id = %s", (cat_id,))
    total_in_cat = cur.fetchone()[0]
    print(f"Eklendi: {added}, atlandi (mevcut): {skipped}, kategori toplam: {total_in_cat}")
    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
