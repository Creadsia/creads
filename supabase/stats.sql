-- Creads: anonymous visit counters for "Estadísticas" in the Panel interno.
-- One row per day (Chile), dimension and value, e.g. (2026-10-17, 'src', 'instagram', 412).
-- No IPs or personal data: only how many visits per day, device, city, source and landing page.
-- Safe to run more than once.

create table if not exists public.site_stats (
  day date not null,
  dim text not null check (dim in ('ses', 'dev', 'loc', 'src', 'land')),
  key text not null,
  n integer not null default 0,
  primary key (day, dim, key)
);
alter table public.site_stats enable row level security;
revoke all on table public.site_stats from anon, authenticated;
grant all on table public.site_stats to service_role;

-- Adds one to each counter of a visit in a single call: p_items = [{"d":"ses","k":"all"}, {"d":"src","k":"instagram"}, …]
create or replace function public.stat_hits(p_day date, p_items jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare it jsonb;
begin
  for it in select * from jsonb_array_elements(p_items) limit 10 loop
    if (it->>'d') in ('ses', 'dev', 'loc', 'src', 'land') and coalesce(it->>'k', '') <> '' then
      insert into public.site_stats (day, dim, key, n) values (p_day, it->>'d', left(it->>'k', 120), 1)
      on conflict (day, dim, key) do update set n = public.site_stats.n + 1;
    end if;
  end loop;
end $$;
revoke execute on function public.stat_hits(date, jsonb) from public, anon, authenticated;
grant execute on function public.stat_hits(date, jsonb) to service_role;
