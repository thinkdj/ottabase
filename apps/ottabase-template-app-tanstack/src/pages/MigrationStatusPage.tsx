import { useApiMutation, useApiQuery } from '@ottabase/ottaorm/client';
import { Button, Card, CardContent, CardHeader, CardTitle, Checkbox, Label } from '@ottabase/ui-shadcn';
import { Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

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

export function MigrationStatusPage() {
    const [initResult, setInitResult] = useState<InitResult | null>(null);
    const [categoryFilters, setCategoryFilters] = useState({
        App: true,
        Package: true,
        Core: true,
        Unknown: true,
    });

    const initDb = useApiMutation<InitResult>({
        endpoint: '/api/ottaorm/init',
        method: 'POST',
    });

    const { data: modelsMetadata } = useApiQuery<ModelsMetadataResponse>({
        entity: 'models',
        queryKey: ['metadata'],
        endpoint: '/api/ottaorm/models-metadata',
    });

    // Auto-run on mount
    useEffect(() => {
        // Get secret from URL query params
        const searchParams = new URLSearchParams(window.location.search);
        const secret = searchParams.get('secret');

        // Pass secret in the body (supported by checkMigrationAuth)
        initDb.mutate(secret ? { secret } : {});
    }, []);

    useEffect(() => {
        if (initDb.data) {
            setInitResult(initDb.data);
        }
    }, [initDb.data]);

    const isLoading = initDb.isPending;
    const error = initDb.error;

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
        if (!initResult) return { status: 'Unknown', icon: '❓', color: 'text-gray-500' };

        const { actualName } = getTableInfo(tableVarName);

        // Check if created
        if (initResult.details.tablesCreated.includes(actualName)) {
            return { status: 'Created', icon: '🆕', color: 'text-green-600' };
        }

        // Check if existing/skipped
        if (initResult.details.tablesSkipped.includes(actualName)) {
            return { status: 'Existing', icon: '✓', color: 'text-blue-600' };
        }

        return { status: 'Unknown', icon: '❓', color: 'text-gray-500' };
    };

    return (
        <div className="mx-auto max-w-5xl space-y-6 px-4 py-12">
            <Button asChild variant="ghost" className="w-fit">
                <Link to="/">← Back to Home</Link>
            </Button>

            <div>
                <h1 className="mb-2 text-3xl font-semibold">Database Migration Status</h1>
                <p className="text-muted-foreground">Running database initialization and migration checks...</p>
                <p className="text-sm text-muted-foreground mt-1">
                    This ensures all schemas (core, app, and packages) are migrated properly.
                </p>
            </div>

            {error ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
                    <h3 className="font-semibold text-destructive">Error</h3>
                    <p className="text-sm text-destructive">{error.message}</p>
                </div>
            ) : null}

            {isLoading && (
                <div className="rounded-lg border bg-muted/50 p-8 text-center animate-pulse">
                    <p>Initializing database...</p>
                    <p className="text-sm text-muted-foreground mt-2">
                        Checking core tables, app tables, and enabled package tables...
                    </p>
                </div>
            )}

            {initResult && (
                <div className="grid gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                Status:{' '}
                                {initResult.success ? (
                                    <span className="text-green-500">Success</span>
                                ) : (
                                    <span className="text-red-500">Failed</span>
                                )}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="text-sm border rounded-md p-4 bg-muted/30 font-mono whitespace-pre-wrap">
                                {initResult.message}
                            </div>

                            {/* Success summary */}
                            {initResult.success && (
                                <div className="border rounded-md p-4 bg-green-50 dark:bg-green-950/20">
                                    <h3 className="font-medium text-green-700 dark:text-green-400 mb-2">
                                        ✅ Migration Summary
                                    </h3>
                                    <div className="text-sm space-y-1">
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
                            <div className="border rounded-lg overflow-hidden">
                                <div className="bg-muted/50 px-4 py-2 border-b flex items-center justify-between">
                                    <h3 className="font-medium text-sm">
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
                                        <Label className="text-xs text-muted-foreground">Filter:</Label>
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
                                                        className="text-xs cursor-pointer"
                                                    >
                                                        {category}
                                                    </Label>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-muted/30 border-b">
                                            <tr>
                                                <th className="text-left px-4 py-2 font-medium">Table Name</th>
                                                <th className="text-left px-4 py-2 font-medium">Type</th>
                                                <th className="text-left px-4 py-2 font-medium">Package</th>
                                                <th className="text-left px-4 py-2 font-medium">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
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

                                                    const categoryColors: Record<string, string> = {
                                                        Core: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
                                                        App: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
                                                        Package:
                                                            'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
                                                        Unknown:
                                                            'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
                                                    };

                                                    return (
                                                        <tr key={i} className="hover:bg-muted/20">
                                                            <td className="px-4 py-2 font-mono text-xs">
                                                                {actualName}
                                                            </td>
                                                            <td className="px-4 py-2">
                                                                <span
                                                                    className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${categoryColors[category]}`}
                                                                >
                                                                    {category}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-2">
                                                                <code className="text-xs text-muted-foreground">
                                                                    {packageName}
                                                                </code>
                                                            </td>
                                                            <td className="px-4 py-2">
                                                                <span
                                                                    className={`flex items-center gap-1 ${statusInfo.color}`}
                                                                >
                                                                    <span>{statusInfo.icon}</span>
                                                                    <span className="text-xs">{statusInfo.status}</span>
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
                                <div className="border rounded-lg overflow-hidden">
                                    <div className="bg-muted/50 px-4 py-2 border-b">
                                        <h3 className="font-medium text-sm">
                                            ➕ Columns Added ({initResult.details.columnsAdded.length})
                                        </h3>
                                    </div>
                                    <div className="p-4">
                                        <ul className="list-disc list-inside text-xs space-y-1">
                                            {initResult.details.columnsAdded.map((col, i) => (
                                                <li key={i} className="font-mono text-muted-foreground">
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
                                <div className="border rounded-lg overflow-hidden">
                                    <div className="bg-muted/50 px-4 py-2 border-b">
                                        <h3 className="font-medium text-sm">⚡ Custom Migrations</h3>
                                    </div>
                                    <div className="p-4 space-y-3">
                                        {initResult.details.customMigrationsRun.length > 0 && (
                                            <div>
                                                <p className="text-xs font-medium text-green-600 mb-1">
                                                    ✓ Executed ({initResult.details.customMigrationsRun.length})
                                                </p>
                                                <ul className="list-disc list-inside text-xs space-y-1 ml-2">
                                                    {initResult.details.customMigrationsRun.map((mig, i) => (
                                                        <li key={i} className="font-mono text-muted-foreground">
                                                            {mig}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                        {initResult.details.customMigrationsSkipped.length > 0 && (
                                            <div>
                                                <p className="text-xs font-medium text-blue-600 mb-1">
                                                    ⏭️ Skipped (Already Run) (
                                                    {initResult.details.customMigrationsSkipped.length})
                                                </p>
                                                <ul className="list-disc list-inside text-xs space-y-1 ml-2">
                                                    {initResult.details.customMigrationsSkipped.map((mig, i) => (
                                                        <li key={i} className="font-mono text-muted-foreground">
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
                                <div className="border border-destructive/30 rounded-md p-4 bg-destructive/5">
                                    <h3 className="font-semibold text-destructive mb-2">Detailed Errors</h3>
                                    <ul className="list-disc list-inside text-sm text-destructive space-y-1">
                                        {initResult.details.errors.map((err, i) => (
                                            <li key={i}>{err}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Timestamp */}
                            <div className="text-xs text-muted-foreground text-right">
                                Last run: {new Date(initResult.timestamp).toLocaleString()}
                            </div>
                        </CardContent>
                    </Card>

                    <div className="flex justify-end">
                        <Button
                            onClick={() => {
                                const searchParams = new URLSearchParams(window.location.search);
                                const secret = searchParams.get('secret');
                                initDb.mutate(secret ? { secret } : {});
                            }}
                        >
                            Run Again
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
