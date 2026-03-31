/**
 * Admin: Next.js marketing homepage content (D1 + OttaORM; consumed via GET /api/homepage/data).
 * Structured forms for theme/variants, navbar/footer links, hero/CTA/about copy, and feature/action rows.
 */
import { ADMIN_LIST_QUERY_CONFIG } from '@/config/queryConfig';
import { Button, Tabs, TabsContent, TabsList, TabsTrigger } from '@ottabase/ui-shadcn';
import { IconDatabaseImport } from '@tabler/icons-react';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { displayHooks, sectionHooks, type HomepageDisplayRow, type HomepageSectionRow } from './homepage-model-hooks';
import { normalizeList, sectionBySlot } from './utils';
import { AboutTab } from './tabs/AboutTab';
import { CtaTab } from './tabs/CtaTab';
import { DisplayTab } from './tabs/DisplayTab';
import { FeaturesTab } from './tabs/FeaturesTab';
import { FooterTab } from './tabs/FooterTab';
import { HeroTab } from './tabs/HeroTab';
import { NavbarTab } from './tabs/NavbarTab';

export function AdminHomepagePage() {
    const queryClient = useQueryClient();
    const { data: displayData, isLoading: displayLoading } = displayHooks.useDetail('default');
    const { data: sectionsData, isLoading: sectionsLoading } = sectionHooks.useList(
        { orderBy: 'sortOrder', orderDirection: 'asc' },
        ADMIN_LIST_QUERY_CONFIG,
    );

    const [seeding, setSeeding] = useState(false);

    const display = displayData as HomepageDisplayRow | undefined;
    const sections = useMemo(() => normalizeList<HomepageSectionRow>(sectionsData), [sectionsData]);

    const navbarSection = sectionBySlot(sections, 'navbar');
    const heroSection = sectionBySlot(sections, 'hero');
    const featuresSection = sectionBySlot(sections, 'features');
    const ctaSection = sectionBySlot(sections, 'cta');
    const footerSection = sectionBySlot(sections, 'footer');
    const aboutSection = sectionBySlot(sections, 'about');

    const runSeed = useCallback(async () => {
        setSeeding(true);
        try {
            const res = await fetch('/api/homepage/seed', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            });
            const json = (await res.json()) as { message?: string; seeded?: boolean };
            if (!res.ok) {
                toast.error(json.message ?? 'Seed failed');
                return;
            }
            toast.success(json.message ?? 'OK');
            await queryClient.invalidateQueries();
        } catch {
            toast.error('Seed request failed');
        } finally {
            setSeeding(false);
        }
    }, [queryClient]);

    return (
        <div className="mx-auto max-w-6xl px-4 py-8">
            <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-foreground dark:text-foreground">Marketing homepage</h1>
                    <p className="text-sm text-muted-foreground dark:text-muted-foreground">
                        Edit all public homepage content for the Next.js template (GET /api/homepage/data).
                    </p>
                </div>
                <Button type="button" variant="secondary" disabled={seeding} onClick={() => void runSeed()}>
                    <IconDatabaseImport className="mr-2 size-4" aria-hidden />
                    {seeding ? 'Seeding…' : 'Seed defaults'}
                </Button>
            </div>

            <Tabs defaultValue="display" className="w-full">
                <TabsList className="mb-6 flex h-auto flex-wrap gap-1 bg-muted/50 dark:bg-muted/30">
                    <TabsTrigger value="display" className="dark:data-[state=active]:bg-background">
                        Display
                    </TabsTrigger>
                    <TabsTrigger value="navbar" className="dark:data-[state=active]:bg-background">
                        Navbar
                    </TabsTrigger>
                    <TabsTrigger value="hero" className="dark:data-[state=active]:bg-background">
                        Hero
                    </TabsTrigger>
                    <TabsTrigger value="features" className="dark:data-[state=active]:bg-background">
                        Features
                    </TabsTrigger>
                    <TabsTrigger value="cta" className="dark:data-[state=active]:bg-background">
                        CTA
                    </TabsTrigger>
                    <TabsTrigger value="footer" className="dark:data-[state=active]:bg-background">
                        Footer
                    </TabsTrigger>
                    <TabsTrigger value="about" className="dark:data-[state=active]:bg-background">
                        About
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="display" className="mt-0">
                    <DisplayTab
                        display={display}
                        displayLoading={displayLoading}
                        sections={sections}
                        sectionsLoading={sectionsLoading}
                    />
                </TabsContent>
                <TabsContent value="navbar" className="mt-0">
                    <NavbarTab section={navbarSection} />
                </TabsContent>
                <TabsContent value="hero" className="mt-0">
                    <HeroTab section={heroSection} />
                </TabsContent>
                <TabsContent value="features" className="mt-0">
                    <FeaturesTab section={featuresSection} />
                </TabsContent>
                <TabsContent value="cta" className="mt-0">
                    <CtaTab section={ctaSection} />
                </TabsContent>
                <TabsContent value="footer" className="mt-0">
                    <FooterTab section={footerSection} />
                </TabsContent>
                <TabsContent value="about" className="mt-0">
                    <AboutTab section={aboutSection} />
                </TabsContent>
            </Tabs>

            <p className="mt-8 text-xs text-muted-foreground dark:text-muted-foreground">
                Raw CRUD remains available at{' '}
                <code className="rounded bg-muted px-1 py-0.5 font-mono">/api/ottaorm/homepage_sections</code> and
                related entities (admin session).
            </p>
        </div>
    );
}
