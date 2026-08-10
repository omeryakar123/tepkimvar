import { createFileRoute } from "@tanstack/react-router";
import { AuthForm } from "@/components/auth-form";

export const Route = createFileRoute("/brand/login")({
  head: () => ({ meta: [{ title: "Firma Girişi — itirazvar.com" }] }),
  component: () => <AuthForm variant="brand" initialMode="login" />,
});
