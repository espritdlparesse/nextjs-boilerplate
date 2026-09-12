update public.items
set title = regexp_replace(title, '\s*[-–—]\s*(★+½?|½)(\s*\([^()]*\))?\s*$', '')
where source in ('letterboxd', 'import_letterboxd')
  and title ~ '[★½]\s*(\([^()]*\))?\s*$';

delete from public.items
where id in (
  select id
  from (
    select
      id,
      row_number() over (
        partition by
          coalesce(owner_key, tg_user_id::text),
          source,
          title,
          coalesce(creator, ''),
          coalesce(consumed_at::text, '')
        order by created_at, id
      ) as copy_index
    from public.items
  ) ranked
  where copy_index > 1
);
