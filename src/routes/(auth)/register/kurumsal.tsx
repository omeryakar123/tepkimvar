import { createFileRoute } from "@tanstack/react-router";
import { AuthForm } from "@/components/auth-form";

export const Route = createFileRoute("/(auth)/register/kurumsal")({
  head: () => ({ meta: [{ title: "Kurumsal Kayıt — tepkimvar" }] }),
  component: () => <AuthForm variant="user" initialMode="register" corporate />,
});
