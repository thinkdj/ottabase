import { MarketingLayout } from '@/components/core/MarketingLayout';
import { ArchitectureSection } from '@/components/home/ArchitectureSection';
import { CodeShowcase } from '@/components/home/CodeShowcase';
import { CtaBanner } from '@/components/home/CtaBanner';
import { EcosystemSection } from '@/components/home/EcosystemSection';
import { HomeHero } from '@/components/home/HomeHero';
import { ManifestoTeaser } from '@/components/home/ManifestoTeaser';
import { MetricsStrip } from '@/components/home/MetricsStrip';
import { QuickStartSection } from '@/components/home/QuickStartSection';

export default function HomePage() {
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
