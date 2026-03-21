alter table public.items
  add column if not exists owner_key text,
  add column if not exists owner_kind text;

update public.items
set
  owner_key = concat('tg:', tg_user_id),
  owner_kind = 'telegram'
where tg_user_id is not null
  and owner_key is null;

create index if not exists items_owner_key_idx on public.items (owner_key);

alter table public.items
  add constraint items_owner_kind_check
  check (owner_kind in ('telegram', 'app'));
