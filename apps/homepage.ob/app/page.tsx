import { MarketingLayout } from '@/components/core/MarketingLayout';
import { ArchitectureSection } from '@/components/home/ArchitectureSection';
import { CodeShowcase } from '@/components/home/CodeShowcase';
import { CtaBanner } from '@/components/home/CtaBanner';
import { EcosystemSection } from '@/components/home/EcosystemSection';
import { HomeHero } from '@/components/home/HomeHero';
import { ManifestoTeaser } from '@/components/home/ManifestoTeaser';
import { MetricsStrip } from '@/components/home/MetricsStrip';
import { QuickStartSection } from '@/components/home/QuickStartSection';
import { HpRevealScope } from '@/components/themes/signal-horizon/HpRevealScope';
import { SignalHomePage } from '@/components/themes/signal-horizon/SignalHomePage';
import { SignalMarketingChrome } from '@/components/themes/signal-horizon/SignalMarketingChrome';
import { siteConfig } from '@/config';

export default function HomePage() {
    if (siteConfig.theme === 'signalHorizon') {
        return (
            <SignalMarketingChrome active={null}>
                <HpRevealScope>
                    <main id="main">
                        <SignalHomePage />
                    </main>
                </HpRevealScope>
            </SignalMarketingChrome>
        );
    }

    return (
        <MarketingLayout>
            <HomeHero />
            <MetricsStrip />
            <EcosystemSection />
            <CodeShowcase />
            <ArchitectureSection />
            <QuickStartSection />
            <ManifestoTeaser />
            <CtaBanner />
        </MarketingLayout>
    );
}
