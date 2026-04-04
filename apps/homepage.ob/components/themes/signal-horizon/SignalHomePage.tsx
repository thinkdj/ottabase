import { SignalCodeShowcase } from '@/components/themes/signal-horizon/SignalCodeShowcase';
import { SignalTerminal } from '@/components/themes/signal-horizon/SignalTerminal';
import Link from 'next/link';
import type { CSSProperties } from 'react';

export function SignalHomePage() {
    return (
        <>
            <section className="hp-hero hp-container" aria-labelledby="hp-hero-title">
                <div className="hp-hero-grid">
                    <div>
                        <p className="hp-eyebrow">TypeScript · monorepo · Edge-native</p>
                        <h1 id="hp-hero-title">
                            Opinionated code,
                            <span className="hp-line2 block">for solo SaaS builders.</span>
                        </h1>
                        <p className="hp-lede">
                            Forty-seven packages wired together for multi-tenant SaaS: OttaORM, Auth.js, RBAC, realtime,
                            queues, blog, UI components... Scale from 1 to 1 M customers on the same codebase and
                            infrastructure.
                        </p>
                        <div className="hp-hero-cta">
                            <a
                                href="https://github.com/thinkdj/ottabase"
                                className="hp-btn hp-btn--primary hp-btn--lg"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                Star on GitHub
                            </a>
                            <Link href="/docs" className="hp-btn hp-btn--ghost hp-btn--lg">
                                Read the quickstart
                            </Link>
                        </div>
                        <p className="hp-micro">
                            <span>TanStack Router</span>
                            <span>·</span>
                            <span>D1 + Drizzle</span>
                            <span>·</span>
                            <span>Durable Objects</span>
                            <span>·</span>
                            <span>MIT</span>
                        </p>
                    </div>
                    <div className="hp-orbit-wrap hp-reveal" aria-hidden="true">
                        <p className="hp-orbit-caption">Edge stack</p>
                        <div className="hp-orbit">
                            <div className="hp-orbit-ring" />
                            <div className="hp-orbit-ring hp-orbit-ring--2" />
                            <div className="hp-orbit-ring hp-orbit-ring--3" />
                            <div className="hp-orbit-core" aria-label="One unified stack — Otta">
                                <span className="hp-orbit-core-one" aria-hidden="true">
                                    1
                                </span>
                            </div>
                            <span className="hp-dot" style={{ '--a': '0deg' } as CSSProperties} />
                            <span className="hp-dot" style={{ '--a': '30deg' } as CSSProperties} />
                            <span className="hp-dot" style={{ '--a': '60deg' } as CSSProperties} />
                            <span className="hp-dot" style={{ '--a': '90deg' } as CSSProperties} />
                            <span className="hp-dot" style={{ '--a': '120deg' } as CSSProperties} />
                            <span className="hp-dot" style={{ '--a': '150deg' } as CSSProperties} />
                            <span className="hp-dot" style={{ '--a': '180deg' } as CSSProperties} />
                            <span className="hp-dot" style={{ '--a': '210deg' } as CSSProperties} />
                            <span className="hp-dot" style={{ '--a': '240deg' } as CSSProperties} />
                            <span className="hp-dot" style={{ '--a': '270deg' } as CSSProperties} />
                            <span className="hp-dot" style={{ '--a': '300deg' } as CSSProperties} />
                            <span className="hp-dot" style={{ '--a': '330deg' } as CSSProperties} />
                            <span className="hp-orbit-sat" style={{ '--sat': '38deg' } as CSSProperties}>
                                Workers
                            </span>
                            <span className="hp-orbit-sat" style={{ '--sat': '128deg' } as CSSProperties}>
                                D1 + Drizzle
                            </span>
                            <span className="hp-orbit-sat" style={{ '--sat': '218deg' } as CSSProperties}>
                                Queues
                            </span>
                            <span className="hp-orbit-sat" style={{ '--sat': '308deg' } as CSSProperties}>
                                Realtime
                            </span>
                        </div>
                        <p className="hp-orbit-foot">
                            Monorepo modules around one runtime — same patterns you ship in production.
                        </p>
                    </div>
                </div>

                <div className="hp-pain hp-reveal">
                    <div className="hp-pain-label">Truth</div>
                    <div className="hp-pain-lines">
                        <strong>You&apos;ve shipped auth five times.</strong> The queue is three libraries taped
                        together. Tenancy showed up in month seven. Real-time ate a weekend.{' '}
                        <strong>Ottabase is the extraction layer</strong> — opinionated, edge-native, yours to fork.
                    </div>
                </div>
                <div className="hp-receipt hp-reveal" aria-label="By the numbers">
                    <div className="hp-receipt-item">
                        <span className="hp-receipt-val">47</span>
                        <span className="hp-receipt-key">packages</span>
                    </div>
                    <div className="hp-receipt-item">
                        <span className="hp-receipt-val">100%</span>
                        <span className="hp-receipt-key">TypeScript</span>
                    </div>
                    <div className="hp-receipt-item">
                        <span className="hp-receipt-val">~$5</span>
                        <span className="hp-receipt-key">/ mo scale</span>
                    </div>
                    <div className="hp-receipt-item">
                        <span className="hp-receipt-val">300+</span>
                        <span className="hp-receipt-key">edge pops</span>
                    </div>
                    <div className="hp-receipt-item">
                        <span className="hp-receipt-val">0</span>
                        <span className="hp-receipt-key">servers</span>
                    </div>
                </div>
            </section>

            <section className="hp-section" aria-labelledby="hp-eco-title">
                <div className="hp-container">
                    <header className="hp-section-head hp-reveal">
                        <h2 id="hp-eco-title">Six clusters. One spine.</h2>
                        <p>
                            Not a starter kit — a full stack you can peel apart. Core, UI, content, business, brand,
                            utilities.
                        </p>
                    </header>
                    <div className="hp-bento">
                        <article
                            className="hp-bento-card hp-bento--wide hp-reveal"
                            style={{ '--hp-card-accent': '#2ee6d6' } as CSSProperties}
                        >
                            <div className="hp-bento-top">
                                <h3>Core infrastructure</h3>
                                <span className="hp-bento-count">11 pkgs</span>
                            </div>
                            <div className="hp-bento-tags">
                                <span className="hp-tag">@ottabase/ottaorm</span>
                                <span className="hp-tag">@ottabase/auth</span>
                                <span className="hp-tag">@ottabase/rbac</span>
                                <span className="hp-tag">@ottabase/cf</span>
                                <span className="hp-tag">@ottabase/queue</span>
                            </div>
                            <p className="hp-bento-desc">
                                Fat models, Auth.js v5, KV-cached RBAC, queues, audit — the spine of your tenant graph.
                            </p>
                        </article>
                        <article
                            className="hp-bento-card hp-bento--tall hp-reveal"
                            style={{ '--hp-card-accent': '#ffb547' } as CSSProperties}
                        >
                            <div className="hp-bento-top">
                                <h3>UI layer</h3>
                                <span className="hp-bento-count">12</span>
                            </div>
                            <div className="hp-bento-tags">
                                <span className="hp-tag">ui-shadcn</span>
                                <span className="hp-tag">ui-datatable</span>
                                <span className="hp-tag">spotlight</span>
                            </div>
                            <p className="hp-bento-desc">
                                Tables, command palette, cropper, date — components that match your tokens, not fight
                                them.
                            </p>
                        </article>
                        <article
                            className="hp-bento-card hp-bento--half hp-reveal"
                            style={{ '--hp-card-accent': '#7dd3fc' } as CSSProperties}
                        >
                            <div className="hp-bento-top">
                                <h3>Content</h3>
                                <span className="hp-bento-count">5</span>
                            </div>
                            <p className="hp-bento-desc">
                                OttaBlog, EditorJS, renderer, uploads to R2 — ship a CMS beside your product.
                            </p>
                        </article>
                        <article
                            className="hp-bento-card hp-bento--half hp-reveal"
                            style={{ '--hp-card-accent': '#fb7185' } as CSSProperties}
                        >
                            <div className="hp-bento-top">
                                <h3>Business</h3>
                                <span className="hp-bento-count">5</span>
                            </div>
                            <p className="hp-bento-desc">
                                Shortlinks, referrals, notifications, comments, model-driven forms.
                            </p>
                        </article>
                        <article
                            className="hp-bento-card hp-bento--wide hp-reveal"
                            style={{ '--hp-card-accent': '#a78bfa' } as CSSProperties}
                        >
                            <div className="hp-bento-top">
                                <h3>Brand &amp; layout</h3>
                                <span className="hp-bento-count">5</span>
                            </div>
                            <div className="hp-bento-tags">
                                <span className="hp-tag">brand-engine</span>
                                <span className="hp-tag">ottalayout</span>
                                <span className="hp-tag">homepage-contract</span>
                            </div>
                            <p className="hp-bento-desc">
                                Tokens, presets, menus — white-label without a second codebase.
                            </p>
                        </article>
                        <article
                            className="hp-bento-card hp-bento--half hp-reveal"
                            style={{ '--hp-card-accent': '#94a3b8' } as CSSProperties}
                        >
                            <div className="hp-bento-top">
                                <h3>Utilities</h3>
                                <span className="hp-bento-count">9</span>
                            </div>
                            <p className="hp-bento-desc">
                                Email, i18n, scripts, AI gateway helpers — the glue stays boring on purpose.
                            </p>
                        </article>
                    </div>
                    <p style={{ textAlign: 'center', marginTop: '2.5rem' }} className="hp-reveal">
                        <Link href="/packages" className="hp-btn hp-btn--ghost hp-btn--lg">
                            Browse all 47 packages →
                        </Link>
                    </p>
                </div>
            </section>

            <SignalCodeShowcase />

            <section className="hp-stack hp-section" aria-labelledby="hp-stack-title">
                <div className="hp-container hp-stack-inner">
                    <div className="hp-reveal">
                        <h2 id="hp-stack-title">First-class edge.</h2>
                        <p style={{ color: 'var(--hp-muted)', marginTop: '0.65rem', maxWidth: '48ch' }}>
                            D1, KV, R2, Durable Objects, Queues — not retrofitted. The ORM and worker routes were shaped
                            for this runtime.
                        </p>
                        <div className="hp-timeline">
                            <div className="hp-tl-row">
                                <div className="hp-tl-glyph" aria-hidden="true" />
                                <div>
                                    <strong>Browser</strong>
                                    <span>TanStack Router · Vite · TanStack Query</span>
                                </div>
                            </div>
                            <div className="hp-tl-row">
                                <div className="hp-tl-glyph" aria-hidden="true" />
                                <div>
                                    <strong>Edge worker</strong>
                                    <span>300+ PoPs · OttaORM · RLS · RBAC</span>
                                </div>
                            </div>
                            <div className="hp-tl-row">
                                <div className="hp-tl-glyph" aria-hidden="true" />
                                <div>
                                    <strong>D1</strong>
                                    <span>SQLite · replicated · Drizzle driver</span>
                                </div>
                            </div>
                        </div>
                        <p style={{ marginTop: '1.5rem' }}>
                            <Link href="/philosophy" className="hp-btn hp-btn--ghost">
                                Why fat models →
                            </Link>
                        </p>
                    </div>
                    <div className="hp-stack-visual hp-reveal">
                        <div className="hp-stack-card">
                            Client <span>hooks</span>
                        </div>
                        <div className="hp-stack-card hp-stack-card--hl">
                            Workers + OttaORM <span>RLS</span>
                        </div>
                        <div className="hp-stack-card">
                            D1 <span>data</span>
                        </div>
                        <div className="hp-mini-grid" aria-label="Side services">
                            <div className="hp-mini">KV</div>
                            <div className="hp-mini">R2</div>
                            <div className="hp-mini">DO</div>
                            <div className="hp-mini">Queues</div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="hp-term-wrap" aria-labelledby="hp-qs-title">
                <div className="hp-container hp-term-grid">
                    <div className="hp-reveal">
                        <h2 id="hp-qs-title">From empty folder to live.</h2>
                        <p style={{ color: 'var(--hp-muted)', marginTop: '0.65rem' }}>
                            Scaffold, install, dev servers, one init call — then deploy. No Docker sermon required.
                        </p>
                        <ol
                            style={{
                                marginTop: '1.5rem',
                                color: 'var(--hp-muted)',
                                fontSize: '0.95rem',
                                lineHeight: 1.8,
                                paddingLeft: '1.2rem',
                                listStyle: 'decimal',
                            }}
                        >
                            <li>
                                <strong style={{ color: 'var(--hp-text)' }}>Scaffold</strong> — monorepo with packages
                                wired.
                            </li>
                            <li>
                                <strong style={{ color: 'var(--hp-text)' }}>pnpm dev</strong> — Vite 3003, Wrangler
                                3004.
                            </li>
                            <li>
                                <strong style={{ color: 'var(--hp-text)' }}>POST /api/ottaorm/init</strong> — tables
                                appear.
                            </li>
                            <li>
                                <strong style={{ color: 'var(--hp-text)' }}>wrangler deploy</strong> — edge.
                            </li>
                        </ol>
                    </div>
                    <SignalTerminal />
                </div>
            </section>

            <section className="hp-manifesto">
                <div className="hp-container hp-manifesto-inner">
                    <div className="hp-reveal">
                        <p className="hp-eyebrow" style={{ marginBottom: '0.5rem' }}>
                            Philosophy
                        </p>
                        <h2
                            style={{
                                fontFamily: 'var(--hp-font-display)',
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
                    <blockquote className="hp-reveal">
                        <p>
                            <strong>
                                Six layers of ceremony to insert a row is not architecture — it&apos;s fatigue.
                            </strong>{' '}
                            OttaORM keeps validation, relationships, and mutations on the model so your routes stay thin
                            and your tests know where to look.
                        </p>
                        <p style={{ marginTop: '1rem' }}>
                            <Link href="/philosophy" className="hp-btn hp-btn--ghost" style={{ marginTop: '0.5rem' }}>
                                Read the manifesto →
                            </Link>
                        </p>
                    </blockquote>
                </div>
            </section>

            <section className="hp-cta" aria-labelledby="hp-cta-title">
                <div className="hp-container">
                    <h2 id="hp-cta-title" className="hp-reveal">
                        Own the stack.
                        <br />
                        <em>Ship the product.</em>
                    </h2>
                    <p className="hp-reveal">Open source under MIT. Discord for humans. GitHub for patches.</p>
                    <div className="hp-cta-actions hp-reveal">
                        <a
                            href="https://github.com/thinkdj/ottabase"
                            className="hp-btn hp-btn--primary hp-btn--lg"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            Star on GitHub
                        </a>
                        <Link href="/docs" className="hp-btn hp-btn--ghost hp-btn--lg">
                            Get started
                        </Link>
                        <a
                            href="https://discord.gg/ottabase"
                            className="hp-btn hp-btn--ghost hp-btn--lg"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            Discord
                        </a>
                    </div>
                    <p className="hp-cta-note hp-reveal">
                        Aligned with the Ottabase open-source launch playbook · demo &amp; docs on the roadmap
                    </p>
                </div>
            </section>
        </>
    );
}
