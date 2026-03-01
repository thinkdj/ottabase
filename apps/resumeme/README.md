# ResumeMe

Professional resume builder — create, customise, and export polished resumes.

## Overview

ResumeMe is a full-stack application built on the Ottabase framework. Users create resume data (profile, work
experience, education, skills, projects, certifications), assemble them into named data sets, apply visual templates,
and export to PDF.

**Key concepts:**

- **Data-first approach**: All resume content is stored as individual database entries. Templates render the same data
  differently.
- **Data Sets**: Users mix-and-match skills, work experience, education, etc. into named collections. Each data set can
  use a different template and accent colour.
- **Templates**: Configurable resume layouts. Eight built-in: Classic, Modern, Lisbon, Executive, Minimal, Clean,
  Creative, and Bold.
- **Name lock**: The user's name on the resume always comes from their app profile — it cannot be overridden per-resume.

## Architecture: Data → Data Set → Saved Resume

The app separates resume content into three layers:

1. **My Resume Data** (`/my-resume`) — Raw content entries: profiles, work experiences, education, skills, projects,
   certifications. A user maintains one repository of career data that can be reused across many resumes.

2. **Resume Data Sets** (managed inside My Resume Data) — A named collection that cherry-picks items from the raw data.
   Each data set selects a profile (single) and a subset of work experiences, education, skills, projects, and
   certifications (multi-select). Use data sets to curate different resume variants (e.g. "Frontend Focus",
   "Full-Stack", "Leadership").

3. **Saved Resumes** (`/my-resumes`) — A frozen snapshot produced by the builder. Contains the full expanded JSON of all
   resume data, template settings, section order, heading labels, and a user-chosen filename. Once saved, the resume
   opens in **view-only mode** in the builder. You can "Refresh Resume Data Set" to pull in the latest data from the
   linked data set, edit, then re-save.

**Typical flow:** Create data → Build a data set → Open in builder → Customise → Save → View in My Resumes.

## Tech Stack

- **Frontend**: React + TanStack Router, Tailwind CSS, Mantine UI
- **Backend**: Cloudflare Workers, Drizzle ORM (D1/SQLite)
- **Framework**: Ottabase (OttaORM fat models, brand engine, auth)

## Data Models

| Model                  | Table                     | Purpose                                                |
| ---------------------- | ------------------------- | ------------------------------------------------------ |
| `ResumeProfile`        | `resume_profiles`         | Contact info, headline, summary, social links          |
| `ResumeSkillSet`       | `resume_skill_sets`       | Named group of skill tags                              |
| `ResumeWorkExperience` | `resume_work_experiences` | Job entries with highlights                            |
| `ResumeEducation`      | `resume_educations`       | Degrees and institutions                               |
| `ResumeProject`        | `resume_projects`         | Portfolio projects                                     |
| `ResumeCertification`  | `resume_certifications`   | Professional certifications                            |
| `ResumeDataSet`        | `resume_data_sets`        | Assembled resume: selected items + template + colour   |
| `ResumeSaved`          | `resume_saved`            | Full snapshot of a built resume (read-only after save) |

All models use OttaORM's `BaseModel` with full CRUD via `/api/ottaorm/{entity}`.

## Resume Templates

### Classic

Traditional single-column layout. Accent-coloured section borders, inline contact row, clean typography.

### Modern

Two-column layout. Dark sidebar with contact/skills/certifications, main area with experience/education/projects.

### Lisbon

Inspired by resume.io's Lisbon. Light-tinted sidebar with contact details, skill dots, education, and certifications.
Main area displays experience and projects. Accent-coloured name and section icons.

### Executive

Premium corporate design for senior professionals. Full-width centred layout with elegant uppercase headings,
pipe-separated contact bar, accent-dot bullet points, and refined typographic hierarchy.

### Minimal

Ultra-clean, typography-focused single-column layout. Maximum whitespace with hairline dividers between sections. Light
font weight for the name, minimal colour use, no backgrounds or borders.

All templates support:

- Configurable accent colour (hex)
- **Proportional page scaling** (80–130% zoom slider with live preview)
- **Section reordering** (↑/↓ buttons and drag-and-drop to rearrange sections in real time)
- **Editable headings** — click any section heading in the preview to customise its label
- **Profile section pinning** — Profile/Summary always stays first and cannot be reordered
- Dark mode
- Print-optimised CSS (`@media print`)
- **PDF export** — server-side via Puppeteer/Cloudflare Browser Rendering API; pixel-perfect replica of the on-screen
  preview
