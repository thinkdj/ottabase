import { Button } from '@ottabase/ui-shadcn';
import Link from 'next/link';
import type { CTAData } from './types';

/**
 * Banner CTA — full-width coloured strip with bold text and actions.
 */
export function CTABanner({ title, description, actions }: CTAData) {
    return (
        <section className="w-full bg-primary/5 px-4 py-14">
            <div className="mx-auto flex max-w-4xl flex-col items-center gap-4 text-center md:flex-row md:justify-between md:text-left">
                <div>
                    <h2 className="font-heading text-2xl font-bold text-foreground">{title}</h2>
                    {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
                </div>
                <div className="flex flex-shrink-0 flex-wrap gap-3">
                    {actions.map((action) =>
                        action.external ? (
                            <Button key={action.href} asChild variant={action.variant ?? 'default'} size="lg">
                                <a href={action.href} target="_blank" rel="noopener noreferrer">
                                    {action.label}
                                </a>
                            </Button>
                        ) : (
                            <Button key={action.href} asChild variant={action.variant ?? 'default'} size="lg">
                                <Link href={action.href}>{action.label}</Link>
                            </Button>
                        ),
                    )}
                </div>
            </div>
        </section>
    );
}
