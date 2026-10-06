import { SEOHead } from '@/components/SEOHead';
import { APP_META } from '@/ottabase/config';
import { Button, Input } from '@ottabase/ui-shadcn';
import { Link } from '@tanstack/react-router';
import { ArrowLeft, Search } from 'lucide-react';
import { useState } from 'react';
import { DemoCard } from './DemoCard';
import { DEMO_ITEMS, groupDemos, searchDemos } from './demoItems';

export function DemoIndexPage() {
    const [query, setQuery] = useState('');
    const sections = groupDemos(searchDemos(query));

    return (
        <div className="space-y-10">
            <SEOHead title={`Demos · ${APP_META.appName}`} />
            <div className="space-y-4">
                <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit gap-1.5 text-muted-foreground">
                    <Link to="/">
                        <ArrowLeft className="h-4 w-4" />
                        Back to Home
                    </Link>
                </Button>

                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div className="space-y-1.5">
                        <h1 className="text-3xl font-bold tracking-tight">{APP_META.appName} demos</h1>
                        <p className="max-w-3xl text-muted-foreground">
                            {DEMO_ITEMS.length} hands-on pages across the packages and Cloudflare services, grouped by
                            what you are building.
                        </p>
                    </div>
                    <div className="relative md:w-72">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Find a demo"
                            aria-label="Find a demo"
                            className="pl-9"
                        />
                    </div>
                </div>

                {!query && (
                    <nav aria-label="Sections" className="flex flex-wrap gap-2">
                        {sections.map(({ group, items }) => (
                            <a
                                key={group.id}
                                href={`#${group.id}`}
                                className="rounded-full bg-muted/40 px-3 py-1 text-sm text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
                            >
                                {group.label} <span className="text-xs">{items.length}</span>
                            </a>
                        ))}
                    </nav>
                )}
            </div>

            {sections.length === 0 ? (
                <p className="rounded-xl bg-muted/40 p-6 text-center text-sm text-muted-foreground">
                    Nothing matches. Try a package name, like forms or KV.
                </p>
            ) : (
                sections.map(({ group, items }) => (
                    <section key={group.id} id={group.id} className="scroll-mt-24 space-y-4">
                        <div className="flex flex-wrap items-end justify-between gap-2">
                            <div className="space-y-1">
                                <h2 className="text-lg font-semibold tracking-tight">{group.label}</h2>
                                <p className="text-sm text-muted-foreground">{group.description}</p>
                            </div>
                            {group.overview && (
                                <Link
                                    to={group.overview}
                                    className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                                >
                                    Overview
                                </Link>
                            )}
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                            {items.map((item) => (
                                <DemoCard key={item.to} item={item} />
                            ))}
                        </div>
                    </section>
                ))
            )}

            <div className="rounded-xl bg-muted/40 p-6">
                <h2 className="mb-1.5 text-sm font-semibold">About this template</h2>
                <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
                    Every demo runs inside the real app shell: the same providers, brand kit, layout engine and data
                    layer that serve the rest of the site. What you see here is what a page in your app gets.
                </p>
            </div>
        </div>
    );
}
