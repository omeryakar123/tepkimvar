import { createFileRoute } from "@tanstack/react-router";
import { and, eq, inArray, notInArray, or, sql, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import { toDbComplaint, type BrandNested } from "@/lib/db-shapes";

// Public: tek şikayet. $id uuid, public_id veya short_id olabilir.
const HIDDEN_STATUSES = ["pending", "rejected", "spam"] as const;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/api/complaints/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const id = params.id;
        const idMatch: SQL = UUID_RE.test(id)
          ? eq(schema.complaints.id, id)
          : (or(
              eq(schema.complaints.publicId, id.toUpperCase()),
              eq(schema.complaints.shortId, id.toUpperCase()),
            ) as SQL);

        // AUTHZ: yayında veya (bot üretimi + onaylı) şikayetler görüntülenebilir.
        const [row] = await db
          .select({ c: schema.complaints, b: schema.brands })
          .from(schema.complaints)
          .innerJoin(schema.brands, eq(schema.complaints.brandId, schema.brands.id))
          .where(
            and(
              idMatch,
              notInArray(schema.complaints.status, [...HIDDEN_STATUSES]),
              or(
                eq(schema.complaints.isPublic, true),
                eq(schema.complaints.isSynthetic, true),
              ),
            ),
          )
          .limit(1);

        if (!row) return new Response("Not Found", { status: 404 });

        // Atomic view increment (await'lı fire-and-forget).
        await db
          .update(schema.complaints)
          .set({ views: sql`${schema.complaints.views} + 1` })
          .where(eq(schema.complaints.id, row.c.id));

        const brand: BrandNested = {
          name: row.b.name,
          slug: row.b.slug,
          logo_url: row.b.logoUrl,
          verified: row.b.verified,
        };
        const dc = toDbComplaint(row.c, brand);

        // PII: anonim şikayette user_id ve profil sızdırma.
        if (dc.is_anonymous) {
          dc.user_id = null;
          dc.profiles = null;
        } else if (dc.user_id) {
          const [pr] = await db
            .select({
              full_name: schema.profiles.fullName,
              username: schema.profiles.username,
              avatar_url: schema.profiles.avatarUrl,
            })
            .from(schema.profiles)
            .where(inArray(schema.profiles.id, [dc.user_id]))
            .limit(1);
          dc.profiles = pr ?? null;
        }

        return Response.json(dc);
      },
    },
  },
});