- **Plain Text export** (`.txt`) — ATS-friendly one-click download

### Page Scale

Adjust resume size proportionally with the zoom slider (80–130%). Uses CSS `zoom` so all elements — headings, body text,
spacing, badges — scale uniformly. The selected zoom applies to both on-screen preview and printed/PDF output.

```typescript
import { FONT_SIZE_MIN, FONT_SIZE_MAX, FONT_SIZE_DEFAULT } from './pages/resume/types';
// 80% – 130%, default 100%
```

### Export (PDF & Plain Text)

The **Download PDF** split button in the toolbar has two export modes:

| Format     | Mechanism                          | Notes                                 |
| ---------- | ---------------------------------- | ------------------------------------- |
| PDF        | `POST /api/resume/pdf` → Puppeteer | Requires `OBCF_BROWSER` binding       |
| Plain Text | Client-side blob download          | ATS-friendly `.txt` with all sections |

#### Server-side PDF (`POST /api/resume/pdf`)

Requires the **Cloudflare Browser Rendering API** binding (`OBCF_BROWSER`). Enable it in the Cloudflare dashboard under
**Workers > resumeme > Settings > Browser Rendering**, then it is picked up automatically via `wrangler.jsonc`.

**How it works — DOM capture approach:**

1. The client serialises the live React-rendered DOM (`#resume-capture`) + every CSS rule from `document.styleSheets`
   into a fully self-contained HTML string.
2. The HTML (including all Tailwind classes, CSS variables like `--resume-accent`, and inline styles) is POSTed to the
   worker.
3. Puppeteer renders that exact HTML — the PDF is a pixel-perfect replica of what the user sees on screen.

The worker never builds its own HTML — it just runs Puppeteer on what the browser already rendered.

```typescript
// worker/routes/resume-pdf.ts — body shape
POST /api/resume/pdf
Body: { html: string, fileName?: string }
// html = fully self-contained HTML captured from the browser DOM
```

During local `wrangler dev` without the binding the route returns `503 BROWSER_BINDING_UNAVAILABLE` and the client
surfaces an error toast. PDF generation requires the binding — there is no silent fallback.

Client utilities in `src/lib/resume-export.ts`:

```typescript
import {
    exportAsPdfServerSide, // server-side DOM capture → Puppeteer PDF
    exportAsPlainText, // ATS .txt download
    buildPlainText, // serialise to string (no download)
} from '@/lib/resume-export';

// Server-side PDF — pass the id of the resume preview wrapper div
await exportAsPdfServerSide('resume-capture', 'My Resume');
```

The preview wrapper in `ResumeBuilder.tsx` carries `id="resume-capture"` so `exportAsPdfServerSide` can locate and clone
the rendered DOM before upload.

The print stylesheet (`src/styles/globals.css`) hides UI chrome (header, sidebars, Radix portals, dialogs) and preserves
accent colours with `print-color-adjust: exact`.

### Section Reorder

Rearrange resume sections using ↑/↓ arrows or drag-and-drop handles in the left sidebar. The preview updates instantly.
The Profile section is locked at the top and cannot be moved. In the Modern and Lisbon templates, sidebar-pinned
sections (Skills, Certifications) stay fixed while main-area sections reorder.

```typescript
import { DEFAULT_SECTION_ORDER, moveSectionUp, moveSectionDown } from './pages/resume/types';
// DEFAULT_SECTION_ORDER: ['summary', 'workExperiences', 'educations', 'skillSets', 'projects', 'certifications']
// 'summary' is pinned at index 0 — moveSectionUp/moveSectionDown enforce this
```

### Editable Section Headings

Click any section heading in the resume preview to edit its label inline. Overrides persist across template switches via
`headingLabels` state. Templates use `resolveHeadingLabel()` to resolve: override → template default → global default.

```typescript
import { resolveHeadingLabel, DEFAULT_HEADING_LABELS } from './pages/resume/types';
// resolveHeadingLabel('summary', overrides, 'Profile') → override || 'Profile' || 'Summary'
```

### Save Resume Snapshots

Save the full resume state (template, accent colour, zoom, section order, heading overrides, and all data) as a
server-persisted **ResumeSaved** record. On save, you're prompted for a filename. The snapshot stores entire
`ResumeTemplateData` JSON so the resume is frozen in time.

**Viewing a saved resume** opens the builder in **view-only mode** — sidebar checkboxes and items are disabled. A
"Refresh Resume Data Set" button lets you pull in the latest data from the linked data set, switching to edit mode. You
can then re-save to overwrite the snapshot.

