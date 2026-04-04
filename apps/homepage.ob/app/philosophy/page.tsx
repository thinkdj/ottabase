import { LegacyAnimateScope } from '@/components/core/LegacyAnimateScope';
import { MarketingLayout } from '@/components/core/MarketingLayout';
import { PageHero } from '@/components/core/PageHero';
import { PhilosophyArticle } from '@/components/philosophy/PhilosophyArticle';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Philosophy',
    description:
        'Why Ottabase chose fat models, Cloudflare Workers, and a monorepo architecture. The reasoning behind every major decision.',
};

export default function PhilosophyPage() {
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
