import { useNavigate, useSearch } from '@tanstack/react-router';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@ottabase/ui-shadcn';
import { IconBadge, IconLayout, IconBox, IconPalette } from '@tabler/icons-react';
import { IdentityTab } from './brand/IdentityTab';
import { ThemeTab } from './brand/ThemeTab';
import { LayoutEditorTab } from './brand/LayoutEditorTab';
import { BrandPresetManagerTab } from './brand/BrandBoxManagerTab';

const VALID_TABS = ['identity', 'theme', 'layouts', 'presets'] as const;

// ---------------------------------------------------------------------------
// BrandEngine Admin – Identity (once) | Theme (base + variants) | Layouts | Presets
// ---------------------------------------------------------------------------

export function AdminBrandEnginePage() {
    const navigate = useNavigate();
    const search = useSearch({ strict: false }) as { tab?: string };
    const tab = VALID_TABS.includes(search?.tab as (typeof VALID_TABS)[number])
        ? (search.tab as (typeof VALID_TABS)[number])
        : 'identity';

    const onTabChange = (v: string) => {
        navigate({ to: '/admin/brand-engine', search: { tab: v } });
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">BrandEngine</h1>
                <p className="text-muted-foreground mt-1">
                    Identity and logos (once per app) · Theme and colors (base + switchable variants) · Layouts ·
                    Presets
                </p>
            </div>

            <Tabs value={tab} onValueChange={onTabChange} className="w-full">
                <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
                    <TabsTrigger value="identity">
                        <IconBadge className="h-4 w-4 mr-2" />
                        Identity
                    </TabsTrigger>
                    <TabsTrigger value="theme">
                        <IconPalette className="h-4 w-4 mr-2" />
                        Theme
                    </TabsTrigger>
                    <TabsTrigger value="layouts">
                        <IconLayout className="h-4 w-4 mr-2" />
                        Layouts
                    </TabsTrigger>
                    <TabsTrigger value="presets">
                        <IconBox className="h-4 w-4 mr-2" />
                        Presets
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="identity">
                    <IdentityTab />
                </TabsContent>
                <TabsContent value="theme">
                    <ThemeTab />
                </TabsContent>
                <TabsContent value="layouts">
                    <LayoutEditorTab />
                </TabsContent>
                <TabsContent value="presets">
                    <BrandPresetManagerTab />
                </TabsContent>
            </Tabs>
        </div>
    );
}
