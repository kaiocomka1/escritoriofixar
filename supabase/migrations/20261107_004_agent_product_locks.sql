-- Run on staging first. Locks with ambiguous writes require manual reconciliation.
create table if not exists public.agent_product_locks (
 store_id uuid not null references public.marketplace_stores(id),
 item_id bigint not null,
 actor_id uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 primary key(store_id,item_id)
);
alter table public.agent_product_locks enable row level security;
revoke all on public.agent_product_locks from anon,authenticated;
