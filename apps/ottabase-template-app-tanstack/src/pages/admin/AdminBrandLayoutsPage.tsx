// ---------------------------------------------------------------------------
// Layouts & Route Mappings – Layout templates + path → layout + Brand Kit
// ---------------------------------------------------------------------------

import { Link } from '@tanstack/react-router';
import { IconArrowLeft } from '@tabler/icons-react';
import { LayoutEditorTab } from './brand/LayoutEditorTab';

export function AdminBrandLayoutsPage() {
    return (
        <div className="space-y-6">
            <div>
                <Link
                    to="/admin/brand-engine"
                    className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
                >
                    <IconArrowLeft className="mr-2 h-4 w-4" />
                    Back to Brand Kits
                </Link>
                <h1 className="text-3xl font-bold tracking-tight">Layouts & Route Mappings</h1>
                <p className="text-muted-foreground mt-1">
                    Choose layout structures and map routes to Brand Kits. Start with visual presets, then fine-tune
                    priorities.
                </p>
            </div>
            <LayoutEditorTab />
        </div>
    );
}
