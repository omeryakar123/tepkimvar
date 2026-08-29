import { createFileRoute } from "@tanstack/react-router";
import { BrandApplicationForm } from "@/components/brand-application-form";

export const Route = createFileRoute("/(auth)/register/marka-basvuru")({
  head: () => ({ meta: [{ title: "Marka Başvurusu — tepkimvar" }] }),
  component: BrandApplicationForm,
});
