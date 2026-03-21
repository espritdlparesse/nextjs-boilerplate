alter table public.items
  add column if not exists consumed_at timestamptz;

create index if not exists items_consumed_at_idx on public.items (consumed_at desc);
