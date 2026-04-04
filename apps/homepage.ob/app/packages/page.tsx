import { MarketingLayout } from '@/components/core/MarketingLayout';
import { PageHero } from '@/components/core/PageHero';
import { PackagesView } from '@/components/packages/PackagesView';
import { HpRevealScope } from '@/components/themes/signal-horizon/HpRevealScope';
import { SignalMarketingChrome } from '@/components/themes/signal-horizon/SignalMarketingChrome';
import { SignalPackagesView } from '@/components/themes/signal-horizon/SignalPackagesView';
import { siteConfig } from '@/config';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Packages',
    description:
        'All 47 Ottabase packages across core infrastructure, UI, content, business features, brand, and utilities. Browse and filter by category.',
};

export default function PackagesPage() {
    if (siteConfig.theme === 'signalHorizon') {
        return (
            <SignalMarketingChrome active="packages">
                <HpRevealScope>
                    <div className="ob-hp-page-hero">
                        <div className="ob-hp-container">
                            <p className="ob-hp-eyebrow" style={{ marginBottom: '1rem' }}>
                                Package ecosystem
                            </p>
                            <h1>
                                47 packages.
                                <br />
                                Nothing missing.
                            </h1>
                            <p style={{ color: 'var(--ob-muted)', maxWidth: '52ch', marginTop: '0.75rem' }}>
                                Every package is independently versioned, documented, and tested. Use the whole stack or
                                cherry-pick what you need.
                            </p>
                        </div>
                    </div>
                    <main id="main">
                        <SignalPackagesView />
                    </main>
                </HpRevealScope>
            </SignalMarketingChrome>
        );
    }

    return (
        <MarketingLayout navActive="packages">
            <PageHero
                label="Package Ecosystem"
                title={
                    <>
                        47 packages.
                        <br />
                        Nothing missing.
                    </>
                }
                description={
                    <>
                        Every package is independently versioned, documented, and tested. Use the whole stack or
                        cherry-pick what you need.
                    </>
                }
            />
            <PackagesView />
        </MarketingLayout>
    );
}
