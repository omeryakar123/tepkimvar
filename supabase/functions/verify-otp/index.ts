import { corsHeaders, json } from "../_shared/cors.ts";
import { admin, hashOtp } from "../_shared/otp.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { email, code } = await req.json();
    const e = String(email ?? "").trim().toLowerCase();
    const c = String(code ?? "").trim();
    if (!/^\d{6}$/.test(c)) return json({ error: "Geçersiz kod" }, 400);

    const sb = admin();
    const { data: row } = await sb.from("email_otps")
      .select("*").eq("email", e).eq("purpose", "signup").is("used_at", null)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!row) return json({ error: "Kod bulunamadı. Lütfen yeni kod isteyin." }, 400);
    if (new Date(row.expires_at).getTime() < Date.now()) return json({ error: "Kodun süresi doldu." }, 400);
    if ((row.attempts ?? 0) >= 5) return json({ error: "Çok fazla yanlış deneme." }, 429);

    const hash = await hashOtp(c, e);
    if (hash !== row.otp_hash) {
      await sb.from("email_otps").update({ attempts: (row.attempts ?? 0) + 1 }).eq("id", row.id);
      return json({ error: "Kod hatalı." }, 400);
    }

    await sb.from("email_otps").update({ used_at: new Date().toISOString() }).eq("id", row.id);

    if (row.user_id) {
      await sb.from("profiles").update({ email_verified: true }).eq("id", row.user_id);
    }
    return json({ ok: true });
  } catch (err) {
    console.error("verify-otp", err);
    return json({ error: err instanceof Error ? err.message : "verify failed" }, 500);
  }
});
