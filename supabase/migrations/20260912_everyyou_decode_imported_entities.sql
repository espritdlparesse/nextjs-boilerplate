create or replace function pg_temp.decode_xml_entities(value text) returns text as $$
  select regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(value, '&#0*39;|&#x0*27;|&apos;', '''', 'gi'),
            '&#0*34;|&#x0*22;|&quot;', '"', 'gi'),
          '&#0*60;|&lt;', '<', 'gi'),
        '&#0*62;|&gt;', '>', 'gi'),
      '&#0*160;|&nbsp;', ' ', 'gi'),
    '&#0*38;|&amp;', '&', 'gi');
$$ language sql immutable;

update public.items
set title = pg_temp.decode_xml_entities(title),
    creator = pg_temp.decode_xml_entities(creator)
where title ~* '&(#x?[0-9a-f]+|amp|apos|quot|lt|gt|nbsp);'
   or creator ~* '&(#x?[0-9a-f]+|amp|apos|quot|lt|gt|nbsp);';
