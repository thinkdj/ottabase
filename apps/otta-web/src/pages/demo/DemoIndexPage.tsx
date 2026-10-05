import { APP_META } from '@/ottabase/config';
import { Badge, Button, Card, CardDescription, CardHeader, CardTitle, Input } from '@ottabase/ui-shadcn';
import { Link } from '@tanstack/react-router';
import { ArrowLeft, ArrowRight, Search } from 'lucide-react';
import { useState } from 'react';
import { DEMO_ITEMS, groupDemos, searchDemos, type DemoItem } from './demoItems';

export function DemoIndexPage() {
    const [query, setQuery] = useState('');
    const sections = groupDemos(searchDemos(query));

    return (
        <div className="space-y-10">
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
                            {DEMO_ITEMS.length} hands-on pages, one per package or service, grouped by what you are
                            building.
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
                    This template uses <strong className="font-medium text-foreground">UI Base</strong> as the
                    foundation, with optional UI libraries layered on top. The main app providers only include UI Base,
                    fonts, state management, and shadcn/ui.
                </p>
            </div>
        </div>
    );
}

function DemoCard({ item }: { item: DemoItem }) {
    return (
        <Link
            to={item.to}
            className="group rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
            <Card className="h-full transition-colors duration-normal group-hover:bg-muted/70">
                <CardHeader className="gap-2">
                    <div className="flex items-center justify-between">
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-background text-muted-foreground ring-1 ring-border transition-colors group-hover:text-foreground">
                            <item.icon className="h-[1.125rem] w-[1.125rem]" />
                        </span>
                        {item.buttonVariant === 'default' && (
                            <Badge
                                variant="secondary"
                                className="bg-background/60 text-[0.625rem] font-medium uppercase tracking-wide text-muted-foreground"
                            >
                                Featured
                            </Badge>
                        )}
                    </div>
                    <CardTitle className="flex items-center gap-1.5 text-[0.9375rem] font-semibold">
                        {item.title}
                        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-normal group-hover:translate-x-0.5 group-hover:text-foreground" />
                    </CardTitle>
                    <CardDescription className="line-clamp-2 leading-relaxed">{item.description}</CardDescription>
                </CardHeader>
            </Card>
        </Link>
    );
}
