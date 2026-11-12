---
name: ottabase-update
description:
    Update an app repo built on Ottabase (a private copy of the public monorepo, optionally with Ottabase Pro at
    packages/pro) to the latest public Ottabase and the latest Pro release, keeping every local change. Use for "update
    Ottabase", "pull the latest Ottabase", "upgrade Pro", "sync with upstream", "we're behind main". Clones upstream
    into the git-ignored `.upstream/`, applies what upstream changed since this repo last synced, keeps the repo's
    recorded local changes (OTTABASE_LOCAL.md), and checks nothing of the app was lost.
---

# Update an Ottabase app repo

Self-contained runbook. It needs git, Node and pnpm, and network access to the upstream repos. Its scripts live next to
this file in `scripts/` and depend on nothing but Node and git, because the update rewrites this repo's own packages
(the CLI included) while it runs. The model behind it, and the rules for changing upstream code between updates, are in
[`docs/BUILDING_ON_OTTABASE.md`](../../../docs/BUILDING_ON_OTTABASE.md).

**How it works.** Upstream lives in full clones under `.upstream/` (git-ignored, never committed). This repo records
which upstream version it last synced to (the **base**, in `.ottabase-upstream.json`) and, when it changed
upstream-owned code, what and why (the **ledger**, `OTTABASE_LOCAL.md`). The update is exactly what upstream changed
from base to the new version, applied on top of this repo. Anything this repo changed since base is the owner's work and
stays.

Never compare this repo with the latest upstream and "make it match", and never `git merge` upstream: without the base,
an owner's edit and an upstream change look the same, and the owner's work gets reverted.

Asking for an update is permission to create a branch and commit on it. Nothing leaves the machine: no push, no deploy,
no `init` against a remote database, no secret changes. Those go in the report as steps for the owner.

## 0. Preflight

1. `git status --porcelain` must be empty. If not, stop and ask: commit or stash is the owner's call. (A large
   uncommitted port is committed first, even as a WIP commit; the apply starts from a known state.)
2. Stop if `origin` is the public repo itself (`github.com/ottabase/ottabase`) or `packages/pro/.git` exists (the Pro
   maintainer layout). This skill is for app repos.
3. `.upstream/` (with the dot: most globbing tools skip dot folders) must be in `.gitignore` and `.prettierignore`. Add
   the lines if missing.
4. Find the apps: every `apps/*/ottabase/packages.ts`; each list is that app's installed packages.
5. Read `OTTABASE_LOCAL.md` if it exists, and run `node .claude/skills/ottabase-update/scripts/check.mjs`. It must pass
   before you start: a marker without a row, or a row whose marker is already gone, is fixed (or put to the owner)
   first, or this update cannot tell what it dropped.
6. `git switch -c update/ottabase-<yyyy-mm-dd>`. Rollback is deleting the branch.

## 1. Fetch upstream

Full clones: no `--depth`, no `--filter`. The base commit and its file contents must be local, or the three-way apply
has nothing to compare against.

```bash
[ -d .upstream/ottabase ] || git clone https://github.com/ottabase/ottabase.git .upstream/ottabase
git -C .upstream/ottabase fetch origin --prune
NEW=$(git -C .upstream/ottabase rev-parse origin/main)

# Only when packages/pro exists. Needs the GitHub account that has Pro access; if refused, update public only and say why.
[ -d .upstream/pro ] || git clone https://github.com/ottabase/pro.git .upstream/pro
git -C .upstream/pro fetch origin --tags --prune
PRO_NEW=$(git -C .upstream/pro tag --list 'v*' --sort=-v:refname | head -1)
```

## 2. Find the bases

`.ottabase-upstream.json` at the repo root is the source of truth when it exists (step 7 updates it every run):

```json
{
    "public": {
        "url": "https://github.com/ottabase/ottabase.git",
        "commit": "<sha>",
        "committedAt": "2026-10-24T18:02:11+00:00",
        "syncedAt": "2026-10-25"
    },
    "pro": {
        "url": "https://github.com/ottabase/pro.git",
        "tag": "v1.1.1",
        "committedAt": "2026-10-20T09:30:00+00:00",
        "syncedAt": "2026-10-25"
    },
    "apps": { "otta-web": "my-app" }
}
```

