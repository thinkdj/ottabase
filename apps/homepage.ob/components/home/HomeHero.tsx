import Link from 'next/link';
import { AnimateOnView } from '@/components/core/AnimateOnView';

export function HomeHero() {
    return (
        <section className="hero" aria-labelledby="hero-heading">
            <div className="container hero-inner">
                <AnimateOnView className="hero-problem">
                    <p className="problem-line-primary">
                        You&apos;ve built auth.
                        <br />
                        Again.
                    </p>
                    <p className="problem-indent">The job queue — duct-taped together.</p>
                    <p className="problem-indent">Multi-tenancy — bolted on in month six.</p>
                    <p className="problem-indent">File uploads — a different library every project.</p>
                    <p className="problem-indent">Real-time — a weekend you&apos;ll never get back.</p>
                </AnimateOnView>

                <AnimateOnView delayClass="animate-delay-1">
                    <div className="hero-rule" />
                </AnimateOnView>

                <AnimateOnView delayClass="animate-delay-2">
                    <div className="hero-claim">
                        <h1 id="hero-heading">
                            We extracted
                            <br />
                            <span>all of it.</span>
                        </h1>
                        <p className="hero-sub">
                            47 TypeScript packages. One monorepo. Edge-native on Cloudflare Workers.
                            <br />
                            The SaaS foundation you keep rebuilding — done. Finally.
                        </p>

                        <div className="hero-actions">
                            <a
                                href="https://github.com/thinkdj/ottabase"
                                className="btn btn-primary btn-lg"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                ⭐ Star on GitHub
                            </a>
                            <Link href="/docs" className="btn btn-ghost btn-lg">
                                Get Started →
                            </Link>
                        </div>
                    </div>
                </AnimateOnView>

                <AnimateOnView delayClass="animate-delay-3">
                    <div className="hero-stack">
                        <span>Cloudflare Workers</span>
                        <span className="sep">·</span>
                        <span>TypeScript E2E</span>
                        <span className="sep">·</span>
                        <span>TanStack Router</span>
                        <span className="sep">·</span>
                        <span>OttaORM</span>
                        <span className="sep">·</span>
                        <span>Open Source</span>
                    </div>
                </AnimateOnView>
            </div>
        </section>
    );
}
