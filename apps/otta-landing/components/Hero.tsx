import { Button } from '@ottabase/ui-shadcn';
import Link from 'next/link';
import type { ReactNode } from 'react';

type HeroAction = {
    href: string;
    label: ReactNode;
    variant?: 'default' | 'secondary' | 'outline' | 'ghost';
    external?: boolean;
};

type HeroProps = {
    /** Main heading (supports ReactNode for gradient text etc.) */
    title: ReactNode;
    /** Subtitle / description */
    subtitle?: string;
    /** Additional body text */
    body?: string;
    /** CTA buttons */
    actions?: HeroAction[];
};

export function Hero({ title, subtitle, body, actions }: HeroProps) {
    return (
        <section className="flex flex-col items-center gap-6 px-4 py-20 text-center md:py-28">
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
