create table if not exists public.profile_settings (
  owner_key text primary key,
  owner_kind text not null check (owner_kind in ('telegram', 'app')),
  display_name text,
  avatar_url text,
  theme_mode text not null default 'light' check (theme_mode in ('light', 'dark')),
  updated_at timestamptz not null default timezone('utc', now())
);

insert into storage.buckets (id, name, public)
values ('profile-avatars', 'profile-avatars', true)
on conflict (id) do update set public = true;