### Live Data Sets in Builder

`/builder` for authenticated users now reads from OttaORM models and `resume_data_sets` instead of static mock data.

- Loads profile, work experience, education, skills, projects, and certifications via `useResume*` hooks.
- Uses a **profile-scoped data set**: each profile maps to one data-set bucket containing template/accent + selected
  IDs.
- Builder dropdown selects **Profile** (not creating buckets in builder). Bucket creation/linking happens automatically.
- Persists template/accent and include/exclude checkbox changes back to the active data set (debounced autosave).
- Autosave writes writable fields only (excludes immutable IDs) to avoid CRUD write errors during PATCH requests.
- All include/exclude checkboxes start in the **selected** state for new profile buckets.
- Checkbox toggles are strict: unchecked items are hidden from the resume preview (including Education and all other
  sections).
- Creates/links a default data set automatically when a selected profile has no bucket yet.
- Keeps `/guest` behavior unchanged (guest mock data, no persistence).

### Responsive Sidebar Layout

Below 1024px viewport width, left and right sidebars collapse into floating flyout panels. Floating toggle buttons
appear at the left and right edges to open/close each panel. On desktop (≥ 1024px), sidebars display inline as before.

## Getting Started

```bash
# From repo root
pnpm install
pnpm build:pkg

# Run the app
cd apps/resumeme
pnpm dev          # Vite frontend (port 3005)
pnpm dev:worker   # Cloudflare Worker backend (port 3006)

# Initialise database tables
curl -X POST http://localhost:3006/api/ottaorm/init
```

## Routes

| Path                     | Description                                        |
| ------------------------ | -------------------------------------------------- |
| `/`                      | Landing page                                       |
| `/guest`                 | Guest mode builder (public, no sign-up)            |
| `/my-resume`             | My Resume Data — manage resume content (protected) |
| `/my-resumes`            | My Resumes — list saved resumes (protected)        |
| `/builder`               | Resume builder (protected)                         |
| `/builder?dataSetId=xxx` | Open builder with a specific data set              |
| `/builder?resumeId=xxx`  | Open a saved resume in view-only mode              |
| `/auth/signin`           | Sign in                                            |
| `/auth/signup`           | Sign up                                            |
| `/user/profile`          | User profile                                       |

## Guest Mode

Visit `/guest` to try the full resume builder without creating an account.

**What works:**

- All 5 templates (Classic, Modern, Lisbon, Executive, Minimal)
- Accent colour and page scale (zoom) controls
- Section reordering (↑/↓ buttons and drag-and-drop)
- Click-to-edit section headings in preview
- Responsive floating sidebars on narrow viewports
- Real-time preview updates

**Restrictions:**

- Name is locked to **John Doe** with a placeholder avatar
- **Download (PDF / Plain Text)** is disabled (greyed out with lock icon)
- Changes are **not saved** — they live only in browser memory
- A banner at the top encourages sign-up to unlock full features

The guest data lives in `src/pages/resume/guestData.ts` — a self-contained mock JSON with realistic work experience,
skills, projects, and certifications.

## Client Hooks

```typescript
import {
    useResumeProfiles,
    useCreateResumeProfile,
    useResumeSkillSets,
    useResumeWorkExperiences,
    useResumeDataSets,
    useCreateResumeDataSet,
    useUpdateResumeDataSet,
    useResumeSavedList,
    useResumeSaved,
    useCreateResumeSaved,
    useUpdateResumeSaved,
    useDeleteResumeSaved,
} from '@/ottabase/hooks/useResume';
```

All hooks are generated via `createModelHooks` from `@ottabase/ottaorm/client`.

## Tests

```bash
cd apps/resumeme
npx vitest run
```

## Project Structure

```text
apps/resumeme/
├── ottabase/
│   ├── db/             # Drizzle schema + helper
│   ├── models/         # OttaORM fat models (8 resume + Todo)
│   ├── config.*        # App config, migrations, routes
│   └── ottabase.config.ts
├── src/
│   ├── __tests__/      # Tests
│   ├── ottabase/hooks/ # Client hooks (useResume.ts)
│   ├── pages/resume/   # Builder UI + templates + MyResumesPage
│   ├── providers/      # React providers
│   ├── router.tsx      # TanStack Router
│   └── main.tsx        # App entry
├── worker/             # Cloudflare Worker routes
└── wrangler.jsonc      # Cloudflare config
```
