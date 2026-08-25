import { createFileRoute } from "@tanstack/react-router";
import { and, desc, eq, ilike, inArray, notInArray, sql, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import { toDbComplaint, type BrandNested, type DbComplaintShape } from "@/lib/db-shapes";
import { HttpError, errorResponse, rateLimit, requireUser } from "@/lib/server/guard";
import { recordStatusChange } from "@/lib/server/history";
import { refreshBrandAggregates } from "@/lib/server/brand-stats";
import { moderateAndScore } from "@/lib/server/moderation";

// Public: şikayet listesi. RLS gitti; moderasyon filtresi BURADA zorlanıyor.
const HIDDEN_STATUSES = ["pending", "rejected", "spam"] as const;

export const Route = createFileRoute("/api/complaints")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const p = url.searchParams;
        const brandSlug = p.get("brandSlug") ?? undefined;
        const categorySlug = p.get("categorySlug") ?? undefined;
        const categoryIdParam = p.get("categoryId") ?? undefined;
        const search = p.get("search") ?? undefined;
        const sortBy = p.get("sortBy") ?? undefined;
        const limitParam = p.get("limit");
        const pageParam = p.get("page");
        const pageSize = Number(p.get("pageSize")) || 12;

        // AUTHZ: is_public = true AND status NOT IN ('pending','rejected','spam')
        const conditions: SQL[] = [
          eq(schema.complaints.isPublic, true),
          notInArray(schema.complaints.status, [...HIDDEN_STATUSES]),
        ];

        if (brandSlug) conditions.push(eq(schema.brands.slug, brandSlug));

        // categoryId param takes precedence; else resolve slug -> id.
        let categoryId = categoryIdParam;
        if (!categoryId && categorySlug) {
          const [cat] = await db
            .select({ id: schema.categories.id })
            .from(schema.categories)
            .where(eq(schema.categories.slug, categorySlug))
            .limit(1);
          categoryId = cat?.id;
          // Bilinmeyen slug -> hiç sonuç dönmemeli.
          if (!categoryId) return Response.json({ items: [], total: 0 });
        }
        if (categoryId) conditions.push(eq(schema.complaints.categoryId, categoryId));

        if (search) conditions.push(ilike(schema.complaints.title, `%${search}%`));

        const where = and(...conditions);
        const orderBy =
          sortBy === "trending"
            ? desc(schema.complaints.views)
            : desc(schema.complaints.createdAt);

        const base = db
          .select({ c: schema.complaints, b: schema.brands })
          .from(schema.complaints)
          .innerJoin(schema.brands, eq(schema.complaints.brandId, schema.brands.id))
          .where(where)
          .orderBy(orderBy)
          .$dynamic();

        let total = 0;
        let rows: { c: typeof schema.complaints.$inferSelect; b: typeof schema.brands.$inferSelect }[];

        if (limitParam) {
          rows = await base.limit(Number(limitParam));
          total = rows.length;
        } else if (pageParam) {
          const page = Math.max(1, Number(pageParam));
          rows = await base.limit(pageSize).offset((page - 1) * pageSize);
          const [{ count }] = await db
            .select({ count: sql<number>`count(*)` })
            .from(schema.complaints)
            .innerJoin(schema.brands, eq(schema.complaints.brandId, schema.brands.id))
            .where(where);
          total = Number(count);
        } else {
          rows = await base;
          total = rows.length;
        }

        const items: DbComplaintShape[] = rows.map((r) => {
          const brand: BrandNested = {
            name: r.b.name,
            slug: r.b.slug,
            logo_url: r.b.logoUrl,
            verified: r.b.verified,
          };
          const dc = toDbComplaint(r.c, brand);
          // PII: anonim şikayette gerçek user_id sızdırma.
          if (dc.is_anonymous) dc.user_id = null;
          return dc;
        });

        // Attach profiles for non-anonymous rows (single inArray query).
        const ids = Array.from(
          new Set(items.filter((i) => !i.is_anonymous && i.user_id).map((i) => i.user_id as string)),
        );
        if (ids.length > 0) {
          const profs = await db
            .select({
              id: schema.profiles.id,
              full_name: schema.profiles.fullName,
              username: schema.profiles.username,
              avatar_url: schema.profiles.avatarUrl,
            })
            .from(schema.profiles)
            .where(inArray(schema.profiles.id, ids));
          const map = new Map(profs.map((pr) => [pr.id, pr]));
          for (const it of items) {
            if (!it.is_anonymous && it.user_id) {
              const pr = map.get(it.user_id);
              it.profiles = pr
                ? { full_name: pr.full_name, username: pr.username, avatar_url: pr.avatar_url }
                : null;
            }
          }
        }

        return Response.json({ items, total });
      },

      // Şikayet oluştur. GÜVENLİK: status/sayaçlar/marka yanıtı istemciden
      // ALINMAZ; user_id oturumdan gelir. (Eski RLS guard trigger'ının karşılığı.)
      POST: async ({ request }) => {
        try {
          const user = await requireUser(request);
          // Spam koruması: saatte 5 şikayet.
          rateLimit(`complaint:${user.id}`, 5, 60 * 60_000);

          const b = (await request.json()) as {
            title?: string;
            body?: string;
            brandId?: string;
            categoryId?: string | null;
            city?: string | null;
            contactPhone?: string | null;
            isAnonymous?: boolean;
          };

          const title = (b.title ?? "").trim();
          const body = (b.body ?? "").trim();
          if (title.length < 6) throw new HttpError(400, "Başlık en az 6 karakter olmalı");
          if (body.length < 20) throw new HttpError(400, "Şikayet detayı en az 20 karakter olmalı");
          if (!b.brandId) throw new HttpError(400, "Firma seçilmeli");

          const [brand] = await db
            .select({ id: schema.brands.id })
            .from(schema.brands)
            .where(eq(schema.brands.id, b.brandId))
            .limit(1);
          if (!brand) throw new HttpError(400, "Geçersiz firma");

          // ── ÖN MODERASYON ──────────────────────────────────────────────
          // Temiz içerik anında yayınlanır; şüpheli içerik 'pending' kalır ve
          // moderasyon kuyruğuna düşer. Kural SUNUCUDA çalışır (atlanamaz).
          const mod = moderateAndScore(`${title}\n${body}`);
          const status = mod.ok ? ("approved" as const) : ("pending" as const);

          const code = `SK-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
          const [created] = await db
            .insert(schema.complaints)
            .values({
              userId: user.id,
              brandId: b.brandId,
              categoryId: b.categoryId || null,
              title: title.slice(0, 200),
              body: body.slice(0, 5000),
              city: b.city?.trim() || null,
              contactPhone: b.contactPhone || null,
              isAnonymous: !!b.isAnonymous,
              anonName: b.isAnonymous ? "Anonim" : null,
              // Sunucu tarafından sabitlenen alanlar:
              status,
              isPublic: true,
              views: 0,
              votes: 0,
              priority: mod.isHighPriority ? 1 : 0,
              isHighPriority: mod.isHighPriority,
              sentimentScore: mod.sentiment,
              sentimentConfidence: String(mod.confidence),
              publicId: code,
              shortId: code.toLowerCase(),
            })
            .returning({ id: schema.complaints.id });

          await recordStatusChange({
            complaintId: created.id,
            fromStatus: null,
            toStatus: status,
            changedBy: user.id,
            actorRole: status === "approved" ? "system" : "user",
            note: mod.ok ? "Otomatik kontrolden geçti, yayınlandı" : "Ön kontrol uyarı verdi, incelemeye alındı",
          });

          // Marka sayaçları (toplam/bekleyen/çözüm oranı) şikayet satırlarından
          // yeniden hesaplanır.
          await refreshBrandAggregates(b.brandId);

          // Şüpheliyse moderatörlerin göreceği kuyruğa ekle.
          if (!mod.ok) {
            await db.insert(schema.moderationQueue).values({
              kind: "sensitive",
              state: "open",
              priority: mod.isHighPriority ? 2 : 1,
              summary: mod.issues[0] ?? "Ön kontrol uyarısı",
              payload: { issues: mod.issues, sentiment: mod.sentiment },
              targetType: "complaint",
              targetId: created.id,
              relatedTable: "complaints",
              relatedId: created.id,
            });
          }

          return Response.json(
            { id: created.id, status, issues: mod.issues },
            { status: 201 },
          );
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
