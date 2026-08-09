-- The Path — RLS policies
-- Run after schema.sql.
--
-- Every policy layers two checks: OWN ROW (auth.uid() = user_id) AND APPROVED
-- (the signed-in email exists and is active in allowed_users). The second check is
-- what makes access revocable — set allowed_users.active = false and every table
-- below stops returning/accepting that user's data immediately, without deleting
-- anything. It also means a stranger who signs in with Google (Supabase Auth allows
-- this unconditionally) gets a real but functionally empty account: 0 rows in, 0 rows out.

alter table training_entries  enable row level security;
alter table program_settings  enable row level security;
alter table week_skips        enable row level security;
alter table allowed_users     enable row level security;

-- The app needs to answer "is the signed-in user approved?" client-side (to show the
-- login vs. "not authorized" screen), so a signed-in user may read ONLY their own row —
-- never the roster, never anyone else's. This leaks nothing beyond the email they signed
-- in with. No insert/update/delete policy exists, so granting/revoking access still only
-- happens via the Supabase SQL editor (service role bypasses RLS) — see README.
create policy "self read own allow-list row" on allowed_users
  for select
  using (email = auth.jwt()->>'email');

create policy "owner full access" on training_entries
  for all
  using (
    auth.uid() = user_id
    and exists (select 1 from allowed_users au where au.email = auth.jwt()->>'email' and au.active)
  )
  with check (
    auth.uid() = user_id
    and exists (select 1 from allowed_users au where au.email = auth.jwt()->>'email' and au.active)
  );

create policy "owner full access" on program_settings
  for all
  using (
    auth.uid() = user_id
    and exists (select 1 from allowed_users au where au.email = auth.jwt()->>'email' and au.active)
  )
  with check (
    auth.uid() = user_id
    and exists (select 1 from allowed_users au where au.email = auth.jwt()->>'email' and au.active)
  );

create policy "owner full access" on week_skips
  for all
  using (
    auth.uid() = user_id
    and exists (select 1 from allowed_users au where au.email = auth.jwt()->>'email' and au.active)
  )
  with check (
    auth.uid() = user_id
    and exists (select 1 from allowed_users au where au.email = auth.jwt()->>'email' and au.active)
  );

-- To grant/revoke access (v1 has no admin UI — use the Supabase SQL editor):
--   insert into allowed_users (email) values ('friend@gmail.com');
--   update allowed_users set active = false where email = 'friend@gmail.com';
