import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/(auth)/reset-password")({
  beforeLoad: () => { throw redirect({ to: "/forgot-password" }); },
});
