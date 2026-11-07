create table if not exists public.product_agent_changes (
 id bigint generated always as identity primary key,
 store_id uuid not null references public.marketplace_stores(id) on delete cascade,
 item_id bigint not null,
 previous_title text not null,
 new_title text not null,
 status text not null check (status in ('verified','submitted_unverified','failed','reverted')),
 source text not null default 'gemini_vision',
 created_at timestamptz not null default now(),
 reverted_at timestamptz
);
create index if not exists product_agent_changes_store_date_idx on public.product_agent_changes(store_id,created_at desc);
alter table public.product_agent_changes enable row level security;
revoke all on public.product_agent_changes from anon,authenticated;
