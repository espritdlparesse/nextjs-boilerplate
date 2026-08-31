create table if not exists public.vibe_feedback (
  id uuid primary key default gen_random_uuid(),
  owner_key text not null,
  owner_kind text not null check (owner_kind in ('telegram', 'app')),
  summary text not null,
  rating text not null check (rating in ('good', 'bad')),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists vibe_feedback_owner_created_idx
  on public.vibe_feedback (owner_key, created_at desc);
