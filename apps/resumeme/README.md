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
- **Templates**: Configurable resume layouts. Two built-in: Classic (single-column) and Modern (two-column sidebar).
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

Both templates support:

- Configurable accent colour (hex)
- Dark mode
- Print-optimised CSS (`@media print`)
- PDF export via browser print

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

| Path            | Description                |
| --------------- | -------------------------- |
| `/`             | Landing page               |
| `/builder`      | Resume builder (protected) |
| `/auth/signin`  | Sign in                    |
| `/auth/signup`  | Sign up                    |
| `/user/profile` | User profile               |

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
