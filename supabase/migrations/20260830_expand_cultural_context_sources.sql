alter table public.cultural_context
  drop constraint if exists cultural_context_source_outlet_check;

alter table public.cultural_context
  add column if not exists source_published_at date;

alter table public.cultural_context
  add constraint cultural_context_source_outlet_check
  check (source_outlet in (
    'the_atlantic', 'new_yorker', 'nyt', 'meduza', 'the_bell',
    'kinopoisk', 'wos', 'afisha_archive', 'x_ilya_krasilshchik',
    'facebook_ilya_krasilshchik', 'wonderzine'
  ));

alter table public.cultural_context
  drop constraint if exists cultural_context_afisha_archive_date_check;

alter table public.cultural_context
  add constraint cultural_context_afisha_archive_date_check
  check (source_outlet <> 'afisha_archive' or source_published_at < date '2021-01-01');
