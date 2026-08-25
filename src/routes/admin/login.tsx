import { createFileRoute } from "@tanstack/react-router";
import { AuthForm } from "@/components/auth-form";

export const Route = createFileRoute("/admin/login")({
  head: () => ({ meta: [{ title: "Admin Girişi — tepkimvar" }] }),
  component: () => <AuthForm variant="admin" initialMode="login" />,
});
