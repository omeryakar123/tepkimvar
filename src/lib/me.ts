import { createServerFn } from "@tanstack/react-start";
import type { AppRole } from "@/hooks/use-auth";

export type Me = { user: { id: string; email: string } | null; roles: AppRole[] };

/**
 * Oturum + rolleri döner.
 *
 * `createServerFn` kullanılıyor çünkü route guard'ları (beforeLoad) hem sunucuda
 * hem istemcide koşuyor. Sunucuda gövde doğrudan çalışır (istek/çerez bağlamıyla),
 * istemcide otomatik RPC'ye dönüşür. Böylece bu dosyaya sunucu-only import
 * koymadan SSR'da da çerezleri okuyabiliyoruz.
 */
export const fetchMe = createServerFn({ method: "GET" }).handler(async (): Promise<Me> => {
  // Sunucu-only modüller SADECE burada, handler içinde import edilir; bu kod
  // istemci paketine girmez.
  const [{ auth }, { getRequest }, { db, schema }, { eq }] = await Promise.all([
    import("@/lib/auth"),
    import("@tanstack/react-start/server"),
    import("@/db"),
    import("drizzle-orm"),
  ]);

  try {
    const request = getRequest();
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) return { user: null, roles: [] };

    const rows = await db
      .select({ role: schema.userRoles.role })
      .from(schema.userRoles)
      .where(eq(schema.userRoles.userId, session.user.id));

    return {
      user: { id: session.user.id, email: session.user.email },
      roles: rows.map((r) => r.role as AppRole),
    };
  } catch {
    return { user: null, roles: [] };
  }
});