`commit` (or Pro's `tag`) is the base. `committedAt` is when upstream made that commit and `syncedAt` is the day this
repo took it: both are for people comparing versions, nothing reads them. `otta pro update` sets `pro` here too, so a
Pro release pulled with that command is not applied a second time.

`apps` maps an upstream app folder to this repo's, for every app the owner renamed. The apply script lands those changes
in the renamed app; without the entry they all end up in `skipped`.

No file (first run): derive the bases, then tell the owner how each was found.

- **Public.** Let the clone see this repo, then ask git:

    ```bash
    git -C .upstream/ottabase fetch "$(pwd)" HEAD:refs/local/head
    BASE=$(git -C .upstream/ottabase merge-base origin/main refs/local/head)
    ```

    No merge base (the repo was started by copying files, not cloning): ask the owner which date or commit they started
    from. If they don't know, propose one: among the `origin/main` commits around this repo's first commit date, the one
    whose `packages/` differs least
    (`git -C .upstream/ottabase diff --shortstat <candidate> refs/local/head -- packages/`). Confirm it with them before
    using it.

- **Pro.** The `git-subtree-split: <sha>` trailer of `git log -1 --grep="git-subtree-dir: packages/pro" --format=%B`,
  then `git -C .upstream/pro describe --tags --exact-match <sha>`. Failing that, the newest released heading in
  `packages/pro/CHANGELOG.md` (`## 1.1.1 (…)` is tag `v1.1.1`).

- **Apps and ledger.** Map every renamed app into `apps`. If this repo has no ledger,
  `git -C .upstream/ottabase diff --stat $BASE refs/local/head -- packages/` shows what it changed in upstream-owned
  code. Show the owner the list and record the ones they must not lose (format in `docs/BUILDING_ON_OTTABASE.md`); the
  rest still merge three-way and show up in the regression map if dropped.

Base equal to new: already up to date for that side, skip it.

## 3. Read the intent before touching code

Upstream writes down why things changed. Read that first; it decides every judgment call later.

```bash
git -C .upstream/ottabase log --oneline $BASE..$NEW
git -C .upstream/ottabase diff $BASE $NEW -- CHANGELOG.md        # the new entries
git -C .upstream/ottabase diff --stat $BASE $NEW
git -C .upstream/pro diff $PRO_OLD $PRO_NEW -- CHANGELOG.md
```

Each Pro entry names the public Ottabase it needs. Public must reach at least that first.

Build a checklist before applying anything:

- **Breaking:** renamed or merged packages, removed exports, changed config shapes, toolchain moves.
- **Security:** anything about auth, sessions, RLS, tenant isolation, permissions, sanitising, a "hole", a "leak". These
  are mandatory. If one lands in code this repo changed, port it by hand. Never drop one.
- **Manual steps:** `otta add`, `ottaorm/init`, new env vars, secrets or bindings, Cloudflare settings.
- **The ledger:** for each row, does upstream now offer the same thing (an option, a hook, a fix)? Then the row can go
  and the change becomes config (step 7).

Big gap (dozens of entries, or a breaking entry in the middle): run steps 4 to 6 once per breaking release, with `NEW`
set to that release's commit, and verify after each. Several small updates beat one unreadable one.

## 4. Apply upstream's changes

Git applies what fits; you port the rest. Each changed file is applied on its own with a three-way fallback, so one
misfit never blocks the others:

```bash
node .claude/skills/ottabase-update/scripts/apply.mjs .upstream/ottabase $BASE $NEW
```

The script reads `apps` and the ledger's `owned` rows, borrows the clone's objects so the three-way fallback can read
upstream's old versions, and cleans the index up afterwards (otherwise `git status` fails with "unable to read <sha>").
Then work the lists in `.upstream/run/ottabase/`:

- **clean:** applied. Skim the diff of anything under `apps/`. For a file that carries an `ottabase-local` marker, read
  the merged result anyway: a clean three-way merge of two sides that built the same thing is how duplicate code gets
  in.
- **conflict:** markers in the file. Resolve by who owns the path (table below), then `git add` it.
- **owned:** upstream changed a path the ledger marks `owned`; nothing was applied, whether this repo kept the file as
  its own or deleted it. Read upstream's change (`git -C .upstream/ottabase diff $BASE $NEW -- <file>`) and carry over
  by hand any part that matters. A security fix always does; for a deleted file it goes in the report.
- **failed:** the file no longer matches upstream's old version (renamed, moved or deleted here, or rewritten). Read
  upstream's change (`git -C .upstream/ottabase diff $BASE $NEW -- <file>`) and port its intent into the local file. If
  the owner deleted the file without a ledger row, leave it deleted unless the change is a security fix; flag it and
  suggest an `owned` row.
- **skipped:** files under an app this repo doesn't have (deleted, or new upstream). A renamed app missing from `apps`
  lands here: add the mapping and run the script again on a clean tree.
- **generated:** not patched. `pnpm install` regenerates the lockfile in step 6. Copy upstream's `llms*.txt` only if
  this repo already has them (`git -C .upstream/ottabase show $NEW:llms.txt > llms.txt`).

| Path                         | Owner     | On a conflict                                                                                   |
| ---------------------------- | --------- | ----------------------------------------------------------------------------------------------- |
| `packages/**`, root tooling  | upstream  | Take upstream's side, then put this repo's change back on top of it (below).                    |
| `apps/**`                    | this repo | Keep this repo's side and bring upstream's intent into it (the CHANGELOG says what it was for). |
| `CHANGELOG.md`, README, docs | both      | Keep both sides.                                                                                |

Putting a change back in an upstream-owned file: this repo's side of the conflict (and `git show HEAD:<file>`) shows
what it had. Code under an `ottabase-local: <id>` marker is a recorded `patch`: re-apply it in upstream's new shape,
marker included. A local change with no marker: re-apply it too unless upstream now does the same thing, and tell the
owner it is unrecorded. Never drop local code silently.

After this, grep this repo's own code (`apps/`, any local packages) for every name the breaking items renamed or
removed, and fix the stragglers. Commit: `git add -A && git commit -m "Update Ottabase to <short NEW>"`.

**Pro**, only after public is at or past the version the Pro release needs (otherwise `pnpm install` fails on unknown
workspace packages). Same script, into `packages/pro`; conflicts there mean this repo edited Pro source, so the
`packages/**` rule applies:

```bash
node .claude/skills/ottabase-update/scripts/apply.mjs .upstream/pro $PRO_OLD $PRO_NEW --into packages/pro
```

Commit: `Update Ottabase Pro to <PRO_NEW>`.

## 5. Carry template changes into the app (what a patch can't see)

`otta add` copied files from each package's `app/` folder into the app (`app/ottabase/packages/<key>.ts` became
`apps/<app>/ottabase/packages/<key>.ts`, `app/src/pages/…` became `apps/<app>/src/pages/…`) and never overwrites them.
Step 4 updated the templates, not the app's copies. For every installed package with an `app/` folder:

