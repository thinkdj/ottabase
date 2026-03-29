import { Button } from '@ottabase/ui-shadcn';
import Link from 'next/link';
import type { HeroData } from './types';

/**
 * Split hero — text content on the left, a decorative colour panel on the right.
 * Great for product / SaaS landing pages.
 */
export function HeroSplit({ title, subtitle, body, actions }: HeroData) {
    return (
        <section className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-10 px-4 py-16 md:grid-cols-2 md:py-24">
            {/* Text side */}
            <div className="flex flex-col gap-5">
                <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
                    {title}
                </h1>

                {subtitle && <p className="text-lg text-muted-foreground">{subtitle}</p>}

                {body && <p className="text-base leading-relaxed text-muted-foreground">{body}</p>}

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
            </div>

            {/* Visual side — decorative gradient panel */}
            <div className="hidden aspect-[4/3] items-center justify-center rounded-xl bg-gradient-to-br from-primary/10 via-primary/5 to-secondary/10 md:flex">
                <div className="flex flex-col items-center gap-3">
                    <div className="h-16 w-16 rounded-xl bg-primary/20" />
                    <div className="h-3 w-24 rounded bg-muted" />
                    <div className="h-3 w-16 rounded bg-muted/60" />
                </div>
            </div>
        </section>
    );
}
