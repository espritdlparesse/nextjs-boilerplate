alter table public.vibe_runs
  add column if not exists form_labeled_at timestamptz;

create index if not exists vibe_runs_unlabeled_idx
  on public.vibe_runs (created_at)
  where form_labeled_at is null;

create table if not exists public.vibe_forms (
  run_id uuid not null references public.vibe_runs (id) on delete cascade,
  label text not null,
  kind text not null check (kind in ('construction', 'flaw')),
  note text,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (run_id, label, kind)
);

create index if not exists vibe_forms_label_idx on public.vibe_forms (label);
