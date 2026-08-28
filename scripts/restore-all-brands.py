#!/usr/bin/env python3
"""Prod'da eksik markaları geri yükler. Idempotent — silmez. DATABASE_URL zorunlu."""
import os, re, random, string, uuid
from datetime import datetime, timedelta, timezone
import psycopg2
import psycopg2.extras

URL = os.environ.get("DATABASE_URL")
if not URL:
    raise SystemExit("DATABASE_URL tanımlı değil")

def rnd(a, b):
    return a + random.randint(0, b - a)

def slugify(s):
    for a, b in (
        ("ç", "c"), ("Ç", "c"), ("ğ", "g"), ("Ğ", "g"), ("ı", "i"), ("I", "i"), ("İ", "i"),
        ("ö", "o"), ("Ö", "o"), ("ş", "s"), ("Ş", "s"), ("ü", "u"), ("Ü", "u"),
    ):
        s = s.replace(a, b)
    s = s.lower()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s

def pub_id():
    return "SK-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=6))

def days_ago(d, h=0):
    return datetime.now(timezone.utc) - timedelta(days=d, hours=h)

def logo_url(name, domain):
    from urllib.parse import quote
    fb = f"https://ui-avatars.com/api/?name={quote(name)}&size=128&background=1B263B&color=fff&bold=true&length=2"
    return f"https://unavatar.io/{domain}?fallback={quote(fb)}"

CATEGORIES = [
    ("Alışveriş / E-Ticaret", "alisveris-e-ticaret", "ShoppingCart", 1),
    ("Market / Süpermarket", "market-supermarket", "Store", 2),
    ("Telekomünikasyon", "telekomunikasyon", "Phone", 3),
    ("Bankacılık / Finans", "bankacilik-finans", "Landmark", 4),
    ("Ulaşım", "ulasim", "Plane", 5),
    ("Kargo / Lojistik", "kargo-lojistik", "Truck", 6),
    ("Restoran / Yeme-İçme", "restoran-yeme-icme", "Utensils", 7),
    ("Enerji", "enerji", "Zap", 8),
    ("Beyaz Eşya / Elektronik", "beyaz-esya-elektronik", "Tv", 9),
    ("Giyim / Moda / Tekstil", "giyim-moda-tekstil", "Shirt", 10),
    ("Bilişim / Teknoloji", "bilisim-teknoloji", "Cpu", 11),
]

