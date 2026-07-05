import { useApiQuery } from '@ottabase/ottaorm/client';
import { Button, Card, CardContent, CardHeader, CardTitle, Checkbox, Input, Label } from '@ottabase/ui-shadcn';
import { Link } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

interface InitResult {
    success: boolean;
    message: string;
    details: {
        tablesCreated: string[];
        columnsAdded: string[];
        customMigrationsRun: string[];
        customMigrationsSkipped: string[];
        tablesDetected: string[];
        tablesSkipped: string[];
        errors: string[];
    };
    timestamp: string;
}

interface ModelsMetadataResponse {
    models: Array<{
        entityName: string;
        modelName: string;
        packageName: string;
        packageType: 'core' | 'app' | 'package';
        tableName: string;
        displayName?: string;
        displayNamePlural?: string;
    }>;
    total: number;
}

const MICRO_LABEL = 'text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground';
const CATEGORY_CHIP =
    'inline-flex items-center rounded-full bg-background px-2 py-0.5 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground ring-1 ring-border';

export function MigrationStatusPage() {
    const [initResult, setInitResult] = useState<InitResult | null>(null);
    const [initError, setInitError] = useState<Error | null>(null);
    const [initLoading, setInitLoading] = useState(true);
    const [categoryFilters, setCategoryFilters] = useState({
        App: true,
        Package: true,
        Core: true,
        Unknown: true,
    });
    const [secretInput, setSecretInput] = useState('');
    const [allowDestructive, setAllowDestructive] = useState(false);

    // Call /api/ottaorm/init via fetch so we can handle 401 (MIGRATION_SECRET) locally
    // without triggering the global API client's "session expired" redirect.
    const runInit = useCallback(async (secret?: string, destructive?: boolean) => {
        setInitLoading(true);
        setInitError(null);
        try {
            const res = await fetch('/api/ottaorm/init', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...(secret ? { secret } : {}),
                    ...(destructive ? { allowDestructive: true } : {}),
                }),
                credentials: 'include',
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                const msg =
                    (data as { error?: string; message?: string }).error ||
                    (data as { error?: string; message?: string }).message ||
                    res.statusText ||
                    'Request failed';
                const err = new Error(msg);
                setInitError(err);
                toast.error(msg, {
                    description:
                        (data as { messages?: string[] }).messages?.join(' • ') || (data as { hint?: string }).hint,
                });
                return;
            }
            setInitResult(data as InitResult);
        } catch (e) {
            const err = e instanceof Error ? e : new Error('Request failed');
            setInitError(err);
            toast.error(err.message);
        } finally {
            setInitLoading(false);
        }
    }, []);

    const { data: modelsMetadata } = useApiQuery<ModelsMetadataResponse>({
        entity: 'models',
        queryKey: ['metadata'],
        endpoint: '/api/ottaorm/models-metadata',
    });

    // Auto-run on mount
    useEffect(() => {
        const searchParams = new URLSearchParams(window.location.search);
        const secret = searchParams.get('secret');
        if (secret) {
            setSecretInput(secret);
        }
        runInit(secret ?? undefined);
    }, [runInit]);

    // Map table variable names to actual table names and categories using metadata from API
    const getTableInfo = (tableVarName: string) => {
        if (!modelsMetadata?.models) {
            return {
                actualName: tableVarName,
                category: 'Unknown' as const,
                packageName: 'unknown',
            };
        }

        // Convert camelCase table variable name to snake_case entity name
        // e.g., "verificationTokensTable" -> "verification_tokens"
        const convertToSnakeCase = (str: string): string => {
            // Remove "Table" suffix if present
            let withoutSuffix = str.replace(/Table$/, '');
            // Convert camelCase to snake_case
            return withoutSuffix.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
        };

        // Try direct table name match first
        let model = modelsMetadata.models.find((m) => m.tableName === tableVarName);

        // Try with "Table" suffix removed (e.g., "usersTable" -> "users")
        if (!model && tableVarName.endsWith('Table')) {
            const withoutSuffix = tableVarName.slice(0, -5);
            model = modelsMetadata.models.find((m) => m.tableName === withoutSuffix);
        }

        // Try converting camelCase to snake_case (e.g., "verificationTokensTable" -> "verification_tokens")
        if (!model) {
            const snakeCaseName = convertToSnakeCase(tableVarName);
            model = modelsMetadata.models.find((m) => m.tableName === snakeCaseName);
        }

        if (!model) {
            // Fallback - derive from variable name
            const actualName = convertToSnakeCase(tableVarName);
            return { actualName, category: 'Unknown' as const, packageName: 'unknown' };
        }

        const category = model.packageType === 'core' ? 'Core' : model.packageType === 'app' ? 'App' : 'Package';

        return {
            actualName: model.tableName,
            category,
            packageName: model.packageName,
        };
    };

    // Build table status map
    const getTableStatus = (tableVarName: string) => {
        if (!initResult) return { status: 'Unknown', chip: 'bg-muted text-muted-foreground' };

        const { actualName } = getTableInfo(tableVarName);

        // Check if created
        if (initResult.details.tablesCreated.includes(actualName)) {
            return { status: 'Created', chip: 'bg-success/10 text-success' };
        }

        // Check if existing/skipped
        if (initResult.details.tablesSkipped.includes(actualName)) {
            return { status: 'Existing', chip: 'bg-muted text-muted-foreground' };
        }

        return { status: 'Unknown', chip: 'bg-muted text-muted-foreground' };
    };

    return (
        <div className="space-y-8">
            <div className="space-y-4">
                <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit gap-1.5 text-muted-foreground">
                    <Link to="/">
                        <ArrowLeft className="h-4 w-4" />
                        Back to Home
                    </Link>
                </Button>

                <div className="space-y-1.5">
                    <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Database Migration Status</h1>
                    <p className="max-w-3xl text-muted-foreground">
                        Running database initialization and migration checks...
                    </p>
                    <p className="text-sm text-muted-foreground">
                        This ensures all schemas (core, app, and packages) are migrated properly.
                    </p>
                </div>

                <div className="max-w-xl space-y-3">
                    <div className="flex items-center gap-2">
                        <Input
                            type="password"
                            placeholder="Migration Secret (required for production)"
                            value={secretInput}
                            onChange={(e) => setSecretInput(e.target.value)}
                            spellCheck={false}
                            autoComplete="off"
                            className="h-9"
                        />
                        <Button size="sm" onClick={() => runInit(secretInput || undefined, allowDestructive)}>
                            Run Migration
                        </Button>
                    </div>
                    <div className="flex items-center gap-2">
                        <Checkbox
                            id="allow-destructive"
                            checked={allowDestructive}
                            onCheckedChange={(checked) => setAllowDestructive(checked === true)}
                        />
                        <Label htmlFor="allow-destructive" className="flex cursor-pointer items-center gap-2 text-sm">
                            <span>Allow destructive actions</span>
                            <span className="text-xs text-muted-foreground">
                                (drops orphan columns, recreates tables if needed)
                            </span>
                        </Label>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Note: If <code>MIGRATION_ALLOW_DESTRUCTIVE=true</code> in the environment, destructive mode is
                        always enabled on the server, even when this checkbox is unchecked.
                    </p>
                    {allowDestructive && (
                        <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
                            <strong className="font-semibold">Warning:</strong> Destructive mode will remove columns
                            that exist in the database but not in the schema. Make sure you have a backup before
                            proceeding.
                        </div>
                    )}
                </div>
            </div>

            {initError ? (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                    <h3 className="font-semibold">Error</h3>
                    <p>{initError.message}</p>
                </div>
            ) : null}

            {initLoading && (
                <div className="animate-pulse rounded-xl bg-muted/40 p-8 text-center" aria-busy="true">
                    <p className="text-sm">Initializing database...</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                        Checking core tables, app tables, and enabled package tables...
                    </p>
                </div>
            )}

            {initResult && (
                <div className="grid gap-6">
                    <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-[0.9375rem] font-semibold">
                                Status:{' '}
                                {initResult.success ? (
                                    <span className="text-success">Success</span>
                                ) : (
                                    <span className="text-destructive">Failed</span>
                                )}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="whitespace-pre-wrap rounded-lg bg-background p-4 font-mono text-xs ring-1 ring-border">
                                {initResult.message}
                            </div>

                            {/* Success summary */}
                            {initResult.success && (
                                <div className="rounded-lg bg-background p-4 ring-1 ring-border">
                                    <h3 className="mb-2 text-sm font-semibold text-success">Migration Summary</h3>
                                    <div className="space-y-1 text-sm text-muted-foreground">
                                        <p>• {initResult.details.tablesDetected.length} table(s) detected in schema</p>
                                        <p>• {initResult.details.tablesCreated.length} new table(s) created</p>
                                        <p>• {initResult.details.tablesSkipped.length} table(s) already exist</p>
                                        <p>• {initResult.details.columnsAdded.length} column(s) added</p>
                                        <p>
                                            • {initResult.details.customMigrationsRun.length} custom migration(s)
                                            executed
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Single Table View */}
                            <div className="overflow-hidden rounded-lg bg-background ring-1 ring-border">
                                <div className="flex items-center justify-between border-b border-border/60 bg-muted/40 px-4 py-2.5">
                                    <h3 className={MICRO_LABEL}>
                                        All Tables (
                                        {(() => {
                                            const filteredCount = initResult.details.tablesDetected.filter(
                                                (tableVarName) => {
                                                    const category = getTableInfo(tableVarName).category;
                                                    return categoryFilters[category as keyof typeof categoryFilters];
                                                },
                                            ).length;
                                            return filteredCount === initResult.details.tablesDetected.length
                                                ? initResult.details.tablesDetected.length
                                                : `${filteredCount} / ${initResult.details.tablesDetected.length}`;
                                        })()}
                                        )
                                    </h3>
                                    <div className="flex items-center gap-4">
                                        <Label className={MICRO_LABEL}>Filter:</Label>
                                        <div className="flex items-center gap-3">
                                            {(['App', 'Package', 'Core'] as const).map((category) => (
                                                <div key={category} className="flex items-center gap-2">
                                                    <Checkbox
                                                        id={`filter-${category.toLowerCase()}`}
                                                        checked={categoryFilters[category]}
                                                        onCheckedChange={(checked) =>
                                                            setCategoryFilters((prev) => ({
                                                                ...prev,
                                                                [category]: checked === true,
                                                            }))
                                                        }
                                                    />
                                                    <Label
                                                        htmlFor={`filter-${category.toLowerCase()}`}
                                                        className="cursor-pointer text-xs"
                                                    >
                                                        {category}
                                                    </Label>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-border/60 text-sm">
                                        <thead className="bg-muted/40">
                                            <tr>
                                                <th className={`px-4 py-2.5 text-left ${MICRO_LABEL}`}>Table Name</th>
                                                <th className={`px-4 py-2.5 text-left ${MICRO_LABEL}`}>Type</th>
                                                <th className={`px-4 py-2.5 text-left ${MICRO_LABEL}`}>Package</th>
                                                <th className={`px-4 py-2.5 text-left ${MICRO_LABEL}`}>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border/60">
                                            {(() => {
                                                // Sort tables: App first, then Package, then Core, then Unknown
                                                const categoryOrder: Record<string, number> = {
                                                    App: 0,
                                                    Package: 1,
                                                    Core: 2,
                                                    Unknown: 3,
                                                };

                                                const sortedTables = [...initResult.details.tablesDetected]
                                                    .filter((tableVarName) => {
                                                        const category = getTableInfo(tableVarName).category;
                                                        return categoryFilters[
                                                            category as keyof typeof categoryFilters
                                                        ];
                                                    })
                                                    .sort((a, b) => {
                                                        const categoryA = getTableInfo(a).category;
                                                        const categoryB = getTableInfo(b).category;
                                                        const orderA = categoryOrder[categoryA] ?? 999;
                                                        const orderB = categoryOrder[categoryB] ?? 999;

                                                        // If same category, sort alphabetically by table name
                                                        if (orderA === orderB) {
                                                            const nameA = getTableInfo(a).actualName;
                                                            const nameB = getTableInfo(b).actualName;
                                                            return nameA.localeCompare(nameB);
                                                        }

                                                        return orderA - orderB;
                                                    });

                                                return sortedTables.map((tableVarName, i) => {
                                                    const { actualName, category, packageName } =
                                                        getTableInfo(tableVarName);
                                                    const statusInfo = getTableStatus(tableVarName);

                                                    return (
                                                        <tr
                                                            key={tableVarName}
                                                            className="transition-colors duration-normal hover:bg-muted/40"
                                                        >
                                                            <td className="px-4 py-2 font-mono text-xs">
                                                                {actualName}
                                                            </td>
                                                            <td className="px-4 py-2">
                                                                <span className={CATEGORY_CHIP}>{category}</span>
                                                            </td>
                                                            <td className="px-4 py-2">
                                                                <code className="text-xs text-muted-foreground">
                                                                    {packageName}
                                                                </code>
                                                            </td>
                                                            <td className="px-4 py-2">
                                                                <span
                                                                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusInfo.chip}`}
                                                                >
                                                                    {statusInfo.status}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                });
                                            })()}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Columns Added Section - only show if there are columns */}
                            {initResult.details.columnsAdded.length > 0 && (
                                <div className="overflow-hidden rounded-lg bg-background ring-1 ring-border">
                                    <div className="border-b border-border/60 bg-muted/40 px-4 py-2.5">
                                        <h3 className={MICRO_LABEL}>
                                            Columns Added ({initResult.details.columnsAdded.length})
                                        </h3>
                                    </div>
                                    <div className="p-4">
                                        <ul className="list-inside list-disc space-y-1 text-xs">
                                            {initResult.details.columnsAdded.map((col, i) => (
                                                <li key={col} className="font-mono text-muted-foreground">
                                                    {col}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            )}

                            {/* Migrations Section - only show if there are migrations */}
                            {(initResult.details.customMigrationsRun.length > 0 ||
                                initResult.details.customMigrationsSkipped.length > 0) && (
                                <div className="overflow-hidden rounded-lg bg-background ring-1 ring-border">
                                    <div className="border-b border-border/60 bg-muted/40 px-4 py-2.5">
                                        <h3 className={MICRO_LABEL}>Custom Migrations</h3>
                                    </div>
                                    <div className="space-y-3 p-4">
                                        {initResult.details.customMigrationsRun.length > 0 && (
                                            <div>
                                                <p className="mb-1 text-[0.6875rem] font-medium uppercase tracking-wide text-success">
                                                    Executed ({initResult.details.customMigrationsRun.length})
                                                </p>
                                                <ul className="ml-2 list-inside list-disc space-y-1 text-xs">
                                                    {initResult.details.customMigrationsRun.map((mig, i) => (
                                                        <li key={mig} className="font-mono text-muted-foreground">
                                                            {mig}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                        {initResult.details.customMigrationsSkipped.length > 0 && (
                                            <div>
                                                <p className={`mb-1 ${MICRO_LABEL}`}>
                                                    Skipped (Already Run) (
                                                    {initResult.details.customMigrationsSkipped.length})
                                                </p>
                                                <ul className="ml-2 list-inside list-disc space-y-1 text-xs">
                                                    {initResult.details.customMigrationsSkipped.map((mig, i) => (
                                                        <li key={mig} className="font-mono text-muted-foreground">
                                                            {mig}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {initResult.details.errors.length > 0 && (
                                <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                                    <h3 className="mb-2 font-semibold">Detailed Errors</h3>
                                    <ul className="list-inside list-disc space-y-1">
                                        {initResult.details.errors.map((err, i) => (
                                            <li key={err}>{err}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Timestamp */}
                            <div className={`text-right ${MICRO_LABEL}`}>
                                Last run: {new Date(initResult.timestamp).toLocaleString()}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
