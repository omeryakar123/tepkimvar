-- ============================================================================
-- Güvenlik sıkılaştırması: sütun/alan bazlı yazma koruması + PII kısıtlama
--
-- Kapatılan açıklar:
--  * complaints: moderasyon bypass (status='approved'), sayaç/alan sahteciliği
--    (votes/views/priority/rating/sensitive/hidden/escalated), sahte marka yanıtı
--  * complaint_replies: is_brand ile sahte marka temsilcisi
--  * comments: upvotes/downvotes manipülasyonu + başkasının yorumunu düzenleme
--  * complaint_resolutions: başkasının şikayetine sahte "çözüldü" kaydı
--  * profiles: kendini ban'dan çıkarma / kendini doğrulama, admin ban'ın çalışması,
--    tüm kullanıcıların telefonunu toplayabilme (PII)
--
-- Yaklaşım: sütun bazlı GRANT tek rolde (authenticated) marka üyesi ile sıradan
-- kullanıcıyı ayıramadığı için, ayrımı rol-farkında BEFORE trigger'lar yapar.
-- pg_trigger_depth() > 1 kontrolü, sayaçları güncelleyen diğer trigger'ların
-- (ör. oy toplama) bu korumalardan etkilenmemesini sağlar.
-- ============================================================================

-- Yardımcı: aktif kullanıcı personel (admin/super_admin) mi?
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'super_admin')
$$;
revoke execute on function public.is_staff() from public, anon;
grant execute on function public.is_staff() to authenticated, service_role;

-- ============================ COMPLAINTS ====================================
create or replace function public.tg_complaints_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  uid   uuid    := auth.uid();
  brand boolean;
begin
  -- service_role (uid null), personel ve iç içe trigger kaynaklı güncellemeler serbest
  if uid is null or public.is_staff() or pg_trigger_depth() > 1 then
    return new;
  end if;

  brand := public.is_brand_member(coalesce(new.brand_id, old.brand_id), uid);

  if tg_op = 'INSERT' then
    if not brand then
      new.user_id             := uid;
      new.status              := 'pending';
      new.votes               := 0;
      new.views               := 0;
      new.priority            := 0;
      new.is_high_priority    := false;
      new.sensitive           := false;
      new.hidden              := false;
      new.escalated           := false;
      new.brand_response      := null;
      new.brand_response_at   := null;
      new.brand_response_by   := null;
      new.admin_notes         := null;
      new.sentiment_score     := null;
      new.sentiment_confidence:= null;
      new.first_response_at   := null;
      new.first_response_minutes := null;
      new.is_white_label      := false;
      new.white_label_source  := null;
      if new.rating is not null then
        new.rating := greatest(1, least(5, new.rating));
      end if;
    end if;
    return new;
  end if;

  -- UPDATE ------------------------------------------------------------------
  if brand then
    -- Marka üyesi: yalnızca yanıt/durum/ilk-yanıt alanlarını değiştirebilir
    new.user_id          := old.user_id;
    new.brand_id         := old.brand_id;
    new.title            := old.title;
    new.body             := old.body;
    new.tags             := old.tags;
    new.city             := old.city;
    new.contact_phone    := old.contact_phone;
    new.is_anonymous     := old.is_anonymous;
    new.anon_name        := old.anon_name;
    new.is_public        := old.is_public;
    new.rating           := old.rating;
    new.votes            := old.votes;
    new.views            := old.views;
    new.priority         := old.priority;
    new.is_high_priority := old.is_high_priority;
    new.sensitive        := old.sensitive;
    new.hidden           := old.hidden;
    new.escalated        := old.escalated;
    new.admin_notes      := old.admin_notes;
    new.public_id        := old.public_id;
    new.short_id         := old.short_id;
    new.is_white_label   := old.is_white_label;
    new.white_label_source := old.white_label_source;
    return new;
  end if;

  -- Şikayet sahibi: içerik alanlarını düzenleyebilir; durumu YALNIZCA 'resolved'
  -- yapabilir (moderasyon bypass'ını, ör. 'approved'/'answered', engeller)
  if uid = old.user_id then
    if new.status is distinct from old.status and new.status <> 'resolved' then
      new.status := old.status;
    end if;
    new.user_id          := old.user_id;
    new.brand_id         := old.brand_id;
    new.votes            := old.votes;
    new.views            := old.views;
    new.priority         := old.priority;
    new.is_high_priority := old.is_high_priority;
    new.sensitive        := old.sensitive;
    new.hidden           := old.hidden;
    new.escalated        := old.escalated;
    new.brand_response   := old.brand_response;
    new.brand_response_at := old.brand_response_at;
    new.brand_response_by := old.brand_response_by;
    new.admin_notes      := old.admin_notes;
    new.sentiment_score  := old.sentiment_score;
    new.sentiment_confidence := old.sentiment_confidence;
    new.first_response_at := old.first_response_at;
    new.first_response_minutes := old.first_response_minutes;
    new.public_id        := old.public_id;
    new.short_id         := old.short_id;
    new.is_white_label   := old.is_white_label;
    new.white_label_source := old.white_label_source;
    if new.rating is not null then
      new.rating := greatest(1, least(5, new.rating));
    end if;
    return new;
  end if;

  -- Diğer durumlar RLS tarafından zaten engellenir; yine de hiçbir değişikliğe izin verme
  return old;
end $$;

drop trigger if exists complaints_guard on public.complaints;
create trigger complaints_guard before insert or update on public.complaints
  for each row execute function public.tg_complaints_guard();

-- ============================ COMPLAINT_REPLIES =============================
create or replace function public.tg_replies_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null or public.is_staff() or pg_trigger_depth() > 1 then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.user_id  := uid;
    -- is_brand yalnızca gerçekten o markanın üyesiyse true olabilir
    new.is_brand := public.is_brand_member(
      (select c.brand_id from public.complaints c where c.id = new.complaint_id), uid);
    if not new.is_brand then
      new.is_internal := false;   -- iç not sadece marka/personel için
    end if;
    return new;
  end if;

  -- UPDATE: bayrakları sabitle
  new.is_brand    := old.is_brand;
  new.is_internal := old.is_internal;
  new.user_id     := old.user_id;
  return new;
end $$;

drop trigger if exists replies_guard on public.complaint_replies;
create trigger replies_guard before insert or update on public.complaint_replies
  for each row execute function public.tg_replies_guard();

-- ============================ COMMENTS ======================================
create or replace function public.tg_comments_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  uid    uuid := auth.uid();
  author boolean;
begin
  if uid is null or public.is_staff() or pg_trigger_depth() > 1 then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.user_id  := uid;
    new.upvotes  := 0;
    new.downvotes := 0;
    new.pinned   := false;
    return new;
  end if;

  -- UPDATE ------------------------------------------------------------------
  author := (uid = old.user_id);
  -- Oy sayıları yalnızca comment_votes toplama trigger'ı ile değişir
  new.upvotes   := old.upvotes;
  new.downvotes := old.downvotes;
  new.user_id   := old.user_id;
  if author then
    new.pinned := old.pinned;    -- yazar kendi yorumunu pinleyemez
  else
    -- şikayet sahibi (RLS ile) yalnızca pinned'i değiştirebilir, metni değil
    new.body      := old.body;
    new.parent_id := old.parent_id;
  end if;
  return new;
end $$;

drop trigger if exists comments_guard on public.comments;
create trigger comments_guard before insert or update on public.comments
  for each row execute function public.tg_comments_guard();

-- ============================ COMPLAINT_RESOLUTIONS =========================
-- Eski policy sadece user_id=auth.uid() istiyordu; complaint_id/brand_id
-- serbestti -> başkasının şikayetine sahte çözüm kaydı eklenebiliyordu.
drop policy if exists "res_owner_insert" on public.complaint_resolutions;
create policy "res_owner_insert" on public.complaint_resolutions for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.complaints c
    where c.id = complaint_id
      and c.user_id = auth.uid()
      and c.brand_id = complaint_resolutions.brand_id
  )
);

