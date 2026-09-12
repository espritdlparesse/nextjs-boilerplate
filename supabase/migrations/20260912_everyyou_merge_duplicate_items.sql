delete from public.items
where id in (
  select id
  from (
    select
      id,
      row_number() over (
        partition by
          coalesce(owner_key, 'tg:' || tg_user_id::text),
          type,
          lower(regexp_replace(btrim(title), '\s+', ' ', 'g')),
          lower(regexp_replace(btrim(coalesce(creator, '')), '\s+', ' ', 'g'))
        order by (consumed_at is null), created_at, id
      ) as copy_index
    from public.items
  ) ranked
  where copy_index > 1
);
