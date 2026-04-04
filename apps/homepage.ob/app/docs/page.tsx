import { LegacyAnimateScope } from '@/components/core/LegacyAnimateScope';
import { MarketingLayout } from '@/components/core/MarketingLayout';
import { PageHero } from '@/components/core/PageHero';
import { DocsMain } from '@/components/docs/DocsMain';
import { DocsSidebar } from '@/components/docs/DocsSidebar';
import { HpRevealScope } from '@/components/themes/signal-horizon/HpRevealScope';
import { SignalMarketingChrome } from '@/components/themes/signal-horizon/SignalMarketingChrome';
import { siteConfig } from '@/config';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Get Started',
    description:
        'Get your Ottabase SaaS monorepo running in minutes. Step-by-step setup for Cloudflare Workers, D1, KV, R2, and deployment.',
};

export default function DocsPage() {
    if (siteConfig.theme === 'signalHorizon') {
        return (
            <SignalMarketingChrome active="docs">
                <HpRevealScope>
                    <div className="ob-hp-page-hero">
                        <div className="ob-hp-container">
                            <p className="ob-hp-eyebrow" style={{ marginBottom: '1rem' }}>
                                Get started
                            </p>
                            <h1>
                                From{' '}
                                <code
                                    style={{
                                        fontSize: '0.7em',
                                        borderRadius: 6,
                                        padding: '0.1em 0.4em',
                                        background: 'var(--ob-bg-card)',
                                        color: 'var(--ob-accent)',
                                    }}
                                >
                                    git clone
                                </code>
                                <br />
                                to running SaaS.
                            </h1>
                            <p style={{ color: 'var(--ob-muted)', maxWidth: '52ch' }}>
                                Prerequisites: Node.js ≥ 24, pnpm ≥ 10, a Cloudflare account (free tier is fine).
                                That&apos;s genuinely all.
                            </p>
                        </div>
                    </div>
                    <div className="ob-hp-container">
                        <div className="ob-hp-docs">
                            <DocsSidebar />
                            <DocsMain />
                        </div>
                    </div>
                </HpRevealScope>
            </SignalMarketingChrome>
        );
    }

    return (
        <MarketingLayout navActive="docs">
            <PageHero
                label="Get Started"
                title={
                    <>
                        From{' '}
                        <code
                            style={{
                                fontSize: '0.7em',
                                borderRadius: 6,
                                padding: '0.1em 0.4em',
                                background: 'var(--bg-card)',
                                color: 'var(--violet-lt)',
                            }}
                        >
                            git clone
                        </code>
                        <br />
                        to running SaaS.
                    </>
                }
                description={
                    <>
                        Prerequisites: Node.js ≥ 24, pnpm ≥ 10, a Cloudflare account (free tier is fine). That&apos;s
                        genuinely all.
                    </>
                }
            />
            <LegacyAnimateScope>
                <div className="container">
                    <div className="docs-layout">
                        <DocsSidebar />
                        <DocsMain />
                    </div>
                </div>
            </LegacyAnimateScope>
        </MarketingLayout>
    );
}
