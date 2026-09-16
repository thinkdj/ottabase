# Ottabase 2-Year Feature Roadmap

> For solopreneurs, indie hackers, and tiny teams who want to ship SaaS, pet projects, and homepages **fast** —
> without rebuilding the same infra twice.

The roadmap is organized in two waves: **Year 1** locks in the foundational platform (revenue, auth, developer
experience), and **Year 2** layers in growth, content, and AI-powered features. Items are ordered by impact within
each wave.

**Effort scale:** XS (< 1 day) · S (1–3 days) · M (1–2 weeks) · L (2–4 weeks) · XL (1–2 months)

**Impact:** 🔴 Critical · 🟠 High · 🟡 Medium · 🟢 Nice-to-have

---

## Year 1 — Foundational Platform

### 1. `@ottabase/payments` — Stripe / Paddle Subscriptions

**Description:** Drop-in billing package wrapping Stripe and Paddle. Handles plans, subscriptions, usage limits,
customer portal, and webhook ingestion. Ships a `Subscription` fat model and a ready-made `/billing` page.

**Why:** Every solo SaaS project needs billing. Without a reusable layer, developers re-implement checkout + webhooks
from scratch for every app — the biggest time sink in early SaaS.

**Sample implementation:**

```typescript
// packages/payments/src/Subscription.ts
export class Subscription extends BaseModel {
    static entity = 'subscriptions';
    static table = subscriptionsTable;

    async isActive() {
        return this.get('status') === 'active' || this.get('status') === 'trialing';
    }

    async cancel() {
        await stripeClient.subscriptions.cancel(this.get('stripeSubscriptionId'));
        this.set('status', 'canceled');
        return this.save();
    }
}
```

```typescript
// In your worker route
import { createCheckoutSession } from '@ottabase/payments';

const session = await createCheckoutSession({
    priceId: 'price_pro_monthly',
    customerId: org.get('stripeCustomerId'),
    successUrl: `${appUrl}/billing?success=1`,
    cancelUrl: `${appUrl}/billing`,
});
return Response.redirect(session.url);
```

```typescript
// Client hook — usage metering
const { data: subscription } = useSubscription(); // createModelHooks under the hood
const isOnPro = subscription?.plan === 'pro' && subscription?.isActive;
```

**Effort:** L · **Impact:** 🔴 Critical

---

### 2. `@ottabase/feature-flags` — Runtime Feature Toggles

**Description:** Lightweight feature flag service backed by Cloudflare KV. Supports per-org, per-user, percentage
rollouts, and environment-based flags. Zero cold-start penalty — flags are read from request-level KV cache.

**Why:** Needed for safe rollouts, A/B tests, and gating beta features per plan without redeploying. Essential for
solo devs who can't afford a bad deploy.

**Sample implementation:**

```typescript
// packages/feature-flags/src/index.ts
import { getFlag } from '@ottabase/feature-flags';

// In a worker route
const isNewDashboard = await getFlag('new_dashboard', {
    kv: env.KV_FLAGS,
    context: { userId, organizationId, plan: 'pro' },
});

if (isNewDashboard) {
    return Response.json({ layout: 'v2' });
}
```

```typescript
// ottabase.config.ts — declare flags centrally
flags: {
    new_dashboard: { default: false, rollout: 20 }, // 20% rollout
    ai_writer: { default: false, plans: ['pro', 'enterprise'] },
}
```

```tsx
// React hook
const { isEnabled } = useFlag('ai_writer');
return isEnabled ? <AIWriterButton /> : null;
```

**Effort:** M · **Impact:** 🟠 High

---

### 3. `@ottabase/api-keys` — Programmatic API Key Management

**Description:** Issue, revoke, scope, and rate-limit API keys for external integrations. Keys are hashed at rest
(SHA-256), stored in D1, and validated in a lightweight worker middleware. Ships UI for self-service key management.

**Why:** Any SaaS that wants to offer integrations or a public API needs programmatic API keys. Auth.js handles
session-based auth; this fills the machine-to-machine gap.

**Sample implementation:**

```typescript
// packages/api-keys/src/ApiKey.ts
export class ApiKey extends BaseModel {
    static entity = 'api_keys';
    static table = apiKeysTable;

    static async issue(opts: { organizationId: string; label: string; scopes: string[] }) {
        // 32 bytes of CSPRNG entropy — stronger than randomUUID()
        const raw = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex');
        const hashed = await hashKey(raw); // SHA-256
        await ApiKey.create({ ...opts, keyHash: hashed, prefix: raw.slice(0, 8) });
        return `otk_${raw}`; // returned once, never stored plain
    }

    static async verify(rawKey: string) {
        const hash = await hashKey(rawKey.replace('otk_', ''));
        return ApiKey.first({ keyHash: hash, status: 'active' });
    }
}
```

```typescript
// Middleware
const apiKey = await ApiKey.verify(request.headers.get('X-API-Key') ?? '');
if (!apiKey) return errorResponse('Invalid API key', 401);
```

**Effort:** M · **Impact:** 🟠 High

---

### 4. `@ottabase/ui-data-table` — Advanced Data Table

**Description:** Headless-first data table built on TanStack Table v8. Supports server-side sort/filter/pagination,
column visibility, row selection, inline editing, and bulk actions. Thin shadcn/ui skin on top.

**Why:** Every admin panel, CMS, and SaaS dashboard needs a rich data table. `@ottabase/forms` handles create/edit;
this handles list views — closing the full CRUD loop.

**Sample implementation:**

```typescript
// packages/ui-data-table/src/DataTable.tsx
import { useDataTable } from '@ottabase/ui-data-table';
import { useTodos } from '@/ottabase/hooks/useTodo';

const { data, pagination, sorting } = useTodos({ paginate: true });

const { table } = useDataTable({
    data: data?.items ?? [],
    columns,
    pagination,
    sorting,
    onSort: (col, dir) => setSorting({ col, dir }),
});

return <DataTable table={table} onRowClick={(row) => navigate(`/todos/${row.id}`)} />;
```

