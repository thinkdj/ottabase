---
name: ottabase-update
description:
    Update an app repo built on Ottabase (a private copy of the public monorepo, optionally with Ottabase Pro at
    packages/pro) to the latest public Ottabase and the latest Pro release, keeping every local change. Use for "update
    Ottabase", "pull the latest Ottabase", "upgrade Pro", "sync with upstream", "we're behind main". Clones upstream
    into the git-ignored `.repos.upstream/`, applies what upstream changed since this repo last synced, and ports the
    rest by intent.
---

# Update an Ottabase app repo

Self-contained runbook. It needs git (Git Bash on Windows), pnpm and network access to the upstream repos.

**How it works.** Upstream lives in full clones under `.repos.upstream/` (git-ignored, never committed). This repo
records which upstream version it last synced to: the **base**. The update is exactly what upstream changed from base to
the new version, applied on top of this repo. Anything this repo changed since base is the owner's work and stays.

Never compare this repo with the latest upstream and "make it match": without the base, an owner's edit and an upstream
change look the same, and the owner's work gets reverted.

Asking for an update is permission to create a branch and commit on it. Nothing leaves the machine: no push, no deploy,
no `init` against a remote database, no secret changes. Those go in the report as steps for the owner.

## 0. Preflight

1. `git status --porcelain` must be empty. If not, stop and ask: commit or stash is the owner's call.
2. Stop if `origin` is the public repo itself (`github.com/thinkdj/ottabase`) or `packages/pro/.git` exists (the Pro
   maintainer layout). This skill is for app repos.
3. `.repos.upstream/` must be in `.gitignore` (add the line if missing) and in `.prettierignore` if the repo has one.
4. Find the apps: every `apps/*/ottabase/packages.ts`; each list is that app's installed packages.
5. `git switch -c update/ottabase-<yyyy-mm-dd>`. Rollback is deleting the branch.

## 1. Fetch upstream

Full clones: no `--depth`, no `--filter`. The base commit and its file contents must be local, or the three-way apply
has nothing to compare against.

```bash
[ -d .repos.upstream/ottabase ] || git clone https://github.com/thinkdj/ottabase.git .repos.upstream/ottabase
git -C .repos.upstream/ottabase fetch origin --prune
NEW=$(git -C .repos.upstream/ottabase rev-parse origin/main)

# Only when packages/pro exists. Needs the GitHub account that has Pro access; if refused, update public only and say why.
[ -d .repos.upstream/pro ] || git clone https://github.com/ottabase/pro.git .repos.upstream/pro
git -C .repos.upstream/pro fetch origin --tags --prune
PRO_NEW=$(git -C .repos.upstream/pro tag --list 'v*' --sort=-v:refname | head -1)
```

## 2. Find the bases

`.ottabase-upstream.json` at the repo root is the source of truth when it exists (step 7 writes it every run):

```json
{
    "public": { "url": "https://github.com/thinkdj/ottabase.git", "commit": "<sha>", "syncedAt": "2026-10-25" },
    "pro": { "url": "https://github.com/ottabase/pro.git", "tag": "v1.1.1", "syncedAt": "2026-10-25" }
}
```

No file (first run): derive the bases, then tell the owner how each was found.

- **Public.** Let the clone see this repo, then ask git:

    ```bash
    git -C .repos.upstream/ottabase fetch "$(pwd)" HEAD:refs/local/head
    BASE=$(git -C .repos.upstream/ottabase merge-base origin/main refs/local/head)
    ```

    No merge base (the repo was started by copying files, not cloning): ask the owner which date or commit they started
    from. If they don't know, propose one: among the `origin/main` commits around this repo's first commit date, the one
    whose `packages/` differs least
    (`git -C .repos.upstream/ottabase diff --shortstat <candidate> refs/local/head -- packages/`). Confirm it with them
    before using it.

- **Pro.** The `git-subtree-split: <sha>` trailer of `git log -1 --grep="git-subtree-dir: packages/pro" --format=%B`,
  then `git -C .repos.upstream/pro describe --tags --exact-match <sha>`. Failing that, the newest released heading in
  `packages/pro/CHANGELOG.md` (`## 1.1.1 (…)` is tag `v1.1.1`).

Base equal to new: already up to date for that side, skip it.

## 3. Read the intent before touching code

Upstream writes down why things changed. Read that first; it decides every judgment call later.

