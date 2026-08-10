
alter table public.profiles add column if not exists email_verified boolean not null default false;
alter table public.profiles add column if not exists phone text;

do $$ begin
  create type public.otp_purpose as enum ('signup','reset');
exception when duplicate_object then null; end $$;

create table if not exists public.email_otps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  email text not null,
  purpose public.otp_purpose not null default 'signup',
  otp_hash text not null,
  attempts int not null default 0,
  expires_at timestamptz not null,
  used_at timestamptz,
  ip_address text,
  created_at timestamptz not null default now()
);

create index if not exists email_otps_email_purpose_idx on public.email_otps (email, purpose, created_at desc);

grant all on public.email_otps to service_role;
alter table public.email_otps enable row level security;
-- no policies => locked to everyone except service_role (edge functions)
