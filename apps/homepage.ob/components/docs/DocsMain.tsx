import Link from 'next/link';
import { siteConfig } from '@/config';
import type { CSSProperties } from 'react';

const h2: CSSProperties = {
    fontSize: 'clamp(1.3rem, 3vw, 1.9rem)',
    fontWeight: 800,
    letterSpacing: '-0.03em',
    marginBottom: '0.75rem',
};

export function DocsMain() {
    const sh = siteConfig.theme === 'signalHorizon';
    const lead: CSSProperties = {
        color: sh ? 'var(--ob-muted)' : 'var(--text-muted)',
        marginBottom: '1.25rem',
        lineHeight: 1.7,
    };
    const div = sh ? 'ob-hp-prose-divider' : 'prose-divider';
    const linkColor = sh ? 'var(--ob-accent)' : 'var(--violet-lt)';
    const mainClass = sh ? 'docs-content ob-hp-reveal' : 'docs-content animate animate-delay-2';
    const listClass = sh ? undefined : 'prose-section';

    return (
        <main className={mainClass} id={sh ? 'main' : undefined}>
            <section id="prerequisites">
                <h2 style={h2}>Prerequisites</h2>
                <p style={lead}>Before you begin, make sure you have the following installed and configured.</p>
                <ul className={listClass} style={{ padding: 0, maxWidth: '100%' }}>
                    <li>
                        <strong>Node.js ≥ 24</strong> — use <code>nvm install 24 && nvm use 24</code> if needed.
                    </li>
                    <li>
                        <strong>pnpm ≥ 10</strong> — install via <code>corepack enable pnpm</code>.
                    </li>
                    <li>
                        <strong>Cloudflare account</strong> — free tier works. No credit card required to start.
                    </li>
                    <li>
                        <strong>Wrangler CLI</strong> — installed automatically by pnpm as part of the monorepo.
                    </li>
                </ul>
            </section>

            <div className={div} />

            <section id="clone">
                <h2 style={h2}>Clone & Install</h2>
                <p style={lead}>
                    Clone the repository and install dependencies. The monorepo uses pnpm workspaces — never use{' '}
                    <code>npm</code> or <code>yarn</code> here.
                </p>
                <CodeWindow filename="terminal" code={CLONE_CODE} />
            </section>

            <div className={div} />

            <section id="cloudflare">
                <h2 style={h2}>Cloudflare Setup</h2>
                <p style={lead}>
                    Ottabase includes a CLI command that creates all required Cloudflare resources: D1 database, KV
                    namespace, R2 bucket, and Queues. Run it once.
                </p>
                <div style={{ marginBottom: '1.25rem' }}>
                    <CodeWindow filename="terminal" code={CF_CODE} />
                </div>
                <p
                    style={{
                        color: sh ? 'var(--ob-muted)' : 'var(--text-muted)',
                        fontSize: '0.9375rem',
                        lineHeight: 1.7,
                    }}
                >
                    After <code>cf:setup</code>, copy <code>.env.example</code> to <code>.env.local</code> and fill in
                    the required secrets: <code>AUTH_SECRET</code>, <code>BOOTSTRAP_OWNER_SECRET</code>, and any OAuth
                    credentials you want (GitHub, Google).
                </p>
            </section>

            <div className={div} />

            <section id="dev">
                <h2 style={h2}>Local Development</h2>
                <p style={lead}>
                    Two servers run in parallel. Vite handles the frontend with hot module replacement. Wrangler
                    emulates the Cloudflare Worker locally with your real D1 data.
                </p>
                <CodeWindow filename="terminal" code={DEV_CODE} />
            </section>

            <div className={div} />

            <section id="bootstrap">
                <h2 style={h2}>Bootstrap</h2>
                <p style={lead}>
                    With the dev server running, run these four curl commands to initialise the platform: create tables,
                    seed roles, create your owner account, and finalise the setup.
                </p>
                <CodeWindow filename="terminal" code={BOOTSTRAP_CODE} />
            </section>

            <div className={div} />

            <section id="deploy">
                <h2 style={h2}>Deploy to Production</h2>
                <p style={lead}>
                    Deploy to Cloudflare Workers. The same code runs locally and in production — no environment
                    configuration differences, no &quot;it works on my machine.&quot;
                </p>
                <CodeWindow filename="terminal" code={DEPLOY_CODE} />
            </section>

            <div className={div} />

            <section id="models">
                <h2 style={h2}>Creating a Fat Model</h2>
                <p style={lead}>
                    Models live in <code>ottabase/models/</code>. They inherit from <code>BaseModel</code> and declare a
                    Drizzle table schema, static metadata, and domain methods.
                </p>
                <CodeWindow filename="ottabase/models/Project.ts" code={MODEL_CODE} />
            </section>

            <div className={div} />

            <section id="crud">
                <h2 style={h2}>Auto CRUD API & Hooks</h2>
                <p style={lead}>
                    Register your model in <code>initDbConnection</code> and a full CRUD API appears automatically at{' '}
                    <code>/api/ottaorm/{'{entity}'}</code>. Then generate client hooks in one line.
                </p>
                <CodeWindow filename="ottabase/hooks/useProjects.ts" code={CRUD_CODE} />
            </section>

            <div className={div} />

            <section id="rls">
                <h2 style={h2}>Row-Level Security</h2>
                <p style={lead}>
                    Call <code>initRLS()</code> at the start of each request. Every OttaORM query after that call is
                    automatically scoped to the current tenant. No accidental cross-tenant data leakage.
                </p>
                <CodeWindow filename="worker/middleware/rls.ts" code={RLS_CODE} />
            </section>

            <div className={div} />

            <section id="rbac">
                <h2 style={h2}>RBAC</h2>
                <p style={lead}>
                    Roles and permissions are evaluated using <code>@ottabase/rbac</code>. Permission checks are cached
                    in KV so hot paths avoid extra D1 round-trips. Pair RBAC with RLS: RLS enforces tenant boundaries;
                    RBAC enforces what a user may do inside that tenant.
                </p>
                <ul className={listClass} style={{ padding: 0, maxWidth: '100%' }}>
                    <li>Define roles and permissions during bootstrap; seed defaults with the bootstrap API.</li>
                    <li>Check permissions in route handlers or model methods before mutating data.</li>
                    <li>Keep permission keys stable — they are stored in KV and referenced from your app config.</li>
                </ul>
            </section>

            <div className={div} />

            <section id="migrations">
                <h2 style={h2}>Auto-Migrations</h2>
                <p style={lead}>
                    No migration files. No SQL to write. OttaORM inspects the registered models and creates or alters
                    tables to match. Call the init endpoint whenever you add or change a model.
                </p>
                <CodeWindow filename="terminal" code={MIGRATIONS_CODE} />
            </section>

            <div className={div} />

            <section style={{ paddingBottom: '3rem' }}>
                <h2 style={{ ...h2, marginBottom: '1rem' }}>Where to go from here</h2>
                <ul className={listClass} style={{ padding: 0, maxWidth: '100%' }}>
                    <li>
                        Read the{' '}
                        <Link href="/philosophy" style={{ color: linkColor }}>
                            Philosophy
                        </Link>{' '}
                        to understand why Ottabase works the way it does.
                    </li>
                    <li>
                        Browse all{' '}
                        <Link href="/packages" style={{ color: linkColor }}>
                            47 packages
                        </Link>{' '}
                        to see what&apos;s available out of the box.
                    </li>
                    <li>
                        Check the <code>SOLO_FOUNDER_SAAS_GUIDE.md</code> in the repo root for a full product-building
                        walkthrough.
                    </li>
                    <li>
                        Join{' '}
                        <a
                            href="https://discord.gg/ottabase"
                            style={{ color: linkColor }}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            Discord
                        </a>{' '}
                        to ask questions and share what you&apos;re building.
                    </li>
                    <li>
                        Read <code>AGENTS.MD</code> in the repo root for AI assistant integration instructions.
                    </li>
                </ul>
            </section>
        </main>
    );
}

