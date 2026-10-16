-- ============================================================================
-- Credits, payments and security (run once in Supabase → SQL Editor, after tenancy.sql).
--
-- * credits: every movement of a customer's credits (plan paid, credits added, a job charged,
--   a failed job refunded). The balance is the sum. Only the server (service role) touches it:
--   customers can't read or write it directly.
-- * spend_credits / refund_last: charge and refund atomically, so two jobs at once can never
--   spend the same credits twice.
-- * rate_limits / hit_rate: counts attempts (logins, generations) to stop abuse.
-- * users.totp_*: two-step verification with an authenticator app.
--
-- Safe to run more than once. Nothing to edit.
-- ============================================================================

-- Until when a customer's plan is paid (empty = no expiry, e.g. friends with free access).
alter table public.workspaces add column if not exists paid_until date;

create table if not exists public.credits (
  id bigint generated always as identity primary key,
  owner text not null references public.workspaces(id) on delete cascade,
  delta integer not null,
  kind text not null check (kind in ('plan', 'topup', 'charge', 'refund', 'adjust')),
  note text,
  ref text,
  usd numeric,
  by_user text,
  created_at timestamptz not null default now()
);
create index if not exists credits_owner_idx on public.credits (owner, id desc);
create index if not exists credits_ref_idx on public.credits (owner, ref);
-- a payment from Mercado Pago gives credits only once, however many times it is notified
create unique index if not exists credits_payment_once on public.credits (ref) where ref like 'mp:%';
alter table public.credits enable row level security; -- no policies: only the service role
revoke all on table public.credits from anon, authenticated;
grant all on table public.credits to service_role;

create table if not exists public.rate_limits (
  key text primary key,
  window_start timestamptz not null,
  hits integer not null
);
alter table public.rate_limits enable row level security;
revoke all on table public.rate_limits from anon, authenticated;
grant all on table public.rate_limits to service_role;

alter table public.users add column if not exists totp_secret text;
alter table public.users add column if not exists totp_on boolean not null default false;

-- Balance of a workspace.
create or replace function public.credit_balance(p_owner text) returns integer
language sql stable security definer set search_path = public as $$
  select coalesce(sum(delta), 0)::integer from public.credits where owner = p_owner
$$;

-- Charges p_amount credits if the balance covers it (p_free: record a free redo without charging).
create or replace function public.spend_credits(
  p_owner text, p_amount integer, p_note text, p_ref text, p_usd numeric, p_by text, p_free boolean default false
) returns table (ok boolean, balance integer, charge_id bigint)
language plpgsql security definer set search_path = public as $$
declare
  b integer;
  cid bigint;
begin
  if p_amount is null or p_amount < 0 then raise exception 'invalid amount'; end if;
  perform pg_advisory_xact_lock(hashtext('credits:' || p_owner));
  select coalesce(sum(delta), 0) into b from public.credits where owner = p_owner;
  if not p_free and b < p_amount then
    return query select false, b, null::bigint;
    return;
  end if;
  insert into public.credits (owner, delta, kind, note, ref, usd, by_user)
  values (p_owner, case when p_free then 0 else -p_amount end, 'charge', p_note, p_ref, p_usd, p_by)
  returning id into cid;
  return query select true, b - case when p_free then 0 else p_amount end, cid;
end $$;

-- Gives back the latest charge for p_ref that wasn't refunded yet (safe to call twice).
create or replace function public.refund_last(p_owner text, p_ref text, p_note text) returns integer
language plpgsql security definer set search_path = public as $$
declare
  c record;
begin
  perform pg_advisory_xact_lock(hashtext('credits:' || p_owner));
  select id, delta into c from public.credits x
  where x.owner = p_owner and x.kind = 'charge' and x.ref = p_ref
    and not exists (select 1 from public.credits r where r.owner = p_owner and r.kind = 'refund' and r.ref = 'charge:' || x.id)
  order by x.id desc limit 1;
  if not found or c.delta > 0 then return 0; end if; -- (a free redo has delta 0: refunding it gives the free redo back)
  insert into public.credits (owner, delta, kind, note, ref) values (p_owner, -c.delta, 'refund', p_note, 'charge:' || c.id);
  return -c.delta;
