
create type public.app_role as enum ('super_admin', 'admin', 'brand', 'user');
create type public.complaint_status as enum ('pending','approved','in_review','answered','resolved','rejected','spam');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text, username text unique, avatar_url text, phone text,
  is_banned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.profiles to anon;
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles are viewable by all" on public.profiles for select using (true);
create policy "users update own profile" on public.profiles for update using (auth.uid() = id);
create policy "users insert own profile" on public.profiles for insert with check (auth.uid() = id);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.user_roles where user_id=_user_id and role=_role) $$;

create policy "users read own roles" on public.user_roles for select using (auth.uid()=user_id);
create policy "admins read all roles" on public.user_roles for select using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'super_admin'));
create policy "super admin manage roles" on public.user_roles for all using (public.has_role(auth.uid(),'super_admin')) with check (public.has_role(auth.uid(),'super_admin'));

create or replace function public.tg_set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger profiles_updated_at before update on public.profiles for each row execute function public.tg_set_updated_at();

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, username, avatar_url)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), split_part(new.email,'@',1), new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role) values (new.id, 'user') on conflict do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null, name text not null, icon text,
  sort_order int not null default 0, is_active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select on public.categories to anon, authenticated;
grant all on public.categories to service_role;
alter table public.categories enable row level security;
create policy "categories public read" on public.categories for select using (true);
create policy "admins manage categories" on public.categories for all using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'super_admin')) with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'super_admin'));

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null, name text not null,
  category_id uuid references public.categories(id) on delete set null,
  about text, website text, phone text, email text, address text, city text,
  logo_url text, cover_url text,
  socials jsonb not null default '{}'::jsonb, business_hours jsonb,
  verified boolean not null default false, premium boolean not null default false,
  rating numeric(3,2) not null default 0, total_complaints int not null default 0,
  resolution_rate int not null default 0, avg_response_minutes int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.brands to anon, authenticated;
grant insert, update on public.brands to authenticated;
grant all on public.brands to service_role;
alter table public.brands enable row level security;
create policy "brands public read" on public.brands for select using (true);
create policy "admins manage brands" on public.brands for all using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'super_admin')) with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'super_admin'));
create trigger brands_updated_at before update on public.brands for each row execute function public.tg_set_updated_at();

create table public.brand_members (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'agent',
  created_at timestamptz not null default now(),
  unique(brand_id, user_id)
);
grant select, insert, update, delete on public.brand_members to authenticated;
grant all on public.brand_members to service_role;
alter table public.brand_members enable row level security;

create or replace function public.is_brand_member(_brand_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.brand_members where brand_id=_brand_id and user_id=_user_id) $$;

create policy "members read brand membership" on public.brand_members for select using (user_id=auth.uid() or public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'super_admin'));
create policy "admins manage brand members" on public.brand_members for all using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'super_admin')) with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'super_admin'));

create table public.complaints (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  title text not null, body text not null,
  status public.complaint_status not null default 'pending',
  priority int not null default 0, tags text[] not null default '{}',
  views int not null default 0, votes int not null default 0,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.complaints to anon, authenticated;
grant insert, update, delete on public.complaints to authenticated;
grant all on public.complaints to service_role;
alter table public.complaints enable row level security;
create policy "complaints read" on public.complaints for select using (
  (is_public and status not in ('pending','rejected','spam'))
  or auth.uid()=user_id
  or public.is_brand_member(brand_id, auth.uid())
  or public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'super_admin')
);
create policy "users create complaints" on public.complaints for insert with check (auth.uid()=user_id);
create policy "users update own complaint" on public.complaints for update using (auth.uid()=user_id);
create policy "brand admin update complaints" on public.complaints for update using (public.is_brand_member(brand_id, auth.uid()) or public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'super_admin'));
create policy "admin delete complaints" on public.complaints for delete using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'super_admin'));
create trigger complaints_updated_at before update on public.complaints for each row execute function public.tg_set_updated_at();

create table public.complaint_replies (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references public.complaints(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  is_brand boolean not null default false,
  is_internal boolean not null default false,
  created_at timestamptz not null default now()
);
grant select on public.complaint_replies to anon, authenticated;
grant insert, update, delete on public.complaint_replies to authenticated;
grant all on public.complaint_replies to service_role;
alter table public.complaint_replies enable row level security;
create policy "replies read" on public.complaint_replies for select using (
  not is_internal or auth.uid()=user_id or exists(
    select 1 from public.complaints c where c.id=complaint_id and (public.is_brand_member(c.brand_id, auth.uid()) or public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'super_admin'))
  )
);
create policy "auth post reply" on public.complaint_replies for insert with check (auth.uid()=user_id);
create policy "edit own reply" on public.complaint_replies for update using (auth.uid()=user_id);

