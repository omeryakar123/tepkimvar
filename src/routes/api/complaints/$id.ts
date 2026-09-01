import { createFileRoute } from "@tanstack/react-router";
import { and, eq, inArray, notInArray, or, sql, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import { toDbComplaint, type BrandNested } from "@/lib/db-shapes";
import { displayPhone } from "@/lib/phone-mask";
import { normalizePlatformUsername } from "@/lib/server/ai/prompts";
import { isBrandMember, isStaff, optionalUser } from "@/lib/server/guard";
import { supportedComplaintIds } from "@/lib/server/complaint-support";

// Public: tek şikayet. $id uuid, public_id veya short_id olabilir.
const HIDDEN_STATUSES = ["pending", "rejected", "spam"] as const;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/api/complaints/$id")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const id = params.id;
        const idMatch: SQL = UUID_RE.test(id)
          ? eq(schema.complaints.id, id)
          : (or(
              eq(schema.complaints.publicId, id.toUpperCase()),
              eq(schema.complaints.shortId, id.toLowerCase()),
            ) as SQL);

        const [row] = await db
          .select({ c: schema.complaints, b: schema.brands })
          .from(schema.complaints)
          .innerJoin(schema.brands, eq(schema.complaints.brandId, schema.brands.id))
          .where(and(idMatch, notInArray(schema.complaints.status, [...HIDDEN_STATUSES])))
          .limit(1);

        if (!row) return new Response("Not Found", { status: 404 });

        const viewer = await optionalUser(request);
        const isOwner = !!viewer && row.c.userId === viewer.id;

        if (row.c.hidden) {
          // Gizli şikayet: yalnızca yazan müşteri görebilir.
          if (!isOwner) return new Response("Not Found", { status: 404 });
        } else {
          const publiclyVisible = row.c.isPublic || row.c.isSynthetic;
          if (!publiclyVisible && !isOwner) {
            return new Response("Not Found", { status: 404 });
          }
        }

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