```tsx
// Column definition with inline actions
const columns = createColumns<TodoType>([
    { key: 'title', header: 'Title', sortable: true },
    { key: 'completed', header: 'Done', cell: ({ row }) => <Checkbox checked={row.completed} /> },
    actionsColumn([
        { label: 'Edit', onClick: (row) => openEditModal(row) },
        { label: 'Delete', variant: 'destructive', onClick: (row) => deleteTodo.mutate(row.id) },
    ]),
]);
```

**Effort:** M · **Impact:** 🟠 High

---

### 5. `@ottabase/webhooks` — Outbound Webhook Delivery

**Description:** Webhook registry, outbound delivery via Cloudflare Queue, retry with exponential back-off, signature
verification (HMAC-SHA256), delivery log, and a self-serve endpoint management UI.

**Why:** Webhooks are the integration backbone of any SaaS. Customers need to react to subscription events, new
records, and status changes. Reusing `@ottabase/queue` as the delivery engine keeps infra overhead zero.

**Sample implementation:**

```typescript
// packages/webhooks/src/dispatch.ts
import { dispatch } from '@ottabase/queue';

export async function triggerWebhook(event: string, payload: unknown, organizationId: string) {
    const endpoints = await WebhookEndpoint.where({ organizationId, events: { contains: event } });
    for (const endpoint of endpoints) {
        await dispatch('webhook.deliver', { endpointId: endpoint.id, event, payload });
    }
}
```

```typescript
// In your model
async publish() {
    this.set('status', 'published');
    await this.save();
    await triggerWebhook('post.published', this.toJSON(), this.get('organizationId'));
}
```

```typescript
// packages/webhooks/src/handler.ts — queue consumer
export async function handleWebhookDeliver({ endpointId, event, payload }: WebhookJob) {
    const endpoint = await WebhookEndpoint.find(endpointId);
    const sig = await signPayload(payload, endpoint.get('secret'));
    const res = await fetch(endpoint.get('url'), {
        method: 'POST',
        headers: { 'X-Webhook-Signature': sig, 'X-Webhook-Event': event },
        body: JSON.stringify(payload),
    });
    await WebhookDelivery.create({ endpointId, statusCode: res.status, event });
}
```

**Effort:** M · **Impact:** 🟠 High

---

### 6. `@ottabase/waitlist` — Pre-launch Waitlist with Viral Loop

**Description:** Waitlist signup form, referral-based queue jumping, email confirmation via `@ottabase/email`, admin
dashboard, and CSV export. Backed by a `WaitlistEntry` fat model. One-command embed for the homepage.

**Why:** Every solo project needs a pre-launch moment. Combining a waitlist with the existing `@ottabase/referrals`
package creates a built-in viral loop with zero third-party dependencies.

**Sample implementation:**

```typescript
// packages/waitlist/src/WaitlistEntry.ts
export class WaitlistEntry extends BaseModel {
    static entity = 'waitlist_entries';

    static async join(email: string, referralCode?: string) {
        const position = await WaitlistEntry.count() + 1;
        const entry = await WaitlistEntry.create({ email, position, referralCode });
        await sendWelcomeEmail(email, entry.get('referralLink'));
        return entry;
    }

    async jumpQueue(spotsToJump: number) {
        this.set('position', Math.max(1, this.get('position') - spotsToJump));
        return this.save();
    }
}
```

```tsx
// Embeddable component
import { WaitlistForm } from '@ottabase/waitlist/react';

<WaitlistForm
    appId="my-saas"
    onSuccess={(position) => <p>You're #{position} in line!</p>}
/>
```

**Effort:** S · **Impact:** 🟠 High

---

### 7. `@ottabase/mfa` — TOTP / Email OTP Multi-Factor Auth

**Description:** TOTP (Google Authenticator / Authy) and email OTP as a second factor. Plugs into `@ottabase/auth`
session lifecycle. Stores encrypted TOTP secrets in D1. Backup codes generated on setup.

**Why:** B2B SaaS customers increasingly require MFA. Adding it later is painful — building it as an opt-in package
now means it's always ready to enable per org.

**Sample implementation:**

```typescript
// packages/mfa/src/totp.ts
import { generateSecret, verifyToken } from '@ottabase/mfa/totp';

// Setup
const { secret, qrCodeUrl } = await generateSecret({ label: user.email, issuer: 'MySaaS' });
// encrypt() uses AES-256-GCM; key sourced from a Cloudflare env var secret, never hardcoded
await MfaDevice.create({ userId: user.id, type: 'totp', secret: encrypt(secret) });

// Verify
const isValid = await verifyToken({ secret: decrypt(device.secret), token: userInput });
if (!isValid) return errorResponse('Invalid MFA code', 401);
```

```typescript
// Auth middleware hook
import { requireMfa } from '@ottabase/mfa';

export const POST = requireMfa(async (req, session) => {
    // Only runs if MFA passed
});
```

**Effort:** M · **Impact:** 🟠 High

---

### 8. `@ottabase/feedback` — In-App Feedback Widget

**Description:** Floating feedback button, screenshot capture (html2canvas), category tagging (bug / idea /
question), and admin inbox. Feedback stored as a fat model; optional webhook to Slack/Linear via
`@ottabase/webhooks`.

**Why:** Solo devs need a direct channel to hear from users without stitching together third-party tools like Canny or
Intercom. Self-hosted, privacy-friendly, zero per-seat cost.

**Sample implementation:**

```tsx
// packages/feedback/src/FeedbackWidget.tsx
import { FeedbackWidget } from '@ottabase/feedback/react';

// Add once in your root layout
<FeedbackWidget
    appId={config.appId}
    organizationId={session.organizationId}
    position="bottom-right"
    onSubmit={async (feedback) => {
        await createFeedback.mutateAsync(feedback);
    }}
/>
```

```typescript
// Slack integration via webhooks
import { triggerWebhook } from '@ottabase/webhooks';

// In Feedback model post-save hook
async notifyTeam() {
    await triggerWebhook('feedback.created', this.toJSON(), 'system');
}
```

**Effort:** S · **Impact:** 🟡 Medium

---

### 9. `@ottabase/changelog` — Public Changelog & Release Notes

**Description:** Structured changelog with categories (new, improved, fixed), public page, RSS feed, and optional
in-app widget showing unseen entries since last login. Ships a `ChangelogEntry` fat model.

**Why:** Changelogs build trust with users. A dedicated, branded changelog page (vs a raw GitHub releases page) is a
conversion tool that every solo product should have — takes an afternoon to add.

