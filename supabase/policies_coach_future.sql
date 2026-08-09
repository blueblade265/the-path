-- The Path — future read-only coach access
--
-- NOT applied yet. This is the designed-in extension point: adding a read-only "coach"
-- role is meant to be exactly this file (a new table + one new SELECT policy), never a
-- rebuild of training_entries or its existing policies. Postgres RLS ORs all permissive
-- policies for a given command together, so this purely ADDS a read path — it cannot
-- weaken or replace the "owner full access" policy in policies.sql, and it grants nothing
-- on auth.users or any other table (never touches PII, only training_entries rows the
-- athlete has explicitly linked).
--
-- Run this when the coach feature is actually built.

create table coach_links (
  coach_user_id   uuid not null references auth.users(id) on delete cascade,
  athlete_user_id uuid not null references auth.users(id) on delete cascade,
  created_at      timestamptz not null default now(),
  primary key (coach_user_id, athlete_user_id)
);

alter table coach_links enable row level security;

-- An athlete can see (and later, manage) who has been granted access to their own data.
create policy "athlete manages own coach links" on coach_links
  for all
  using (auth.uid() = athlete_user_id)
  with check (auth.uid() = athlete_user_id);

create policy "coach read-only access" on training_entries
  for select
  using (
    exists (
      select 1 from coach_links cl
      where cl.athlete_user_id = training_entries.user_id
        and cl.coach_user_id = auth.uid()
    )
  );