end $$;

-- Free automatic redos. The review (server) grants a voucher for a clip with a severe error: at most
-- one per clip and two per ad. A redo can use it once; if that redo fails, refund_last gives it back.
create or replace function public.grant_free_redo(p_owner text, p_ad text, p_clip text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtext('credits:' || p_owner));
  if exists (select 1 from public.credits where owner = p_owner and kind = 'adjust' and ref = 'voucher:' || p_ad || ':' || p_clip) then
    return true;
  end if;
  if (select count(*) from public.credits where owner = p_owner and kind = 'adjust' and ref like 'voucher:' || p_ad || ':%') >= 2 then
    return false;
  end if;
  insert into public.credits (owner, delta, kind, note, ref) values (p_owner, 0, 'adjust', 'Rehecho gratis disponible', 'voucher:' || p_ad || ':' || p_clip);
  return true;
end $$;

create or replace function public.use_free_redo(p_owner text, p_ad text, p_clip text) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  cid bigint;
begin
  perform pg_advisory_xact_lock(hashtext('credits:' || p_owner));
  if not exists (select 1 from public.credits where owner = p_owner and kind = 'adjust' and ref = 'voucher:' || p_ad || ':' || p_clip) then
    return null;
  end if;
  if exists (
    select 1 from public.credits x
    where x.owner = p_owner and x.kind = 'charge' and x.ref = p_clip and x.delta = 0 and x.note = 'Rehecho gratis · ' || p_ad
      and not exists (select 1 from public.credits r where r.owner = p_owner and r.kind = 'refund' and r.ref = 'charge:' || x.id)
  ) then
    return null;
  end if;
  insert into public.credits (owner, delta, kind, note, ref) values (p_owner, 0, 'charge', 'Rehecho gratis · ' || p_ad, p_clip) returning id into cid;
  return cid;
end $$;

-- Counts one attempt for p_key; true while it stays within p_max per p_window seconds.
create or replace function public.hit_rate(p_key text, p_window integer, p_max integer) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  h integer;
begin
  insert into public.rate_limits as r (key, window_start, hits) values (p_key, now(), 1)
  on conflict (key) do update set
    hits = case when r.window_start < now() - make_interval(secs => p_window) then 1 else r.hits + 1 end,
    window_start = case when r.window_start < now() - make_interval(secs => p_window) then now() else r.window_start end
  returning hits into h;
  if random() < 0.01 then delete from public.rate_limits where window_start < now() - interval '2 days'; end if;
  return h <= p_max;
end $$;

-- Only the server may call these.
revoke execute on function public.credit_balance(text) from public, anon, authenticated;
revoke execute on function public.spend_credits(text, integer, text, text, numeric, text, boolean) from public, anon, authenticated;
revoke execute on function public.refund_last(text, text, text) from public, anon, authenticated;
revoke execute on function public.hit_rate(text, integer, integer) from public, anon, authenticated;
revoke execute on function public.grant_free_redo(text, text, text) from public, anon, authenticated;
revoke execute on function public.use_free_redo(text, text, text) from public, anon, authenticated;
grant execute on function public.credit_balance(text) to service_role;
grant execute on function public.spend_credits(text, integer, text, text, numeric, text, boolean) to service_role;
grant execute on function public.refund_last(text, text, text) to service_role;
grant execute on function public.hit_rate(text, integer, integer) to service_role;
grant execute on function public.grant_free_redo(text, text, text) to service_role;
grant execute on function public.use_free_redo(text, text, text) to service_role;

-- Ask the API to see the new functions right away.
notify pgrst, 'reload schema';