**Sample implementation:**

```typescript
// packages/changelog/src/ChangelogEntry.ts
export class ChangelogEntry extends BaseModel {
    static entity = 'changelog_entries';

    // Mark entry as seen for a user
    static async markSeen(userId: string, entryId: string) {
        await ChangelogView.upsert({ userId, entryId, seenAt: Date.now() });
    }

    static async unseenCount(userId: string) {
        const lastSeen = await ChangelogView.latest(userId);
        return ChangelogEntry.where({ publishedAt: { gt: lastSeen?.seenAt ?? 0 } }).count();
    }
}
```

```tsx
// In-app badge
const { data: count } = useQuery(['changelog-unseen'], () => fetchUnseenCount());
<ChangelogButton unreadCount={count} />
```

**Effort:** S · **Impact:** 🟡 Medium

---

### 10. `@ottabase/ui-onboarding` — Guided Onboarding Flows

**Description:** Multi-step onboarding wizard with checklist, progress persistence (D1), confetti on completion, and
skip/resume. Integrates with `@ottabase/analytics` to track step drop-offs.

**Why:** Activation is the most impactful metric for early SaaS. A good onboarding flow doubles activation rates;
without tooling, solo devs skip it and suffer churn.

**Sample implementation:**

```tsx
// packages/ui-onboarding/src/OnboardingWizard.tsx
import { OnboardingWizard } from '@ottabase/ui-onboarding';

<OnboardingWizard
    steps={[
        { id: 'profile', title: 'Set up your profile', component: <ProfileStep /> },
        { id: 'invite', title: 'Invite your team', component: <InviteStep /> },
        { id: 'first-project', title: 'Create your first project', component: <ProjectStep /> },
    ]}
    onComplete={async () => {
        await updateUser.mutateAsync({ onboardingCompleted: true });
        navigate('/dashboard');
    }}
/>
```

```typescript
// Progress backed by OttaORM
const progress = await OnboardingProgress.upsert({
    userId,
    completedSteps: JSON.stringify(['profile', 'invite']),
});
```

**Effort:** S · **Impact:** 🟠 High

---

### 11. `@ottabase/search` — Full-Text & Semantic Search

**Description:** Unified search package with two backends: D1 FTS5 for structured text search and Cloudflare
Vectorize for semantic/embedding search. `@ottabase/ottablog` and user-defined models register themselves as
searchable via a decorator.

**Why:** Every content-heavy app needs search. D1 FTS5 is free and fast for up to millions of rows; Vectorize adds
AI-powered semantic search for discovery use cases — both run at the edge with zero extra infra.

**Sample implementation:**

```typescript
// packages/search/src/Searchable.ts
@Searchable({ fields: ['title', 'content', 'tags'] })
export class Post extends BaseModel { ... }

// Auto-registers FTS triggers on init, re-indexes on save
```

```typescript
// Search API
import { search } from '@ottabase/search';

const results = await search('cloudflare workers', {
    models: [Post, Page],
    mode: 'fts', // or 'semantic' | 'hybrid'
    organizationId: ctx.organizationId,
    limit: 20,
});
```

```tsx
// Spotlight integration (uses existing @ottabase/spotlight)
import { SearchSpotlight } from '@ottabase/search/react';
<SearchSpotlight shortcut="cmd+k" models={['posts', 'pages', 'users']} />
```

**Effort:** L · **Impact:** 🟠 High

---

### 12. `@ottabase/health` — Health Checks & Uptime Endpoints

**Description:** `/api/health` and `/api/health/deep` endpoints that check D1 connectivity, KV, R2, Queue liveness,
and external dependency latency. Returns structured JSON. Ships a `HealthDashboard` component.

**Why:** Cloudflare Workers apps have no built-in health check. Without one, external monitors (Better Uptime,
UptimeRobot) can't distinguish app logic errors from infra failures.

**Sample implementation:**

```typescript
// packages/health/src/checks.ts
import { defineHealthCheck } from '@ottabase/health';

export const d1Check = defineHealthCheck('d1', async (env) => {
    await env.DB.prepare('SELECT 1').first();
    return { status: 'ok' };
});

export const kvCheck = defineHealthCheck('kv', async (env) => {
    await env.KV.put('__health', '1', { expirationTtl: 10 });
    return { status: 'ok' };
});
```

```typescript
// In cloudflare-worker.ts
import { healthRouter } from '@ottabase/health';
router.use('/api/health', healthRouter({ checks: [d1Check, kvCheck] }));
```

**Effort:** XS · **Impact:** 🟡 Medium

---

### 13. `@ottabase/backups` — Automated D1 Backup to R2

**Description:** Cron-triggered D1 export (SQLite dump via Cloudflare API) stored as gzipped `.sqlite` files in R2
with configurable retention (daily/weekly). Admin UI showing backup history and one-click restore trigger.

**Why:** D1 has point-in-time recovery, but solo devs need an extra safety net. Losing user data of a pet project
that took months to build is devastating. This is insurance.

**Sample implementation:**

```typescript
// Registered as a cron handler via @ottabase/cron
import { registerCron } from '@ottabase/cron';

registerCron('0 3 * * *', 'db:backup', async (env) => {
    const dump = await exportD1(env.DB, env.CLOUDFLARE_API_TOKEN);
    const key = `backups/${new Date().toISOString()}.sqlite.gz`;
    await env.R2_BACKUPS.put(key, dump);
    await pruneOldBackups(env.R2_BACKUPS, { keep: 30 }); // Keep 30 days
});
```

**Effort:** S · **Impact:** 🟠 High

---

### 14. `@ottabase/ui-charts` — Chart Components

**Description:** Thin wrapper around Recharts (already in many Mantine apps) providing `AreaChart`, `BarChart`,
`LineChart`, `DonutChart`, and `MetricCard`. Auto dark-mode via CSS variables. Feeds from OttaORM hooks directly.

**Why:** Dashboards and analytics pages are in every SaaS. A consistent chart library with pre-wired dark mode and
brand tokens eliminates the "chart styling rabbit hole" on every new project.

**Sample implementation:**

