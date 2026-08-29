import { createFileRoute } from "@tanstack/react-router";
import { errorResponse, requireStaff } from "@/lib/server/guard";
import { storageHealthReport } from "@/lib/server/storage-health";

/** Personel: depolama (S3/MinIO veya yerel disk) bağlantı testi. */
export const Route = createFileRoute("/api/admin/storage-health")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          await requireStaff(request);
          return Response.json(await storageHealthReport());
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
