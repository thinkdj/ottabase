import { LegacyAnimateScope } from '@/components/core/LegacyAnimateScope';
import { MarketingLayout } from '@/components/core/MarketingLayout';
import { PageHero } from '@/components/core/PageHero';
import { DocsMain } from '@/components/docs/DocsMain';
import { DocsSidebar } from '@/components/docs/DocsSidebar';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Get Started',
    description:
        'Get your Ottabase SaaS monorepo running in minutes. Step-by-step setup for Cloudflare Workers, D1, KV, R2, and deployment.',
};

export default function DocsPage() {
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
