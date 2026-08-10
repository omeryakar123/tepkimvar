import { corsHeaders, json } from "../_shared/cors.ts";
import { admin, hashOtp } from "../_shared/otp.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { email, code, newPassword } = await req.json();
    const e = String(email ?? "").trim().toLowerCase();
    const c = String(code ?? "").trim();
    const pw = String(newPassword ?? "");
    if (!/^\d{6}$/.test(c)) return json({ error: "Geçersiz kod" }, 400);
    if (pw.length < 6) return json({ error: "Şifre en az 6 karakter olmalı" }, 400);

    const sb = admin();
    const { data: row } = await sb.from("email_otps")
      .select("*").eq("email", e).eq("purpose", "reset").is("used_at", null)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!row) return json({ error: "Kod bulunamadı." }, 400);
    if (new Date(row.expires_at).getTime() < Date.now()) return json({ error: "Kodun süresi doldu." }, 400);
    if ((row.attempts ?? 0) >= 5) return json({ error: "Çok fazla yanlış deneme." }, 429);

    const hash = await hashOtp(c, e);
    if (hash !== row.otp_hash) {
      await sb.from("email_otps").update({ attempts: (row.attempts ?? 0) + 1 }).eq("id", row.id);
      return json({ error: "Kod hatalı." }, 400);
    }

    if (!row.user_id) return json({ error: "Kullanıcı bulunamadı." }, 400);

    const { error: upErr } = await sb.auth.admin.updateUserById(row.user_id, { password: pw });
    if (upErr) return json({ error: upErr.message }, 400);

    await sb.from("email_otps").update({ used_at: new Date().toISOString() }).eq("id", row.id);
    await sb.from("profiles").update({ email_verified: true }).eq("id", row.user_id);
    return json({ ok: true });
  } catch (err) {
    console.error("reset-password-otp", err);
    return json({ error: err instanceof Error ? err.message : "reset failed" }, 500);
  }
});
