import { createFileRoute } from "@tanstack/react-router";
import { AuthForm } from "@/components/auth-form";

export const Route = createFileRoute("/(auth)/register")({
  head: () => ({ meta: [{ title: "Üye Ol — itirazvar" }] }),
  component: () => <AuthForm variant="user" initialMode="register" />,
});
