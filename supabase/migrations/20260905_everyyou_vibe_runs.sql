create table if not exists public.vibe_runs (
  id uuid primary key default gen_random_uuid(),
  owner_key text not null,
  owner_kind text not null check (owner_kind in ('telegram', 'app')),
  prompt_version text not null,
  model text not null,
  outcome text not null check (outcome in ('delivered', 'rejected_422', 'fallback')),
  summary text,
  selected_basis text[] not null default '{}',
  planner_observation text,
  media_counts jsonb not null default '{}'::jsonb,
  gate_hits text[] not null default '{}',
  retry_count int not null default 0,
  plans_valid_count int not null default 0,
  item_count int not null default 0,
  is_holdout boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists vibe_runs_owner_created_idx
  on public.vibe_runs (owner_key, created_at desc);

create index if not exists vibe_runs_outcome_created_idx
  on public.vibe_runs (outcome, created_at desc);

create index if not exists vibe_runs_prompt_version_idx
  on public.vibe_runs (prompt_version, created_at desc);

alter table public.vibe_feedback
  add column if not exists run_id uuid references public.vibe_runs (id);

create index if not exists vibe_feedback_run_idx
  on public.vibe_feedback (run_id);

create table if not exists public.vibe_duels (
  id uuid primary key default gen_random_uuid(),
  owner_key text not null,
  owner_kind text not null check (owner_kind in ('telegram', 'app')),
  run_id_a uuid not null references public.vibe_runs (id),
  run_id_b uuid not null references public.vibe_runs (id),
  shown_first uuid not null references public.vibe_runs (id),
  winner_run_id uuid references public.vibe_runs (id),
  decided_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists vibe_duels_owner_created_idx
  on public.vibe_duels (owner_key, created_at desc);

create index if not exists vibe_duels_winner_idx
  on public.vibe_duels (winner_run_id);
