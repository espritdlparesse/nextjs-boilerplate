create table if not exists public.cultural_context (
  lookup_key text primary key,
  aliases text[] not null default '{}',
  display_name text not null,
  kind text not null check (kind in ('artist', 'author', 'director', 'work')),
  context_note text not null,
  roast_angles text[] not null default '{}',
  source_outlet text not null check (source_outlet in ('meduza', 'wos')),
  source_url text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cultural_context_aliases_idx
  on public.cultural_context using gin (aliases);

insert into public.cultural_context (
  lookup_key,
  aliases,
  display_name,
  kind,
  context_note,
  roast_angles,
  source_outlet,
  source_url
)
values
  (
    'биг бейби тейп',
    array['big baby tape', 'big baby tape', 'биг-бейби-тейп'],
    'биг бейби тейп',
    'artist',
    'Российский рэпер, для которого прорывом стал «Dragonborn»: тяжелый бас, трэп, игровые отсылки и намеренно неразборчивый речитатив.',
    array['массовый рэп-хит рядом с подчеркнуто авторской вещью', 'музыка для очень громкого общего плейлиста'],
    'meduza',
    'https://meduza.io/feature/2021/10/26/esli-vy-nedavno-zahodili-v-muzykalnye-strimingi-to-tochno-videli-chto-pervye-mesta-zanimaet-albom-bandana-i-ot-big-baby-tape-i-kizaru'
  ),
  (
    'софия коппола',
    array['sofia coppola', 'софия коппола'],
    'софия коппола',
    'director',
    'Режиссерка «Трудностей перевода»; ее кино часто строится на одиночестве, недосказанности и красивой, но неуютной дистанции.',
    array['красиво, но никому не хорошо', 'выходной, в котором разговора оказалось меньше, чем ожидалось'],
    'meduza',
    'https://meduza.io/slides/25-glavnyh-filmov-xxi-veka-po-versii-meduzy'
  ),
  (
    'трудности перевода',
    array['lost in translation', 'трудности перевода'],
    '«Трудности перевода»',
    'work',
    'Фильм Софии Копполы о двух одиноких американцах в Токио; узнаваемая фактура — недосказанность, отель, бессонница и близость без ясного продолжения.',
    array['красивая дистанция', 'вещи, после которых не хочется немедленно кому-то писать'],
    'meduza',
    'https://meduza.io/slides/25-glavnyh-filmov-xxi-veka-po-versii-meduzy'
  )
on conflict (lookup_key) do update set
  aliases = excluded.aliases,
  display_name = excluded.display_name,
  kind = excluded.kind,
  context_note = excluded.context_note,
  roast_angles = excluded.roast_angles,
  source_outlet = excluded.source_outlet,
  source_url = excluded.source_url,
  updated_at = now();
