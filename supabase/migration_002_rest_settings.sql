-- Run this once in the Supabase SQL editor against an existing project that already
-- ran schema.sql before rest_seconds_load/rest_seconds_default existed. A fresh install
-- doesn't need this — schema.sql already includes these columns.
-- No policy changes needed: the existing "owner full access" policy on program_settings
-- is a whole-row policy, so it already covers these new columns.

alter table program_settings
  add column if not exists rest_seconds_load integer not null default 180,
  add column if not exists rest_seconds_default integer not null default 90;
