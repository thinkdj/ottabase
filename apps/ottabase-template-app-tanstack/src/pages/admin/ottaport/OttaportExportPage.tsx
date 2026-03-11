// ============================================================
// OttaPort Export Page
// ============================================================

import { useState } from 'react';
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Input,
    Label,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@ottabase/ui-shadcn';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowDownToLine, Download, Loader2, Search } from 'lucide-react';

interface ModelInfo {
    entity: string;
    displayName: string;
    fields: Array<{
        name: string;
        type: string;
        label: string;
        filterable: boolean;
        searchable: boolean;
    }>;
}

export function OttaportExportPage() {
    const [selectedModel, setSelectedModel] = useState('');
    const [format, setFormat] = useState('csv');
    const [search, setSearch] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [page, setPage] = useState(1);
    const perPage = 20;

    // Fetch models
    const { data: modelsData } = useQuery({
        queryKey: ['ottaport', 'models'],
        queryFn: async () => {
            const res = await fetch('/api/admin/ottaport/models');
            if (!res.ok) throw new Error('Failed to fetch models');
            return res.json();
        },
    });

    const models: ModelInfo[] = modelsData?.data || [];
    const selectedModelInfo = models.find((m) => m.entity === selectedModel);

    // Preview data
    const { data: previewData, isLoading: previewLoading } = useQuery({
        queryKey: ['ottaport', 'preview', selectedModel, page, search],
        queryFn: async () => {
            const params = new URLSearchParams({
                model: selectedModel,
                page: String(page),
                perPage: String(perPage),
            });
            if (search) params.set('search', search);

            const res = await fetch(`/api/admin/ottaport/export/preview?${params}`);
            if (!res.ok) throw new Error('Failed to fetch preview');
            return res.json();
        },
        enabled: !!selectedModel,
    });

    const previewResult = previewData?.data;
    const records = previewResult?.data || [];
    const totalRecords = previewResult?.total || 0;
    const totalPages = previewResult?.lastPage || 1;

    // Export mutation
    const exportMutation = useMutation({
        mutationFn: async () => {
            const body: Record<string, unknown> = {
                modelEntity: selectedModel,
                format,
            };
            if (search) body.search = search;
            if (dateFrom || dateTo) {
                body.dateRange = {
                    field: 'createdAt',
                    ...(dateFrom ? { from: dateFrom } : {}),
                    ...(dateTo ? { to: dateTo } : {}),
                };
            }

            const res = await fetch('/api/admin/ottaport/export', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'Export failed');
            }

            // Download the file
            const blob = await res.blob();
            const filename =
                res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] ||
                `${selectedModel}-export.${format}`;

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        },
    });

    // Get display columns from first record
    const columns = records.length > 0 ? Object.keys(records[0]).slice(0, 8) : [];

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <ArrowDownToLine className="h-5 w-5" />
                        Export Data
                    </CardTitle>
                    <CardDescription>
                        Select a model, apply optional filters, preview the data, and download
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <Label className="text-xs">Model</Label>
                            <Select
                                value={selectedModel}
                                onValueChange={(v) => {
                                    setSelectedModel(v);
                                    setPage(1);
                                }}
                            >
                                <SelectTrigger className="mt-1">
                                    <SelectValue placeholder="Select a model..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {models.map((m) => (
                                        <SelectItem key={m.entity} value={m.entity}>
                                            {m.displayName} ({m.entity})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label className="text-xs">Export Format</Label>
                            <Select value={format} onValueChange={setFormat}>
                                <SelectTrigger className="mt-1">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="csv">CSV</SelectItem>
                                    <SelectItem value="json">JSON</SelectItem>
                                    <SelectItem value="tsv">TSV</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label className="text-xs">Search</Label>
                            <div className="relative mt-1">
                                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                                <Input
                                    placeholder="Search..."
                                    value={search}
                                    onChange={(e) => {
                                        setSearch(e.target.value);
                                        setPage(1);
                                    }}
                                    className="pl-8"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label className="text-xs">Date From</Label>
                            <Input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label className="text-xs">Date To</Label>
                            <Input
                                type="date"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                                className="mt-1"
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Data Preview */}
            {selectedModel && (
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <div>
                            <CardTitle className="text-sm">Preview: {selectedModelInfo?.displayName}</CardTitle>
                            <CardDescription className="text-xs">{totalRecords} total records</CardDescription>
                        </div>
                        <Button
                            size="sm"
                            onClick={() => exportMutation.mutate()}
                            disabled={exportMutation.isPending || totalRecords === 0}
                        >
                            {exportMutation.isPending ? (
                                <>
                                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Exporting...
                                </>
                            ) : (
                                <>
                                    <Download className="mr-1.5 h-3.5 w-3.5" /> Export {format.toUpperCase()}
                                </>
                            )}
                        </Button>
                    </CardHeader>
                    <CardContent>
                        {previewLoading ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : records.length === 0 ? (
                            <div className="py-8 text-center text-sm text-muted-foreground">No records found</div>
                        ) : (
                            <div className="space-y-3">
                                <div className="overflow-x-auto rounded-md border">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="border-b bg-muted/50">
                                                {columns.map((col) => (
                                                    <th key={col} className="px-3 py-2 text-left font-medium">
                                                        {col}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {records.map((record: Record<string, unknown>, i: number) => (
                                                <tr key={i} className="border-b last:border-0">
                                                    {columns.map((col) => (
                                                        <td
                                                            key={col}
                                                            className="max-w-[200px] truncate px-3 py-2 font-mono"
                                                        >
                                                            {record[col] !== null && record[col] !== undefined
                                                                ? String(record[col])
                                                                : '—'}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Pagination */}
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground">
                                        Page {page} of {totalPages}
                                    </span>
                                    <div className="flex gap-1.5">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            disabled={page <= 1}
                                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                                        >
                                            Previous
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            disabled={page >= totalPages}
                                            onClick={() => setPage((p) => p + 1)}
                                        >
                                            Next
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
