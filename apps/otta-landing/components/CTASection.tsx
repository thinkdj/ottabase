import { Button } from '@ottabase/ui-shadcn';
import Link from 'next/link';
import type { ReactNode } from 'react';

type CTAAction = {
    href: string;
    label: ReactNode;
    variant?: 'default' | 'secondary' | 'outline' | 'ghost';
    external?: boolean;
};

type CTASectionProps = {
    /** CTA heading */
    title: string;
    /** CTA description */
    description?: ReactNode;
    /** CTA buttons */
    actions: CTAAction[];
};

export function CTASection({ title, description, actions }: CTASectionProps) {
    return (
        <section className="mx-auto w-full max-w-3xl px-4 py-16 text-center">
            <h2 className="font-heading text-3xl font-bold text-foreground">{title}</h2>
            {description && <p className="mt-3 text-base text-muted-foreground">{description}</p>}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
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
        </section>
    );
}
