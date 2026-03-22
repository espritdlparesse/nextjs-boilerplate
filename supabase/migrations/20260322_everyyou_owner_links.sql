create table if not exists public.owner_links (
  app_owner_key text primary key,
  app_owner_kind text not null check (app_owner_kind in ('app')),
  telegram_owner_key text unique,
  telegram_owner_kind text check (telegram_owner_kind in ('telegram')),
  link_code text unique,
  expires_at timestamptz,
  claimed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists owner_links_code_idx on public.owner_links (link_code);
create index if not exists owner_links_telegram_owner_key_idx on public.owner_links (telegram_owner_key);