1. What changed: `git -C .upstream/pro diff --name-status $PRO_OLD $PRO_NEW -- '*/app/*'`, and for public packages
   `git -C .upstream/ottabase diff --name-status $BASE $NEW -- 'packages/*/app/*'`.
2. For each changed template, compare the app's copy with the **old** template
   (`git -C .upstream/pro show $PRO_OLD:<pkg>/app/<path>`, or the upstream equivalent):
    - **Same as the old template** (never edited): replace it with the new one.
    - **Edited here:** `git merge-file -p <app copy> <old template file> <new template file>`, resolve conflicts by
      intent, and list it in the report. Compositions hold the owner's settings (plans, product ids, mail recipients):
      keep their values, take upstream's new shape and options.
    - **Missing here:** a new template for an installed package is copied in. A copy the owner deleted stays deleted;
      mention it.
3. Wiring: `pnpm otta add <pkg> <app> --dry-run` shows what a fresh install would add now (routes, account-menu entries,
   table re-exports, the error reporter). It never overwrites. If the plan looks right, run it without `--dry-run`. A
   package new in this release is installed only if the owner wants it: ask.

Commit: `Carry Ottabase template changes into <app>`.

## 6. Verify

```bash
pnpm install
pnpm build:pkg
pnpm otta type-check <app>
pnpm otta lint <app>
pnpm otta test <app>
node .claude/skills/ottabase-update/scripts/check.mjs
```

Then `pnpm ci:check` if time allows. Fix what the update broke; never weaken or skip a test to get green. A failure that
is upstream's own (it fails in `.upstream/ottabase` too) goes in the report, unfixed. Errors that a stricter upstream
check now finds in code this repo wrote (a new type-check program, a new lint rule) are this repo's to fix, not the
update's to suppress. Commit the fixes and the new lockfile.

`check.mjs` failing with **Lost** means a recorded patch did not survive: re-apply it. **Unrecorded** means code carries
a marker the ledger does not list: add the row.

Then check what neither catches. Tests rarely cover what an app changed in upstream code, so map it:

```bash
node .claude/skills/ottabase-update/scripts/regression-map.mjs .upstream/ottabase $BASE <commit before the update>
```

