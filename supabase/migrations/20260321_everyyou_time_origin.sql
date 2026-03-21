alter table public.items
  add column if not exists time_origin text;

create index if not exists items_time_origin_idx on public.items (time_origin);

alter table public.items
  drop constraint if exists items_time_origin_check;

alter table public.items
  add constraint items_time_origin_check
  check (time_origin in ('exact', 'imported', 'estimated') or time_origin is null);
