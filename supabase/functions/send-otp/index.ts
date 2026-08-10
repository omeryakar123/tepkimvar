import { corsHeaders, json } from "../_shared/cors.ts";
import { admin, generateOtp, hashOtp, sendOtpEmail, clientIp } from "../_shared/otp.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { email, purpose } = await req.json();
    const e = String(email ?? "").trim().toLowerCase();
    const p = (purpose === "reset" ? "reset" : "signup") as "signup" | "reset";
    if (!e || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return json({ error: "Geçersiz e-posta" }, 400);

    const sb = admin();
    const ip = clientIp(req);

    // Rate limit
    const since1m = new Date(Date.now() - 60_000).toISOString();
    const since1h = new Date(Date.now() - 3_600_000).toISOString();
    const { count: c1 } = await sb.from("email_otps").select("id", { count: "exact", head: true }).eq("email", e).gte("created_at", since1m);
    if ((c1 ?? 0) >= 3) return json({ error: "Çok fazla istek. Lütfen biraz bekleyin." }, 429);
    const { count: c2 } = await sb.from("email_otps").select("id", { count: "exact", head: true }).eq("email", e).gte("created_at", since1h);
    if ((c2 ?? 0) >= 10) return json({ error: "Saatlik OTP limiti doldu." }, 429);

    // Lookup user
    const { data: list } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 });
    const user = list?.users.find((u) => u.email?.toLowerCase() === e);
    if (p === "reset" && !user) return json({ ok: true }); // don't leak

    // Invalidate prior unused OTPs
    await sb.from("email_otps").update({ used_at: new Date().toISOString() }).is("used_at", null).eq("email", e).eq("purpose", p);

    const otp = generateOtp();
    const otp_hash = await hashOtp(otp, e);
    const expires_at = new Date(Date.now() + 10 * 60_000).toISOString();
    const { error: insErr } = await sb.from("email_otps").insert({
      user_id: user?.id ?? null, email: e, purpose: p, otp_hash, expires_at, ip_address: ip,
    });
    if (insErr) throw insErr;

    await sendOtpEmail(e, otp);
    return json({ ok: true });
  } catch (err) {
    console.error("send-otp", err);
    return json({ error: err instanceof Error ? err.message : "send failed" }, 500);
  }
});