-- ============================ PROFILES ======================================
-- 1) Admin/super_admin profilleri güncelleyebilsin (ban akışı RLS'te eksikti,
--    şu an sessizce hiçbir satırı güncellemiyordu).
drop policy if exists "admins update profiles" on public.profiles;
create policy "admins update profiles" on public.profiles for update
  using (public.is_staff()) with check (public.is_staff());

-- 2) Sıradan kullanıcı kendi ban/doğrulama bayraklarını değiştiremesin.
--    (OTP doğrulama edge function'ları service_role ile çalışır -> muaf.)
create or replace function public.tg_profiles_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null or public.is_staff() or pg_trigger_depth() > 1 then
    return new;
  end if;
  new.id             := old.id;
  new.is_banned      := old.is_banned;
  new.email_verified := old.email_verified;
  new.phone_verified := old.phone_verified;
  return new;
end $$;

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.tg_profiles_guard();

-- 3) Telefon numarası PII: giriş yapan herkes tüm kullanıcıların telefonunu
--    çekebiliyordu. phone sütununu authenticated/anon SELECT'inden çıkar;
--    kullanıcı kendi telefonunu get_my_profile() RPC'si ile okur.
revoke select on public.profiles from authenticated;
grant select (
  id, full_name, username, avatar_url, city, bio,
  created_at, updated_at, is_banned, email_verified, phone_verified
) on public.profiles to authenticated;

create or replace function public.get_my_profile()
returns setof public.profiles language sql stable security definer set search_path = public as $$
  select * from public.profiles where id = auth.uid()
$$;
revoke execute on function public.get_my_profile() from public, anon;
grant execute on function public.get_my_profile() to authenticated;
