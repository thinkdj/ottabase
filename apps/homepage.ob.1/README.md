# Ottabase homepage (`homepage.ob.1`)

Alternate static marketing site for Ottabase — same story as `apps/homepage.ob`, **different visual system** (“Signal
Horizon”): **Sora** (headlines) + **Source Sans 3** (body) + **JetBrains Mono** (UI/code), teal/coral accents, bento
layout, orbit hero with stack labels (Workers, D1, Queues, Realtime), grain, light/dark toggle.

**No build step.** Plain HTML, CSS, and JS. Open `index.html` locally or serve the folder.

## Pages

| File              | Purpose                                                                          |
| ----------------- | -------------------------------------------------------------------------------- |
| `index.html`      | Landing: hero, metrics receipt, bento ecosystem, code tabs, stack, terminal, CTA |
| `packages.html`   | All 47 packages with category filter                                             |
| `philosophy.html` | Fat models + architecture prose                                                  |
| `docs.html`       | Get started (clone, CF, dev, bootstrap, deploy)                                  |

## Serve locally

```bash
npx serve apps/homepage.ob.1
```

Or from this directory: `npx serve .`

## Deploy

Any static host or Cloudflare Pages:

```bash
npx wrangler pages deploy apps/homepage.ob.1 --project-name <your-project>
```

## vs `homepage.ob`

|         | `homepage.ob`     | `homepage.ob.1`                           |
| ------- | ----------------- | ----------------------------------------- |
| Palette | Violet / zinc     | Teal / warm / paper-light                 |
| Hero    | Pain lines + grid | Orbit + editorial headline                |
| Extras  | —                 | Theme toggle, bento grid, receipt metrics |

Content and URLs (GitHub, Discord) align with the launch plan in `LAUNCH_PLAN_NEW_DETAILED_46.md` (demo/docs/discussion
when ready).
