import { createFileRoute } from "@tanstack/react-router";
import { AuthForm } from "@/components/auth-form";

export const Route = createFileRoute("/(auth)/login")({
  head: () => ({ meta: [{ title: "Giriş Yap — tepkimvar" }] }),
  component: () => <AuthForm variant="user" initialMode="login" />,
});
