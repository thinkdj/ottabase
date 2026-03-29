import { Button } from '@ottabase/ui-shadcn';
import Link from 'next/link';
import type { HeroData } from './types';

/**
 * Minimal hero — compact, understated headline with a thin divider and
 * small action links. Ideal for documentation sites or text-heavy pages.
 */
export function HeroMinimal({ title, subtitle, actions }: HeroData) {
    return (
        <section className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-14">
            <h1 className="font-heading text-2xl font-semibold text-foreground sm:text-3xl">{title}</h1>

            {subtitle && <p className="text-base text-muted-foreground">{subtitle}</p>}

            <div className="h-px w-12 bg-border" />

            {actions && actions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {actions.map((action) =>
                        action.external ? (
                            <Button key={action.href} asChild variant={action.variant ?? 'ghost'} size="sm">
                                <a href={action.href} target="_blank" rel="noopener noreferrer">
                                    {action.label}
                                </a>
                            </Button>
                        ) : (
                            <Button key={action.href} asChild variant={action.variant ?? 'ghost'} size="sm">
                                <Link href={action.href}>{action.label}</Link>
                            </Button>
                        ),
                    )}
                </div>
            )}
        </section>
    );
}
