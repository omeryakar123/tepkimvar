import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { AuthForm } from "@/components/auth-form";

/**
 * Alt rotalar (/register/marka-basvuru, /register/kurumsal) Outlet ile render edilir.
 * /register kök yolu doğrudan bireysel kayıt formunu gösterir.
 */
export const Route = createFileRoute("/(auth)/register")({
  head: () => ({ meta: [{ title: "Üye Ol — tepkimvar" }] }),
  component: RegisterLayout,
});

function RegisterLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isNested = pathname.startsWith("/register/") && pathname.length > "/register/".length;

  if (isNested) return <Outlet />;
  return <AuthForm variant="user" initialMode="register" />;
}
