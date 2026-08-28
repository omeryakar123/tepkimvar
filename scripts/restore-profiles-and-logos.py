#!/usr/bin/env python3
"""
Kayıtlı kullanıcılar için eksik profilleri oluşturur / doldurur.
Marka logolarını unavatar yerine gerçek favicon (gstatic) veya monogram URL ile günceller.

DATABASE_URL zorunlu. MinIO (S3_*) varsa logolar oraya da yüklenebilir — opsiyonel.

  python3 scripts/restore-profiles-and-logos.py
"""
import os
import re
import uuid
import base64
import urllib.parse
import urllib.request
import psycopg2
import psycopg2.extras

URL = os.environ.get("DATABASE_URL")
if not URL:
    raise SystemExit("DATABASE_URL tanımlı değil")

USE_S3 = bool(os.environ.get("S3_ENDPOINT") and os.environ.get("S3_ACCESS_KEY_ID"))
BUCKET = os.environ.get("S3_BUCKET", "itirazvar")

GSTATIC = (
    "https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON"
    "&fallback_opts=TYPE,SIZE,URL&size=128&url="
)


def domain_from_website(website):
    if not website:
        return None
    s = re.sub(r"^https?://", "", website.strip().lower())
    s = re.sub(r"^www\.", "", s).split("/")[0].split("?")[0]
    return s if "." in s else None


def monogram_url(name):
    q = urllib.parse.quote(name)
    return (
        f"https://ui-avatars.com/api/?name={q}&size=128"
        f"&background=1B263B&color=fff&bold=true&length=2&format=png"
    )


def favicon_url(name, website):
    dom = domain_from_website(website)
    if dom:
        return GSTATIC + urllib.parse.quote(f"https://{dom}", safe="")
    return monogram_url(name)


def unique_username(cur, email, name):
    base = re.sub(r"[^a-z0-9_]", "", (email.split("@")[0] or "user").lower())[:24] or "user"
    candidate = base
    n = 0
    while True:
        cur.execute("SELECT 1 FROM profiles WHERE username=%s", (candidate,))
        if not cur.fetchone():
            return candidate
        n += 1
        candidate = f"{base}{n}"[:30]


conn = psycopg2.connect(URL)
conn.autocommit = False
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

print("=== 1) Kullanıcı profilleri ===")
cur.execute(
    """SELECT u.id, u.email, u.name, u.phone, u.image, u.email_verified,
              p.id AS pid, p.full_name, p.username, p.avatar_url, p.phone AS pphone
       FROM "user" u
       LEFT JOIN profiles p ON p.id = u.id
       ORDER BY u.created_at"""
)
users = cur.fetchall()
created = updated = roles_added = 0

for u in users:
    if not u["pid"]:
        uname = unique_username(cur, u["email"], u["name"] or "")
        cur.execute(
            """INSERT INTO profiles (id, full_name, username, phone, avatar_url, email_verified, city)
               VALUES (%s,%s,%s,%s,%s,%s,%s)""",
            (
                u["id"],
                u["name"] or u["email"].split("@")[0],
                uname,
                u["phone"],
                u["image"],
                True,
                "İstanbul",
            ),
        )
        created += 1
    else:
        patches = {}
        if not u["full_name"] and u["name"]:
            patches["full_name"] = u["name"]
        if not u["username"]:
            patches["username"] = unique_username(cur, u["email"], u["name"] or "")
        if not u["avatar_url"] and u["image"]:
            patches["avatar_url"] = u["image"]
        if not u["pphone"] and u["phone"]:
            patches["phone"] = u["phone"]
        if not u["email_verified"]:
            cur.execute('UPDATE "user" SET email_verified=true WHERE id=%s', (u["id"],))
        if patches:
            sets = ", ".join(f"{k}=%s" for k in patches)
            cur.execute(
                f"UPDATE profiles SET {sets}, email_verified=true, updated_at=now() WHERE id=%s",
                (*patches.values(), u["id"]),
            )
            updated += 1

    cur.execute("SELECT 1 FROM user_roles WHERE user_id=%s AND role='user'", (u["id"],))
    if not cur.fetchone():
        cur.execute(
            "INSERT INTO user_roles (user_id, role) VALUES (%s,'user') ON CONFLICT DO NOTHING",
            (u["id"],),
        )
        roles_added += 1

conn.commit()
print(f"  Profil oluşturulan: {created}, güncellenen: {updated}, rol eklenen: {roles_added}")
print(f"  Toplam kullanıcı: {len(users)}")

print("=== 2) Marka logoları ===")
cur.execute(
    """SELECT id, slug, name, website, logo_url FROM brands
       WHERE logo_url IS NULL OR logo_url LIKE 'http%' OR logo_url = ''
       ORDER BY slug"""
)
brands = cur.fetchall()
print(f"  Güncellenecek: {len(brands)} marka")

logo_ok = 0
for b in brands:
    new_url = favicon_url(b["name"], b["website"])
    cur.execute(
        "UPDATE brands SET logo_url=%s, updated_at=now() WHERE id=%s",
        (new_url, b["id"]),
    )
    logo_ok += 1
    if logo_ok % 50 == 0:
        conn.commit()
        print(f"  {logo_ok}/{len(brands)}…")

conn.commit()
print(f"  {logo_ok} marka logosu güncellendi (gstatic / monogram)")

if USE_S3:
    print("=== 3) MinIO'ya logo yükleme (S3 yapılandırılmış) ===")
    try:
        import boto3
        from botocore.config import Config

        s3 = boto3.client(
            "s3",
            endpoint_url=os.environ["S3_ENDPOINT"],
            aws_access_key_id=os.environ["S3_ACCESS_KEY_ID"],
            aws_secret_access_key=os.environ["S3_SECRET_ACCESS_KEY"],
            region_name=os.environ.get("S3_REGION", "us-east-1"),
            config=Config(signature_version="s3v4"),
        )
        uploaded = 0
        cur.execute("SELECT id, slug, name, website FROM brands ORDER BY slug")
        for b in cur.fetchall():
            dom = domain_from_website(b["website"])
            fetch_url = favicon_url(b["name"], b["website"])
            try:
                req = urllib.request.Request(fetch_url, headers={"User-Agent": "tepkimvar-seed/1.0"})
                with urllib.request.urlopen(req, timeout=12) as resp:
                    body = resp.read()
                    ctype = resp.headers.get("Content-Type", "image/png").split(";")[0]
                if len(body) < 80:
                    continue
                key = f"brand-logos/seed/{b['slug']}.png"
                s3.put_object(Bucket=BUCKET, Key=key, Body=body, ContentType=ctype)
                cur.execute(
                    "UPDATE brands SET logo_url=%s, updated_at=now() WHERE id=%s",
                    (f"/api/files/{key}", b["id"]),
                )
                uploaded += 1
            except Exception as e:
                print(f"  atlandı {b['slug']}: {e}")
        conn.commit()
        print(f"  MinIO'ya yüklenen: {uploaded}")
    except ImportError:
        print("  boto3 yok — pip install boto3 ile MinIO yükleme açılır")

cur.execute("SELECT count(*) n FROM profiles")
pc = cur.fetchone()["n"]
cur.execute("SELECT count(*) n FROM brands WHERE logo_url LIKE '/api/files/%'")
minio_n = cur.fetchone()["n"]
cur.execute("SELECT count(*) n FROM brands WHERE logo_url LIKE 'https://%'")
https_n = cur.fetchone()["n"]
print(f"\n=== Bitti: {pc} profil | logolar: {minio_n} MinIO, {https_n} harici URL ===")
cur.close()
conn.close()
