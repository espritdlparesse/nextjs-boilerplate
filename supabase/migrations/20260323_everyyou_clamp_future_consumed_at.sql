update public.items
set consumed_at = timezone('utc', now())
where consumed_at is not null
  and consumed_at > timezone('utc', now()) + interval '5 minutes';
