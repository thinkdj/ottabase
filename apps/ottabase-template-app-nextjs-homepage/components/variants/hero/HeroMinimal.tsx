import { Button } from '@ottabase/ui-shadcn';
import Link from 'next/link';
import type { HeroData } from './types';

/**
 * Minimal hero — compact, understated headline with a thin divider and
 * small action links. Ideal for documentation sites or text-heavy pages.
 */
export function HeroMinimal({ title, subtitle, actions }: HeroData) {
    return (
        <section className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-20 md:py-24">
            <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
                {title}
            </h1>

            {subtitle && <p className="text-lg text-muted-foreground md:text-xl">{subtitle}</p>}

            <div className="h-px w-16 bg-border" />

            {actions && actions.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-3">
                    {actions.map((action) =>
                        action.external ? (
                            <Button key={action.href} asChild variant={action.variant ?? 'outline'} size="lg">
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
            )}
        </section>
    );
}
