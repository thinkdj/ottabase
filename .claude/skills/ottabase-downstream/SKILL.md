---
name: ottabase-downstream
description:
    For someone who maintains a framework repo (Ottabase, or their own) and an app built on it, or was given access to
    one: review that app for changes worth taking back into the framework. Use for "what can we take back from <app>",
    "review downstream", "port this from <app> into Ottabase". Reads the app's clone in the git-ignored
    `.downstream/<app>`, starts from its `OTTABASE_LOCAL.md` ledger and what it changed in framework code, ports the
    generic changes by intent, and records the reviewed commit in `.ottabase-downstream.json`.
---

# Take changes back from an app built on Ottabase

The mirror of `ottabase-update`. That skill moves Ottabase's changes into an app; this one moves an app's generic
changes into Ottabase. Run it in the framework repo (Ottabase itself, or the repo your own apps are built from), never
in the app, and only for an app that is yours or whose owner gave you access for this.

**How it works.** Each app is a plain clone under `.downstream/<app>` (git-ignored, never committed). The tracked file
`.ottabase-downstream.json` records which commit of each app was last reviewed. A review reads what the app changed in
framework code, sorts each change, and ports the generic ones into this repo as ordinary changes. Nothing is merged or
cherry-picked: the app's history is its own, and the app may be private.

Asking for a review is permission to read the clone and to commit on a new branch here. Nothing is pushed, and nothing
in the clone is edited: a change the app needs goes through the app's own repo.

## 0. Preflight

1. `git status --porcelain` must be empty. If not, stop and ask.
2. `.downstream/` (with the dot: most globbing tools skip dot folders) must be in `.gitignore` and `.prettierignore`.
3. The clone exists and is current. The owner supplies the address; it is not written down in this repo.

    ```bash
    APP=my-app
    [ -d .downstream/$APP ] || git clone <the app's repo> .downstream/$APP
    git -C .downstream/$APP pull --ff-only
    NOW=$(git -C .downstream/$APP rev-parse HEAD)
    ```

4. `git switch -c downstream/$APP-<yyyy-mm-dd>`. Rollback is deleting the branch.

## 1. Find the two starting points

**The last review.** `.ottabase-downstream.json` at the repo root, one entry per app, keyed by its folder name:

```json
{
    "my-app": { "commit": "<sha>", "committedAt": "2026-11-12T22:31:40+00:00", "reviewedAt": "2026-11-13" }
}
```

`commit` is the app commit the last review read (`LAST`). `committedAt` and `reviewedAt` are for people. No entry: this
is the first review, and everything in step 2 and 3 is new.

**The Ottabase the app is on.** `public.commit` in the app's `.ottabase-upstream.json` (`BASE`). The app's difference
from that commit, in framework paths, is exactly what it changed. Let the clone see this repo so it can compare:

```bash
git -C .downstream/$APP fetch "$(pwd)" HEAD:refs/ottabase/head
BASE=$(node -p "require('./.downstream/$APP/.ottabase-upstream.json').public.commit")
```

No such file in the app: `BASE=$(git -C .downstream/$APP merge-base refs/ottabase/head HEAD)`. No merge base either (the
app was started by copying files): ask the owner which Ottabase commit it started from.

## 2. Read what the app says it changed

The app's ledger is the short list. Each `patch` row in `.downstream/$APP/OTTABASE_LOCAL.md` is a change to framework
code with its reason, and often says whether it is generic.

```bash
git -C .downstream/$APP diff $LAST $NOW -- OTTABASE_LOCAL.md      # later reviews: rows added or removed since the last one
git -C .downstream/$APP grep -n "ottabase-local:" -- . ':!*.md'   # where each change lives
```

## 3. Read what it changed without saying

```bash
git -C .downstream/$APP diff --stat $BASE $NOW -- packages .claude/skills docs
git -C .downstream/$APP log --oneline $LAST..$NOW -- packages     # later reviews: only what is new
```

A package that exists only in the app is the app's own. A file in that list with no ledger row is an unrecorded change,
or a difference left behind by a hand port. Read the ones that look like a fix or a feature
(`git -C .downstream/$APP diff $BASE $NOW -- <file>`), and list the rest for the app's owner. The app's own folder
(`apps/<app>`, upstream's `apps/otta-web` when `apps` in its `.ottabase-upstream.json` says so) is its product; look
there only for fixes to plumbing every app shares (`worker/lib`, `worker/middleware`).

## 4. Sort each change

- **take:** another app would want it, or it fixes a bug in framework code. A security fix is taken first.
- **leave:** the app's own product or taste (its brand, its copy, a feature only it has). It stays a row in its ledger.
- **already here:** this repo does the same thing now, perhaps under another name. Nothing to port; the app's row can go
  at its next update.

When unsure whether a change is generic, ask: would it be on by default for a new app? If not, it is an option or it
stays.

## 5. Port what you take

- **By intent, in this repo's current shape.** The app is on an older Ottabase: port the change, never the file. No
  `git merge`, no `cherry-pick`, no patch applied from the clone.
- **A behavior change arrives as an option** whose default is today's behavior, so no other app changes. Keep the name
  the app used where it fits: its next update is then "delete the row and its markers, keep the config".
- **Nothing of the app's identity comes along:** no product name, domain, brand, copy, ids or secrets, in code, tests,
  docs, the CHANGELOG or commit messages.
- **It ships like any change here:** a test, the README or doc, a CHANGELOG entry, and the gates
  (`pnpm --filter <package> test`, then `pnpm ci:check`). One commit per change taken.

## 6. Record and report

Set the app's entry in `.ottabase-downstream.json`: `commit` = `NOW`, `committedAt` =
`git -C .downstream/$APP show -s --format=%cI $NOW`, today's `reviewedAt`. Commit it.

Report to the owner, in this order:

1. **Range:** the app from `LAST` to `NOW` (short shas and dates), and the Ottabase commit it is on.
2. **Taken:** each change, and what the app does at its next update (which ledger row and markers to delete, which
   config to keep).
3. **Left:** each change that stays the app's own, in a line.
4. **Already here:** rows the app can drop.
5. **Unrecorded:** framework files the app changed with no ledger row, for the app's owner.
6. **Gates:** each command and its result.

## Gotchas

- A feature both repos built separately looks like a large diff. Compare behavior, keep this repo's shape, and note for
  the app's owner where the two differ.
- An app with no ledger still works: step 3 is then the whole review, and its owner should start one
  (`docs/BUILDING_ON_OTTABASE.md`).
- The clone is for reading. The app gets these changes back through its own `ottabase-update`, not from here.
- Keep the leading dot in `.downstream/`: a name without it is scanned by root-level tools.