```tsx
// packages/ui-charts/src/AreaChart.tsx
import { AreaChart } from '@ottabase/ui-charts';

const { data } = useAnalytics({ metric: 'pageviews', range: '30d' });

<AreaChart
    data={data}
    xKey="date"
    yKey="value"
    color="var(--brand-primary)"
    label="Page Views"
/>
```

```tsx
// MetricCard — common dashboard tile
<MetricCard title="MRR" value={mrr} delta={+12.5} format="currency" currency="USD" />
```

**Effort:** S · **Impact:** 🟡 Medium

---

### 15. `@ottabase/invitations` — Team Invitation System

**Description:** Token-based invitation flow (email link → accept → onboard). Integrates with `@ottabase/auth`
(auto-create account), `@ottabase/email` (template), and `@ottabase/rbac` (role assignment on accept). Expiry +
resend logic included.

**Why:** Multi-tenant SaaS must let org owners invite teammates. This is currently manual — a formalised invitation
package with email templates removes a recurring pain point.

**Sample implementation:**

```typescript
// packages/invitations/src/Invitation.ts
export class Invitation extends BaseModel {
    static entity = 'invitations';

    static async send(email: string, organizationId: string, roleId: string, invitedById: string) {
        // 32 bytes of CSPRNG entropy for security-sensitive invitation token
        const token = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex');
        await Invitation.create({ email, organizationId, roleId, token, expiresAt: Date.now() + 7 * 86400_000 });
        await sendInvitationEmail(email, { token, orgName: org.name });
    }

    async accept(userId: string) {
        await OrganizationMember.addMember({ userId, organizationId: this.get('organizationId'), role: 'member' });
        await user.assignRole(this.get('roleId'), this.get('invitedById'), this.get('organizationId'));
        this.set('status', 'accepted');
        return this.save();
    }
}
```

**Effort:** S · **Impact:** 🟠 High

---

### 16. `@ottabase/support` — Help Desk / Support Tickets

**Description:** Lightweight in-app support ticket system: users submit tickets, org admins reply, status tracking
(open/in-progress/resolved). Email notifications via `@ottabase/email`. Optional Slack integration.

**Why:** Every self-funded SaaS needs a way to handle support without paying for Intercom or Zendesk from day one.
A self-hosted ticket system that lives in the same D1 database is free and searchable.

**Sample implementation:**

```typescript
export class SupportTicket extends BaseModel {
    static entity = 'support_tickets';

    async reply(body: string, authorId: string) {
        await TicketMessage.create({ ticketId: this.id, body, authorId });
        await sendEmail({ to: this.get('userEmail'), subject: `Re: ${this.get('subject')}`, body });
        this.set('status', 'in_progress');
        return this.save();
    }
}
```

```tsx
<SupportWidget organizationId={session.organizationId} userId={session.userId} />
```

**Effort:** M · **Impact:** 🟡 Medium

---

### 17. Enhancement: OttaORM — Soft Deletes & Query Scopes

**Description:** Add `softDelete()` support to `BaseModel` (deleted_at column, auto-exclude from queries,
`withTrashed()` scope, `restore()`). Also add chainable query scopes: `Model.where(...).scope('active').paginate()`.

**Why:** Soft deletes are needed in every real app to prevent accidental data loss and enable undo. Implementing them
per-model is error-prone; a `BaseModel` primitive eliminates the repetition.

**Sample implementation:**

```typescript
// packages/ottaorm/src/base/BaseModel.ts
export class BaseModel {
    // Opt-in per model
    static softDelete = true;

    async delete() {
        if ((this.constructor as typeof BaseModel).softDelete) {
            this.set('deletedAt', Date.now());
            return this.save();
        }
        return this.hardDelete();
    }
}

// Usage
await todo.delete();                      // soft delete
const all = await Todo.withTrashed().all(); // includes deleted
await todo.restore();                     // bring back
```

**Effort:** S · **Impact:** 🟠 High

---

### 18. Enhancement: `@ottabase/ottablog` — RSS Feed, Sitemap & Comments

**Description:** Add auto-generated RSS/Atom feed endpoint, XML sitemap for SEO, and a threaded comment system
(`Comment` fat model, moderation queue, `@ottabase/notifications` on reply).

**Why:** Blogs without RSS lose distribution. Blogs without a sitemap hurt SEO. Both are table-stakes for any content
site, and solo devs forget to add them under time pressure.

**Sample implementation:**

```typescript
// In cloudflare-worker.ts
import { blogRSSHandler, blogSitemapHandler } from '@ottabase/ottablog/feeds';

router.get('/rss.xml', blogRSSHandler({ appId: config.appId }));
router.get('/sitemap.xml', blogSitemapHandler({ appId: config.appId, baseUrl: config.appUrl }));
```

```typescript
// Comment model (ships with ottablog)
export class Comment extends BaseModel {
    static entity = 'blog_comments';

    async approve() {
        this.set('status', 'approved');
        await this.save();
        await notify(this.get('postAuthorId'), 'New comment on your post');
    }
}
```

**Effort:** S · **Impact:** 🟡 Medium

---

### 19. Enhancement: `@ottabase/brand-engine` — Visual Token Editor

**Description:** Browser-based design token editor rendered in the admin panel. Lets non-technical users update brand
colours, fonts, and spacing in real-time. Changes persist to D1 and invalidate KV cache.

**Why:** A solo dev running multiple client projects must customise branding per tenant without touching code. The
token editor makes the brand-engine a true no-code customisation layer.

**Sample implementation:**

```tsx
// packages/brand-engine-react/src/TokenEditor.tsx
import { TokenEditor } from '@ottabase/brand-engine-react';

// Admin panel page
<TokenEditor
    organizationId={session.organizationId}
    onSave={async (tokens) => {
        await updateBrandTokens.mutateAsync(tokens);
        // Cloudflare KV cache invalidated automatically
    }}
/>
```

**Effort:** M · **Impact:** 🟡 Medium

---

### 20. Enhancement: `@ottabase/scripts` — `create-app` Interactive CLI

**Description:** Extend the existing `pnpm create-app` script into an interactive wizard (`@clack/prompts`) that
scaffolds new apps with a questionnaire: app type (SaaS / blog / landing), packages to enable, tenant mode, billing
provider.