```bash
git -C .repos.upstream/ottabase log --oneline $BASE..$NEW
git -C .repos.upstream/ottabase diff $BASE $NEW -- CHANGELOG.md        # the new entries
git -C .repos.upstream/ottabase diff --stat $BASE $NEW
git -C .repos.upstream/pro diff $PRO_OLD $PRO_NEW -- CHANGELOG.md
```

Each Pro entry names the public Ottabase it needs. Public must reach at least that first.

Build a checklist before applying anything:

- **Breaking:** renamed or merged packages, removed exports, changed config shapes, toolchain moves.
- **Security:** anything about auth, sessions, RLS, tenant isolation, permissions, sanitising, a "hole", a "leak". These
  are mandatory. If one lands in code this repo changed, port it by hand. Never drop one.
- **Manual steps:** `otta add`, `ottaorm/init`, new env vars, secrets or bindings, Cloudflare settings.

Big gap (dozens of entries, or a breaking entry in the middle): run steps 4 to 6 once per breaking release, with `NEW`
set to that release's commit, and verify after each. Several small updates beat one unreadable one.

## 4. Apply upstream's changes

Git applies what fits; you port the rest. Each changed file is applied on its own with a three-way fallback, so one
misfit never blocks the others. Save this as `.repos.upstream/apply.sh`:

```bash
# usage: . .repos.upstream/apply.sh <clone> <from> <to> [<folder in this repo>]
up="$1"; from="$2"; to="$3"; prefix="${4:+$4/}"; dirarg="${4:+--directory=$4}"
out=".repos.upstream/run/$(basename "$up")"; rm -rf "$out"; mkdir -p "$out"; touch "$out"/{clean,conflict,failed,skipped,generated}
export GIT_ALTERNATE_OBJECT_DIRECTORIES="$(cd "$up/.git/objects" && pwd -W 2>/dev/null || pwd)"
git -C "$up" diff --name-only --no-renames "$from" "$to" | while IFS= read -r f; do
    target="$prefix$f"
    case "$target" in
        pnpm-lock.yaml | llms.txt | llms-full.txt) echo "$target" >> "$out/generated"; continue ;;
        apps/*) app="${target#apps/}"; [ -d "apps/${app%%/*}" ] || { echo "$target" >> "$out/skipped"; continue; } ;;
    esac
    git -C "$up" diff --binary --no-renames "$from" "$to" -- "$f" > "$out/one.patch"
    git apply --3way $dirarg "$out/one.patch" 2>> "$out/apply.log"; status=$? # non-zero on conflicts too
    if [ -n "$(git diff --name-only --diff-filter=U -- "$target")" ]; then echo "$target" >> "$out/conflict"
    elif [ $status -eq 0 ]; then echo "$target" >> "$out/clean"
    else echo "$target" >> "$out/failed"; fi
done
unset GIT_ALTERNATE_OBJECT_DIRECTORIES
wc -l "$out"/{clean,conflict,failed,skipped,generated}
```

The alternate object directory lets this repo read the clone's file versions, which is what makes the three-way fallback
work without pulling upstream history into this repo.

```bash
. .repos.upstream/apply.sh .repos.upstream/ottabase $BASE $NEW
```

Then work the lists in `.repos.upstream/run/ottabase/`:

- **clean:** done. Skim the diff of anything under `apps/`.
- **conflict:** markers in the file. Resolve by who owns the path (table below), then `git add` it.
- **failed:** the file no longer matches upstream's old version (renamed, moved or deleted here, or rewritten). Read
  upstream's change (`git -C .repos.upstream/ottabase diff $BASE $NEW -- <file>`) and port its intent into the local
  file. If the owner deleted the file, leave it deleted unless the change is a security fix; then flag it.
- **skipped:** files under an app this repo doesn't have (deleted, or new upstream). If the owner renamed
  `apps/otta-web`, port its changes into the renamed app:
  `git -C .repos.upstream/ottabase diff --binary $BASE $NEW -- apps/otta-web/<file> | git apply --3way -p3 --directory=apps/<name>`
  (with the same `GIT_ALTERNATE_OBJECT_DIRECTORIES` export).
- **generated:** not patched. Copy upstream's `llms*.txt`
  (`git -C .repos.upstream/ottabase show $NEW:llms.txt > llms.txt`); `pnpm install` regenerates the lockfile in step 6.

