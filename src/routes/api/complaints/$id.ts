import { createFileRoute } from "@tanstack/react-router";
import { and, eq, ilike, notInArray, or, sql, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import { toDbComplaint, type BrandNested } from "@/lib/db-shapes";
import { displayPhone } from "@/lib/phone-mask";
import { normalizePlatformUsername } from "@/lib/server/ai/prompts";
import { isBrandMember, isStaff, optionalUser } from "@/lib/server/guard";
import { supportedComplaintIds } from "@/lib/server/complaint-support";
import { loadAuthorProfile } from "@/lib/server/author-profile";
import { ensureDbPatches } from "@/lib/server/ensure-db-patches";

// Public: tek şikayet. $id uuid, public_id veya short_id olabilir.
const HIDDEN_STATUSES = ["rejected", "spam"] as const;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizeComplaintParam(raw: string): string {
  try {
    return decodeURIComponent(raw).trim();
  } catch {
    return raw.trim();
  }
}

function buildIdMatch(id: string): SQL {
  if (UUID_RE.test(id)) return eq(schema.complaints.id, id);

  const upper = id.toUpperCase();
  const lower = id.toLowerCase();

  return or(
    eq(schema.complaints.publicId, upper),
    eq(schema.complaints.shortId, lower),
    ilike(schema.complaints.publicId, upper),
  ) as SQL;
}

export const Route = createFileRoute("/api/complaints/$id")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        await ensureDbPatches();

        const id = normalizeComplaintParam(params.id);
        if (!id) return new Response("Not Found", { status: 404 });

        const idMatch = buildIdMatch(id);

        const [row] = await db
          .select({ c: schema.complaints, b: schema.brands })
          .from(schema.complaints)
          .innerJoin(schema.brands, eq(schema.complaints.brandId, schema.brands.id))
          .where(and(idMatch, notInArray(schema.complaints.status, [...HIDDEN_STATUSES])))
          .limit(1);

        if (!row) return new Response("Not Found", { status: 404 });

        const viewer = await optionalUser(request);
        const isOwner = !!viewer && row.c.userId === viewer.id;
        const staff = !!viewer && (await isStaff(viewer.id));

        if (row.c.hidden) {
          // Gizli şikayet: yalnızca yazan müşteri veya personel görebilir.
          if (!isOwner && !staff) return new Response("Not Found", { status: 404 });
        } else if (row.c.status === "pending") {
          if (!isOwner && !staff) {
            return Response.json(
              { error: "Bu şikayet henüz yayında değil veya moderasyon bekliyor.", code: "not_public" },
              { status: 403 },
            );
          }
        } else {
          const publiclyVisible = row.c.isPublic || row.c.isSynthetic;
          if (!publiclyVisible && !isOwner && !staff) {
            return Response.json(
              { error: "Bu şikayet henüz yayında değil veya moderasyon bekliyor.", code: "not_public" },
              { status: 403 },
            );
          }
        }

        if (!staff) {
          await db
            .update(schema.complaints)
            .set({ views: sql`${schema.complaints.views} + 1` })
            .where(eq(schema.complaints.id, row.c.id));
        }

        const brand: BrandNested = {
          name: row.b.name,
          slug: row.b.slug,
          logo_url: row.b.logoUrl,
          verified: row.b.verified,
        };
        const dc = toDbComplaint(row.c, brand);

        if (dc.is_anonymous) {
          dc.user_id = null;
          dc.profiles = null;
        } else if (dc.user_id) {
          dc.profiles = await loadAuthorProfile(dc.user_id);
        }

        let phoneMode: "full" | "masked" | "hidden" = "masked";
        if (viewer) {
          const staff = await isStaff(viewer.id);
          const brandAccess = await isBrandMember(viewer.id, row.c.brandId);
          if (staff || brandAccess) phoneMode = "full";
        }

        (dc as typeof dc & {
          platform_username?: string | null;
          contact_phone?: string | null;
          contact_phone_display?: string | null;
        }).platform_username = row.c.platformUsername
          ? normalizePlatformUsername(row.c.platformUsername)
          : null;
        (dc as typeof dc & { contact_phone?: string | null }).contact_phone =
          phoneMode === "hidden" ? null : row.c.contactPhone ?? null;
        (dc as typeof dc & { contact_phone_display?: string | null }).contact_phone_display =
          phoneMode === "hidden"
            ? null
            : displayPhone(row.c.contactPhone, phoneMode === "full" ? "full" : "masked");

        if (viewer) {
          const supported = await supportedComplaintIds(viewer.id, [dc.id]);
          (dc as typeof dc & { user_supported?: boolean }).user_supported = supported.has(dc.id);
        }

        return Response.json(dc);
      },
    },
  },
});
