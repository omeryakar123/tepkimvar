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

KEEP_SLUGS = ("bovbet", "kazansana")


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
        WHERE b.slug NOT IN %s
          AND (c.brand_response IS NOT NULL OR c.status = 'answered')
        """,
        (KEEP_SLUGS,),
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
        USING complaints c, brands b
        WHERE cr.complaint_id = c.id
          AND b.id = c.brand_id
          AND b.slug NOT IN %s
          AND cr.is_brand = true
        """,
        (KEEP_SLUGS,),
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
        WHERE c.brand_id = b.id
          AND b.slug NOT IN %s
          AND (c.brand_response IS NOT NULL OR c.status = 'answered')
        """,
        (KEEP_SLUGS,),
    )
    updated = cur.rowcount

    conn.commit()
    print(f"Silinen marka yanıtı (reply): {deleted_replies}")
    print(f"Güncellenen şikayet: {updated}")
    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