| Path                              | Owner     | On a conflict                                                                                                                                |
| --------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/**`                     | upstream  | Take upstream. If this repo had a real change there, re-apply it on top and list it in the report: it belongs upstream as an option or hook. |
| `apps/**`                         | this repo | Keep this repo's version and bring upstream's intent into it (the CHANGELOG says what the change was for). Never drop local code silently.   |
| `CHANGELOG.md`, `README.md`, docs | both      | Keep both sides.                                                                                                                             |

After this, grep this repo's own code (`apps/`, any local packages) for every name the breaking items renamed or
removed, and fix the stragglers. Commit: `git add -A && git commit -m "Update Ottabase to <short NEW>"`.

**Pro**, only after public is at or past the version the Pro release needs (otherwise `pnpm install` fails on unknown
workspace packages). Same script, into `packages/pro`; conflicts there mean this repo edited Pro source, so the
`packages/**` rule applies:

```bash
. .repos.upstream/apply.sh .repos.upstream/pro $PRO_OLD $PRO_NEW packages/pro
```

Commit: `Update Ottabase Pro to <PRO_NEW>`.

## 5. Carry template changes into the app (what a patch can't see)

`otta add` copied files from each package's `app/` folder into the app (`app/ottabase/packages/<key>.ts` became
`apps/<app>/ottabase/packages/<key>.ts`, `app/src/pages/…` became `apps/<app>/src/pages/…`) and never overwrites them.
Step 4 updated the templates, not the app's copies. For every installed package with an `app/` folder:

1. What changed: `git -C .repos.upstream/pro diff --name-status $PRO_OLD $PRO_NEW -- '*/app/*'`, and for public packages
   `git -C .repos.upstream/ottabase diff --name-status $BASE $NEW -- 'packages/*/app/*'`.
2. For each changed template, compare the app's copy with the **old** template
   (`git -C .repos.upstream/pro show $PRO_OLD:<pkg>/app/<path>`, or the upstream equivalent):
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
```

Then `pnpm ci:check` if time allows. Fix what the update broke; never weaken or skip a test to get green. A failure that
is upstream's own (it fails in `.repos.upstream/ottabase` too) goes in the report, unfixed. Commit the fixes and the new
lockfile.

Then check what tests can't:

- **Schema.** New models or columns ship with the update. Tables change only when `POST /api/ottaorm/init` runs in each
  environment (production needs `MIGRATION_SECRET`). Renames and drops need `allowDestructive`: never run that against
  real data; list it for the owner.
- **Bindings and env.**
  `git -C .repos.upstream/ottabase diff $BASE $NEW -- '*wrangler.jsonc' '*cloudflare-env.d.ts' '*.env.example' '*.dev.vars.example'`.
  New bindings, vars or secrets go in the report; `wrangler.jsonc` and `cloudflare-env.d.ts` change together.
- Never touch `.env.local`, `.dev.vars` or any secret file.

## 7. Record and report

Write `.ottabase-upstream.json` (public `commit` = `NEW`, Pro `tag` = `PRO_NEW`, today's `syncedAt`) and commit it.

Report to the owner, in this order:

1. **From → to:** public base → new (short shas and dates), Pro tag → tag.
2. **Applied cleanly:** counts from `.repos.upstream/run/*/clean` and the CHANGELOG headlines, not a file list.
3. **Judgment calls:** every conflict, failed or skipped file: what upstream did, what this repo had, what was kept and
   why. Local changes to `packages/**` that should become upstream options.
4. **Security fixes:** each one and how it landed (applied cleanly, or ported by hand into local code).
5. **For the owner to do:** `ottaorm/init` per environment, new secrets and bindings, Cloudflare settings, new packages
   they may want to `otta add`, anything left deleted.
6. **Gates:** each command and its result, with the output of anything that failed.

Then: review `git diff <owner-branch>...update/ottabase-<date>`, and merge the branch when happy. `.repos.upstream/` can
stay for next time (a fetch is faster than a clone) or be deleted.

## Gotchas

- A shallow or blob-less clone breaks the three-way fallback: every patch that doesn't apply exactly lands in `failed`.
- Pro before public fails at `pnpm install` when a release renamed a workspace package. Order is public, then Pro.
- After the first run, this repo's history no longer shares commits with upstream, so `merge-base` would return a stale
  base. The JSON record is the truth; derive only when it's missing.
- Root-level tools that glob everything (a root `vitest`, `prettier .`) would also scan `.repos.upstream/`; exclude it
  there.
- Don't run a formatter across the repo afterwards: format only files you touched, with the repo's own config.
- A rebuilt `dist/` is required before type-check sees a package change (`pnpm build:pkg`).