function CodeWindow({ filename, code }: { filename: string; code: string }) {
    const sh = siteConfig.theme === 'signalHorizon';
    if (sh) {
        return (
            <div className="ob-hp-window">
                <div className="ob-hp-window-bar" aria-hidden="true">
                    <span className="ob-hp-window-dot" />
                    <span className="ob-hp-window-dot" />
                    <span className="ob-hp-window-dot" />
                    <span className="ob-hp-window-name">{filename}</span>
                </div>
                <pre className="ob-hp-code-block">
                    <code>{code}</code>
                </pre>
            </div>
        );
    }
    return (
        <div className="code-window">
            <div className="code-window-bar" aria-hidden="true">
                <span className="code-window-dot" style={{ background: '#ef4444' }} />
                <span className="code-window-dot" style={{ background: '#f59e0b' }} />
                <span className="code-window-dot" style={{ background: '#10b981' }} />
                <span className="code-window-filename">{filename}</span>
            </div>
            <pre className="code-block">
                <code>{code}</code>
            </pre>
        </div>
    );
}

const CLONE_CODE = `# Clone the repository
$ git clone https://github.com/thinkdj/ottabase.git my-saas
$ cd my-saas

# Install all dependencies (pnpm workspaces handles everything)
$ pnpm install

# Build shared packages first — required before first dev run
$ pnpm build:pkg`;

