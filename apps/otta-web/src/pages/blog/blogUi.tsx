/**
 * Shared public-blog UI primitives for the linen personal-blog surface.
 */
import { formatDate, type ContentType } from '@ottabase/ottablog';
import { Button } from '@ottabase/ui-shadcn';
import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';

export function publicKindLabel(type: ContentType | string | undefined): string {
    if (type === 'blurb') return 'Note';
    if (type === 'photo') return 'Journal';
    if (type === 'blog') return 'Essay';
    if (!type) return 'Essay';
    return type;
}

export function BlogMeasure({ children, className = '' }: { children: ReactNode; className?: string }) {
    return <div className={`mx-auto w-full max-w-[40rem] ${className}`}>{children}</div>;
}

export function BlogBackLink({ label = 'Writing' }: { label?: string }) {
    return (
        <Link
            to="/blog"
            className="inline-flex items-center text-[0.8125rem] text-muted-foreground transition-colors hover:text-foreground"
        >
            ← {label}
        </Link>
    );
}

export function ArchiveMasthead({
    kicker,
    title,
    description,
    countLabel,
}: {
    kicker: string;
    title: string;
    description?: string | null;
    countLabel?: string;
}) {
    return (
        <header className="space-y-3">
            <p className="text-[0.75rem] tracking-[0.16em] text-muted-foreground uppercase">{kicker}</p>
            <h1 className="font-serif text-3xl font-medium tracking-[-0.03em] text-foreground sm:text-4xl">{title}</h1>
            {description ? (
                <p className="max-w-xl font-serif text-lg leading-relaxed text-muted-foreground">{description}</p>
            ) : null}
            {countLabel ? <p className="text-[0.8125rem] text-muted-foreground">{countLabel}</p> : null}
        </header>
    );
}

export function BlogEmpty({ children }: { children: ReactNode }) {
    return <p className="py-12 text-center font-serif text-muted-foreground">{children}</p>;
}

export function BlogNotFound({ title, body }: { title: string; body: string }) {
    return (
        <BlogMeasure className="py-20 text-center">
            <h1 className="font-serif text-2xl tracking-tight">{title}</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{body}</p>
            <div className="mt-8">
                <BlogBackLink />
            </div>
        </BlogMeasure>
    );
}

export function BlogListSkeleton({ rows = 6 }: { rows?: number }) {
    return (
        <div className="space-y-6" aria-busy="true">
            <span className="sr-only">Loading…</span>
            {Array.from({ length: rows }, (_, index) => (
                <div key={index} className="flex gap-6">
                    <div className="h-4 w-14 animate-pulse rounded-sm bg-muted/60" />
                    <div className="flex-1 space-y-2">
                        <div className="h-5 w-3/4 animate-pulse rounded-sm bg-muted/60" />
                        <div className="h-4 w-full animate-pulse rounded-sm bg-muted/40" />
                    </div>
                </div>
            ))}
        </div>
    );
}

export function YearHeading({ year }: { year: string }) {
    return (
        <h2 className="font-serif text-sm tracking-[0.18em] text-muted-foreground uppercase tabular-nums">{year}</h2>
    );
}

export function TextPager({
    page,
    totalPages,
    onPrev,
    onNext,
}: {
    page: number;
    totalPages: number;
    onPrev: () => void;
    onNext: () => void;
}) {
    if (totalPages <= 1) return null;
    return (
        <nav
            className="flex items-center justify-between pt-4 text-[0.8125rem] text-muted-foreground"
            aria-label="Pagination"
        >
            <Button
                variant="ghost"
                size="sm"
                className="-ml-3 text-muted-foreground"
                onClick={onPrev}
                disabled={page === 1}
            >
                ← Newer
            </Button>
            <span className="tabular-nums">
                {page} / {totalPages}
            </span>
            <Button
                variant="ghost"
                size="sm"
                className="-mr-3 text-muted-foreground"
                onClick={onNext}
                disabled={page >= totalPages}
            >
                Older →
            </Button>
        </nav>
    );
}

export function PublishedDateLink({ publishedAt }: { publishedAt: string }) {
    const date = new Date(publishedAt);
    if (Number.isNaN(date.getTime())) return <span>{formatDate(publishedAt)}</span>;

    return (
        <Link
            to="/blog/archive/$year/$month"
            params={{ year: String(date.getUTCFullYear()), month: String(date.getUTCMonth() + 1) }}
            className="hover:text-foreground"
            aria-label={`View posts from ${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`}
        >
            {formatDate(publishedAt, { timeZone: 'UTC' })}
        </Link>
    );
}

export function FilterLink({
    active,
    onClick,
    children,
}: {
    active: boolean;
    onClick: () => void;
    children: ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={
                active
                    ? 'text-foreground underline decoration-foreground/30 underline-offset-[5px]'
                    : 'text-muted-foreground hover:text-foreground'
            }
        >
            {children}
        </button>
    );
}
