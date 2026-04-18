import { Button } from '@ottabase/ui-shadcn';
import Link from 'next/link';
import type { HeroData } from './types';

/**
 * Centered hero — large heading, subtitle, and action buttons all center-aligned.
 * This is the original / default hero layout.
 */
export function HeroCentered({ title, subtitle, body, actions }: HeroData) {
    return (
        <section className="flex w-full flex-col items-center gap-6 px-4 py-20 text-center md:py-28">
            <h1 className="font-heading text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl">
                {title}
            </h1>

            {subtitle && <p className="max-w-2xl text-lg text-muted-foreground md:text-xl">{subtitle}</p>}

            {body && <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">{body}</p>}

            {actions && actions.length > 0 && (
                <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
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