DEMO_BRANDS = [
    ("trendyol", "Trendyol", "alisveris-e-ticaret", "İstanbul", "trendyol.com", True, True, 3.8, 79, "Türkiye'nin önde gelen e-ticaret platformu."),
    ("hepsiburada", "Hepsiburada", "alisveris-e-ticaret", "İstanbul", "hepsiburada.com", True, True, 3.6, 74, "Teknolojiden modaya geniş ürün yelpazeli pazaryeri."),
    ("n11", "n11", "alisveris-e-ticaret", "İstanbul", "n11.com", True, False, 3.3, 66, "Online alışveriş pazaryeri."),
    ("amazon-turkiye", "Amazon Türkiye", "alisveris-e-ticaret", "İstanbul", "amazon.com.tr", True, False, 3.9, 82, "Global e-ticaret devinin Türkiye operasyonu."),
    ("sahibinden", "sahibinden.com", "alisveris-e-ticaret", "İstanbul", "sahibinden.com", True, False, 3.4, 61, "İlan ve alışveriş platformu."),
    ("getir", "Getir", "market-supermarket", "İstanbul", "getir.com", True, True, 3.7, 77, "Dakikalar içinde market teslimatı."),
    ("migros", "Migros", "market-supermarket", "İstanbul", "migros.com.tr", True, False, 3.9, 80, "Türkiye'nin köklü market zinciri."),
    ("a101", "A101", "market-supermarket", "İstanbul", "a101.com.tr", False, False, 3.2, 58, "İndirim market zinciri."),
    ("turkcell", "Turkcell", "telekomunikasyon", "İstanbul", "turkcell.com.tr", True, True, 3.2, 63, "Türkiye'nin lider mobil operatörü."),
    ("vodafone", "Vodafone", "telekomunikasyon", "İstanbul", "vodafone.com.tr", True, False, 3.1, 60, "Mobil ve internet operatörü."),
    ("turk-telekom", "Türk Telekom", "telekomunikasyon", "Ankara", "turktelekom.com.tr", True, False, 3.0, 57, "Sabit hat, internet ve mobil hizmetler."),
    ("garanti-bbva", "Garanti BBVA", "bankacilik-finans", "İstanbul", "garantibbva.com.tr", True, True, 3.6, 72, "Özel sektör bankası."),
    ("yapi-kredi", "Yapı Kredi", "bankacilik-finans", "İstanbul", "yapikredi.com.tr", True, False, 3.4, 68, "Bireysel ve kurumsal bankacılık."),
    ("akbank", "Akbank", "bankacilik-finans", "İstanbul", "akbank.com", True, False, 3.7, 75, "Dijital bankacılıkta öncü."),
    ("ziraat-bankasi", "Ziraat Bankası", "bankacilik-finans", "Ankara", "ziraatbank.com.tr", True, False, 3.3, 64, "Türkiye'nin en büyük kamu bankası."),
    ("thy", "Türk Hava Yolları", "ulasim", "İstanbul", "turkishairlines.com", True, True, 3.8, 78, "Bayrak taşıyıcı havayolu."),
    ("pegasus", "Pegasus Hava Yolları", "ulasim", "İstanbul", "flypgs.com", True, False, 3.2, 62, "Ekonomik havayolu taşımacılığı."),
    ("aras-kargo", "Aras Kargo", "kargo-lojistik", "İstanbul", "araskargo.com.tr", False, False, 2.9, 51, "Kargo ve lojistik hizmetleri."),
    ("yurtici-kargo", "Yurtiçi Kargo", "kargo-lojistik", "İstanbul", "yurticikargo.com", True, False, 3.1, 59, "Ülke geneli kargo taşımacılığı."),
    ("mng-kargo", "MNG Kargo", "kargo-lojistik", "İstanbul", "mngkargo.com.tr", False, False, 2.8, 49, "Kargo ve dağıtım."),
    ("yemeksepeti", "Yemeksepeti", "restoran-yeme-icme", "İstanbul", "yemeksepeti.com", True, True, 3.6, 76, "Online yemek siparişi platformu."),
    ("enerjisa", "Enerjisa", "enerji", "İstanbul", "enerjisa.com.tr", True, False, 3.0, 55, "Elektrik dağıtım ve perakende."),
    ("arcelik", "Arçelik", "beyaz-esya-elektronik", "İstanbul", "arcelik.com.tr", True, False, 3.8, 81, "Beyaz eşya ve elektronik üreticisi."),
    ("lcwaikiki", "LC Waikiki", "giyim-moda-tekstil", "İstanbul", "lcwaikiki.com", True, False, 3.5, 70, "Uygun fiyatlı hazır giyim markası."),
    ("papara", "Papara", "bankacilik-finans", "İstanbul", "papara.com", True, False, 3.5, 68, "Dijital cüzdan ve ödeme."),
]

CASINO_SMALL = """Alobet Aresbet Bahislion Betbox Betcasper Betcool Betkare Betkolik Betlivo Betlike Betmabet Betmoney Betnixe Betnis Betosfer Betovis Betpipo Betpon Betra Betrabet Betticket Betvoy Betverse Betyap Casifix Casinoas CasinoBonanza CasinoDior Casinomilyon Casinoroyal Casinowon Casival Casivera Celtabet Chamadabet Editorbet Efesbet Enbet Enobahis Etrobet Exstrabet EyfelCasino Fiksturbet Galabet GallerBahis GanyanBet Gobahis Golbet Gonebet Grandoperabet Hanedabet Hazbet Hilarionbet Huhubeet İbizabet Kafacasino Kareasbet Kingbetting Kupawin Lagoncasino Livebahis Lordpalace Lüxbet Luxbet Maritbet Marjınbet Markaj Maxibet Medusabahis Meritliman MeritQueen Meybet Millibahis Milosbet Mislibet Modelbahis Mobiloyna Nesiller Netbahis Nitrobahis Norabahis Orisbet Oslobet Padişahbet Plazabet palacebet Poliwin Prensbet Rinabet Roketbet Romabet Rotabet SaltBahis Seteabet Sohobet Sovabet SmartBahis Sonbahis Stonebahis Süratbet Teosbet Tiklabet Tikobet Tlcasino Trendbet Tuccobet Ultrabet Vizyonbet WinxBet Wojobet""".split()

CASINO_BIG = """Jojobet Grandpashabet Meritking Casibom Bets10 Betboo Mobilbahis Youwin Superbetin Tempobet Bahigo Bahsegel Cratosslot Vdcasino Sekabet Onwin Sahabet Matadorbet Holiganbet Marsbahis Betturkey Mariobet Piabet Pinbahis Restbet Klasbahis Dinamobet 1xbet Mostbet Betist Pusulabet Perabet Jetbahis Rexbet Casinomaxi Casinometropol Cratosroyal Bettilt Nakitbahis İmajbet Sultanbet Vevobahis Betpark Betpas Kingroyal Extrabet Hepsibahis Betebet Asyabahis Casinoper Betsat Betgaranti""".split()