**Why:** The current scaffold is a manual file copy. An interactive CLI that wires `ottabase.config.ts`, enables the
right packages, and creates the initial RBAC seed reduces the setup from 30 minutes to 3 minutes.

**Sample implementation:**

```bash
pnpm create-app
# → ? What type of app? › SaaS  Blog  Homepage
# → ? App name: › my-saas
# → ? Enable billing? › Yes (Stripe)
# → ? Enable blog? › Yes
# → ? Tenant mode? › Multi-tenant
# ✓ Scaffolded apps/my-saas in 4s
# ✓ ottabase.config.ts written
# ✓ Dependencies installed
```

```typescript
// packages/scripts/src/cli/create-app.ts (extended)
import { select, text, confirm } from '@clack/prompts';

const appType = await select({ message: 'App type', options: ['saas', 'blog', 'homepage'] });
const billing = appType === 'saas' && await confirm({ message: 'Enable billing?' });
```

**Effort:** S · **Impact:** 🟠 High

---

## Year 2 — Growth, Content & AI

### 21. `@ottabase/ai` — AI Toolkit (Workers AI / OpenAI / Claude)

**Description:** Unified AI client with provider abstraction (Cloudflare Workers AI, OpenAI, Anthropic). Helpers for
streaming responses, prompt templating, token counting, and rate-limiting per org/plan.

**Why:** AI features are now a competitive expectation, not a differentiator. A shared client with streaming support
and per-org rate limits prevents different apps from duplicating this boilerplate.

**Sample implementation:**

```typescript
// packages/ai/src/index.ts
import { createAIClient } from '@ottabase/ai';

const ai = createAIClient({ provider: 'workers-ai', binding: env.AI });

// Streaming completion
const stream = ai.stream({
    model: '@cf/meta/llama-3-8b-instruct',
    messages: [{ role: 'user', content: prompt }],
});
return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } });
```

```typescript
// Per-org usage metering (integrates with @ottabase/payments)
const tokens = await ai.complete({ model, messages, track: { organizationId, quota: plan.aiTokens } });
```

**Effort:** M · **Impact:** 🟠 High

---

### 22. `@ottabase/embeddings` — Vector Embeddings & Semantic Search

**Description:** Generate, store, and query vector embeddings using Cloudflare Vectorize. Ships a `withEmbeddings`
mixin for any fat model, auto-updating vectors on save. Pairs with `@ottabase/search` semantic mode.

**Why:** Semantic search and AI-powered recommendations require embeddings. Building on Vectorize keeps everything
within Cloudflare's edge with no third-party latency or data residency concerns.

**Sample implementation:**

```typescript
@withEmbeddings({ fields: ['title', 'content'], namespace: 'blog-posts' })
export class Post extends BaseModel { ... }

// After save, embedding auto-generated via Workers AI, stored in Vectorize

// Semantic search
const similar = await Post.semanticSearch('how to deploy to edge', { topK: 5, organizationId });
```

**Effort:** M · **Impact:** 🟡 Medium

---

### 23. `@ottabase/ai-content` — AI Writing Assistant for Blog & Pages

**Description:** AI-powered writing tools that plug into `@ottabase/ottaeditor`: auto-complete, paragraph expand,
tone rewrite, SEO meta generation, and image alt-text. Uses `@ottabase/ai` under the hood.

**Why:** Content creation is the bottleneck for solo devs running their own blogs. AI writing tools that live
directly in the editor (vs copy-pasting from ChatGPT) cut content time in half.

**Sample implementation:**

```tsx
// packages/ai-content/src/EditorAIPlugin.tsx
// Registers as an OttaEditor plugin
export const AIContentPlugin: OttaEditorPlugin = {
    id: 'ai-content',
    commands: [
        { label: 'Expand paragraph', handler: expandWithAI },
        { label: 'Fix grammar', handler: fixGrammarWithAI },
        { label: 'Generate SEO title', handler: generateSeoTitle },
    ],
};
```

```typescript
// Generate SEO meta from content
const { title, description, keywords } = await generateSeoMeta({
    content: post.get('content'),
    ai: createAIClient({ provider: 'openai', apiKey: env.OPENAI_KEY }),
});
```

**Effort:** M · **Impact:** 🟡 Medium

---

### 24. `@ottabase/pages` — Visual Page Builder

**Description:** Drag-and-drop landing page builder for marketing sites. Sections (Hero, Features, Pricing, FAQ,
CTA) are React components with editable props. Pages stored as JSON in D1, rendered server-side or as React.

**Why:** Solo devs waste days tweaking landing pages in code. A section-based page builder that stores JSON and
renders to edge HTML lets marketing changes happen without a deploy.

**Sample implementation:**

```typescript
// packages/pages/src/Page.ts
export class Page extends BaseModel {
    static entity = 'pages';

    get sections() {
        return JSON.parse(this.get('content')) as PageSection[];
    }

    async render() {
        return renderPageToHTML(this.sections, { brand: await loadBrandTokens(this.get('organizationId')) });
    }
}
```

```tsx
<PageBuilder
    pageId={params.id}
    blocks={['Hero', 'Features', 'Pricing', 'FAQ', 'CTA', 'Testimonials']}
    onSave={(sections) => updatePage.mutateAsync({ id: params.id, content: JSON.stringify(sections) })}
/>
```

**Effort:** XL · **Impact:** 🟠 High

---

### 25. `@ottabase/billing-ui` — Self-Service Billing Portal Components

**Description:** Pre-built React components for the billing page: current plan display, upgrade CTA, invoice history,
payment method management, and usage meters. Consumes `@ottabase/payments` hooks.

**Why:** The hardest part of billing UI isn't the Stripe API — it's the polished table of invoices, the "upgrade"
modal, and the usage progress bars. Pre-built components eliminate a week of frontend work.

**Sample implementation:**

```tsx
import { BillingPage } from '@ottabase/billing-ui';

// Drop-in page component with all billing UI pre-wired
<BillingPage organizationId={session.organizationId} returnUrl="/settings" />
```

```tsx
// Or individual components
<CurrentPlan plan={subscription.plan} seats={usage.seats} />
<InvoiceHistory invoices={invoices} />
<UsageMeter label="API Calls" used={usage.apiCalls} limit={plan.apiLimit} />
```

**Effort:** M · **Impact:** 🟠 High

