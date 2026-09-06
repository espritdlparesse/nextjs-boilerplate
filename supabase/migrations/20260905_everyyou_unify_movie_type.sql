update public.items set type = 'movie' where type = 'film';

alter table public.items
  drop constraint if exists items_type_canonical;

alter table public.items
  add constraint items_type_canonical check (type <> 'film') not valid;

alter table public.items
  validate constraint items_type_canonical;
