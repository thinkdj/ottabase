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
- **Templates**: Configurable resume layouts. Five built-in: Classic, Modern, Lisbon, Executive, and Minimal.
- **Name lock**: The user's name on the resume always comes from their app profile — it cannot be overridden per-resume.

## Tech Stack

- **Frontend**: React + TanStack Router, Tailwind CSS, Mantine UI
- **Backend**: Cloudflare Workers, Drizzle ORM (D1/SQLite)
- **Framework**: Ottabase (OttaORM fat models, brand engine, auth)

## Data Models

| Model                  | Table                     | Purpose                                              |
| ---------------------- | ------------------------- | ---------------------------------------------------- |
| `ResumeProfile`        | `resume_profiles`         | Contact info, headline, summary, social links        |
| `ResumeSkillSet`       | `resume_skill_sets`       | Named group of skill tags                            |
| `ResumeWorkExperience` | `resume_work_experiences` | Job entries with highlights                          |
| `ResumeEducation`      | `resume_educations`       | Degrees and institutions                             |
| `ResumeProject`        | `resume_projects`         | Portfolio projects                                   |
| `ResumeCertification`  | `resume_certifications`   | Professional certifications                          |
| `ResumeDataSet`        | `resume_data_sets`        | Assembled resume: selected items + template + colour |

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
- **Font size control** (9–16pt slider with live preview)
- **Section reordering** (↑/↓ buttons to rearrange sections in real time)
- Dark mode
- Print-optimised CSS (`@media print`)
- PDF export via browser print

### Font Size Control

Adjust resume density with the font size slider (9–16pt). The selected size applies to both on-screen preview and
printed/PDF output.

```typescript
import { FONT_SIZE_MIN, FONT_SIZE_MAX, FONT_SIZE_DEFAULT } from './pages/resume/types';
// 9pt – 16pt, default 12pt
```

### Section Reorder

Rearrange resume sections using the ↑/↓ arrows next to each section header in the left sidebar. The preview updates
instantly. In the Modern template, sidebar-pinned sections (Skills, Certifications) stay fixed while main-area sections
reorder.

```typescript
import { DEFAULT_SECTION_ORDER, moveSectionUp, moveSectionDown } from './pages/resume/types';
// DEFAULT_SECTION_ORDER: ['summary', 'workExperiences', 'educations', 'skillSets', 'projects', 'certifications']
```

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

| Path            | Description                             |
| --------------- | --------------------------------------- |
| `/`             | Landing page                            |
| `/guest`        | Guest mode builder (public, no sign-up) |
| `/builder`      | Resume builder (protected)              |
| `/auth/signin`  | Sign in                                 |
| `/auth/signup`  | Sign up                                 |
| `/user/profile` | User profile                            |

## Guest Mode

Visit `/guest` to try the full resume builder without creating an account.

**What works:**

- All 5 templates (Classic, Modern, Lisbon, Executive, Minimal)
- Accent colour and font size controls
- Section reordering
- Real-time preview updates

**Restrictions:**

- Name is locked to **John Doe** with a placeholder avatar
- **Printing / PDF export** is disabled (greyed out with lock icon)
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
} from '@/ottabase/hooks/useResume';
```

All hooks are generated via `createModelHooks` from `@ottabase/ottaorm/client`.

## Tests

```bash
cd apps/resumeme
npx vitest run
```

## Project Structure

```
apps/resumeme/
├── ottabase/
│   ├── db/             # Drizzle schema + helper
│   ├── models/         # OttaORM fat models (7 resume + Todo)
│   ├── config.*        # App config, migrations, routes
│   └── ottabase.config.ts
├── src/
│   ├── __tests__/      # Tests
│   ├── ottabase/hooks/ # Client hooks (useResume.ts)
│   ├── pages/resume/   # Builder UI + templates
│   ├── providers/      # React providers
│   ├── router.tsx      # TanStack Router
│   └── main.tsx        # App entry
├── worker/             # Cloudflare Worker routes
└── wrangler.jsonc      # Cloudflare config
```
