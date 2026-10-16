-- ============================================================================
-- Customer accounts kept apart (run once in Supabase → SQL Editor).
--
-- Every customer has a workspace. Each row of the studio tables carries its
-- workspace in `owner`, and the database itself only shows a workspace its own
-- rows (Row Level Security). The app connects with its own role, `creads_app`,
-- which cannot skip those rules, and says which workspace it is acting for at
-- the start of every request (setting `app.workspace`).
--
-- Safe to run more than once. The only thing to edit is the password, near the top.
-- ============================================================================

-- Workspaces: one per customer (and "main" for Creadsia itself).
create table if not exists public.workspaces (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]{2,40}$'),
  name text not null,
  kind text not null default 'client' check (kind in ('owner', 'client')),
  plan text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
insert into public.workspaces (id, name, kind) values ('main', 'Creadsia', 'owner') on conflict (id) do nothing;
-- What each customer can use (full studio, or only "Crear anuncio"), and their discount (%).
alter table public.workspaces add column if not exists access text not null default 'full';
alter table public.workspaces add column if not exists discount int not null default 0;
alter table public.workspaces add column if not exists notes text;
do $$
begin
  if not exists (select from pg_constraint where conname = 'workspaces_access_check') then
    alter table public.workspaces add constraint workspaces_access_check check (access in ('full', 'ads'));
  end if;
  if not exists (select from pg_constraint where conname = 'workspaces_discount_check') then
    alter table public.workspaces add constraint workspaces_discount_check check (discount between 0 and 100);
  end if;
end $$;

-- Cloned voices: each one belongs to the customer who cloned it (all clones live in one ElevenLabs account).
create table if not exists public.voices (
  id uuid primary key default gen_random_uuid(),
  owner text not null default 'main',
  voice_id text not null unique,
  name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create index if not exists voices_owner_created on public.voices (owner, created_at desc);
grant all on table public.voices to service_role;
alter table public.workspaces enable row level security;
grant all on table public.workspaces to service_role;

-- The app's own database role (no login yet: the password is set in the last step).
do $$
begin
  if not exists (select from pg_roles where rolname = 'creads_app') then
    create role creads_app nologin;
  end if;
end $$;
grant usage on schema public to creads_app;

-- ============================================================================
-- >>> LO ÚNICO QUE CAMBIAS: tu clave entre las comillas (24+ letras y números) <<<
-- ============================================================================
do $$
declare pw text := 'PEGA-AQUI-TU-CLAVE-LARGA';
begin
  if pw like 'PEGA-AQUI%' or length(pw) < 24 or pw !~ '^[A-Za-z0-9]+$' then
    raise exception 'Cambia la clave (arriba, entre las comillas): 24 o más letras y números, sin espacios.';
  end if;
  execute format('alter role creads_app with login password %L', pw);
end $$;

-- Which workspace the current request acts for ('' or null = none, so nothing is visible).
create or replace function public.current_workspace() returns text
  language sql stable
  as $$ select nullif(current_setting('app.workspace', true), '') $$;

-- Studio tables: each workspace sees and changes only its own rows.
do $$
declare t text;
begin
  foreach t in array array['avatars', 'products', 'scripts', 'ads', 'clips', 'images', 'voices'] loop
    execute format('grant select, insert, update, delete on table public.%I to creads_app', t);
    execute format('alter table public.%I alter column owner set default public.current_workspace()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists tenant_isolation on public.%I', t);
    execute format(
      'create policy tenant_isolation on public.%I for all to creads_app using (owner = public.current_workspace()) with check (owner = public.current_workspace())',
      t);
  end loop;
end $$;

-- Learned rules are shared by every customer (that is how the system learns for all):
-- anyone may read them and the app may add or update them, never delete.
grant select, insert, update on table public.rules to creads_app;
drop policy if exists rules_shared_read on public.rules;
drop policy if exists rules_shared_add on public.rules;
drop policy if exists rules_shared_update on public.rules;
create policy rules_shared_read on public.rules for select to creads_app using (true);
create policy rules_shared_add on public.rules for insert to creads_app with check (owner = 'main');
create policy rules_shared_update on public.rules for update to creads_app using (true) with check (owner = 'main');

-- A workspace may read its own row (name, plan).
grant select on table public.workspaces to creads_app;
drop policy if exists own_workspace on public.workspaces;
create policy own_workspace on public.workspaces for select to creads_app using (id = public.current_workspace());

-- A clip may only point to an ad of the same workspace, and an ad to a script of the same workspace
-- (foreign keys alone would let one customer attach rows to another's ad).
create or replace function public.clip_same_workspace() returns trigger
  language plpgsql security definer set search_path = public
  as $$
begin
  if new.ad_id is not null and not exists (select 1 from public.ads a where a.id = new.ad_id and a.owner = new.owner) then
    raise exception 'ad of another workspace' using errcode = '42501';
  end if;
  return new;
end $$;
create or replace function public.ad_same_workspace() returns trigger
  language plpgsql security definer set search_path = public
  as $$
begin
  if new.script_id is not null and not exists (select 1 from public.scripts s where s.id = new.script_id and s.owner = new.owner) then
    raise exception 'script of another workspace' using errcode = '42501';
  end if;
  return new;
end $$;
drop function if exists public.same_workspace_refs() cascade;
drop trigger if exists clips_same_workspace on public.clips;
create trigger clips_same_workspace before insert or update of ad_id, owner on public.clips
  for each row execute function public.clip_same_workspace();
drop trigger if exists ads_same_workspace on public.ads;
create trigger ads_same_workspace before insert or update of script_id, owner on public.ads
  for each row execute function public.ad_same_workspace();

-- Every account belongs to an existing workspace.
do $$
begin
  if not exists (select from pg_constraint where conname = 'users_workspace_fk') then
    alter table public.users add constraint users_workspace_fk foreign key (workspace) references public.workspaces(id);
  end if;
end $$;
