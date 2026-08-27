import { api, isApiError } from '@/lib/api';
import { useApiQuery } from '@ottabase/ottaorm/client';
import { ConfirmDialog } from '@ottabase/ui-components';
import {
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Input,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@ottabase/ui-shadcn';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { ArrowLeft, ChevronLeft, ChevronRight, Database, Search, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

interface TableDataResponse {
    tableName: string;
    columns: { name: string; type: string; pk: number }[];
    rows: Record<string, unknown>[];
    pagination: {
        page: number;
        perPage: number;
        total: number;
        totalPages: number;
    };
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
    'inline-flex items-center rounded-full bg-background px-2.5 py-0.5 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground ring-1 ring-border';

export function AdminDbPage() {
    const navigate = useNavigate();
    const search = useSearch({ from: '/admin/infrastructure/database' });
    const selectedTable = search.table;
    const page = search.page;
    const perPage = search.perPage;

    const queryClient = useQueryClient();
    const [isDropTableDialogOpen, setIsDropTableDialogOpen] = useState(false);
    const [deleteRowDialog, setDeleteRowDialog] = useState<{ id: string | number; pkField: string } | null>(null);
    const [tableFilter, setTableFilter] = useState('');

    // Load tables list
    const { data: tablesData, isLoading: tablesLoading } = useQuery({
        queryKey: ['admin', 'db', 'tables'],
        queryFn: async () => {
            return api<{ tables: string[] }>('/api/admin/db/tables');
        },
    });

    const { data: modelsMetadata } = useApiQuery<ModelsMetadataResponse>({
        entity: 'models',
        queryKey: ['metadata'],
        endpoint: '/api/ottaorm/models-metadata',
    });

    // Load table data
    const {
        data: tableData,
        isLoading: tableLoading,
        error: tableError,
    } = useQuery({
        queryKey: ['admin', 'db', 'table', selectedTable, page, perPage],
        queryFn: async () => {
            if (!selectedTable) return null;
            return api<TableDataResponse>(`/api/admin/db/tables/${selectedTable}?page=${page}&perPage=${perPage}`);
        },
        enabled: !!selectedTable,
    });

    // Delete row mutation
    const deleteRowMutation = useMutation({
        meta: { entity: 'admin_db' },
        mutationFn: async ({ id, pkField }: { id: string | number; pkField: string }) => {
            return api(`/api/admin/db/tables/${selectedTable}/${id}?pk=${pkField}`, {
                method: 'DELETE',
            });
        },
        onSuccess: () => {
            toast.success('Row deleted');
            queryClient.invalidateQueries({ queryKey: ['admin', 'db', 'table', selectedTable] });
        },
        onError: (err) => {
            toast.error(isApiError(err) ? err.message : 'Failed to delete row');
        },
    });

    // Delete table mutation
    const deleteTableMutation = useMutation({
        meta: { entity: 'admin_db' },
        mutationFn: async (tableName: string) => {
            return api(`/api/admin/db/tables/${tableName}`, { method: 'DELETE' });
        },
        onSuccess: () => {
            toast.success('Table dropped successfully');
            setIsDropTableDialogOpen(false);
            queryClient.invalidateQueries({ queryKey: ['admin', 'db', 'tables'] });
            navigate({ to: '/admin/infrastructure/database', search: { table: '', page: 1, perPage: 25 } });
        },
        onError: (err) => {
            toast.error(isApiError(err) ? err.message : 'Failed to drop table');
        },
    });

    const handleTableSelect = (tableName: string) => {
        navigate({
            to: '/admin/infrastructure/database',
            search: { table: tableName, page: 1, perPage: 25 },
        });
    };

    const handlePageChange = (newPage: number) => {
        navigate({
            to: '/admin/infrastructure/database',
            search: { ...search, page: newPage },
        });
    };

    const handleDropTable = () => {
        if (!selectedTable) return;
        // Validate that the selected table exists in our tables list
        if (!tablesData?.tables.includes(selectedTable)) {
            toast.error('Invalid table selected');
            return;
        }
        setIsDropTableDialogOpen(true);
    };

    const handleConfirmDropTable = () => {
        if (!selectedTable) return;
        // Validate that the selected table exists in our tables list
        if (!tablesData?.tables.includes(selectedTable)) {
            toast.error('Invalid table selected');
            setIsDropTableDialogOpen(false);
            return;
        }
        deleteTableMutation.mutate(selectedTable);
        // Dialog closes on success, stays open on error
    };

    const handleDelete = (row: Record<string, unknown>) => {
        if (!tableData) return;

        // Find PK field
        const pkColumn = tableData.columns.find((c) => c.pk > 0);
        const pkField = pkColumn ? pkColumn.name : 'id';
        const id = row[pkField];

        if (typeof id !== 'string' && typeof id !== 'number') {
            toast.error('Could not determine primary key for this row');
            return;
        }

        setDeleteRowDialog({ id, pkField });
    };

    const handleConfirmDeleteRow = () => {
        if (deleteRowDialog) {
            deleteRowMutation.mutate(
                { id: deleteRowDialog.id, pkField: deleteRowDialog.pkField },
                {
                    onSettled: () => {
                        setDeleteRowDialog(null);
                    },
                },
            );
        }
    };

    // Get model metadata for a table name
    const getTableMetadata = (tableName: string) => {
        if (!modelsMetadata?.models) return null;

        // Try exact match first
        let model = modelsMetadata.models.find((m) => m.tableName === tableName || m.entityName === tableName);

        // If not found, try snake_case conversion
        if (!model) {
            const snakeCaseName = tableName.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
            model = modelsMetadata.models.find((m) => m.tableName === snakeCaseName || m.entityName === snakeCaseName);
        }

        return model || null;
    };

    // Get category for a table name
    const getTableCategory = (tableName: string): string => {
        const metadata = getTableMetadata(tableName);
        if (!metadata) return 'Unknown';

        const categoryMap: Record<string, string> = {
            core: 'Core',
            app: 'App',
            package: 'Package',
        };

        return categoryMap[metadata.packageType] || 'Unknown';
    };

    // Group tables by category
    const groupedTables: Record<string, string[]> = (() => {
        if (!tablesData?.tables) return {};

        const groups: Record<string, string[]> = {
            App: [],
            Package: [],
            Core: [],
            Unknown: [],
        };

        const query = tableFilter.trim().toLowerCase();
        tablesData.tables
            .filter((table) => !query || table.toLowerCase().includes(query))
            .forEach((table) => {
                const category = getTableCategory(table);
                if (groups[category]) {
                    groups[category].push(table);
                } else {
                    groups.Unknown.push(table);
                }
            });

        // Sort tables within each category
        Object.keys(groups).forEach((category) => {
            groups[category].sort();
        });

        return groups;
    })();

    return (
        <div className="space-y-8">
            <div className="space-y-4">
                <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit gap-1.5 text-muted-foreground">
                    <Link to="/admin">
                        <ArrowLeft className="h-4 w-4" />
                        Back to Admin
                    </Link>
                </Button>

                <div className="space-y-1.5">
                    <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Database Manager</h1>
                    <p className="max-w-3xl text-muted-foreground">Browse tables and inspect raw rows.</p>
                </div>
            </div>

            <div className="grid grid-cols-12 gap-6">
                {/* Sidebar - Table List */}
                <div className="col-span-12 md:col-span-3">
                    <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                        <CardHeader className="gap-3 py-4">
                            <CardTitle className="flex items-center gap-2 text-[0.9375rem] font-semibold">
                                <Database className="h-4 w-4 text-muted-foreground" />
                                Tables
                            </CardTitle>
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    value={tableFilter}
                                    onChange={(e) => setTableFilter(e.target.value)}
                                    placeholder="Filter tables…"
                                    aria-label="Filter tables"
                                    className="h-8 bg-background pl-8 pr-8 text-sm"
                                />
                                {tableFilter && (
                                    <button
                                        type="button"
                                        onClick={() => setTableFilter('')}
                                        aria-label="Clear filter"
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors duration-normal hover:text-foreground"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            {tablesLoading ? (
                                <div className="space-y-2 p-4" aria-busy="true">
                                    <span className="sr-only">Loading tables…</span>
                                    {Array.from({ length: 6 }, (_, index) => (
                                        <div key={index} className="h-8 animate-pulse rounded-lg bg-background/60" />
                                    ))}
                                </div>
                            ) : (
                                <div className="flex max-h-[calc(100vh-300px)] flex-col overflow-y-auto pb-2">
                                    {(() => {
                                        const categoryOrder = ['App', 'Package', 'Core', 'Unknown'];

                                        return categoryOrder.map((category) => {
                                            const tables = groupedTables[category] || [];
                                            if (tables.length === 0) return null;

                                            return (
                                                <div key={category}>
                                                    <div
                                                        className={`border-b border-border/60 px-4 py-2 ${MICRO_LABEL}`}
                                                    >
                                                        {category}
                                                    </div>
                                                    {tables.map((table) => (
                                                        <button
                                                            key={table}
                                                            onClick={() => handleTableSelect(table)}
                                                            title={table}
                                                            className={`block w-full truncate px-4 py-2 text-left font-mono text-xs outline-none transition-colors duration-normal focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${
                                                                selectedTable === table
                                                                    ? 'bg-background font-medium text-foreground ring-1 ring-inset ring-border'
                                                                    : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                                                            }`}
                                                        >
                                                            {table}
                                                        </button>
                                                    ))}
                                                </div>
                                            );
                                        });
                                    })()}
                                    {Object.values(groupedTables).every((tables) => tables.length === 0) && (
                                        <div className="p-4 text-sm text-muted-foreground">
                                            {tableFilter ? 'No tables match your filter' : 'No tables found'}
                                        </div>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Main Content - Data View */}
                <div className="col-span-12 md:col-span-9">
                    {!selectedTable ? (
                        <Card className="flex h-full min-h-[400px] items-center justify-center rounded-xl border-transparent bg-muted/40 shadow-none">
                            <div className="text-center text-muted-foreground">
                                <Database className="mx-auto mb-4 h-12 w-12 opacity-40" />
                                <p className="text-sm">Select a table to view data</p>
                            </div>
                        </Card>
                    ) : (
                        <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 py-4">
                                <div className="space-y-1">
                                    <CardTitle className="font-mono text-xl">{selectedTable}</CardTitle>
                                    {(() => {
                                        const metadata = getTableMetadata(selectedTable);
                                        if (metadata) {
                                            const categoryLabels: Record<string, string> = {
                                                core: 'Core',
                                                app: 'App',
                                                package: 'Package',
                                            };
                                            return (
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className={CATEGORY_CHIP}>
                                                        {categoryLabels[metadata.packageType] || metadata.packageType}
                                                    </span>
                                                    <code className="text-xs text-muted-foreground">
                                                        {metadata.packageName}
                                                    </code>
                                                    {metadata.modelName && (
                                                        <span className="text-xs text-muted-foreground">
                                                            • Model: <code>{metadata.modelName}</code>
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        }
                                        return null;
                                    })()}
                                    <CardDescription>
                                        {tableLoading ? 'Loading...' : `${tableData?.pagination.total || 0} rows`}
                                    </CardDescription>
                                </div>
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={handleDropTable}
                                    disabled={deleteTableMutation.status === 'pending'}
                                >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Drop Table
                                </Button>
                            </CardHeader>
                            <CardContent>
                                {tableLoading ? (
                                    <div className="space-y-3" aria-busy="true">
                                        <span className="sr-only">Loading table data…</span>
                                        {Array.from({ length: 5 }, (_, index) => (
                                            <div
                                                key={index}
                                                className="h-10 animate-pulse rounded-lg bg-background/60"
                                            />
                                        ))}
                                    </div>
                                ) : tableError ? (
                                    <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                                        {/* error handling */}
                                        Error:{' '}
                                        {isApiError(tableError) ? tableError.message : (tableError as Error).message}
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="overflow-x-auto rounded-lg bg-background ring-1 ring-border">
                                            <Table>
                                                <TableHeader className="bg-muted/40">
                                                    <TableRow className="border-border/60 hover:bg-transparent">
                                                        <TableHead className="w-[50px]"></TableHead>
                                                        {tableData?.columns.map((col) => (
                                                            <TableHead
                                                                key={col.name}
                                                                className="whitespace-nowrap font-mono text-xs text-muted-foreground"
                                                            >
                                                                {col.name}
                                                                {col.pk > 0 && (
                                                                    <span className="ml-1 text-[0.6875rem] font-medium text-foreground">
                                                                        (PK)
                                                                    </span>
                                                                )}
                                                                <span className="ml-1 text-[0.6875rem] font-normal text-muted-foreground">
                                                                    ({col.type})
                                                                </span>
                                                            </TableHead>
                                                        ))}
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {tableData?.rows.length === 0 ? (
                                                        <TableRow className="border-border/60">
                                                            <TableCell
                                                                colSpan={(tableData?.columns.length || 0) + 1}
                                                                className="h-24 text-center text-muted-foreground"
                                                            >
                                                                No data found
                                                            </TableCell>
                                                        </TableRow>
                                                    ) : (
                                                        tableData?.rows.map((row, i) => (
                                                            <TableRow
                                                                key={i}
                                                                className="group border-border/60 transition-colors duration-normal hover:bg-muted/40"
                                                            >
                                                                <TableCell>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-8 w-8 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                                                                        onClick={() => handleDelete(row)}
                                                                        title="Delete row"
                                                                    >
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </Button>
                                                                </TableCell>
                                                                {tableData?.columns.map((col) => (
                                                                    <TableCell
                                                                        key={col.name}
                                                                        className="max-w-[200px] truncate font-mono text-xs"
                                                                        title={String(row[col.name])}
                                                                    >
                                                                        {row[col.name] === null ? (
                                                                            <span className="italic text-muted-foreground">
                                                                                null
                                                                            </span>
                                                                        ) : (
                                                                            String(row[col.name])
                                                                        )}
                                                                    </TableCell>
                                                                ))}
                                                            </TableRow>
                                                        ))
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </div>

                                        {/* Pagination */}
                                        {(tableData?.pagination.totalPages || 0) > 1 && (
                                            <div className="flex items-center justify-between">
                                                <div className={MICRO_LABEL}>
                                                    Page {page} of {tableData?.pagination.totalPages}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-muted-foreground"
                                                        onClick={() => handlePageChange(page - 1)}
                                                        disabled={page <= 1}
                                                    >
                                                        <ChevronLeft className="mr-1 h-4 w-4" />
                                                        Prev
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-muted-foreground"
                                                        onClick={() => handlePageChange(page + 1)}
                                                        disabled={page >= (tableData?.pagination.totalPages || 1)}
                                                    >
                                                        Next
                                                        <ChevronRight className="ml-1 h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>

            <ConfirmDialog
                open={deleteRowDialog !== null}
                onOpenChange={(open) => !open && setDeleteRowDialog(null)}
                title="Delete Row?"
                description={
                    <>
                        Are you sure you want to delete this row? ({deleteRowDialog?.pkField}: {deleteRowDialog?.id})
                    </>
                }
                tone="destructive"
                secondaryActionText="Cancel"
                primaryActionText="Delete"
                onConfirm={handleConfirmDeleteRow}
                confirmProps={{ disabled: deleteRowMutation.isPending }}
                cancelProps={{ disabled: deleteRowMutation.isPending }}
            />

            {/* Drop Table Confirmation Dialog */}
            <ConfirmDialog
                open={isDropTableDialogOpen}
                onOpenChange={setIsDropTableDialogOpen}
                title={
                    <>
                        Drop Table <code className="font-mono">{selectedTable}</code>?
                    </>
                }
                description={
                    <>
                        This action cannot be undone. This will permanently delete the table{' '}
                        <code className="font-mono">{selectedTable}</code> and all of its data from the database.
                    </>
                }
                tone="destructive"
                secondaryActionText="Cancel"
                primaryActionText={deleteTableMutation.status === 'pending' ? 'Dropping...' : 'Drop Table'}
                onConfirm={handleConfirmDropTable}
                confirmProps={{ disabled: deleteTableMutation.status === 'pending' }}
                cancelProps={{ disabled: deleteTableMutation.status === 'pending' }}
            />
        </div>
    );
}