`.upstream/run/regression-map.md` lists every line this repo had added (since `$BASE`) that no longer appears in the
same file, and every file it had changed that is gone. Read it by area (worker, client, packages, docs; split a long map
across reviewers by area) and give each entry one verdict:

- **superseded:** upstream now does the same thing, or better; or a rename that keeps the behavior. Fine.
- **regression:** a feature, route, setting, copy, permission rule or test the app had is gone. Restore it in the
  current code's shape, with a test; if it lives in upstream-owned code, propose a ledger row and marker to the owner.
- **judgment:** a trade-off or anything security-relevant. Do not change it; put it in the report.

Then check the rest by hand:

- **Schema.** New models or columns ship with the update. Tables change only when `POST /api/ottaorm/init` runs in each
  environment (production needs `MIGRATION_SECRET`). Renames and drops need `allowDestructive`: never run that against
  real data; list it for the owner.
- **Bindings and env.**
  `git -C .upstream/ottabase diff $BASE $NEW -- '*wrangler.jsonc' '*cloudflare-env.d.ts' '*.env.example' '*.dev.vars.example'`.
  New bindings, vars or secrets go in the report; `wrangler.jsonc` and `cloudflare-env.d.ts` change together.
- **Defaults.** An upstream default that changed (a role, a redirect, a limit) changes the app too. Where the app wants
  the old behavior, set it in config; where there is no setting, put it to the owner: it would be a new package option,
  recorded as a `patch` (and a good upstream issue).
- Never touch `.env.local`, `.dev.vars` or any secret file.

## 7. Record and report

Update `.ottabase-upstream.json`: public `commit` = `NEW`, Pro `tag` = `PRO_NEW`, each with its `committedAt`
(`git -C .upstream/ottabase show -s --format=%cI $NEW`, and the same in `.upstream/pro` for `$PRO_NEW^{commit}`) and
today's `syncedAt`. Change only those; `apps` and anything else stay. Update the ledger: a row upstream now covers
becomes config and is removed with its markers. Commit both.

Report to the owner, in this order:

1. **From → to:** public base → new (short shas and dates), Pro tag → tag.
2. **Applied cleanly:** counts from `.upstream/run/*/clean` and the CHANGELOG headlines, not a file list.
3. **Judgment calls:** every conflict, owned, failed or skipped file: what upstream did, what this repo had, what was
   kept and why.
4. **Local changes:** each ledger row and how it landed (kept as it was, re-applied by hand, dropped because upstream
   now covers it). Unrecorded changes found on the way, for the owner to record or let go. Patches that could be
   upstream options or hooks.
5. **Regressions:** what the regression map found and what was restored; the judgment entries left for the owner.
6. **Security fixes:** each one and how it landed (applied cleanly, or ported by hand into local code).
7. **For the owner to do:** `ottaorm/init` per environment, new secrets and bindings, Cloudflare settings, new packages
   they may want to `otta add`, anything left deleted.
8. **Gates:** each command and its result, with the output of anything that failed.

Then: review `git diff <owner-branch>...update/ottabase-<date>`, and merge the branch when happy. `.upstream/` can stay
for next time (a fetch is faster than a clone) or be deleted.

## Gotchas

- A shallow or blob-less clone breaks the three-way fallback: every patch that doesn't apply exactly lands in `failed`.
- Pro before public fails at `pnpm install` when a release renamed a workspace package. Order is public, then Pro.
- After the first run, this repo's history no longer shares commits with upstream, so `merge-base` would return a stale
  base. The JSON record is the truth; derive only when it's missing.
- Root-level tools that glob everything (a root `vitest`, `prettier .`) would also scan `.upstream/`; exclude it there.
  Keep the leading dot: a name without it (`_upstream`, `upstream-repos`) is not skipped by default anywhere.
- A repo-wide rename upstream can fold two `vi.mock()` calls onto one module in this repo's tests, and a package mocked
  from app tests needs the same source alias in the app's `vitest.config.ts` as in its `tsconfig.json`, or the mock
  misses.
- Upstream renaming its own repository (links in READMEs, `package.json` `repository` fields) conflicts with this repo's
  own links on every file. Mark those files `owned` in the ledger once.
- Don't run a formatter across the repo afterwards: format only files you touched, with the repo's own config.
- A rebuilt `dist/` is required before type-check sees a package change (`pnpm build:pkg`).
- On Windows, stopping a background `wrangler dev` or `vite` can leave the child process holding its port; use other
  ports for a second run and tell the owner what is still running.
