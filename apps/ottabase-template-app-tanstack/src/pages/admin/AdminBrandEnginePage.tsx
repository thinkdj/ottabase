import { Tabs, TabsContent, TabsList, TabsTrigger } from '@ottabase/ui-shadcn';
import { IconBrush, IconLayout, IconBox, IconPalette } from '@tabler/icons-react';
import { BrandSettingsTab } from './brand/BrandSettingsTab';
import { BrandPresetManagerTab } from './brand/BrandBoxManagerTab';
import { LayoutEditorTab } from './brand/LayoutEditorTab';
import { ThemeVariantEditorTab } from './brand/ThemeVariantEditorTab';

// ---------------------------------------------------------------------------
// BrandEngine Admin – tabbed UI for brand settings, BrandBoxes, layouts, themes
// ---------------------------------------------------------------------------

export function AdminBrandEnginePage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">BrandEngine</h1>
                <p className="text-muted-foreground mt-1">
                    Manage brand settings, presets, layouts, and theme variants. Changes apply in real-time.
                </p>
            </div>

            <Tabs defaultValue="settings" className="w-full">
                <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
                    <TabsTrigger value="settings">
                        <IconBrush className="h-4 w-4 mr-2" />
                        Brand Settings
                    </TabsTrigger>
                    <TabsTrigger value="presets">
                        <IconBox className="h-4 w-4 mr-2" />
                        Presets
                    </TabsTrigger>
                    <TabsTrigger value="layouts">
                        <IconLayout className="h-4 w-4 mr-2" />
                        Layouts
                    </TabsTrigger>
                    <TabsTrigger value="themes">
                        <IconPalette className="h-4 w-4 mr-2" />
                        Theme Variants
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="settings">
                    <BrandSettingsTab />
                </TabsContent>
                <TabsContent value="presets">
                    <BrandPresetManagerTab />
                </TabsContent>
                <TabsContent value="layouts">
                    <LayoutEditorTab />
                </TabsContent>
                <TabsContent value="themes">
                    <ThemeVariantEditorTab />
                </TabsContent>
            </Tabs>
        </div>
    );
}
