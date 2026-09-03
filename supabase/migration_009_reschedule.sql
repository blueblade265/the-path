-- The Path — migration 009: reschedule-day feature
-- Run once, in the Supabase SQL editor (RPC functions and constraint changes can't go
-- through the REST API — same "run by hand" precedent as migration_008).
--
-- schedule_overrides: absence of a row for (user_id, week, day) means "no override, day
-- is fully natural — render ctx.dayPlan[day] as-is" (see
-- js/services/schedule-resolver.js, the single source of truth for how these columns are
-- interpreted client-side).
--   origin_day — always set. Which dayPlan[] entry's title/exercises should display at
--                this calendar day. Defaults back to `day` itself once nothing occupies it.
--   slot       — nullable. NULL means this day has been explicitly vacated (its natural
--                content moved elsewhere this week) — genuinely "open," not a normal rest
--                day. Non-null slot is always written equal to origin_day (see
--                schedule-resolver.js's buildMovePayload/buildShiftPayload, which only
--                ever copy the two together from the same source day) — kept as two
--                columns rather than one so "vacated" is representable at all.
-- No origin_week column: moves never cross a `week` boundary.

create table schedule_overrides (
  user_id     uuid    not null references auth.users(id) on delete cascade,
  week        integer not null,
  day         integer not null check (day between 0 and 6),
  slot        integer          check (slot between 0 and 6),
  origin_day  integer not null check (origin_day between 0 and 6),
  primary key (user_id, week, day)
);

alter table schedule_overrides enable row level security;

create policy "owner full access" on schedule_overrides
  for all
  using (
    auth.uid() = user_id
    and exists (select 1 from allowed_users au where au.email = auth.jwt()->>'email' and au.active)
  )
  with check (
    auth.uid() = user_id
    and exists (select 1 from allowed_users au where au.email = auth.jwt()->>'email' and au.active)
  );

-- ── training_entries_unique_slot: index -> deferrable constraint ────────────────────
-- Needed so reschedule_apply/reschedule_reset can defer the uniqueness check to the end
-- of the function body instead of after every individual write inside it. Same columns,
-- zero behavior change for every existing .upsert(row, {onConflict:'user_id,week,day,
-- exercise_id'}) call site.
drop index if exists training_entries_unique_slot;

alter table training_entries
  add constraint training_entries_unique_slot
  unique (user_id, week, day, exercise_id)
  deferrable initially immediate;

-- ── reschedule_apply ────────────────────────────────────────────────────────────────
-- Applies a batch of destination-day rows for one program week. p_rows is a JSON array
-- of { day, slot, origin_day, from_day }, built by schedule-resolver.js's
-- buildMovePayload/buildShiftPayload. `from_day` is ephemeral — it tells this function
-- which day's CURRENT training_entries rows should relocate to `day`; it is never
-- itself stored.
--
-- Deliberately NOT security definer: runs as the calling (authenticated) role, so table
-- RLS policies apply exactly as if the client had issued these writes directly —
-- auth.uid() is the only source of "which user," never a client-supplied param.
create or replace function reschedule_apply(p_week int, p_rows jsonb)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'reschedule_apply: no authenticated user (auth.uid() is null)';
  end if;

  set constraints training_entries_unique_slot deferred;

  -- 1) schedule_overrides --------------------------------------------------------
  with rows as (
    select
      (r->>'day')::int        as day,
      (r->>'slot')::int       as slot,
      (r->>'origin_day')::int as origin_day
    from jsonb_array_elements(p_rows) as r
  ),
  deleted as (
    delete from schedule_overrides so
    using rows
    where so.user_id = v_user
      and so.week = p_week
      and so.day = rows.day
      and rows.slot = rows.day
      and rows.origin_day = rows.day
    returning so.day
  )
  insert into schedule_overrides (user_id, week, day, slot, origin_day)
  select v_user, p_week, rows.day, rows.slot, rows.origin_day
  from rows
  -- IS DISTINCT FROM (not <>/=) matters here specifically because slot can be NULL:
  -- plain `NOT (slot = day AND origin_day = day)` evaluates to NULL when slot IS NULL,
  -- which would silently drop every vacated-day row from this INSERT.
  where rows.slot is distinct from rows.day or rows.origin_day is distinct from rows.day
  on conflict (user_id, week, day)
  do update set slot = excluded.slot, origin_day = excluded.origin_day;
  -- If p_rows ever contained two elements with the same `day`, this INSERT fails fast
  -- here with Postgres' own "ON CONFLICT DO UPDATE command cannot affect row a second
  -- time" error, instead of silently applying one and dropping the other.

  -- 2) training_entries relocation ------------------------------------------------
  --
  -- WHY THIS IS ONE STATEMENT, NOT A LOOP: p_rows can describe a closed rotation, e.g.
  -- A->B->C->A. Three separate `UPDATE ... WHERE day = from` statements run in sequence
  -- would have the second statement's "day = B" predicate match what the FIRST
  -- statement just wrote there, not what actually originated at B — silently
  -- duplicating A's entries onto C and losing B's entirely. A single UPDATE ... FROM
  -- joined against a mapping derived once from p_rows does not have this hazard:
  -- Postgres evaluates the matched-row set against the table's state as of the START of
  -- the statement, and every matched row is assigned its new `day` in that one pass —
  -- the same guarantee that makes `UPDATE t SET a=b, b=a` a safe in-place swap.
  with mapping as (
    select
      (r->>'day')::int       as to_day,
      (r->>'from_day')::int  as from_day
    from jsonb_array_elements(p_rows) as r
    where (r->>'from_day') is not null
      and (r->>'from_day')::int <> (r->>'day')::int
  )
  update training_entries te
  set day = mapping.to_day
  from mapping
  where te.user_id = v_user
    and te.week = p_week
    and te.day = mapping.from_day;

  -- PRECONDITION this relies on, not re-verified here: p_rows describes a closed
  -- permutation over a set of distinct days — every `day` appears at most once, every
  -- non-null `from_day` is either some row's `day` or an untouched day. Under that
  -- precondition the mapping join is 1-to-1 both ways, so no two sources ever target the
  -- same destination. If the caller violates this, the deferred unique constraint raises
  -- at COMMIT and the whole transaction rolls back — no partial relocation is ever left
  -- committed. schedule-resolver.js's buildMovePayload/buildShiftPayload are the only
  -- intended producers of p_rows and both maintain this precondition by construction.
end;
$$;

-- ── reschedule_reset ────────────────────────────────────────────────────────────────
-- "Put this week back" — every displaced entry returns to its natural day, every
-- schedule_overrides row for that week is deleted. Same single-statement relocation
-- approach as reschedule_apply, for the same reason.
create or replace function reschedule_reset(p_week int)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'reschedule_reset: no authenticated user (auth.uid() is null)';
  end if;

  set constraints training_entries_unique_slot deferred;

  with mapping as (
    select day as from_day, origin_day as to_day
    from schedule_overrides
    where user_id = v_user and week = p_week and origin_day <> day
  )
  update training_entries te
  set day = mapping.to_day
  from mapping
  where te.user_id = v_user
    and te.week = p_week
    and te.day = mapping.from_day;

  delete from schedule_overrides
  where user_id = v_user and week = p_week;
end;
$$;

-- First RPC/stored-function use in this codebase — explicit revoke-then-grant as
-- defense in depth alongside the auth.uid() check and table RLS (Supabase convention).
revoke all on function reschedule_apply(int, jsonb) from public;
revoke all on function reschedule_reset(int)         from public;
grant execute on function reschedule_apply(int, jsonb) to authenticated;
grant execute on function reschedule_reset(int)         to authenticated;
