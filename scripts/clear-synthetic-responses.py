#!/usr/bin/env python3
"""
Marka yanıtlarını siler — bovbet ve kazansana hariç tüm şikayetlerde
cevap kaldırılır, yalnızca şikayet metni ve yıldız kalır.

  DATABASE_URL=... python3 scripts/clear-synthetic-responses.py
  DATABASE_URL=... python3 scripts/clear-synthetic-responses.py --dry-run
"""
from __future__ import annotations

import argparse
import os
import sys

URL = os.environ.get("DATABASE_URL")
if not URL:
    sys.exit("DATABASE_URL tanımlı değil")

KEEP_SLUGS = ("bovbet", "kazansana", "bahsine")
STRIP_CATEGORIES = ("bilisim-teknoloji", "telekomunikasyon")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    import psycopg2

    conn = psycopg2.connect(URL)
    cur = conn.cursor()

    cur.execute(
        """
        SELECT c.id
        FROM complaints c
        JOIN brands b ON b.id = c.brand_id
        LEFT JOIN categories cat ON cat.id = b.category_id
        LEFT JOIN categories ccat ON ccat.id = c.category_id
        WHERE (
          COALESCE(cat.slug, ccat.slug) IN %s
          OR b.slug NOT IN %s
        )
          AND (c.brand_response IS NOT NULL OR c.status = 'answered')
        """,
        (STRIP_CATEGORIES, KEEP_SLUGS),
    )
    ids = [r[0] for r in cur.fetchall()]
    print(f"Etkilenecek şikayet: {len(ids)}")

    if not ids or args.dry_run:
        if args.dry_run:
            print("Dry-run — değişiklik yapılmadı")
        cur.close()
        conn.close()
        return

    cur.execute(
        """
        DELETE FROM complaint_replies cr
        WHERE cr.is_brand = true
          AND EXISTS (
            SELECT 1
            FROM complaints c
            JOIN brands b ON b.id = c.brand_id
            LEFT JOIN categories cat ON cat.id = b.category_id
            LEFT JOIN categories ccat ON ccat.id = c.category_id
            WHERE c.id = cr.complaint_id
              AND (
                COALESCE(cat.slug, ccat.slug) IN %s
                OR b.slug NOT IN %s
              )
          )
        """,
        (STRIP_CATEGORIES, KEEP_SLUGS),
    )
    deleted_replies = cur.rowcount

    cur.execute(
        """
        UPDATE complaints c
        SET brand_response = NULL,
            brand_response_at = NULL,
            brand_response_by = NULL,
            first_response_at = NULL,
            first_response_minutes = NULL,
            status = CASE WHEN c.status = 'answered' THEN 'approved' ELSE c.status END,
            bot_error = NULL,
            updated_at = NOW()
        FROM brands b
        LEFT JOIN categories cat ON cat.id = b.category_id
        WHERE c.brand_id = b.id
          AND (
            cat.slug IN %s
            OR b.slug NOT IN %s
            OR EXISTS (
              SELECT 1 FROM categories ccat
              WHERE ccat.id = c.category_id AND ccat.slug IN %s
            )
          )
          AND (c.brand_response IS NOT NULL OR c.status = 'answered')
        """,
        (STRIP_CATEGORIES, KEEP_SLUGS, STRIP_CATEGORIES),
    )
    updated = cur.rowcount

    conn.commit()
    print(f"Silinen marka yanıtı (reply): {deleted_replies}")
    print(f"Güncellenen şikayet: {updated}")
    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