---

### 26. `@ottabase/affiliate` — Affiliate / Partner Program

**Description:** Affiliate link generation, click tracking (via `@ottabase/analytics`), conversion attribution, and
payout tracking. Integrates with `@ottabase/referrals` for first-touch attribution.

**Why:** Affiliates and partner programs drive scalable acquisition for solo SaaS without ad spend. Building on top of
existing referrals + analytics packages means almost zero net-new infrastructure.

**Sample implementation:**

```typescript
export class Affiliate extends BaseModel {
    static entity = 'affiliates';

    static async create(userId: string, code?: string) {
        const affiliate = await super.create({
            userId,
            code: code ?? generateCode(6),
            commissionRate: 0.3, // 30%
        });
        return affiliate;
    }

    async pendingPayout() {
        const conversions = await Conversion.where({ affiliateId: this.id, status: 'pending' });
        return conversions.reduce((sum, c) => sum + c.get('amount') * this.get('commissionRate'), 0);
    }
}
```

**Effort:** M · **Impact:** 🟡 Medium

---

### 27. `@ottabase/usage-metering` — Usage-Based Billing Counters

**Description:** Lightweight metering counters (API calls, storage bytes, seats, AI tokens) persisted in D1 with
daily rollups to avoid unbounded row growth. Integrates with `@ottabase/payments` for overage billing.

**Why:** Usage-based pricing is the default for developer tools and AI SaaS. Without metering infra, solo devs either
charge flat rates (leaving money on the table) or bill incorrectly.

**Sample implementation:**

```typescript
import { meter } from '@ottabase/usage-metering';

// In any worker route — fire and forget
await meter({ organizationId, metric: 'api_calls', value: 1, env });
await meter({ organizationId, metric: 'ai_tokens', value: completionTokens, env });
```

```typescript
// Check quota before serving
const usage = await getUsage(organizationId, 'api_calls', 'month');
if (usage >= plan.apiLimit) return errorResponse('Usage limit exceeded', 429);
```

**Effort:** S · **Impact:** 🟠 High

---

### 28. `@ottabase/sso` — SAML / OIDC Enterprise SSO

**Description:** SAML 2.0 SP and OIDC RP implementation for enterprise org-level SSO. Per-org IdP configuration
stored in D1. Integrates into `@ottabase/auth` session flow. JIT provisioning on first login.

**Why:** Enterprise deals require SSO. Adding SAML support late is a multi-week effort that blocks sales. A reusable
package that every Ottabase app can enable closes enterprise deals without custom work.

**Sample implementation:**

```typescript
// packages/sso/src/saml.ts
import { SamlSP } from '@ottabase/sso';

const sp = new SamlSP({ entityId: `${appUrl}/sso/saml/metadata`, acs: `${appUrl}/sso/saml/callback` });
const { redirectUrl } = await sp.initiateLogin(idpConfig);
return Response.redirect(redirectUrl);
```

```typescript
// JIT provisioning on SAML callback — handleCallback validates IdP certificate signature first
const { email, firstName, lastName } = await sp.handleCallback(request, idpConfig);
// idpConfig must include the IdP's X.509 certificate for signature verification
let user = await User.first({ email }) ?? await User.create({ email, name: `${firstName} ${lastName}` });
await OrganizationMember.addMember({ userId: user.id, organizationId, role: 'member', status: 'active' });
```

**Effort:** L · **Impact:** 🟡 Medium

---

### 29. `@ottabase/ui-kanban` — Drag-and-Drop Kanban Board

**Description:** Accessible kanban board (columns + cards) with drag-and-drop via `@dnd-kit`. Column and card data
backed by OttaORM fat models. Real-time card movement via `@ottabase/cf-realtime`.

**Why:** Project management, pipeline tracking, and content calendars all use kanban. Without a reusable component,
every new app rebuilds the same drag-and-drop logic.

**Sample implementation:**

```tsx
import { KanbanBoard } from '@ottabase/ui-kanban';

const { data: columns } = useKanbanColumns({ boardId });
const { data: cards } = useKanbanCards({ boardId });

<KanbanBoard
    columns={columns}
    cards={cards}
    onCardMove={async ({ cardId, toColumnId, position }) => {
        await moveCard.mutateAsync({ cardId, toColumnId, position });
        // Broadcast via cf-realtime for real-time sync
    }}
/>
```

**Effort:** M · **Impact:** 🟡 Medium

---

### 30. `@ottabase/ui-calendar` — Calendar & Scheduling Component

**Description:** Month/week/day calendar view with event rendering, drag-to-create, and event click handlers.
Framework-agnostic core; React wrapper uses OttaORM hooks. Supports iCal export.

**Why:** Booking, scheduling, and editorial calendar use cases appear in a huge range of projects. A quality calendar
component is notoriously hard to build from scratch.

**Sample implementation:**

```tsx
import { Calendar } from '@ottabase/ui-calendar';

const { data: events } = useCalendarEvents({ start, end });

<Calendar
    view="week"
    events={events}
    onEventCreate={(slot) => createEvent.mutateAsync({ start: slot.start, end: slot.end })}
    onEventClick={(event) => navigate(`/events/${event.id}`)}
/>
```

**Effort:** L · **Impact:** 🟡 Medium

---

### 31. `@ottabase/testimonials` — Social Proof Collection & Display

**Description:** Request testimonials via email, collect via a public form, moderate in admin, and display with
`<TestimonialsWall />` and `<TestimonialCarousel />` components. Integrates with the page builder.

**Why:** Social proof is the fastest trust signal. Manually collecting and displaying testimonials is tedious. A
self-hosted tool avoids per-seat pricing on tools like Testimonial.to.

**Sample implementation:**

```typescript
export class Testimonial extends BaseModel {
    static entity = 'testimonials';

    static async requestViaEmail(customerEmail: string, appId: string) {
        const token = crypto.randomUUID();
        await TestimonialRequest.create({ customerEmail, appId, token });
        await sendEmail({ to: customerEmail, template: 'testimonial-request', data: { token } });
    }
}
```

```tsx
<TestimonialsWall organizationId={session.organizationId} layout="masonry" limit={12} />
```

**Effort:** S · **Impact:** 🟡 Medium

---

