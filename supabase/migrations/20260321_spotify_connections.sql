create table if not exists public.spotify_connections (
  owner_key text primary key,
  owner_kind text not null,
  spotify_user_id text not null,
  spotify_display_name text,
  access_token text not null,
  refresh_token text not null,
  expires_at bigint not null,
  scope text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists spotify_connections_set_updated_at on public.spotify_connections;

create trigger spotify_connections_set_updated_at
before update on public.spotify_connections
for each row
execute function public.set_updated_at();