const CF_CODE = `# Log in to Cloudflare via Wrangler
$ pnpm cf:login

# Create all required Cloudflare resources automatically
$ pnpm cf:setup
  ✓ D1 database 'my-saas-db' created
  ✓ KV namespace 'my-saas-kv' created
  ✓ R2 bucket 'my-saas-r2' created
  ✓ Queue 'my-saas-queue' created
  ✓ wrangler.jsonc updated with binding IDs

# Validate your configuration looks correct
$ pnpm cf:validate`;

const DEV_CODE = `$ pnpm dev

  ┌─────────────────────────────────────────────┐
  │  Vite dev server    → localhost:3003          │
  │  Wrangler worker    → localhost:3004          │
  └─────────────────────────────────────────────┘

# Or start them separately for more control:
$ pnpm dev:fe   # Vite only
$ pnpm dev:be   # Wrangler only`;

const BOOTSTRAP_CODE = `# Get your bootstrap secret from .env.local
$ SECRET=$(grep BOOTSTRAP_OWNER_SECRET .env.local | cut -d= -f2)
$ BASE=http://localhost:3004/__bootstrap__/api

# 1. Initialise — clears KV, runs migrations, creates tables
$ curl -s -X POST $BASE/init -H "X-Bootstrap-Secret: $SECRET"

# 2. Seed — creates default roles and permissions
$ curl -s -X POST $BASE/seed -H "X-Bootstrap-Secret: $SECRET"

# 3. Create owner account
$ curl -s -X POST $BASE/create-owner \\
    -H "X-Bootstrap-Secret: $SECRET" \\
    -H "Content-Type: application/json" \\
    -d '{"email":"you@example.com","password":"SecurePass1!","name":"You"}'

# 4. Finalise platform state
$ curl -s -X POST $BASE/finalize -H "X-Bootstrap-Secret: $SECRET"

# Done. Open localhost:3003 and log in.`;

const DEPLOY_CODE = `# Build the worker bundle
$ pnpm build

# Deploy to Cloudflare Workers
$ wrangler deploy
  ✓ Uploaded my-saas (5.2 sec)
  ✓ Deployed to https://my-saas.workers.dev

# Run bootstrap on production (once, same 4 commands)
# Just change localhost:3004 → https://my-saas.workers.dev

# Set a custom domain (optional)
$ wrangler custom-domain add my-saas.com`;

const MODEL_CODE = `import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { BaseModel } from '@ottabase/ottaorm';

// 1. Define the schema (Drizzle + SQLite)
export const projectsTable = sqliteTable('projects', {
  id:    text('id').primaryKey(),
  name:  text('name').notNull(),
  status: text('status').default('draft'),
  orgId: text('org_id'),
});

// 2. Define the model (fat model pattern)
export class Project extends BaseModel {
  static entity = 'projects';
  static table  = projectsTable;

  // Domain method — logic lives here, not in a service
  async publish() {
    this.set('status', 'published');
    return this.save();
  }
}

// 3. Export the table in ottabase/db/schema.ts
// 4. Register in worker/lib/db-utils.ts → initDbConnection
// 5. POST /api/ottaorm/init to create the table`;

const CRUD_CODE = `import { createModelHooks } from '@ottabase/ottaorm/client';
import type { Project } from '../models/Project';

export const {
  useList:         useProjects,       // GET /api/ottaorm/projects
  useDetail:       useProject,        // GET /api/ottaorm/projects/:id
  useCreate:       useCreateProject,  // POST /api/ottaorm/projects
  useUpdate:       useUpdateProject,  // PUT /api/ottaorm/projects/:id
  useDelete:       useDeleteProject,  // DELETE /api/ottaorm/projects/:id
  useInfiniteList: useProjectsInfinite,
} = createModelHooks<Project>({ entityName: 'projects' });`;

const RLS_CODE = `import { initRLS } from '@ottabase/ottaorm';

// Called once per request in your middleware
await initRLS({
  organizationId: session.user.orgId,
  userId:         session.user.id,
  appId:          env.APP_ID,
});

// These queries are automatically tenant-scoped.
// No WHERE clause needed. No accident possible.
const projects = await Project.all();
const project  = await Project.find(projectId);`;

const MIGRATIONS_CODE = `# Local development
$ curl -X POST http://localhost:3004/api/ottaorm/init
  { "created": ["projects"], "updated": [], "unchanged": 11 }

# Production (run after deploy)
$ curl -X POST https://my-saas.workers.dev/api/ottaorm/init \\
    -H "Authorization: Bearer $ADMIN_TOKEN"

# Capabilities:
#   ✓ Create new tables
#   ✓ Add new columns (with DEFAULT values)
#   ✗ Rename or drop columns (use custom migration)`;
