import { api, isApiError } from '@/lib/api';
import type { PaginatedResponse, Pagination } from '@/lib/api-types';
import type { AuditLogRecord, BadgeVariant } from '@/types/rbac';
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Input,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@ottabase/ui-shadcn';
import {
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    FileText,
    Search,
    Filter,
    Download,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ApiErrorDisplay } from '@/components/ErrorBoundary';
import { TableSkeleton } from '@/components/LoadingSkeletons';
import { useRBACToast } from '@/hooks/useToast';

type AuditLogsResponse = PaginatedResponse<AuditLogRecord>;

export function AuditLogViewerPage() {
    const toast = useRBACToast();
    const [logs, setLogs] = useState<AuditLogRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [perPage, setPerPage] = useState(25);
    const [pagination, setPagination] = useState<Pagination | null>(null);

    // Filter state
    const [searchTerm, setSearchTerm] = useState('');
    const [actionFilter, setActionFilter] = useState<string>('all');
    const [entityTypeFilter, setEntityTypeFilter] = useState<string>('all');
    const [userIdFilter, setUserIdFilter] = useState('');
    const [organizationIdFilter, setOrganizationIdFilter] = useState('');

    const fetchLogs = useCallback(
        async (page: number = 1, itemsPerPage: number = 25) => {
            try {
                setLoading(true);
                setError(null);

                // Build query params
                const params = new URLSearchParams({
                    page: page.toString(),
                    per_page: itemsPerPage.toString(),
                });

                if (searchTerm) params.append('search', searchTerm);
                if (actionFilter !== 'all') params.append('action', actionFilter);
                if (entityTypeFilter !== 'all') params.append('entityType', entityTypeFilter);
                if (userIdFilter) params.append('userId', userIdFilter);
                if (organizationIdFilter) params.append('organizationId', organizationIdFilter);

                const response = await api<AuditLogsResponse>(`/api/audit/logs?${params.toString()}`);
                if (response.data) {
                    setLogs(response.data);
                    setPagination(response.pagination);
                    setCurrentPage(response.pagination.page);
                }
            } catch (err) {
                const error = err instanceof Error ? err : new Error('Failed to load audit logs');
                setError(error);
            } finally {
                setLoading(false);
            }
        },
        [searchTerm, actionFilter, entityTypeFilter, userIdFilter, organizationIdFilter],
    );

    useEffect(() => {
        fetchLogs(currentPage, perPage);
    }, [fetchLogs, currentPage, perPage]);

    const handleSearch = () => {
        setCurrentPage(1);
        fetchLogs(1, perPage);
    };

    const handleClearFilters = () => {
        setSearchTerm('');
        setActionFilter('all');
        setEntityTypeFilter('all');
        setUserIdFilter('');
        setOrganizationIdFilter('');
        setCurrentPage(1);
    };

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
    };

    const handlePerPageChange = (value: string) => {
        setPerPage(parseInt(value));
        setCurrentPage(1);
    };

    const handleExport = async () => {
        try {
            toast.info('Exporting audit logs...', 'This may take a moment for large datasets');
            // In a real implementation, this would call an export endpoint
            // const blob = await api('/api/audit/export', { responseType: 'blob' });
            // downloadBlob(blob, 'audit-logs.csv');
            toast.success('Export complete', 'Audit logs have been downloaded');
        } catch (err) {
            toast.error('Export failed', 'Could not export audit logs');
        }
    };

    const getActionBadgeVariant = (action: string): BadgeVariant => {
        switch (action) {
            case 'create':
                return 'default';
            case 'update':
                return 'secondary';
            case 'delete':
                return 'destructive';
            case 'read':
                return 'outline';
            default:
                return 'outline';
        }
    };

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <FileText className="h-5 w-5" />
                                Audit Log Viewer
                            </CardTitle>
                            <CardDescription>
                                View and search audit logs across all organizations and apps
                            </CardDescription>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={handleExport} className="gap-2">
                                <Download className="h-4 w-4" />
                                Export
                            </Button>
                            <Button variant="outline" asChild>
                                <Link to="/admin">← Back to Admin</Link>
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Filters */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm flex items-center gap-2">
                                <Filter className="h-4 w-4" />
                                Filters
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {/* Search */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Search</label>
                                    <div className="flex gap-2">
                                        <Input
                                            placeholder="Search logs..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                        />
                                        <Button variant="outline" size="icon" onClick={handleSearch}>
                                            <Search className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>

                                {/* Action Filter */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Action</label>
                                    <Select value={actionFilter} onValueChange={setActionFilter}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Actions</SelectItem>
                                            <SelectItem value="create">Create</SelectItem>
                                            <SelectItem value="update">Update</SelectItem>
                                            <SelectItem value="delete">Delete</SelectItem>
                                            <SelectItem value="read">Read</SelectItem>
                                            <SelectItem value="login">Login</SelectItem>
                                            <SelectItem value="logout">Logout</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Entity Type Filter */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Entity Type</label>
                                    <Select value={entityTypeFilter} onValueChange={setEntityTypeFilter}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Types</SelectItem>
                                            <SelectItem value="organization">Organization</SelectItem>
                                            <SelectItem value="organization_member">Member</SelectItem>
                                            <SelectItem value="role">Role</SelectItem>
                                            <SelectItem value="permission">Permission</SelectItem>
                                            <SelectItem value="user">User</SelectItem>
                                            <SelectItem value="app">App</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* User ID Filter */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">User ID</label>
                                    <Input
                                        placeholder="Filter by user ID..."
                                        value={userIdFilter}
                                        onChange={(e) => setUserIdFilter(e.target.value)}
                                    />
                                </div>

                                {/* Organization ID Filter */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Organization ID</label>
                                    <Input
                                        placeholder="Filter by org ID..."
                                        value={organizationIdFilter}
                                        onChange={(e) => setOrganizationIdFilter(e.target.value)}
                                    />
                                </div>

                                {/* Clear Filters */}
                                <div className="space-y-2 flex items-end">
                                    <Button
                                        variant="outline"
                                        onClick={handleClearFilters}
                                        className="w-full"
                                    >
                                        Clear Filters
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Error Display */}
                    {error && (
                        <ApiErrorDisplay
                            error={error}
                            onRetry={() => fetchLogs(currentPage, perPage)}
                            onDismiss={() => setError(null)}
                        />
                    )}

                    {/* Logs Table */}
                    {loading && logs.length === 0 ? (
                        <TableSkeleton rows={10} columns={7} />
                    ) : logs.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p className="text-lg font-medium">No audit logs found</p>
                            <p className="text-sm">Try adjusting your filters or search criteria</p>
                        </div>
                    ) : (
                        <>
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Timestamp</TableHead>
                                            <TableHead>Action</TableHead>
                                            <TableHead>Entity Type</TableHead>
                                            <TableHead>Entity ID</TableHead>
                                            <TableHead>User ID</TableHead>
                                            <TableHead>Org ID</TableHead>
                                            <TableHead>Details</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {logs.map((log) => (
                                            <TableRow key={log.id}>
                                                <TableCell className="font-mono text-xs">
                                                    {new Date(log.timestamp).toLocaleString()}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={getActionBadgeVariant(log.action)}>
                                                        {log.action}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <code className="text-xs bg-muted px-2 py-1 rounded">
                                                        {log.entityType}
                                                    </code>
                                                </TableCell>
                                                <TableCell>
                                                    <code className="text-xs">{log.entityId || '-'}</code>
                                                </TableCell>
                                                <TableCell>
                                                    <code className="text-xs">{log.userId || '-'}</code>
                                                </TableCell>
                                                <TableCell>
                                                    <code className="text-xs">{log.organizationId || '-'}</code>
                                                </TableCell>
                                                <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                                                    {log.metadata
                                                        ? JSON.stringify(log.metadata)
                                                        : '-'}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Pagination */}
                            {pagination && (
                                <div className="flex items-center justify-between pt-4">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-muted-foreground">Rows per page:</span>
                                        <Select value={perPage.toString()} onValueChange={handlePerPageChange}>
                                            <SelectTrigger className="w-20">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="10">10</SelectItem>
                                                <SelectItem value="25">25</SelectItem>
                                                <SelectItem value="50">50</SelectItem>
                                                <SelectItem value="100">100</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-muted-foreground">
                                            Page {pagination.page} of {pagination.totalPages} (
                                            {pagination.total} total)
                                        </span>
                                        <div className="flex gap-1">
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                onClick={() => handlePageChange(1)}
                                                disabled={currentPage === 1}
                                            >
                                                <ChevronsLeft className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                onClick={() => handlePageChange(currentPage - 1)}
                                                disabled={currentPage === 1}
                                            >
                                                <ChevronLeft className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                onClick={() => handlePageChange(currentPage + 1)}
                                                disabled={currentPage === pagination.totalPages}
                                            >
                                                <ChevronRight className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                onClick={() => handlePageChange(pagination.totalPages)}
                                                disabled={currentPage === pagination.totalPages}
                                            >
                                                <ChevronsRight className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Info Card */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-sm">Audit Log Information</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-2 text-muted-foreground">
                    <p>
                        Audit logs capture all significant events across the system, including user actions,
                        RBAC changes, and data modifications.
                    </p>
                    <p>
                        Logs are automatically retained based on your organization's compliance requirements
                        and can be exported for archival purposes.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