COMPLAINT_TEMPLATES = [
    ("Siparişim kargoya verilmedi", "3 gündür siparişim hazırlanıyor durumunda, kargoya verilmedi."),
    ("İade param hâlâ yatmadı", "Ürünü iade ettim ama iade tutarı hesabıma geçmedi."),
    ("Yanlış ürün gönderildi", "Sipariş ettiğim ürün yerine farklı bir ürün geldi."),
    ("Müşteri hizmetlerine ulaşamıyorum", "Günlerdir arıyorum, çağrı merkezine ulaşamıyorum."),
    ("Faturama tanımadığım ücret yansıdı", "Kullanmadığım bir servis için ücret yansıtılmış."),
    ("Teslimat sürekli erteleniyor", "Üç kez teslimat randevusu verildi, gelinmedi."),
]

DEMO_NAMES = [
    ("Ahmet Yılmaz", "ahmety"), ("Elif Demir", "elifd"), ("Mehmet Kaya", "mehmetk"),
    ("Zeynep Şahin", "zeyneps"), ("Can Öztürk", "canozturk"),
]

conn = psycopg2.connect(URL)
conn.autocommit = False
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

def cat_map():
    cur.execute("SELECT id, slug FROM categories")
    return {r["slug"]: r["id"] for r in cur.fetchall()}

print("=== 1) Kategoriler ===")
added_cats = 0
for name, slug, icon, sort_order in CATEGORIES:
    cur.execute("SELECT 1 FROM categories WHERE slug=%s", (slug,))
    if cur.fetchone():
        continue
    cur.execute(
        "INSERT INTO categories (name, slug, icon, sort_order, is_active) VALUES (%s,%s,%s,%s,true)",
        (name, slug, icon, sort_order),
    )
    added_cats += 1
conn.commit()
cats = cat_map()
print(f"  {added_cats} yeni kategori. Toplam slug: {len(cats)}")

print("=== 2) Demo kullanıcılar ===")
user_ids = []
for full, uname in DEMO_NAMES:
    email = f"{uname}@demo.tepkimvarplus.com"
    cur.execute('SELECT id FROM "user" WHERE email=%s', (email,))
    row = cur.fetchone()
    if not row:
        uid = str(uuid.uuid4())
        cur.execute('INSERT INTO "user" (id, name, email, email_verified) VALUES (%s,%s,%s,true) RETURNING id', (uid, full, email))
        uid = cur.fetchone()["id"]
        cur.execute(
            "INSERT INTO profiles (id, full_name, username, email_verified) VALUES (%s,%s,%s,true) ON CONFLICT (id) DO NOTHING",
            (uid, full, uname),
        )
    else:
        uid = row["id"]
    user_ids.append(uid)
conn.commit()

