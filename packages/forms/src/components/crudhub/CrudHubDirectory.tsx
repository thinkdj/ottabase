// ============================================================
// @ottabase/forms - CrudHub directory
// ============================================================
// Search box, groups Core / Packages (one heading per package) / App,
// a card per model with a lazy row count and chips.
// ============================================================

import type { CrudHubModelDescriptor } from '@ottabase/ottaorm';
import { getStableQuerySignal } from '@ottabase/ottaorm/client';
import { useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { Database, Lock, Search } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useFormRequest } from '../../hooks/useFormRequest';
import { CRUDHUB_API, CRUDHUB_PATH, crudHubPaths, type CrudHubNavigate } from './useCrudHub';

export interface CrudHubDirectoryProps {
    models: CrudHubModelDescriptor[];
    onNavigate: CrudHubNavigate;
    basePath?: string;
    apiBasePath?: string;
    className?: string;
}

const CHIP =
    'inline-flex items-center rounded-full bg-background px-2 py-0.5 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground ring-1 ring-border';

function packageLabel(name: string): string {
    const bare = name.replace(/^@ottabase\//, '');
    return bare.charAt(0).toUpperCase() + bare.slice(1);
}

export function CrudHubDirectory({
    models,
    onNavigate,
    basePath = CRUDHUB_PATH,
    apiBasePath = CRUDHUB_API,
    className,
}: CrudHubDirectoryProps) {
    const [query, setQuery] = useState('');

    const groups = useMemo(() => {
        const q = query.trim().toLowerCase();
        const visible = q
            ? models.filter(
                  (m) =>
                      m.displayNamePlural.toLowerCase().includes(q) ||
                      m.entity.toLowerCase().includes(q) ||
                      m.packageName.toLowerCase().includes(q),
              )
            : models;
        const core = visible.filter((m) => m.packageType === 'core');
        const app = visible.filter((m) => m.packageType === 'app');
        const byPackage = new Map<string, CrudHubModelDescriptor[]>();
        for (const m of visible.filter((m) => m.packageType === 'package')) {
            const list = byPackage.get(m.packageName) ?? [];
            list.push(m);
            byPackage.set(m.packageName, list);
        }
        return { core, app, packages: [...byPackage.entries()].sort(([a], [b]) => a.localeCompare(b)) };
    }, [models, query]);

    const section = (title: string, items: CrudHubModelDescriptor[], sub = false) =>
        items.length === 0 ? null : (
            <section key={title} className="flex flex-col gap-3">
                <h2
                    className={clsx(
                        'text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground',
                        sub && 'pl-1',
                    )}
                >
                    {title}
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {items.map((model) => (
                        <ModelCard
                            key={model.entity}
                            model={model}
                            href={crudHubPaths(model.entity, basePath).list}
                            onNavigate={onNavigate}
                            apiBasePath={apiBasePath}
                        />
                    ))}
                </div>
            </section>
        );

    return (
        <div className={clsx('flex flex-col gap-8', className)}>
            <div className="relative max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search models…"
                    aria-label="Search models"
                    className="h-9 w-full rounded-md bg-background pl-10 pr-3 text-sm ring-1 ring-border placeholder:text-muted-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                />
            </div>

            {section('Core', groups.core)}
            {groups.packages.length > 0 && (
                <div className="flex flex-col gap-6">
                    {groups.packages.map(([pkg, items]) => section(packageLabel(pkg), items, true))}
                </div>
            )}
            {section('App', groups.app)}

            {models.length > 0 && groups.core.length + groups.app.length + groups.packages.length === 0 && (
                <p className="text-sm text-muted-foreground">No models match &ldquo;{query}&rdquo;.</p>
            )}
            {models.length === 0 && (
                <p className="text-sm text-muted-foreground">
                    No model has opted into CrudHub yet. Add <code>static admin = {'{ enabled: true }'}</code> to a
                    model.
                </p>
            )}
        </div>
    );
}

function ModelCard({
    model,
    href,
    onNavigate,
    apiBasePath,
}: {
    model: CrudHubModelDescriptor;
    href: string;
    onNavigate: CrudHubNavigate;
    apiBasePath: string;
}) {
    const request = useFormRequest();
    // Cheap count: one row, read the pagination total. Lazy so the directory paints first.
    const count = useQuery<number>({
        queryKey: ['crudhub', model.entity, 'count'],
        queryFn: async (context) => {
            const data = await request<{ pagination?: { total?: number } }>(
                `${apiBasePath}/${encodeURIComponent(model.entity)}?page=1&perPage=1`,
                { signal: await getStableQuerySignal(context) },
            );
            return data.pagination?.total ?? 0;
        },
        staleTime: 30_000,
        meta: { errorPresentation: 'silent' },
    });

    return (
        <a
            href={href}
            onClick={(e) => {
                e.preventDefault();
                onNavigate(href);
            }}
            aria-label={model.displayNamePlural}
            className="group rounded-xl border border-border/60 bg-card p-4 outline-hidden transition duration-fast ease-theme hover:border-input hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
            <div className="flex items-start justify-between gap-3">
                <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground transition group-hover:text-foreground">
                    <Database className="size-[18px]" />
                </span>
                <span className="text-right text-xs tabular-nums text-muted-foreground">
                    {count.isPending ? '…' : count.isError ? '' : `${count.data} rows`}
                </span>
            </div>
            <div className="mt-3 flex items-center gap-2">
                <span className="truncate font-medium text-foreground">{model.displayNamePlural}</span>
                {model.readOnly && (
                    <span className={CHIP} title="Read-only in CrudHub">
                        <Lock className="mr-1 h-3 w-3" /> read-only
                    </span>
                )}
            </div>
            <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                {model.description ?? model.tableName}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
                <span className={CHIP}>{packageLabel(model.packageName)}</span>
                <span className={CHIP}>{model.scope === 'org' ? 'org' : 'platform'}</span>
            </div>
        </a>
    );
}
