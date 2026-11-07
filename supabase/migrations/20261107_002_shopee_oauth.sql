create table if not exists public.shopee_oauth_states (
 state_hash text primary key,
 admin_user_id uuid not null references auth.users(id) on delete cascade,
 expires_at timestamptz not null,
 created_at timestamptz not null default now()
);
alter table public.shopee_oauth_states enable row level security;
revoke all on public.shopee_oauth_states from anon, authenticated;
create index if not exists idx_shopee_oauth_expiry on public.shopee_oauth_states(expires_at);
