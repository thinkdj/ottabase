import { Button } from '@ottabase/ui-shadcn';
import Link from 'next/link';
import type { CTAData } from './types';

/**
 * Minimal CTA — compact inline text and small action buttons.
 */
export function CTAMinimal({ title, description, actions }: CTAData) {
    return (
        <section className="mx-auto flex w-full max-w-3xl flex-col items-start gap-3 px-4 py-10 sm:flex-row sm:items-center sm:justify-between">
            <div>
                <h2 className="font-heading text-lg font-semibold text-foreground">{title}</h2>
                {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
            </div>
            <div className="flex flex-shrink-0 flex-wrap gap-2">
                {actions.map((action) =>
                    action.external ? (
                        <Button key={action.href} asChild variant={action.variant ?? 'outline'} size="sm">
                            <a href={action.href} target="_blank" rel="noopener noreferrer">
                                {action.label}
                            </a>
                        </Button>
                    ) : (
                        <Button key={action.href} asChild variant={action.variant ?? 'outline'} size="sm">
                            <Link href={action.href}>{action.label}</Link>
                        </Button>
                    ),
                )}
            </div>
        </section>
    );
}