### 32. `@ottabase/announcements` — In-App Announcement Banners

**Description:** Admin-created announcements shown as dismissible banners or modals to users. Targeting by plan,
role, or feature flag. Seen-state tracked per user in D1. Supports rich content via `@ottabase/ottarenderer`.

**Why:** Communicating new features, upcoming maintenance, or plan changes without a full notification system is a
common need. A lightweight in-app announcement system is faster than push notifications for most use cases.

**Sample implementation:**

```tsx
// Wrap your app layout once
<AnnouncementProvider userId={session.userId} organizationId={session.organizationId}>
    {children}
</AnnouncementProvider>

// Auto-renders unseen announcements at the top of every page
```

```typescript
// Create announcement from admin
await Announcement.create({
    title: 'New AI features are here!',
    body: editorJsContent,
    target: { plans: ['pro', 'enterprise'] },
    startsAt: Date.now(),
    endsAt: Date.now() + 7 * 86400_000,
});
```

**Effort:** S · **Impact:** 🟡 Medium

---

### 33. `@ottabase/ottamap` — Maps Component

**Description:** Lightweight map component wrapping Leaflet (open-source, free tiles) with MarkerCluster, GeoJSON
overlay, and click handlers. Optional Mapbox adapter for premium tiles.

**Why:** Location features appear in local services, event apps, and analytics dashboards. Leaflet on its own requires
styling and clustering boilerplate; a thin wrapper eliminates the recurring setup.

**Sample implementation:**

```tsx
import { OttaMap, Marker, MarkerCluster } from '@ottabase/ottamap';

<OttaMap center={[51.5, -0.09]} zoom={12}>
    <MarkerCluster>
        {locations.map((loc) => (
            <Marker key={loc.id} position={[loc.lat, loc.lng]} onClick={() => setSelected(loc)} />
        ))}
    </MarkerCluster>
</OttaMap>
```

**Effort:** S · **Impact:** 🟢 Nice-to-have

---

### 34. `@ottabase/devtools` — Browser DevTools Panel

**Description:** Browser extension (Chrome/Firefox) that shows OttaORM query log, active RLS context, RBAC
permissions, feature flags, and cache stats for the current page. Zero production overhead — panel only active in dev.

**Why:** Debugging OttaORM, RLS, and RBAC in a browser context currently requires console.log hunting. A dedicated
DevTools panel cuts debugging time significantly, especially for new contributors.

**Sample implementation:**

```typescript
// packages/devtools/src/panel.ts
// Injected only in dev mode via @ottabase/config ENVIRONMENT check

window.__OTTABASE_DEVTOOLS__ = {
    queries: queryLog,
    context: currentRLSContext,
    flags: resolvedFlags,
    permissions: currentPermissions,
};
```

```typescript
// OttaORM hooks into devtools when available
if (typeof window !== 'undefined' && window.__OTTABASE_DEVTOOLS__) {
    window.__OTTABASE_DEVTOOLS__.queries.push({ sql, duration, model });
}
```

**Effort:** M · **Impact:** 🟡 Medium

---

### 35. `@ottabase/docs-engine` — Full Documentation Site Engine

**Description:** Extend `@ottabase/docs` into a full documentation platform: sidebar navigation from file system,
versioned docs, Algolia DocSearch integration, MDX support, interactive playground via `@ottabase/ui-split-pane`.

**Why:** Products with good documentation have lower churn and faster onboarding. Mintlify costs $150/month;
a self-hosted docs engine that runs on the same Cloudflare Workers deployment is free.

**Sample implementation:**

```typescript
// ottabase/config.ts — enable docs engine
packages: {
    docsEngine: {
        enabled: true,
        basePath: '/docs',
        source: './content/docs', // Markdown files
        search: 'algolia', // or 'd1-fts'
        versions: ['v1', 'v2'],
    }
}
```

```tsx
// Auto-generated sidebar, prev/next navigation, search
// Accessed at /docs/getting-started, /docs/api-reference, etc.
```

**Effort:** L · **Impact:** 🟡 Medium

---

### 36. Enhancement: `@ottabase/cf-realtime` — Presence & Typing Indicators

**Description:** Add user presence (online/offline/idle), per-document typing indicators, and cursor sharing to
`@ottabase/cf-realtime`. Backed by Durable Objects. React hooks: `usePresence()`, `useTyping()`.

**Why:** Collaborative editing, live dashboards, and shared kanban boards all need presence. Durable Objects already
power the WebSocket layer — presence is a small surface extension with big perceived-value.

**Sample implementation:**

```typescript
// packages/cf-realtime/src/presence.ts
export const { usePresence } = createPresence({ channel: `doc:${docId}`, userId });

const { online } = usePresence();
// → [{ userId: 'u1', name: 'Alice', cursor: { x, y } }, ...]
```

```typescript
const { isTyping, startTyping } = useTyping({ channel: `doc:${docId}`, userId });
<input onFocus={startTyping} onChange={startTyping} />
{isTyping.length > 0 && <p>{isTyping.map(u => u.name).join(', ')} is typing...</p>}
```

**Effort:** S · **Impact:** 🟡 Medium

---

### 37. Enhancement: `@ottabase/ottaorm` — Optimistic Locking & Versioning

**Description:** Add `version` column support to `BaseModel` for optimistic concurrency control. Concurrent updates
increment the version; a stale update throws `ConflictError`. Also adds `history()` method for change tracking.

**Why:** Multi-user collaborative editing (kanban, docs) without optimistic locking causes silent data loss. This is
a one-time `BaseModel` primitive that prevents entire classes of race condition bugs.

**Sample implementation:**

```typescript
// Opt-in per model
export class Document extends BaseModel {
    static optimisticLock = true; // adds `version` column

    async update(data: Partial<DocumentType>) {
        // Throws ConflictError if version mismatch
        return super.update({ ...data, version: this.get('version') + 1 });
    }
}
```

**Effort:** S · **Impact:** 🟠 High

---

### 38. Enhancement: `@ottabase/analytics` — Funnel & Cohort Analysis UI

**Description:** Add pre-built React dashboard components to `@ottabase/analytics`: funnel visualisation, cohort
retention heatmap, top-K tables, and a real-time event stream viewer. Data from Cloudflare WAE.

