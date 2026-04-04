import Link from 'next/link';
import { philosophyTheme } from '@/components/philosophy/philosophy-theme';

const CODE_DIFF = `// ❌ The MVC ceremony — logic scattered everywhere
// userService.ts → userController.ts → userRepository.ts
await userService.activate(userId);

// ✅ The fat model — logic where it belongs
const user = await User.find(userId);
await user.activate(); // sends email, updates status, logs event`;

export function PhilosophyArticle() {
    const t = philosophyTheme();

    return (
        <div className={t.wrap}>
            <article className={t.article}>
                <h2 className={t.block}>I. The fat models manifesto.</h2>

                <p className={t.block}>There is a ceremony in modern web development that goes like this:</p>

                <p className={t.block}>
                    You write a model. It has <code>id</code>, <code>name</code>, <code>createdAt</code>. Then you write
                    a service that does the actual work. Then a controller that orchestrates the service. Then a
                    repository that wraps the ORM. Then a DTO to validate input. Then a transformer to format output.
                </p>

                <div className={t.quote}>
                    <p>
                        By the time you&apos;ve finished, you&apos;ve touched six files to do one thing: save a record
                        to a database.
                    </p>
                </div>

                <p className={t.block}>
                    This abstraction ceremony is sold as &quot;separation of concerns.&quot; But concerns were never the
                    problem. <strong>Scatter is the problem.</strong> When the logic for what a <code>Todo</code> does
                    is spread across a service, a controller, and a repository, you don&apos;t have separation — you
                    have archaeology.
                </p>

                <p className={t.block}>
                    OttaORM says: no. <strong>The model is the truth.</strong> It knows how to save itself. It knows its
                    relationships. It knows its validation rules. It knows its domain behavior.{' '}
                    <code>todo.toggle()</code> is a method on the model. <code>user.activate()</code> is too.{' '}
                    <code>shortlink.rotateSlug()</code>. <code>invoice.markPaid()</code>.
                </p>

                <p className={t.block}>
                    You read the model, you understand the domain. Nothing is missing. Nothing is elsewhere.
                </p>

                <ul className={t.block}>
                    <li>Domain logic lives with the data that it acts on.</li>
                    <li>Relationships are declared where the model is defined.</li>
                    <li>Validation is part of the schema, not a separate class hierarchy.</li>
                    <li>The model is the unit of testing — isolated, self-contained, honest.</li>
                </ul>

                <div className={t.codeWrap} style={{ marginBlock: '2.5rem' }}>
                    <div className={t.codeBar} aria-hidden="true">
                        <span className={t.codeDot} style={{ background: '#ef4444' }} />
                        <span className={t.codeDot} style={{ background: '#f59e0b' }} />
                        <span className={t.codeDot} style={{ background: '#10b981' }} />
                        <span className={t.codeTitle}>The difference</span>
                    </div>
                    <pre className={t.codePre}>
                        <code>{CODE_DIFF}</code>
                    </pre>
                </div>

                <p className={t.block}>
                    This isn&apos;t a new idea. Active Record in Rails proved it. Django models proved it. It works. The
                    enterprise world abandoned it for abstraction theatre and suffered for it. We&apos;re not repeating
                    that mistake.
                </p>

                <div className={t.divider} />

                <h2 className={t.block}>II. Why Cloudflare, specifically.</h2>

                <p className={t.block}>
                    We&apos;re not Cloudflare-native because it&apos;s trendy. We&apos;re Cloudflare-native because the
                    economics are undeniable and the primitives are genuinely better.
                </p>

                <ul className={t.block}>
                    <li>
                        <strong>D1 (SQLite on the edge)</strong> — no Postgres instance to provision, no connection
                        pools to manage, no bill for idle capacity. SQLite is fast, portable, and underrated.
                    </li>
                    <li>
                        <strong>KV</strong> — RBAC caching with global read performance at 0ms from anywhere. Session
                        storage without a Redis cluster.
                    </li>
                    <li>
                        <strong>R2</strong> — S3-compatible storage with <em>zero egress fees</em>. At scale, egress is
                        where AWS costs you more than everything else combined.
                    </li>
                    <li>
                        <strong>Durable Objects</strong> — real WebSocket connections, real state, at edge locations.
                        Firebase Realtime Database but for $0.15 per million requests.
                    </li>
                    <li>
                        <strong>Queues</strong> — native job queue. No SQS, no Bull, no Redis. Just a binding and a
                        handler.
                    </li>
                    <li>
                        <strong>Analytics Engine</strong> — custom events at SQL-queryable speed. ClickHouse-level
                        throughput for $0.
                    </li>
                </ul>

                <div className={t.quote}>
                    <p>
                        Cloudflare&apos;s free tier supports a meaningful early-stage SaaS. Their paid tier is 50x
                        cheaper than AWS for equivalent workloads. We&apos;d be foolish to build anywhere else.
                    </p>
                </div>

                <p className={t.block}>
                    There is one tradeoff: <strong>no Node.js APIs in Workers.</strong> No <code>fs</code>, no{' '}
                    <code>child_process</code>, no native modules. Ottabase is designed around this. Every package in
                    the ecosystem is edge-compatible. If you find one that isn&apos;t, it&apos;s a bug — file it.
                </p>

                <div className={t.divider} />

                <h2 className={t.block}>III. Multi-tenancy is the foundation, not a feature.</h2>

                <p className={t.block}>
                    The classic SaaS mistake: build for a single tenant, then try to add multi-tenancy later. You
                    can&apos;t. Not cleanly. You end up with <code>WHERE organizationId = ?</code> in 200 queries, a
                    permission system that leaks across orgs, and an audit log that you pray nobody subpoenas.
                </p>

                <p className={t.block}>
                    Ottabase enforces multi-tenancy at the ORM layer through Row-Level Security. You call{' '}
                    <code>initRLS()</code> once per request. Every query after that is automatically scoped to the right
                    tenant. You cannot accidentally query another tenant&apos;s data. The WHERE clause is invisible but
                    inescapable.
                </p>

                <ul className={t.block}>
                    <li>Organisation → App → User: a three-level hierarchy that covers most B2B SaaS models.</li>
                    <li>RBAC permissions cached in KV — checked on every request, never hit the database.</li>
                    <li>Audit log captures every mutation with full context: who, what, when, for which tenant.</li>
                    <li>
                        Bootstrap sequence creates the owner account, seeds roles, and initialises the platform in four
                        curl commands.
                    </li>
                </ul>

                <p className={t.block}>This is not something you add later. It&apos;s why Ottabase exists.</p>

                <div className={t.divider} />

                <h2 className={t.block}>IV. TypeScript, end to end, without compromise.</h2>

                <p className={t.block}>
                    &quot;TypeScript E2E&quot; is a phrase people use loosely. Ottabase means it precisely.
                </p>

                <ul className={t.block}>
                    <li>Database schema is defined in TypeScript (Drizzle). No SQL files, no migration diffs.</li>
                    <li>API types are inferred from schema — not generated, inferred. Zero drift by construction.</li>
                    <li>
                        Client hooks are typed to the same models. If you rename a field, TypeScript breaks where it
                        should break.
                    </li>
                    <li>
                        Workers runtime types come from <code>@cloudflare/workers-types</code>. No runtime surprises.
                    </li>
                    <li>Zod validates at the API boundary. If it passes Zod, TypeScript and the database agree.</li>
                </ul>

                <p className={t.block}>
                    There is no &quot;any&quot; in Ottabase&apos;s core. There are no <code>// @ts-ignore</code>{' '}
                    comments in the codebase. If your IDE shows you a type error, it means something is actually wrong.
                </p>

                <div className={t.divider} />

                <h2 className={t.block}>V. The monorepo isn&apos;t overhead. It&apos;s leverage.</h2>

                <p className={t.block}>
                    47 packages sounds like a lot to manage. With pnpm workspaces and Turborepo, it isn&apos;t. You get:
                </p>

                <ul className={t.block}>
                    <li>Shared dependency versions across all packages — one update, propagated everywhere.</li>
                    <li>Atomic changes that span package boundaries without publish cycles.</li>
                    <li>Incremental builds — only rebuild what changed, not the entire codebase.</li>
                    <li>The ability to cherry-pick: use only the packages you need, ignore the rest.</li>
                    <li>Corporate-grade code organisation from day one, even as a solo founder.</li>
                </ul>

                <p className={t.block}>
                    The alternative is a polyrepo — where <code>auth</code> is in one repo, <code>ui</code> is in
                    another, and you&apos;re publishing and depending on package versions across 12 repositories.
                    We&apos;ve done that. It&apos;s not worth it until you have a reason to decouple deployment cycles.
                    Most SaaS products never reach that point.
                </p>

                <div className={t.divider} />

                <h2 className={t.block}>VI. What we&apos;d change if starting over.</h2>

                <p className={t.block}>Honesty matters in open-source documentation.</p>

                <ul className={t.block}>
                    <li>
                        <strong>Payments from day one</strong> — Stripe integration should be a first-class package.
                        It&apos;s coming, but it should have shipped before everything else.
                    </li>
                    <li>
                        <strong>Less Mantine, more primitive</strong> — Mantine adds significant bundle weight. The
                        trend is toward headless + Tailwind. We&apos;re moving in that direction.
                    </li>
                    <li>
                        <strong>Simpler bootstrap sequence</strong> — four curl commands work, but an interactive CLI
                        wizard would be more welcoming for first-time users.
                    </li>
                    <li>
                        <strong>More examples earlier</strong> — the framework is capable, but the &quot;what can I
                        build&quot; question deserves more concrete answers in the docs.
                    </li>
                </ul>

                <p className={t.block}>
                    None of these are regressions. They&apos;re the honest backlog of a project built by someone who was
                    also building products with it simultaneously.
                </p>

                <div className={t.divider} />

                <div className={t.block} style={{ textAlign: 'center', paddingBlock: '2rem' }}>
                    <p style={{ color: t.muted, marginBottom: '1.5rem', fontSize: '1.0625rem' }}>
                        These aren&apos;t just opinions. They&apos;re working code. 47 packages worth.
                    </p>
                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <a
                            href="https://github.com/thinkdj/ottabase"
                            className={t.btnP}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            ⭐ Star on GitHub
                        </a>
                        <Link href="/docs" className={t.btnG}>
                            Get Started →
                        </Link>
                    </div>
                </div>
            </article>
        </div>
    );
}
