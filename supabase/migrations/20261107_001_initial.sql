-- Fixar+ AI Office: initial private schema. Run once in Supabase SQL Editor.
create extension if not exists pgcrypto;
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'viewer' check (role in ('admin','viewer')),
  created_at timestamptz not null default now()
);
create table if not exists public.marketplace_stores (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('shopee','tiktok')),
  external_shop_id text,
  label text not null,
  status text not null default 'disconnected' check (status in ('disconnected','pending','connected','error')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider,external_shop_id)
);
create table if not exists public.integration_credentials (
  store_id uuid primary key references public.marketplace_stores(id) on delete cascade,
  encrypted_access_token bytea,
  encrypted_refresh_token bytea,
  token_expires_at timestamptz,
  updated_at timestamptz not null default now()
);
create table if not exists public.integration_events (
  id bigint generated always as identity primary key,
  store_id uuid references public.marketplace_stores(id) on delete set null,
  event_type text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_integration_events_created on public.integration_events(created_at desc);
alter table public.profiles enable row level security;
alter table public.marketplace_stores enable row level security;
alter table public.integration_credentials enable row level security;
alter table public.integration_events enable row level security;
-- No browser access to tokens/events. Server access will require explicit
-- authenticated admin verification before using the Supabase secret key.
revoke all on public.integration_credentials from anon, authenticated;
revoke all on public.integration_events from anon, authenticated;
create policy "admins read profiles" on public.profiles for select to authenticated
 using (user_id = (select auth.uid()));
create policy "admins read stores" on public.marketplace_stores for select to authenticated
 using (exists(select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.role='admin'));
-- Bootstrap first admin manually after creating user in Authentication:
-- insert into public.profiles(user_id,role) values ('<USER_UUID>','admin');
-- Never store plaintext tokens. Implement application-side AES-GCM
-- encryption and key rotation before inserting credentials.