**Why:** Raw WAE write calls are already wired. The missing piece is the read-side UI. Solo devs should be able to
see their funnel and retention data without self-hosting Metabase.

**Sample implementation:**

```tsx
import { FunnelChart, RetentionHeatmap, TopKTable } from '@ottabase/analytics/react';

<FunnelChart
    steps={['signup', 'onboarding_complete', 'first_payment']}
    range="30d"
    organizationId={session.organizationId}
/>

<RetentionHeatmap metric="dau" cohort="weekly" range="12w" />
```

**Effort:** M · **Impact:** 🟠 High

---

### 39. Enhancement: `@ottabase/queue` — Dead Letter Queue & Monitoring UI

**Description:** Add DLQ support (failed jobs routed to separate queue after N retries), a `QueueJob` fat model for
job persistence and query, and an admin UI showing queue depth, throughput, and failed job replay.

**Why:** Job queues in production fail silently. Without DLQ and observability, failed background jobs (emails,
webhooks, AI tasks) disappear without a trace. Visibility is non-negotiable for production.

**Sample implementation:**

```typescript
// packages/queue/src/dlq.ts
export async function handleJobFailure(job: QueueMessage, error: Error) {
    const attempts = job.metadata?.attempts ?? 0;
    if (attempts >= MAX_RETRIES) {
        await DeadLetterJob.create({ jobId: job.id, payload: job.body, error: error.message });
        await notify('team', `Job ${job.id} moved to DLQ: ${error.message}`);
    }
}
```

```tsx
// Admin UI — queue dashboard
<QueueDashboard queues={['default', 'email', 'webhooks']} showDLQ />
```

**Effort:** M · **Impact:** 🟠 High

---

### 40. Enhancement: Multi-App CLI & Deployment Orchestration

**Description:** Extend `@ottabase/scripts` with `pnpm deploy:all` (parallel Wrangler deploys), `pnpm db:migrate`
(run migrations across all D1 databases), and `pnpm status` (live deployment health from Cloudflare API).

**Why:** Managing multiple apps in the monorepo becomes painful without deployment tooling. A solo dev running 3+
apps should be able to deploy them all and check their status in a single command.

**Sample implementation:**

```bash
pnpm deploy:all
# → Deploying apps/my-saas     ... ✓ 3.2s
# → Deploying apps/my-homepage ... ✓ 2.1s
# → Deploying apps/my-blog     ... ✓ 1.8s
# All 3 apps deployed successfully

pnpm db:migrate --env production
# → Running migrations for my-saas    ... ✓ 2 new tables
# → Running migrations for my-homepage... ✓ no changes
```

**Effort:** S · **Impact:** 🟠 High

---

## Summary Matrix

| # | Package / Feature | Year | Effort | Impact |
|---|---|---|---|---|
| 1 | `@ottabase/payments` | Y1 | L | 🔴 |
| 2 | `@ottabase/feature-flags` | Y1 | M | 🟠 |
| 3 | `@ottabase/api-keys` | Y1 | M | 🟠 |
| 4 | `@ottabase/ui-data-table` | Y1 | M | 🟠 |
| 5 | `@ottabase/webhooks` | Y1 | M | 🟠 |
| 6 | `@ottabase/waitlist` | Y1 | S | 🟠 |
| 7 | `@ottabase/mfa` | Y1 | M | 🟠 |
| 8 | `@ottabase/feedback` | Y1 | S | 🟡 |
| 9 | `@ottabase/changelog` | Y1 | S | 🟡 |
| 10 | `@ottabase/ui-onboarding` | Y1 | S | 🟠 |
| 11 | `@ottabase/search` | Y1 | L | 🟠 |
| 12 | `@ottabase/health` | Y1 | XS | 🟡 |
| 13 | `@ottabase/backups` | Y1 | S | 🟠 |
| 14 | `@ottabase/ui-charts` | Y1 | S | 🟡 |
| 15 | `@ottabase/invitations` | Y1 | S | 🟠 |
| 16 | `@ottabase/support` | Y1 | M | 🟡 |
| 17 | OttaORM: Soft Deletes & Scopes | Y1 | S | 🟠 |
| 18 | ottablog: RSS + Sitemap + Comments | Y1 | S | 🟡 |
| 19 | brand-engine: Visual Token Editor | Y1 | M | 🟡 |
| 20 | scripts: Interactive `create-app` CLI | Y1 | S | 🟠 |
| 21 | `@ottabase/ai` | Y2 | M | 🟠 |
| 22 | `@ottabase/embeddings` | Y2 | M | 🟡 |
| 23 | `@ottabase/ai-content` | Y2 | M | 🟡 |
| 24 | `@ottabase/pages` | Y2 | XL | 🟠 |
| 25 | `@ottabase/billing-ui` | Y2 | M | 🟠 |
| 26 | `@ottabase/affiliate` | Y2 | M | 🟡 |
| 27 | `@ottabase/usage-metering` | Y2 | S | 🟠 |
| 28 | `@ottabase/sso` | Y2 | L | 🟡 |
| 29 | `@ottabase/ui-kanban` | Y2 | M | 🟡 |
| 30 | `@ottabase/ui-calendar` | Y2 | L | 🟡 |
| 31 | `@ottabase/testimonials` | Y2 | S | 🟡 |
| 32 | `@ottabase/announcements` | Y2 | S | 🟡 |
| 33 | `@ottabase/ottamap` | Y2 | S | 🟢 |
| 34 | `@ottabase/devtools` | Y2 | M | 🟡 |
| 35 | `@ottabase/docs-engine` | Y2 | L | 🟡 |
| 36 | cf-realtime: Presence & Typing | Y2 | S | 🟡 |
| 37 | OttaORM: Optimistic Locking | Y2 | S | 🟠 |
| 38 | analytics: Funnel & Cohort UI | Y2 | M | 🟠 |
| 39 | queue: DLQ & Monitoring UI | Y2 | M | 🟠 |
| 40 | Multi-app Deploy Orchestration | Y2 | S | 🟠 |

---

> All packages follow the Ottabase conventions: OttaORM fat models, `workspace:*` deps, edge-safe code, README +
> tests required. See `AGENTS.MD` and `PACKAGE_CREATION_GUIDE.md` for scaffolding instructions.
