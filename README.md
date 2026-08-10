# The Path

Personal training-log web app. Static HTML/JS frontend, Supabase (Postgres + Auth + RLS)
backend, algorithmic progression — the app reads your prior logged results and computes
next week's prescriptions client-side; there's no manual weekly programming.

## Before this works

`js/data/exercises.js` has a drift-check (`console.error` on load) that fires if this
file and `RULE_MAP` in the engine ever disagree on which exercise ids exist — check the
browser console after any edit to either file.

Several exercises were reclassified from a flat type to a staged (`TIER`) ladder as real
progressions were defined for them (currently: `squat-hold` "Horse Stance", `side-lever`,
`nordic-curl`, `toes-to-bar`, `pike-handstand-hold` "Handstand" — see `RULE_MAP` in
`js/lib/progression-engine.js`). If you add a progression for another exercise, follow
the same pattern: change its `RULE_MAP` entry to `{ type:'TIER', unit:'tier',
params:{ subUnit:'sec'|'reps', tiers:[...] } }`, and check whether its coach/cue/abort
copy in `exercises.js` still holds across every stage (a cue that only makes sense at
the hardest stage needs generalizing, same as was done for the exercises above).

## One-time setup

### 1. Supabase project
1. Create a project at supabase.com.
2. SQL editor: run `supabase/schema.sql`, then `supabase/policies.sql`.
   - Already ran `schema.sql` before `rest_seconds_load`/`rest_seconds_default` existed
     on `program_settings`? Also run `supabase/migration_002_rest_settings.sql` once —
     a fresh install doesn't need this, `schema.sql` already includes those columns.
3. Approve yourself (and anyone else) to actually use the app — RLS blocks everyone by
   default until they're in this table:
   ```sql
   insert into allowed_users (email) values ('you@gmail.com'), ('spouse@gmail.com');
   ```
   Revoke access later with `update allowed_users set active = false where email = ...` —
   this never deletes their logged data.
4. Authentication → Providers → Google: create an OAuth 2.0 Client ID in Google Cloud
   Console (Web application), redirect URI `https://<project-ref>.supabase.co/auth/v1/callback`,
   paste the Client ID/Secret in here and enable.
5. Authentication → URL Configuration: set Site URL (and add to the redirect allow-list)
   to your eventual GitHub Pages URL, e.g. `https://<username>.github.io/<repo>/`.

Sign-in itself is open to any Google account (that's intentional — see `allowed_users`
above for how access is actually gated); no Google Console restriction is needed.

### 2. GitHub repo
1. Push this folder as the repo root (not a subfolder — the workflows assume `app/` IS
   the repo root).
2. Repo Settings → Secrets and variables → Actions: add `SUPABASE_URL` and
   `SUPABASE_ANON_KEY` (Supabase dashboard → Project Settings → API).
3. Repo Settings → Pages → Source: **GitHub Actions**.
4. Push to `main` — `.github/workflows/deploy.yml` builds `js/config.js` from the secrets
   above (never committed) and deploys.

### 3. First sign-in
Each user sets their own Week 0 / Day 1 date on first sign-in (this anchors the Calendar
tab). It can be changed later from More → Restart program — that also clears any
recorded vacation weeks, since they'd otherwise misalign against the new date.

## Local development

```
cp js/config.example.js js/config.js   # fill in your Supabase project's URL/anon key
```
Then serve `app/` with any static file server (e.g. `npx serve`) — there's no build step.
`js/config.js` is gitignored; don't commit it.

## Verifying the progression engine independently

`js/lib/progression-engine.js` is a copy of `../progression_engine_v1.js` (one sibling
directory up) with two `RULE_MAP` corrections applied — see the file's own header comment
for the diff. To sanity-check a prescription outside the app:
```js
// node --input-type=module
import { computeRx } from './js/lib/progression-engine.js';
computeRx('dead-hang', [{ id: 'dead-hang', value: 62, weekIndex: 0, formClean: true }]);
```
(Uses dynamic ESM import since this file now carries `export` statements for the browser,
not just the original's CommonJS `module.exports` — see the comment at the bottom of the
file. The untouched original in the parent directory still works with plain `require()`.)

## Architecture notes

- `js/services/*.js` is the only layer that talks to Supabase. UI modules (`js/ui/*`)
  never call `supabase` directly.
- `js/lib/progression-engine.js` never reads or writes anything — `js/services/rx-service.js`
  is the only bridge between it and the database, per the engine's own porting contract.
- Coach (read-only) access is designed but not enabled — `supabase/policies_coach_future.sql`
  is additive SQL to run when that feature is actually built.
