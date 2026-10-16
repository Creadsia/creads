-- Creads database schema (run in Supabase → SQL Editor).
-- Phase 0: waitlist only. Later phases add users, credits, ads, cuts, avatars and learned rules.

create table if not exists public.waitlist (
  id bigint generated always as identity primary key,
  email text not null unique,
  niche text,
  ads_per_month text,
  created_at timestamptz not null default now()
);

-- Only the server (service role) writes or reads it; the public site cannot.
alter table public.waitlist enable row level security;
grant all on table public.waitlist to service_role;

-- Plan reservations from the pricing section (added with the subscription site).
alter table public.waitlist add column if not exists plan text;
alter table public.waitlist add column if not exists lang text;

-- ============================================================================
-- Platform tables (the app at /app). Every row has an `owner`; until accounts
-- exist everything belongs to 'main'. Only the server (service role) touches them.
-- ============================================================================
create extension if not exists pgcrypto;

create table if not exists public.avatars (
  id uuid primary key default gen_random_uuid(),
  owner text not null default 'main',
  name text not null,
  description text,
  image_url text,
  voice_id text,
  voice_name text,
  lang text default 'en',
  consent boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  owner text not null default 'main',
  name text not null,
  description text,
  image_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table if not exists public.scripts (
  id uuid primary key default gen_random_uuid(),
  owner text not null default 'main',
  title text,
  lang text default 'en',
  format text default 'ugc',
  text text not null,
  cuts jsonb,
  favorite boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table if not exists public.ads (
  id uuid primary key default gen_random_uuid(),
  owner text not null default 'main',
  title text,
  script_id uuid references public.scripts(id) on delete set null,
  format text,
  aspect text default '9:16',
  model text,
  status text not null default 'draft',
  settings jsonb,
  final_url text,
  favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table if not exists public.clips (
  id uuid primary key default gen_random_uuid(),
  owner text not null default 'main',
  ad_id uuid references public.ads(id) on delete cascade,
  idx int not null default 0,
  kind text,
  text text,
  prompt text,
  model text,
  provider_job text,
  status text not null default 'pending',
  url text,
  image_url text,
  error text,
  usd numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table if not exists public.images (
  id uuid primary key default gen_random_uuid(),
  owner text not null default 'main',
  prompt text,
  url text not null,
  model text,
  aspect text,
  favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table if not exists public.rules (
  id uuid primary key default gen_random_uuid(),
  owner text not null default 'main',
  rule_en text not null,
  rule_es text,
  formats text[] default '{all}',
  hits int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

do $$
declare t text;
begin
  foreach t in array array['avatars','products','scripts','ads','clips','images','rules'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('grant all on table public.%I to service_role', t);
    execute format('create index if not exists %I on public.%I (owner, created_at desc)', t || '_owner_created', t);
  end loop;
end $$;
create index if not exists clips_ad on public.clips (ad_id, idx);

-- ============================================================================
-- Accounts: email + password sign-in (scrypt hashes) and sessions (only the
-- SHA-256 of each session token is stored). Roles: owner, admin, member.
-- ============================================================================
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text,
  password_hash text not null,
  role text not null default 'member' check (role in ('owner','admin','member')),
  workspace text not null default 'main',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  last_login timestamptz
);
create table if not exists public.sessions (
  id text primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  expires_at timestamptz not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists sessions_user on public.sessions (user_id);
alter table public.users enable row level security;
alter table public.sessions enable row level security;
grant all on table public.users to service_role;
grant all on table public.sessions to service_role;
