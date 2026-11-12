# Building your app on Ottabase

Ottabase is a monorepo you copy and make your own, not a package you install. Your app lives in `apps/<your-app>`, the
framework in `packages/`, and you keep pulling Ottabase forward as it improves. That stays cheap if you change
Ottabase's own code rarely, and write down each change where the next update will find it. This page is the whole model.
The `ottabase-update` agent skill (`.claude/skills/ottabase-update/SKILL.md`) is the runbook for the update itself.

These rules are for an app repo: your copy of Ottabase. Ottabase's own repositories follow their maintainers' process.

## Who owns what

| Path                                             | Owner    | In an update                                                                    |
| ------------------------------------------------ | -------- | ------------------------------------------------------------------------------- |
| `apps/<your-app>/**`                             | you      | Yours stays. Upstream's changes to its template app are merged in, by intent.   |
| `packages/**`, root tooling, `.claude/skills/**` | upstream | Upstream's version wins. The changes you recorded are kept on top of it.        |
| `OTTABASE_LOCAL.md`, `.ottabase-upstream.json`   | you      | Your record: how your copy differs, and which upstream commit it is on.         |
| `README.md`, `CHANGELOG.md`, docs                | both     | Both sides kept, unless you mark the file `owned` (your product's README, say). |

## Changing how Ottabase behaves

Take the first step that works:

1. **Config.** `ottabase/ottabase.config.ts` and env vars. Most product decisions are settings: for example
   `features.authBehavior.signupRole: 'member'` keeps sign-ups out of the admin area.
2. **Your own files.** Anything under `apps/<your-app>`, including the `ottabase/packages/<key>.ts` files `otta add`
   copied in, which hold your settings for each package.
3. **Extension points.** The brand override registry (restyle or replace a built-in component), auth hooks such as
   `onSignIn`, package manifests (routes, models, RLS policies), the event bus.
4. **Change the package.** Prefer a new option whose default is upstream's current behavior, set from your config: you
   can then offer it upstream, and once upstream ships it your change is step 1. Editing behavior in place is the last
   resort.

Steps 1 to 3 need no record: an update never touches them. Step 4 does.

## Recording a change to Ottabase's code

Two things, in the same commit as the change:

1. **A row** in `OTTABASE_LOCAL.md` at the repo root (create the file when you first need it).
2. **A marker**: the comment `ottabase-local: <id>` at each place in the code.

```markdown
# Local changes to Ottabase

| id            | kind  | paths                                           | why                                        |
| ------------- | ----- | ----------------------------------------------- | ------------------------------------------ |
| `email-white` | patch | `packages/email/src/templates.ts`               | Our default email layout is white.         |
| `toast-z`     | patch | `packages/ui/components/ui/toaster.tsx`         | Toasts above our sheets. Offered upstream. |
| `our-repo`    | owned | `README.md`, `.github/workflows/pr-preview.yml` | Our product README; no PR previews.        |
```

```ts
// ottabase-local: email-white
const background = '#ffffff';
```

| Kind    | Use it for                                                                               | In an update                                                             |
| ------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `patch` | Code you changed inside an upstream file. Marked. `paths` says where to look.            | Merged with upstream's change; re-applied by hand if they collide.       |
| `owned` | Whole files (or folders, or globs) you took over: kept as your own, or deleted. No mark. | Upstream's changes to them are not applied, only listed for you to read. |

The marker does two jobs. An agent editing that file sees that the code is deliberate. And a script can tell when it is
gone:

```bash
node .claude/skills/ottabase-update/scripts/check.mjs
```

It fails when a `patch` row has no marker left in the code (**lost**: what an update that dropped your change looks
like) or a marker has no row (**unrecorded**). The update runs it before and after. Add the line to your CI if you also
want it between updates; a repo with no ledger passes. Markers are read from code, not markdown, so a JSON file is
either `owned` or carries its marker in a test.

Where a change is behavior you would miss, add a test for it: that is the stronger guard, and the update's gates run it.

What needs no row: everything in `apps/<your-app>`, and ordinary edits to shared root files (`package.json`, a
workflow). The update is a three-way merge, so those survive on their own, and its last step lists every line of yours
that did not (the regression map). A row is for what you cannot afford to have missed.

## Updating to the latest Ottabase

Ask your agent to "update Ottabase", or follow the skill's runbook yourself. What happens:

1. Upstream is cloned in full into `.upstream/ottabase` (git-ignored).
2. `.ottabase-upstream.json` says which upstream commit your copy is on (the **base**), when upstream made that commit,
   when you took it, and which apps you renamed:

    ```json
    {
        "public": {
            "url": "https://github.com/ottabase/ottabase.git",
            "commit": "<sha>",
            "committedAt": "2026-11-11T22:14:52+00:00",
            "syncedAt": "2026-11-12"
        },
        "apps": { "otta-web": "my-app" }
    }
    ```

3. Exactly what upstream changed from the base to the new version is applied on top of your repo, file by file, with a
   three-way merge (`scripts/apply.mjs`). Changes to a renamed app land in your app; `owned` paths are left alone.
4. Conflicts are resolved by who owns the path, the gates run, `check.mjs` confirms every recorded patch is still there,
   and the **regression map** (`scripts/regression-map.mjs`) lists every line you had added that is now gone.
5. The base is updated and everything is committed on an `update/ottabase-<date>` branch for you to review.

Never `git merge` upstream, and never compare your repo with the latest upstream and make it match. Both lose the
difference between your change and upstream's, and yours is the one that gets reverted.

### Why a nested clone

Upstream sits in a git-ignored clone inside your repo, not in a remote:

- It works the same whether you forked or started by copying files, and for Ottabase Pro (`.upstream/pro`).
- Upstream's history never enters your repository, so there is no `upstream/main` to merge by accident.
- It is a full checkout: when a test fails after an update, run it in the clone to see if the failure is upstream's own.
- Delete it any time. Kept, the next update is a fetch.

Keep the dot in `.upstream/`: most tools skip dot folders, and `.gitignore` and `.prettierignore` already list it.

## Giving a change back

The best local change is one you no longer need. If another app would want your patch as an option, open an issue or
pull request on `ottabase/ottabase`. When upstream ships it, delete the row and its markers and set the option in your
config.
