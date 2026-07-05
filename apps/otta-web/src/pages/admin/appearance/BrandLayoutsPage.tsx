// ---------------------------------------------------------------------------
// Layouts & Route Mappings – Layout templates + path → layout + Brand Kit
// ---------------------------------------------------------------------------

import { Button } from '@ottabase/ui-shadcn';
import { Link } from '@tanstack/react-router';
import { IconArrowLeft } from '@tabler/icons-react';
import { LayoutEditorTab } from './brand/LayoutEditorTab';

export function AdminBrandLayoutsPage() {
    return (
        <div className="space-y-8">
            <div className="space-y-4">
                <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit gap-1.5 text-muted-foreground">
                    <Link to="/admin/appearance/brand-kits">
                        <IconArrowLeft className="h-4 w-4" />
                        Back to Brand Kits
                    </Link>
                </Button>
                <div className="space-y-1.5">
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Layouts &amp; Route Mappings</h1>
                    <p className="max-w-3xl text-muted-foreground">
                        Choose layout structures and map routes to Brand Kits. Start with visual presets, then fine-tune
                        priorities.
                    </p>
                </div>
            </div>
            <LayoutEditorTab />
        </div>
    );
}
