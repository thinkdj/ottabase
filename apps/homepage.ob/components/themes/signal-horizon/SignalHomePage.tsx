import { SignalCodeShowcase } from '@/components/themes/signal-horizon/SignalCodeShowcase';
import { SignalTerminal } from '@/components/themes/signal-horizon/SignalTerminal';
import Link from 'next/link';
import type { CSSProperties } from 'react';

export function SignalHomePage() {
    return (
        <>
            <section className="ob-hp-hero ob-hp-container" aria-labelledby="ob-hp-hero-title">
                <div className="ob-hp-hero-grid">
                    <div>
                        <p className="ob-hp-eyebrow">TypeScript · monorepo · Edge-native</p>
                        <h1 id="ob-hp-hero-title">
                            Opinionated code,
                            <span className="ob-hp-line2 block">for solo SaaS builders.</span>
                        </h1>
                        <p className="ob-hp-lede">
                            Forty-seven packages wired together for multi-tenant SaaS: OttaORM, Auth.js, RBAC, realtime,
                            queues, blog, UI components... Scale from 1 to 1 M customers on the same codebase and
                            infrastructure.
                        </p>
                        <div className="ob-hp-hero-cta">
                            <a
                                href="https://github.com/thinkdj/ottabase"
                                className="ob-hp-btn ob-hp-btn--primary ob-hp-btn--lg"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                Star on GitHub
                            </a>
                            <Link href="/docs" className="ob-hp-btn ob-hp-btn--ghost ob-hp-btn--lg">
                                Read the quickstart
                            </Link>
                        </div>
                        <p className="ob-hp-micro">
                            <span>TanStack Router</span>
                            <span>·</span>
                            <span>D1 + Drizzle</span>
                            <span>·</span>
                            <span>Durable Objects</span>
                            <span>·</span>
                            <span>MIT</span>
                        </p>
                    </div>
                    <div className="ob-hp-orbit-wrap ob-hp-reveal" aria-hidden="true">
                        <p className="ob-hp-orbit-caption">Edge stack</p>
                        <div className="ob-hp-orbit">
                            <div className="ob-hp-orbit-ring" />
                            <div className="ob-hp-orbit-ring ob-hp-orbit-ring--2" />
                            <div className="ob-hp-orbit-ring ob-hp-orbit-ring--3" />
                            <div className="ob-hp-orbit-core" aria-label="One unified stack — Otta">
                                <span className="ob-hp-orbit-core-one" aria-hidden="true">
                                    1
                                </span>
                            </div>
                            <span className="ob-hp-dot" style={{ '--a': '0deg' } as CSSProperties} />
                            <span className="ob-hp-dot" style={{ '--a': '30deg' } as CSSProperties} />
                            <span className="ob-hp-dot" style={{ '--a': '60deg' } as CSSProperties} />
                            <span className="ob-hp-dot" style={{ '--a': '90deg' } as CSSProperties} />
                            <span className="ob-hp-dot" style={{ '--a': '120deg' } as CSSProperties} />
                            <span className="ob-hp-dot" style={{ '--a': '150deg' } as CSSProperties} />
                            <span className="ob-hp-dot" style={{ '--a': '180deg' } as CSSProperties} />
                            <span className="ob-hp-dot" style={{ '--a': '210deg' } as CSSProperties} />
                            <span className="ob-hp-dot" style={{ '--a': '240deg' } as CSSProperties} />
                            <span className="ob-hp-dot" style={{ '--a': '270deg' } as CSSProperties} />
                            <span className="ob-hp-dot" style={{ '--a': '300deg' } as CSSProperties} />
                            <span className="ob-hp-dot" style={{ '--a': '330deg' } as CSSProperties} />
                            <span className="ob-hp-orbit-sat" style={{ '--sat': '38deg' } as CSSProperties}>
                                Workers
                            </span>
                            <span className="ob-hp-orbit-sat" style={{ '--sat': '128deg' } as CSSProperties}>
                                D1 + Drizzle
                            </span>
                            <span className="ob-hp-orbit-sat" style={{ '--sat': '218deg' } as CSSProperties}>
                                Queues
                            </span>
                            <span className="ob-hp-orbit-sat" style={{ '--sat': '308deg' } as CSSProperties}>
                                Realtime
                            </span>
                        </div>
                        <p className="ob-hp-orbit-foot">
                            Monorepo modules around one runtime — same patterns you ship in production.
                        </p>
                    </div>
                </div>

                <div className="ob-hp-pain ob-hp-reveal">
                    <div className="ob-hp-pain-label">Truth</div>
                    <div className="ob-hp-pain-lines">
                        <strong>You&apos;ve shipped auth five times.</strong> The queue is three libraries taped
                        together. Tenancy showed up in month seven. Real-time ate a weekend.{' '}
                        <strong>Ottabase is the extraction layer</strong> — opinionated, edge-native, yours to fork.
                    </div>
                </div>
                <div className="ob-hp-receipt ob-hp-reveal" aria-label="By the numbers">
                    <div className="ob-hp-receipt-item">
                        <span className="ob-hp-receipt-val">47</span>
                        <span className="ob-hp-receipt-key">packages</span>
                    </div>
                    <div className="ob-hp-receipt-item">
                        <span className="ob-hp-receipt-val">100%</span>
                        <span className="ob-hp-receipt-key">TypeScript</span>
                    </div>
                    <div className="ob-hp-receipt-item">
                        <span className="ob-hp-receipt-val">~$5</span>
                        <span className="ob-hp-receipt-key">/ mo scale</span>
                    </div>
                    <div className="ob-hp-receipt-item">
                        <span className="ob-hp-receipt-val">300+</span>
                        <span className="ob-hp-receipt-key">edge pops</span>
                    </div>
                    <div className="ob-hp-receipt-item">
                        <span className="ob-hp-receipt-val">0</span>
                        <span className="ob-hp-receipt-key">servers</span>
                    </div>
                </div>
            </section>

            <section className="ob-hp-section" aria-labelledby="ob-hp-eco-title">
                <div className="ob-hp-container">
                    <header className="ob-hp-section-head ob-hp-reveal">
                        <h2 id="ob-hp-eco-title">Six clusters. One spine.</h2>
                        <p>
                            Not a starter kit — a full stack you can peel apart. Core, UI, content, business, brand,
                            utilities.
                        </p>
                    </header>
                    <div className="ob-hp-bento">
                        <article
                            className="ob-hp-bento-card ob-hp-bento--wide ob-hp-reveal"
                            style={{ '--ob-card-accent': '#2ee6d6' } as CSSProperties}
                        >
                            <div className="ob-hp-bento-top">
                                <h3>Core infrastructure</h3>
                                <span className="ob-hp-bento-count">11 pkgs</span>
                            </div>
                            <div className="ob-hp-bento-tags">
                                <span className="ob-hp-tag">@ottabase/ottaorm</span>
                                <span className="ob-hp-tag">@ottabase/auth</span>
                                <span className="ob-hp-tag">@ottabase/rbac</span>
                                <span className="ob-hp-tag">@ottabase/cf</span>
                                <span className="ob-hp-tag">@ottabase/queue</span>
                            </div>
                            <p className="ob-hp-bento-desc">
                                Fat models, Auth.js v5, KV-cached RBAC, queues, audit — the spine of your tenant graph.
                            </p>
                        </article>
                        <article
                            className="ob-hp-bento-card ob-hp-bento--tall ob-hp-reveal"
                            style={{ '--ob-card-accent': '#ffb547' } as CSSProperties}
                        >
                            <div className="ob-hp-bento-top">
                                <h3>UI layer</h3>
                                <span className="ob-hp-bento-count">12</span>
                            </div>
                            <div className="ob-hp-bento-tags">
                                <span className="ob-hp-tag">ui-shadcn</span>
                                <span className="ob-hp-tag">ui-datatable</span>
                                <span className="ob-hp-tag">spotlight</span>
                            </div>
                            <p className="ob-hp-bento-desc">
                                Tables, command palette, cropper, date — components that match your tokens, not fight
                                them.
                            </p>
                        </article>
                        <article
                            className="ob-hp-bento-card ob-hp-bento--half ob-hp-reveal"
                            style={{ '--ob-card-accent': '#7dd3fc' } as CSSProperties}
                        >
                            <div className="ob-hp-bento-top">
                                <h3>Content</h3>
                                <span className="ob-hp-bento-count">5</span>
                            </div>
                            <p className="ob-hp-bento-desc">
                                OttaBlog, EditorJS, renderer, uploads to R2 — ship a CMS beside your product.
                            </p>
                        </article>
                        <article
                            className="ob-hp-bento-card ob-hp-bento--half ob-hp-reveal"
                            style={{ '--ob-card-accent': '#fb7185' } as CSSProperties}
                        >
                            <div className="ob-hp-bento-top">
                                <h3>Business</h3>
                                <span className="ob-hp-bento-count">5</span>
                            </div>
                            <p className="ob-hp-bento-desc">
                                Shortlinks, referrals, notifications, comments, model-driven forms.
                            </p>
                        </article>
                        <article
                            className="ob-hp-bento-card ob-hp-bento--wide ob-hp-reveal"
                            style={{ '--ob-card-accent': '#a78bfa' } as CSSProperties}
                        >
                            <div className="ob-hp-bento-top">
                                <h3>Brand &amp; layout</h3>
                                <span className="ob-hp-bento-count">5</span>
                            </div>
                            <div className="ob-hp-bento-tags">
                                <span className="ob-hp-tag">brand-engine</span>
                                <span className="ob-hp-tag">ottalayout</span>
                                <span className="ob-hp-tag">homepage-contract</span>
                            </div>
                            <p className="ob-hp-bento-desc">
                                Tokens, presets, menus — white-label without a second codebase.
                            </p>
                        </article>
                        <article
                            className="ob-hp-bento-card ob-hp-bento--half ob-hp-reveal"
                            style={{ '--ob-card-accent': '#94a3b8' } as CSSProperties}
                        >
                            <div className="ob-hp-bento-top">
                                <h3>Utilities</h3>
                                <span className="ob-hp-bento-count">9</span>
                            </div>
                            <p className="ob-hp-bento-desc">
                                Email, i18n, scripts, AI gateway helpers — the glue stays boring on purpose.
                            </p>
                        </article>
                    </div>
                    <p style={{ textAlign: 'center', marginTop: '2.5rem' }} className="ob-hp-reveal">
                        <Link href="/packages" className="ob-hp-btn ob-hp-btn--ghost ob-hp-btn--lg">
                            Browse all 47 packages →
                        </Link>
                    </p>
                </div>
            </section>

            <SignalCodeShowcase />

            <section className="ob-hp-stack ob-hp-section" aria-labelledby="ob-hp-stack-title">
                <div className="ob-hp-container ob-hp-stack-inner">
                    <div className="ob-hp-reveal">
                        <h2 id="ob-hp-stack-title">First-class edge.</h2>
                        <p style={{ color: 'var(--ob-muted)', marginTop: '0.65rem', maxWidth: '48ch' }}>
                            D1, KV, R2, Durable Objects, Queues — not retrofitted. The ORM and worker routes were shaped
                            for this runtime.
                        </p>
                        <div className="ob-hp-timeline">
                            <div className="ob-hp-tl-row">
                                <div className="ob-hp-tl-glyph" aria-hidden="true" />
                                <div>
                                    <strong>Browser</strong>
                                    <span>TanStack Router · Vite · TanStack Query</span>
                                </div>
                            </div>
                            <div className="ob-hp-tl-row">
                                <div className="ob-hp-tl-glyph" aria-hidden="true" />
                                <div>
                                    <strong>Edge worker</strong>
                                    <span>300+ PoPs · OttaORM · RLS · RBAC</span>
                                </div>
                            </div>
                            <div className="ob-hp-tl-row">
                                <div className="ob-hp-tl-glyph" aria-hidden="true" />
                                <div>
                                    <strong>D1</strong>
                                    <span>SQLite · replicated · Drizzle driver</span>
                                </div>
                            </div>
                        </div>
                        <p style={{ marginTop: '1.5rem' }}>
                            <Link href="/philosophy" className="ob-hp-btn ob-hp-btn--ghost">
                                Why fat models →
                            </Link>
                        </p>
                    </div>
                    <div className="ob-hp-stack-visual ob-hp-reveal">
                        <div className="ob-hp-stack-card">
                            Client <span>hooks</span>
                        </div>
                        <div className="ob-hp-stack-card ob-hp-stack-card--hl">
                            Workers + OttaORM <span>RLS</span>
                        </div>
                        <div className="ob-hp-stack-card">
                            D1 <span>data</span>
                        </div>
                        <div className="ob-hp-mini-grid" aria-label="Side services">
                            <div className="ob-hp-mini">KV</div>
                            <div className="ob-hp-mini">R2</div>
                            <div className="ob-hp-mini">DO</div>
                            <div className="ob-hp-mini">Queues</div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="ob-hp-term-wrap" aria-labelledby="ob-hp-qs-title">
                <div className="ob-hp-container ob-hp-term-grid">
                    <div className="ob-hp-reveal">
                        <h2 id="ob-hp-qs-title">From empty folder to live.</h2>
                        <p style={{ color: 'var(--ob-muted)', marginTop: '0.65rem' }}>
                            Scaffold, install, dev servers, one init call — then deploy. No Docker sermon required.
                        </p>
                        <ol
                            style={{
                                marginTop: '1.5rem',
                                color: 'var(--ob-muted)',
                                fontSize: '0.95rem',
                                lineHeight: 1.8,
                                paddingLeft: '1.2rem',
                                listStyle: 'decimal',
                            }}
                        >
                            <li>
                                <strong style={{ color: 'var(--ob-text)' }}>Scaffold</strong> — monorepo with packages
                                wired.
                            </li>
                            <li>
                                <strong style={{ color: 'var(--ob-text)' }}>pnpm dev</strong> — Vite 3003, Wrangler
                                3004.
                            </li>
                            <li>
                                <strong style={{ color: 'var(--ob-text)' }}>POST /api/ottaorm/init</strong> — tables
                                appear.
                            </li>
                            <li>
                                <strong style={{ color: 'var(--ob-text)' }}>wrangler deploy</strong> — edge.
                            </li>
                        </ol>
                    </div>
                    <SignalTerminal />
                </div>
            </section>

            <section className="ob-hp-manifesto">
                <div className="ob-hp-container ob-hp-manifesto-inner">
                    <div className="ob-hp-reveal">
                        <p className="ob-hp-eyebrow" style={{ marginBottom: '0.5rem' }}>
                            Philosophy
                        </p>
                        <h2
                            style={{
                                fontFamily: 'var(--ob-font-display)',
                                fontSize: 'clamp(1.75rem, 3vw, 2.25rem)',
                                fontWeight: 800,
                                letterSpacing: '-0.03em',
                                lineHeight: 1.1,
                            }}
                        >
                            One file.
                            <br />
                            The whole behavior.
                        </h2>
                    </div>
                    <blockquote className="ob-hp-reveal">
                        <p>
                            <strong>
                                Six layers of ceremony to insert a row is not architecture — it&apos;s fatigue.
                            </strong>{' '}
                            OttaORM keeps validation, relationships, and mutations on the model so your routes stay thin
                            and your tests know where to look.
                        </p>
                        <p style={{ marginTop: '1rem' }}>
                            <Link
                                href="/philosophy"
                                className="ob-hp-btn ob-hp-btn--ghost"
                                style={{ marginTop: '0.5rem' }}
                            >
                                Read the manifesto →
                            </Link>
                        </p>
                    </blockquote>
                </div>
            </section>

            <section className="ob-hp-cta" aria-labelledby="ob-hp-cta-title">
                <div className="ob-hp-container">
                    <h2 id="ob-hp-cta-title" className="ob-hp-reveal">
                        Own the stack.
                        <br />
                        <em>Ship the product.</em>
                    </h2>
                    <p className="ob-hp-reveal">Open source under MIT. Discord for humans. GitHub for patches.</p>
                    <div className="ob-hp-cta-actions ob-hp-reveal">
                        <a
                            href="https://github.com/thinkdj/ottabase"
                            className="ob-hp-btn ob-hp-btn--primary ob-hp-btn--lg"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            Star on GitHub
                        </a>
                        <Link href="/docs" className="ob-hp-btn ob-hp-btn--ghost ob-hp-btn--lg">
                            Get started
                        </Link>
                        <a
                            href="https://discord.gg/ottabase"
                            className="ob-hp-btn ob-hp-btn--ghost ob-hp-btn--lg"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            Discord
                        </a>
                    </div>
                    <p className="ob-hp-cta-note ob-hp-reveal">
                        Aligned with the Ottabase open-source launch playbook · demo &amp; docs on the roadmap
                    </p>
                </div>
            </section>
        </>
    );
}