print("=== 3) Demo markalar ===")
new_demo = new_complaints = 0
cities = ["İstanbul", "Ankara", "İzmir", "Bursa", "Antalya"]
statuses = ["approved", "answered", "resolved", "in_review"]
for slug, name, cat, city, domain, verified, premium, rating, resolved_pct, about in DEMO_BRANDS:
    cur.execute("SELECT id FROM brands WHERE slug=%s", (slug,))
    b = cur.fetchone()
    if not b:
        total = rnd(80, 1400)
        resolved = int(total * resolved_pct / 100)
        cur.execute(
            """INSERT INTO brands (slug, name, category_id, about, website, city, logo_url, verified, premium,
               rating, rating_count, total_complaints, complaints_resolved, resolution_rate, avg_response_minutes)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id""",
            (slug, name, cats.get(cat), about, f"https://{domain}", city, logo_url(name, domain),
             verified, premium, rating, rnd(60, 1200), total, resolved, resolved_pct, rnd(45, 260)),
        )
        bid = cur.fetchone()["id"]
        new_demo += 1
    else:
        bid = b["id"]

    cur.execute("SELECT count(*)::int n FROM complaints WHERE brand_id=%s", (bid,))
    if cur.fetchone()["n"] > 0:
        continue
    for i in range(rnd(4, 7)):
        t = random.choice(COMPLAINT_TEMPLATES)
        status = random.choice(statuses)
        created = days_ago(rnd(1, 60))
        anon = random.random() < 0.25
        uid = random.choice(user_ids)
        has_resp = status in ("answered", "resolved")
        resp_at = days_ago(rnd(0, 3)) if has_resp else None
        cur.execute(
            """INSERT INTO complaints (user_id, brand_id, category_id, title, body, status, city, views, votes,
               is_anonymous, anon_name, public_id, brand_response, brand_response_at, brand_response_by, created_at, updated_at)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
            (uid, bid, cats.get(cat), t[0], t[1] + f" ({name})", status, random.choice(cities),
             rnd(20, 800), rnd(0, 40), anon, "Anonim Kullanıcı" if anon else None, pub_id(),
             "Konuyu inceliyoruz." if has_resp else None, resp_at, uid if has_resp else None, created, resp_at or created),
        )
        new_complaints += 1
conn.commit()
print(f"  {new_demo} yeni demo marka, {new_complaints} şikayet")

def insert_casino(names, cat_slug, big=False):
    cat_id = cats.get(cat_slug)
    if not cat_id:
        print(f"  UYARI: kategori yok: {cat_slug}")
        return 0
    added = skipped = 0
    seen = set()
    for name in names:
        slug = slugify(name)
        if slug in seen:
            skipped += 1
            continue
        seen.add(slug)
        cur.execute("SELECT 1 FROM brands WHERE slug=%s", (slug,))
        if cur.fetchone():
            skipped += 1
            continue
        domain = slug.replace("-", "") + ".com"
        total = rnd(800, 6500) if big else rnd(15, 220)
        resolved_pct = rnd(15, 55) if big else rnd(10, 45)
        cur.execute(
            """INSERT INTO brands (slug, name, category_id, website, city, logo_url, verified, premium,
               rating, rating_count, total_complaints, complaints_resolved, resolution_rate, avg_response_minutes)
               VALUES (%s,%s,%s,%s,%s,%s,false,false,%s,%s,%s,%s,%s,%s)""",
            (slug, name, cat_id, f"https://{domain}", "İstanbul", logo_url(name, domain),
             rnd(18, 36) / 10 if big else rnd(15, 32) / 10,
             rnd(150, 3000) if big else rnd(5, 180), total, int(total * resolved_pct / 100), resolved_pct,
             rnd(60, 1200) if big else rnd(120, 2000)),
        )
        added += 1
    conn.commit()
    print(f"  +{added} marka, {skipped} atlandı ({cat_slug})")
    return added

print("=== 4) Casino markalar (küçük) ===")
insert_casino(CASINO_SMALL, "beyaz-esya-elektronik", big=False)

print("=== 5) Casino markalar (büyük) ===")
insert_casino(CASINO_BIG, "bilisim-teknoloji", big=True)

print("=== 6) Casino şikayetleri ===")
cur.execute(
    """SELECT b.id, b.name, b.category_id FROM brands b
       JOIN categories c ON c.id = b.category_id
       WHERE c.slug IN ('bilisim-teknoloji', 'beyaz-esya-elektronik') ORDER BY b.slug"""
)
casino_brands = cur.fetchall()
nc = skipped_b = 0
for b in casino_brands:
    cur.execute("SELECT count(*)::int n FROM complaints WHERE brand_id=%s", (b["id"],))
    if cur.fetchone()["n"] > 0:
        skipped_b += 1
        continue
    for _ in range(rnd(2, 6)):
        status = random.choices(["approved", "answered", "resolved", "in_review"], weights=[30, 30, 25, 15])[0]
        created = days_ago(rnd(1, 45), rnd(0, 20))
        uid = random.choice(user_ids)
        has_resp = status in ("answered", "resolved")
        resp_at = created + timedelta(hours=rnd(4, 72)) if has_resp else None
        cur.execute(
            """INSERT INTO complaints (user_id, brand_id, category_id, title, body, status, city, views, votes,
               is_anonymous, anon_name, public_id, brand_response, brand_response_at, brand_response_by, created_at, updated_at)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,true,'Anonim Kullanıcı',%s,%s,%s,%s,%s,%s)""",
            (uid, b["id"], b["category_id"], "Param yatırılmadı", f"Çekim talebim gecikti ({b['name']}).",
             status, random.choice(cities), rnd(40, 1500), rnd(0, 60), pub_id(),
             "Talebiniz inceleniyor." if has_resp else None, resp_at, uid if has_resp else None, created, resp_at or created),
        )
        nc += 1
conn.commit()
print(f"  {nc} şikayet, {skipped_b} marka zaten doluydu")

cur.execute("SELECT count(*)::int n FROM brands")
bc = cur.fetchone()["n"]
cur.execute("SELECT count(*)::int n FROM complaints")
cc = cur.fetchone()["n"]
print(f"\n=== Bitti: {bc} marka, {cc} şikayet ===")
cur.close()
conn.close()