create table public.complaint_attachments (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid references public.complaints(id) on delete cascade,
  reply_id uuid references public.complaint_replies(id) on delete cascade,
  uploader_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null, file_type text, file_size int,
  created_at timestamptz not null default now()
);
grant select on public.complaint_attachments to anon, authenticated;
grant insert, delete on public.complaint_attachments to authenticated;
grant all on public.complaint_attachments to service_role;
alter table public.complaint_attachments enable row level security;
create policy "attachments read" on public.complaint_attachments for select using (true);
create policy "uploader writes attachments" on public.complaint_attachments for insert with check (auth.uid()=uploader_id);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid references public.complaints(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(complaint_id)
);
grant select, insert on public.conversations to authenticated;
grant all on public.conversations to service_role;
alter table public.conversations enable row level security;
create policy "conv participants read" on public.conversations for select using (auth.uid()=user_id or public.is_brand_member(brand_id, auth.uid()) or public.has_role(auth.uid(),'admin'));
create policy "users create conv" on public.conversations for insert with check (auth.uid()=user_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null, attachment_url text, read_at timestamptz,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.messages to authenticated;
grant all on public.messages to service_role;
alter table public.messages enable row level security;
create policy "messages read" on public.messages for select using (
  exists(select 1 from public.conversations c where c.id=conversation_id and (c.user_id=auth.uid() or public.is_brand_member(c.brand_id, auth.uid()) or public.has_role(auth.uid(),'admin')))
);
create policy "messages send" on public.messages for insert with check (
  auth.uid()=sender_id and exists(select 1 from public.conversations c where c.id=conversation_id and (c.user_id=auth.uid() or public.is_brand_member(c.brand_id, auth.uid())))
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null, title text not null, body text, link text,
  read_at timestamptz, created_at timestamptz not null default now()
);
grant select, update, delete on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;
create policy "own notifications read" on public.notifications for select using (auth.uid()=user_id);
create policy "own notifications update" on public.notifications for update using (auth.uid()=user_id);

create table public.blogs (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null, title text not null, excerpt text, body text not null,
  cover_url text, author_id uuid references auth.users(id) on delete set null,
  category text, seo_title text, seo_description text,
  status text not null default 'draft', published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.blogs to anon, authenticated;
grant insert, update, delete on public.blogs to authenticated;
grant all on public.blogs to service_role;
alter table public.blogs enable row level security;
create policy "blogs published read" on public.blogs for select using (status='published' or public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'super_admin'));
create policy "blogs admin manage" on public.blogs for all using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'super_admin')) with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'super_admin'));
create trigger blogs_updated_at before update on public.blogs for each row execute function public.tg_set_updated_at();

create table public.cms_blocks (
  id uuid primary key default gen_random_uuid(),
  key text unique not null, type text not null,
  data jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);
grant select on public.cms_blocks to anon, authenticated;
grant all on public.cms_blocks to service_role;
alter table public.cms_blocks enable row level security;
create policy "cms public read" on public.cms_blocks for select using (is_active);
create policy "cms admin manage" on public.cms_blocks for all using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'super_admin')) with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'super_admin'));
create trigger cms_updated_at before update on public.cms_blocks for each row execute function public.tg_set_updated_at();

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  action text not null, entity_type text, entity_id text, metadata jsonb, ip text,
  created_at timestamptz not null default now()
);
grant select, insert on public.audit_logs to authenticated;
grant all on public.audit_logs to service_role;
alter table public.audit_logs enable row level security;
create policy "audit admin read" on public.audit_logs for select using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'super_admin'));
create policy "audit auth insert" on public.audit_logs for insert with check (auth.uid()=user_id);

insert into public.categories (slug, name, icon, sort_order) values
  ('e-ticaret','E-Ticaret','ShoppingBag',1),
  ('bankacilik','Bankacılık & Finans','Landmark',2),
  ('telekomunikasyon','Telekomünikasyon','Smartphone',3),
  ('kargo','Kargo & Lojistik','Truck',4),
  ('havayolu','Havayolu','Plane',5),
  ('teknoloji','Teknoloji','Cpu',6),
  ('saglik','Sağlık','HeartPulse',7),
  ('egitim','Eğitim','GraduationCap',8)
on conflict (slug) do nothing;
