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
