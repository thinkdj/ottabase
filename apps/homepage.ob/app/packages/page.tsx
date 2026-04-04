import { MarketingLayout } from '@/components/core/MarketingLayout';
import { PageHero } from '@/components/core/PageHero';
import { PackagesView } from '@/components/packages/PackagesView';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Packages',
    description:
        'All 47 Ottabase packages across core infrastructure, UI, content, business features, brand, and utilities. Browse and filter by category.',
};

export default function PackagesPage() {
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
