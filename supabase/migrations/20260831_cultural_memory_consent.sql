create table if not exists public.cultural_memory_consents (
  owner_key text primary key,
  owner_kind text not null check (owner_kind in ('telegram', 'app')),
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

create index if not exists cultural_memory_consents_enabled_idx
  on public.cultural_memory_consents (enabled)
  where enabled = true;
