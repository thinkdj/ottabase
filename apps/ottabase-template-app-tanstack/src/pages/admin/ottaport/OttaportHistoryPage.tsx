// ============================================================
// OttaPort History Page
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@ottabase/ui-shadcn';
import { useQuery } from '@tanstack/react-query';
import { ArrowDownToLine, ArrowUpFromLine, Clock, Loader2 } from 'lucide-react';

interface PortJobItem {
    id: string;
    direction: string;
    modelEntity: string;
    status: string;
    format: string;
    filename: string;
    totalRows: number;
    totalCreated: number;
    totalUpdated: number;
    totalFailed: number;
    durationMs: number;
    userEmail: string;
    createdAt: string | number;
}

function formatDate(value: string | number | null): string {
    if (!value) return '—';
    const date = new Date(typeof value === 'number' ? value : Date.parse(value));
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleString();
}

function getStatusBadge(status: string) {
    switch (status) {
        case 'completed':
            return (
                <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">Completed</Badge>
            );
        case 'partial':
            return (
                <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">Partial</Badge>
            );
        case 'failed':
            return <Badge variant="destructive">Failed</Badge>;
        case 'processing':
            return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">Processing</Badge>;
        default:
            return <Badge variant="secondary">{status}</Badge>;
    }
}

export function OttaportHistoryPage() {
    const [directionFilter, setDirectionFilter] = useState<string>('all');
    const [page, setPage] = useState(1);
    const perPage = 20;

    const { data: jobsData, isLoading } = useQuery({
        queryKey: ['ottaport', 'jobs', directionFilter, page],
        queryFn: async () => {
            const params = new URLSearchParams({
                page: String(page),
                perPage: String(perPage),
            });
            if (directionFilter !== 'all') params.set('direction', directionFilter);

            const res = await fetch(`/api/admin/ottaport/jobs?${params}`);
            if (!res.ok) throw new Error('Failed to fetch jobs');
            return res.json();
        },
    });

    const jobsResult = jobsData?.data;
    const jobs: PortJobItem[] = jobsResult?.data || [];
    const totalPages = jobsResult?.lastPage || 1;

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5" />
                        Job History
                    </CardTitle>
                    <CardDescription>Import and export operation history</CardDescription>
                </div>
                <Select
                    value={directionFilter}
                    onValueChange={(v) => {
                        setDirectionFilter(v);
                        setPage(1);
                    }}
                >
                    <SelectTrigger className="w-[140px]">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="import">Imports</SelectItem>
                        <SelectItem value="export">Exports</SelectItem>
                    </SelectContent>
                </Select>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : jobs.length === 0 ? (
                    <div className="py-8 text-center text-sm text-muted-foreground">No import/export jobs found</div>
                ) : (
                    <div className="space-y-3">
                        <div className="overflow-x-auto rounded-md border">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="border-b bg-muted/50">
                                        <th className="px-3 py-2 text-left font-medium">Direction</th>
                                        <th className="px-3 py-2 text-left font-medium">Model</th>
                                        <th className="px-3 py-2 text-left font-medium">Status</th>
                                        <th className="px-3 py-2 text-left font-medium">File</th>
                                        <th className="px-3 py-2 text-right font-medium">Rows</th>
                                        <th className="px-3 py-2 text-right font-medium">Created</th>
                                        <th className="px-3 py-2 text-right font-medium">Updated</th>
                                        <th className="px-3 py-2 text-right font-medium">Failed</th>
                                        <th className="px-3 py-2 text-left font-medium">User</th>
                                        <th className="px-3 py-2 text-left font-medium">Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {jobs.map((job) => (
                                        <tr key={job.id} className="border-b last:border-0">
                                            <td className="px-3 py-2">
                                                {job.direction === 'import' ? (
                                                    <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                                                        <ArrowUpFromLine className="h-3 w-3" /> Import
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                                                        <ArrowDownToLine className="h-3 w-3" /> Export
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-3 py-2 font-mono">{job.modelEntity}</td>
                                            <td className="px-3 py-2">{getStatusBadge(job.status)}</td>
                                            <td className="max-w-[150px] truncate px-3 py-2">{job.filename || '—'}</td>
                                            <td className="px-3 py-2 text-right font-mono">{job.totalRows}</td>
                                            <td className="px-3 py-2 text-right font-mono text-green-600 dark:text-green-400">
                                                {job.totalCreated || 0}
                                            </td>
                                            <td className="px-3 py-2 text-right font-mono text-blue-600 dark:text-blue-400">
                                                {job.totalUpdated || 0}
                                            </td>
                                            <td className="px-3 py-2 text-right font-mono text-red-600 dark:text-red-400">
                                                {job.totalFailed || 0}
                                            </td>
                                            <td className="max-w-[140px] truncate px-3 py-2">{job.userEmail || '—'}</td>
                                            <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                                                {formatDate(job.createdAt)}
                                            </td>
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
    );
}
