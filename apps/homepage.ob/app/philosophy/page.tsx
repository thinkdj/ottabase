import { LegacyAnimateScope } from '@/components/core/LegacyAnimateScope';
import { MarketingLayout } from '@/components/core/MarketingLayout';
import { PageHero } from '@/components/core/PageHero';
import { PhilosophyArticle } from '@/components/philosophy/PhilosophyArticle';
import { HpRevealScope } from '@/components/themes/signal-horizon/HpRevealScope';
import { SignalMarketingChrome } from '@/components/themes/signal-horizon/SignalMarketingChrome';
import { siteConfig } from '@/config';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Philosophy',
    description:
        'Why Ottabase chose fat models, Cloudflare Workers, and a monorepo architecture. The reasoning behind every major decision.',
};

export default function PhilosophyPage() {
    if (siteConfig.theme === 'signalHorizon') {
        return (
            <SignalMarketingChrome active="philosophy">
                <HpRevealScope>
                    <div className="ob-hp-page-hero">
                        <div className="ob-hp-container">
                            <p className="ob-hp-eyebrow" style={{ marginBottom: '1rem' }}>
                                Philosophy
                            </p>
                            <h1>
                                Strong opinions.
                                <br />
                                Weakly held where
                                <br />
                                it matters.
                            </h1>
                            <p style={{ color: 'var(--ob-muted)', maxWidth: '52ch' }}>
                                Every decision in Ottabase has a reason. Here&apos;s why we made the calls we made — and
                                what we&apos;d change if we were starting over.
                            </p>
                        </div>
                    </div>
                    <main id="main">
                        <PhilosophyArticle />
                    </main>
                </HpRevealScope>
            </SignalMarketingChrome>
        );
    }

    return (
        <MarketingLayout navActive="philosophy">
            <PageHero
                label="Philosophy"
                title={
                    <>
                        Strong opinions.
                        <br />
                        Weakly held where
                        <br />
                        it matters.
                    </>
                }
                description={
                    <>
                        Every decision in Ottabase has a reason. Here&apos;s why we made the calls we made — and what
                        we&apos;d change if we were starting over.
                    </>
                }
            />
            <LegacyAnimateScope>
                <PhilosophyArticle />
            </LegacyAnimateScope>
        </MarketingLayout>
    );
}
