import { Button } from '@ottabase/ui-shadcn';
import { Link } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';

export interface DemoPageHeaderProps {
    /** Page title (rendered as the H1) */
    title: ReactNode;
    /** Optional supporting description shown under the title */
    description?: ReactNode;
    /**
     * Optional right-aligned slot for controls, badges, or status shown beside the
     * title block on wider screens (stacks below on narrow viewports).
     */
    actions?: ReactNode;
    /** Back-link target (defaults to the demo gallery) */
    backTo?: string;
    /** Back-link label (defaults to "Back to Demos") */
    backLabel?: string;
}

/**
 * Shared header for every /demo/* page.
 *
 * Gives all demo pages ONE consistent header: a ghost "← Back to Demos" link, an
 * H1 at a single size, and a muted description — replacing the mix of back-link
 * styles, heading sizes, and spacing that had drifted across pages.
 *
 * Wrap page content in a `space-y-8` container and place this at the top:
 *
 * ```tsx
 * <div className="space-y-8">
 *     <DemoPageHeader title="Image Cropper" description="…" />
 *     … sections …
 * </div>
 * ```
 */
export function DemoPageHeader({
    title,
    description,
    actions,
    backTo = '/demo',
    backLabel = 'Back to Demos',
}: DemoPageHeaderProps) {
    return (
        <div className="space-y-4">
            <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit gap-1.5 text-muted-foreground">
                <Link to={backTo}>
                    <ArrowLeft className="h-4 w-4" />
                    {backLabel}
                </Link>
            </Button>

            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="space-y-1.5">
                    <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
                    {description ? <p className="max-w-3xl text-muted-foreground">{description}</p> : null}
                </div>
                {actions ? <div className="shrink-0">{actions}</div> : null}
            </div>
        </div>
    );
}
