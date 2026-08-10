import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { authClient } from "@/lib/auth-client";

export type AppRole = "super_admin" | "admin" | "brand" | "moderator" | "user";

export type AuthUser = {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  emailVerified: boolean;
};

type AuthCtx = {
  user: AuthUser | null;
  roles: AppRole[];
  loading: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: session, isPending } = authClient.useSession();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [rolesLoading, setRolesLoading] = useState(true);

  async function loadRoles() {
    try {
      const res = await fetch("/api/me", { credentials: "include" });
      const json = (await res.json()) as { roles?: AppRole[] };
      setRoles(json.roles ?? []);
    } catch {
      setRoles([]);
    } finally {
      setRolesLoading(false);
    }
  }

  const userId = session?.user?.id;
  useEffect(() => {
    if (userId) {
      setRolesLoading(true);
      loadRoles();
    } else {
      setRoles([]);
      setRolesLoading(false);
    }
  }, [userId]);

  const value: AuthCtx = {
    user: (session?.user as AuthUser | undefined) ?? null,
    roles,
    loading: isPending || rolesLoading,
    signOut: async () => {
      await authClient.signOut();
      setRoles([]);
    },
    refresh: loadRoles,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function highestRoleRedirect(roles: AppRole[]): string {
  if (roles.includes("super_admin") || roles.includes("admin")) return "/admin";
  if (roles.includes("brand")) return "/brand";
  return "/";
}
