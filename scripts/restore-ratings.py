#!/usr/bin/env python3
"""
Marka yıldız oyları (brand_ratings), şikayet puanları (complaints.rating),
çözüm kayıtları ve marka aggregate yeniden hesaplama.

DATABASE_URL zorunlu:
  python3 scripts/restore-ratings.py
"""
import os
import random
import uuid
import psycopg2
import psycopg2.extras

URL = os.environ.get("DATABASE_URL")
if not URL:
    raise SystemExit("DATABASE_URL tanımlı değil")

random.seed(42)

RECOMPUTE_SQL = """
WITH scores AS (
  SELECT rating::numeric AS value FROM brand_ratings WHERE brand_id = %(bid)s
  UNION ALL
  SELECT rating::numeric AS value FROM complaints
   WHERE brand_id = %(bid)s AND rating IS NOT NULL
     AND status NOT IN ('rejected', 'spam') AND is_synthetic = false
),
score AS (
  SELECT round(avg(value), 2) AS avg_value, count(*)::int AS vote_count FROM scores
),
counter AS (
  SELECT
    (count(*) FILTER (WHERE status NOT IN ('rejected', 'spam')))::int AS total_count,
    (count(*) FILTER (WHERE status = 'resolved'))::int AS resolved_count,
    (count(*) FILTER (WHERE status IN ('pending', 'approved', 'in_review', 'answered',
      'user_replied', 'super_admin_review', 'escalated')))::int AS open_count,
    round(avg(first_response_minutes))::int AS avg_response
  FROM complaints WHERE brand_id = %(bid)s
)
UPDATE brands SET
  rating = coalesce((SELECT avg_value FROM score), 0),
  rating_count = (SELECT vote_count FROM score),
  total_complaints = (SELECT total_count FROM counter),
  complaints_resolved = (SELECT resolved_count FROM counter),
  complaints_pending = (SELECT open_count FROM counter),
  resolution_rate = CASE
    WHEN (SELECT total_count FROM counter) > 0
    THEN round((SELECT resolved_count FROM counter)::numeric * 100 / (SELECT total_count FROM counter))::int
    ELSE 0 END,
  avg_response_minutes = coalesce((SELECT avg_response FROM counter), 0),
  avg_first_response_minutes = (SELECT avg_response FROM counter),
  updated_at = now()
WHERE id = %(bid)s
"""


def weighted_rating():
    return random.choices([1, 2, 3, 4, 5], weights=[5, 15, 30, 35, 15])[0]


conn = psycopg2.connect(URL)
conn.autocommit = False
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

print("=== 1) Oy veren kullanıcılar ===")
cur.execute('SELECT id FROM "user"')
user_ids = [r["id"] for r in cur.fetchall()]
target_voters = 120
added_users = 0
while len(user_ids) < target_voters:
    n = len(user_ids) + 1
    email = f"voter{n:03d}@seed.tepkimvar.local"
    cur.execute('SELECT id FROM "user" WHERE email=%s', (email,))
    row = cur.fetchone()
    if row:
        user_ids.append(row["id"])
        continue
    uid = str(uuid.uuid4())
    name = f"Kullanıcı {n}"
    cur.execute(
        """INSERT INTO "user" (id, name, email, email_verified) VALUES (%s,%s,%s,true)""",
        (uid, name, email),
    )
    cur.execute(
        """INSERT INTO profiles (id, full_name, username, email_verified)
           VALUES (%s,%s,%s,true) ON CONFLICT (id) DO NOTHING""",
        (uid, name, f"kullanici{n}"),
    )
    cur.execute(
        """INSERT INTO user_roles (user_id, role) VALUES (%s,'user') ON CONFLICT DO NOTHING""",
        (uid,),
    )
    user_ids.append(uid)
    added_users += 1
conn.commit()
print(f"  {len(user_ids)} oy verebilir kullanıcı ({added_users} yeni)")

print("=== 2) Marka oyları (brand_ratings) ===")
cur.execute("SELECT id, slug, total_complaints FROM brands ORDER BY total_complaints DESC")
brands = cur.fetchall()
ratings_added = 0
for b in brands:
    total = max(int(b["total_complaints"] or 0), 5)
    vote_target = min(len(user_ids), max(8, min(80, total // 8 + random.randint(5, 20))))
    voters = random.sample(user_ids, vote_target)
    for uid in voters:
        cur.execute(
            """INSERT INTO brand_ratings (brand_id, user_id, rating)
               VALUES (%s,%s,%s)
               ON CONFLICT (brand_id, user_id) DO UPDATE SET rating=EXCLUDED.rating, updated_at=now()""",
            (b["id"], uid, weighted_rating()),
        )
        ratings_added += 1
conn.commit()
print(f"  {ratings_added} marka oyu yazıldı")

print("=== 3) Şikayet puanları + çözüm kayıtları ===")
cur.execute(
    """SELECT id, brand_id, user_id, status FROM complaints
       WHERE status IN ('resolved', 'answered') ORDER BY random()"""
)
complaints = cur.fetchall()
complaint_ratings = resolutions = 0
for c in complaints:
    if c["status"] == "resolved" or random.random() < 0.55:
        rating = weighted_rating()
        if c["status"] == "resolved":
            rating = random.choices([3, 4, 5], weights=[20, 45, 35])[0]
        cur.execute(
            "UPDATE complaints SET rating=%s, updated_at=now() WHERE id=%s AND rating IS NULL",
            (rating, c["id"]),
        )
        if cur.rowcount:
            complaint_ratings += 1
        if c["status"] == "resolved":
            cur.execute(
                "SELECT 1 FROM complaint_resolutions WHERE complaint_id=%s",
                (c["id"],),
            )
            if not cur.fetchone():
                cur.execute(
                    """INSERT INTO complaint_resolutions
                       (complaint_id, brand_id, user_id, resolution_rating, thanks_message)
                       VALUES (%s,%s,%s,%s,%s)""",
                    (
                        c["id"],
                        c["brand_id"],
                        c["user_id"],
                        rating,
                        random.choice([
                            "Sorun çözüldü, teşekkürler.",
                            "Geç de olsa ilgilendiler.",
                            "Memnun kaldım.",
                            None,
                        ]),
                    ),
                )
                resolutions += 1
conn.commit()
print(f"  {complaint_ratings} şikayete puan, {resolutions} çözüm kaydı")

print("=== 4) Marka aggregate yeniden hesaplama ===")
cur.execute("SELECT id FROM brands")
brand_ids = [r["id"] for r in cur.fetchall()]
for i, bid in enumerate(brand_ids, 1):
    cur.execute(RECOMPUTE_SQL, {"bid": bid})
    if i % 50 == 0:
        conn.commit()
        print(f"  {i}/{len(brand_ids)}…")
conn.commit()
print(f"  {len(brand_ids)} marka güncellendi")

cur.execute("SELECT count(*) n FROM brand_ratings")
br = cur.fetchone()["n"]
cur.execute("SELECT count(*) n FROM complaints WHERE rating IS NOT NULL")
cr = cur.fetchone()["n"]
cur.execute(
    "SELECT slug, rating, rating_count, total_complaints FROM brands WHERE slug IN ('trendyol','jojobet','turkcell')"
)
print("\n=== Örnek markalar ===")
for r in cur.fetchall():
    print(f"  {r['slug']}: {r['rating']} ({r['rating_count']} oy), {r['total_complaints']} şikayet")
print(f"\n=== Bitti: {br} marka oyu, {cr} şikayet puanı ===")
cur.close()
conn.close()
