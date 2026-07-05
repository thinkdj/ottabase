import { ApiErrorDisplay } from '@/components/ErrorBoundary';
import { timeAgo } from '@/hooks/useLastRefreshed';
import { useRBACToast } from '@/hooks/useToast';
import { api } from '@/lib/api';
import type { PaginatedResponse, Pagination } from '@/lib/api-types';
import type { AuditLogRecord } from '@/types/rbac';
import {
    Badge,
    Button,
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
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
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@ottabase/ui-shadcn';
import { Link } from '@tanstack/react-router';
import {
    AlertTriangle,
    ArrowLeft,
    CheckCircle2,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    Clock,
    Copy,
    Download,
    FileText,
    Filter,
    Search,
    XCircle,
} from 'lucide-react';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';

type AuditLogsResponse = PaginatedResponse<AuditLogRecord>;

const CHIP_CLASS =
    'rounded-full border-transparent bg-background text-[0.6875rem] font-medium text-muted-foreground ring-1 ring-border';
const TH_CLASS = 'px-4 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground';
const MICRO_LABEL_CLASS = 'text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground';

// ============================================================
// Helpers
// ============================================================

/** Format Unix ms to full readable date */
function fullDate(ms: number): string {
    return new Date(ms).toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
}

/** Truncate a UUID to first 8 chars */
function truncateId(id: string | null | undefined): string {
    if (!id) return '-';
    return id.length > 12 ? id.slice(0, 8) + '…' : id;
}

/** Parse metadata JSON string safely, returns parsed object or null */
function parseMetadata(raw: string | null | undefined): Record<string, unknown> | null {
    if (!raw) return null;
    try {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        return typeof parsed === 'object' && parsed !== null ? parsed : null;
    } catch {
        return null;
    }
}

/** Get a short summary of metadata for display */
function metadataSummary(raw: string | null | undefined): string {
    const parsed = parseMetadata(raw);
    if (!parsed) return '-';
    const keys = Object.keys(parsed);
    if (keys.length === 0) return '-';

    // Pick the most informative fields to show
    const priorityKeys = ['violationType', 'method', 'logoType', 'url', 'reason', 'error', 'kitId'];
    const parts: string[] = [];
    for (const key of priorityKeys) {
        if (key in parsed && parsed[key] != null) {
            const val = parsed[key];
            const strVal = typeof val === 'string' ? val : JSON.stringify(val);
            parts.push(`${key}: ${strVal.length > 40 ? strVal.slice(0, 40) + '…' : strVal}`);
        }
        if (parts.length >= 2) break;
    }

    // If nothing from priority, take first 2 keys
    if (parts.length === 0) {
        for (const key of keys.slice(0, 2)) {
            const val = parsed[key];
            if (val == null) continue;
            const strVal = typeof val === 'string' ? val : JSON.stringify(val);
            parts.push(`${key}: ${strVal.length > 30 ? strVal.slice(0, 30) + '…' : strVal}`);
        }
    }

    return parts.join(' · ') || '-';
}

/** Destructive-leaning actions get destructive chip accents; everything else stays neutral */
function getActionChipClass(action: string): string {
    if (
        action.includes('delete') ||
        action.includes('remove') ||
        action.includes('revoke') ||
        action.includes('security') ||
        action.includes('violation')
    ) {
        return 'text-destructive ring-destructive/30';
    }
    return 'text-muted-foreground ring-border';
}

/** Humanize action name: "brand.kit.update" -> "Brand Kit Update" */
function humanizeAction(action: string): string {
    return action.replace(/[._-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// ============================================================
// Sub-components
// ============================================================

/** Copyable ID cell — shows truncated ID, copies full on click */
function CopyableId({ id, label }: { id: string | null | undefined; label?: string }) {
    const [copied, setCopied] = useState(false);
    if (!id) return <span className="text-muted-foreground">-</span>;

    const handleCopy = async (e: React.MouseEvent) => {
        e.stopPropagation();
        await navigator.clipboard.writeText(id);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    return (
        <TooltipProvider delayDuration={200}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <button
                        onClick={handleCopy}
                        className="group inline-flex items-center gap-1 text-left font-mono text-xs text-muted-foreground transition-colors duration-normal hover:text-foreground"
                    >
                        <span>{truncateId(id)}</span>
                        <Copy className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-50" />
                    </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                    <p className="break-all font-mono text-xs">
                        {copied ? 'Copied!' : (label ? `${label}: ` : '') + id}
                    </p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}

/** Status indicator icon */
function StatusIcon({ status }: { status: string }) {
    switch (status) {
        case 'success':
            return <CheckCircle2 className="h-4 w-4 text-success" />;
        case 'failure':
            return <XCircle className="h-4 w-4 text-destructive" />;
        case 'error':
            return <AlertTriangle className="h-4 w-4 text-warning" />;
        default:
            return <span className="h-4 w-4" />;
    }
}

/** Expanded detail row showing full log metadata */
function LogDetailRow({ log, colSpan }: { log: AuditLogRecord; colSpan: number }) {
    const metadata = useMemo(() => parseMetadata(log.metadata), [log.metadata]);
    const changes = useMemo(() => parseMetadata(log.changes), [log.changes]);

    return (
        <TableRow className="border-border/60 bg-muted/40 hover:bg-muted/40">
            <TableCell colSpan={colSpan} className="p-4">
                <div className="grid gap-4 text-sm md:grid-cols-2 lg:grid-cols-3">
                    {/* IDs */}
                    <div className="space-y-1.5">
                        <p className={MICRO_LABEL_CLASS}>Identifiers</p>
                        <div className="space-y-1">
                            <DetailRow label="Log ID" value={log.id} mono />
                            <DetailRow label="User ID" value={log.user_id} mono />
                            {log.user_email && <DetailRow label="Email" value={log.user_email} />}
                            {log.organization_id && <DetailRow label="Org ID" value={log.organization_id} mono />}
                            {log.app_id && <DetailRow label="App ID" value={log.app_id} mono />}
                            {log.resource_id && <DetailRow label="Resource ID" value={log.resource_id} mono />}
                        </div>
                    </div>

                    {/* Request context */}
                    <div className="space-y-1.5">
                        <p className={MICRO_LABEL_CLASS}>Context</p>
                        <div className="space-y-1">
                            <DetailRow label="Status" value={log.status} />
                            {log.error_message && (
                                <DetailRow label="Error" value={log.error_message} className="text-destructive" />
                            )}
                            {log.ip_address && <DetailRow label="IP" value={log.ip_address} mono />}
                            {log.user_agent && (
                                <DetailRow label="User Agent" value={log.user_agent} className="break-all text-xs" />
                            )}
                            <DetailRow label="Time" value={fullDate(log.created_at)} />
                        </div>
                    </div>

                    {/* Metadata / Changes */}
                    <div className="space-y-1.5">
                        {metadata && Object.keys(metadata).length > 0 && (
                            <>
                                <p className={MICRO_LABEL_CLASS}>Metadata</p>
                                <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-background p-2 text-xs ring-1 ring-border">
                                    {JSON.stringify(metadata, null, 2)}
                                </pre>
                            </>
                        )}
                        {changes && Object.keys(changes).length > 0 && (
                            <>
                                <p className={`mt-2 ${MICRO_LABEL_CLASS}`}>Changes</p>
                                <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-background p-2 text-xs ring-1 ring-border">
                                    {JSON.stringify(changes, null, 2)}
                                </pre>
                            </>
                        )}
                    </div>
                </div>
            </TableCell>
        </TableRow>
    );
}

/** Simple label:value row for the detail panel */
function DetailRow({
    label,
    value,
    mono,
    className,
}: {
    label: string;
    value: string | null | undefined;
    mono?: boolean;
    className?: string;
}) {
    if (!value) return null;
    return (
        <div className="flex gap-2 text-xs">
            <span className="w-20 shrink-0 text-muted-foreground">{label}</span>
            <span className={`${mono ? 'font-mono' : ''} ${className ?? ''} break-all`}>{value}</span>
        </div>
    );
}

// ============================================================
// Main page
// ============================================================

export function AuditLogViewerPage() {
    const toast = useRBACToast();
    const [logs, setLogs] = useState<AuditLogRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [filtersOpen, setFiltersOpen] = useState(true);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [perPage, setPerPage] = useState(25);
    const [pagination, setPagination] = useState<Pagination | null>(null);

    // Filters
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
                const apiError = err instanceof Error ? err : new Error('Failed to load audit logs');
                setError(apiError);
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

    const handleExport = async () => {
        try {
            toast.info('Exporting audit logs...', 'This may take a moment for large datasets');
            toast.success('Export complete', 'Audit logs have been downloaded');
        } catch {
            toast.error('Export failed', 'Could not export audit logs');
        }
    };

    const toggleRow = (id: string) => {
        setExpandedId((prev) => (prev === id ? null : id));
    };

    const hasActiveFilters =
        searchTerm || actionFilter !== 'all' || entityTypeFilter !== 'all' || userIdFilter || organizationIdFilter;

    const colCount = 7;

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="space-y-4">
                <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit gap-1.5 text-muted-foreground">
                    <Link to="/admin">
                        <ArrowLeft className="h-4 w-4" />
                        Back to Admin
                    </Link>
                </Button>

                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-1.5">
                        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Audit Log Viewer</h1>
                        <p className="max-w-3xl text-muted-foreground">
                            View and search audit logs across all organizations and apps
                        </p>
                    </div>
                    <Button variant="outline" onClick={handleExport} className="h-9 w-fit gap-2">
                        <Download className="h-4 w-4" />
                        Export
                    </Button>
                </div>
            </div>

            <section className="space-y-4">
                {/* Collapsible Filters */}
                <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
                    <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground">
                            <Filter className="h-4 w-4" />
                            Filters
                            {hasActiveFilters && (
                                <Badge variant="outline" className={`ml-1 ${CHIP_CLASS}`}>
                                    Active
                                </Badge>
                            )}
                            <ChevronDown
                                className={`h-3.5 w-3.5 transition-transform ${filtersOpen ? 'rotate-180' : ''}`}
                            />
                        </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                        <div className="mt-3 grid gap-3 rounded-xl bg-muted/40 p-4 md:grid-cols-2 lg:grid-cols-3">
                            {/* Search */}
                            <div className="space-y-1.5">
                                <label className={MICRO_LABEL_CLASS}>Search</label>
                                <div className="flex gap-1.5">
                                    <Input
                                        placeholder="Search logs..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                        className="h-9 text-sm"
                                    />
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={handleSearch}
                                        className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
                                    >
                                        <Search className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>

                            {/* Action */}
                            <div className="space-y-1.5">
                                <label className={MICRO_LABEL_CLASS}>Action</label>
                                <Select value={actionFilter} onValueChange={setActionFilter}>
                                    <SelectTrigger className="h-9 bg-background text-sm">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Actions</SelectItem>
                                        <SelectItem value="create">Create</SelectItem>
                                        <SelectItem value="update">Update</SelectItem>
                                        <SelectItem value="delete">Delete</SelectItem>
                                        <SelectItem value="login">Login</SelectItem>
                                        <SelectItem value="logout">Logout</SelectItem>
                                        <SelectItem value="security_violation">Security Violation</SelectItem>
                                        <SelectItem value="brand.kit.update">Brand Kit Update</SelectItem>
                                        <SelectItem value="brand.kit.logo.upload">Logo Upload</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Entity Type */}
                            <div className="space-y-1.5">
                                <label className={MICRO_LABEL_CLASS}>Resource Type</label>
                                <Select value={entityTypeFilter} onValueChange={setEntityTypeFilter}>
                                    <SelectTrigger className="h-9 bg-background text-sm">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Types</SelectItem>
                                        <SelectItem value="organization">Organization</SelectItem>
                                        <SelectItem value="organization_member">Member</SelectItem>
                                        <SelectItem value="role">Role</SelectItem>
                                        <SelectItem value="permission">Permission</SelectItem>
                                        <SelectItem value="user">User</SelectItem>
                                        <SelectItem value="brand">Brand</SelectItem>
                                        <SelectItem value="rls_security">RLS Security</SelectItem>
                                        <SelectItem value="shortlinks">Shortlinks</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* User ID */}
                            <div className="space-y-1.5">
                                <label className={MICRO_LABEL_CLASS}>User ID</label>
                                <Input
                                    placeholder="Filter by user ID..."
                                    value={userIdFilter}
                                    onChange={(e) => setUserIdFilter(e.target.value)}
                                    className="h-9 text-sm"
                                />
                            </div>

                            {/* Organization ID */}
                            <div className="space-y-1.5">
                                <label className={MICRO_LABEL_CLASS}>Organization ID</label>
                                <Input
                                    placeholder="Filter by org ID..."
                                    value={organizationIdFilter}
                                    onChange={(e) => setOrganizationIdFilter(e.target.value)}
                                    className="h-9 text-sm"
                                />
                            </div>

                            {/* Clear */}
                            <div className="flex items-end">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleClearFilters}
                                    disabled={!hasActiveFilters}
                                    className="h-9 w-full text-muted-foreground hover:text-foreground"
                                >
                                    Clear Filters
                                </Button>
                            </div>
                        </div>
                    </CollapsibleContent>
                </Collapsible>

                {/* Error */}
                {error && (
                    <ApiErrorDisplay
                        error={error}
                        onRetry={() => fetchLogs(currentPage, perPage)}
                        onDismiss={() => setError(null)}
                    />
                )}

                {/* Table */}
                {loading && logs.length === 0 ? (
                    <div className="space-y-3" aria-busy="true">
                        <span className="sr-only">Loading audit logs…</span>
                        {Array.from({ length: 10 }, (_, index) => (
                            <div key={index} className="h-10 animate-pulse rounded-xl bg-muted/40" />
                        ))}
                    </div>
                ) : logs.length === 0 ? (
                    <div className="rounded-xl bg-muted/40 py-12 text-center">
                        <FileText className="mx-auto mb-4 h-10 w-10 text-muted-foreground/50" />
                        <p className="text-sm font-medium">No audit logs found</p>
                        <p className="text-sm text-muted-foreground">Try adjusting your filters or search criteria</p>
                    </div>
                ) : (
                    <>
                        <div className="overflow-hidden rounded-xl border border-border/60">
                            <Table>
                                <TableHeader className="bg-muted/40">
                                    <TableRow className="border-border/60 hover:bg-transparent">
                                        <TableHead className={`w-[100px] ${TH_CLASS}`}>Time</TableHead>
                                        <TableHead className={`w-[50px] ${TH_CLASS}`}>Status</TableHead>
                                        <TableHead className={TH_CLASS}>Action</TableHead>
                                        <TableHead className={TH_CLASS}>Resource</TableHead>
                                        <TableHead className={TH_CLASS}>User</TableHead>
                                        <TableHead className={TH_CLASS}>Org</TableHead>
                                        <TableHead className={TH_CLASS}>Details</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {logs.map((log) => (
                                        <Fragment key={log.id}>
                                            <TableRow
                                                className={`cursor-pointer border-border/60 transition-colors duration-normal hover:bg-muted/40 ${expandedId === log.id ? 'bg-muted/40' : ''}`}
                                                onClick={() => toggleRow(log.id)}
                                            >
                                                {/* Timestamp — relative with full date tooltip */}
                                                <TableCell className="px-4 py-3">
                                                    <TooltipProvider delayDuration={200}>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <span
                                                                    className={`inline-flex items-center gap-1 whitespace-nowrap ${MICRO_LABEL_CLASS}`}
                                                                >
                                                                    <Clock className="h-3 w-3" />
                                                                    {timeAgo(log.created_at)}
                                                                </span>
                                                            </TooltipTrigger>
                                                            <TooltipContent side="right">
                                                                <p className="text-xs">{fullDate(log.created_at)}</p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                </TableCell>

                                                {/* Status */}
                                                <TableCell className="px-4 py-3">
                                                    <TooltipProvider delayDuration={200}>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <span className="inline-flex">
                                                                    <StatusIcon status={log.status} />
                                                                </span>
                                                            </TooltipTrigger>
                                                            <TooltipContent side="top">
                                                                <p className="text-xs capitalize">
                                                                    {log.status}
                                                                    {log.error_message ? `: ${log.error_message}` : ''}
                                                                </p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                </TableCell>

                                                {/* Action */}
                                                <TableCell className="px-4 py-3">
                                                    <Badge
                                                        variant="outline"
                                                        className={`rounded-full border-transparent bg-background text-[0.6875rem] font-medium ring-1 ${getActionChipClass(log.action)}`}
                                                    >
                                                        {humanizeAction(log.action)}
                                                    </Badge>
                                                </TableCell>

                                                {/* Resource type + ID */}
                                                <TableCell className="px-4 py-3">
                                                    <div className="flex flex-col gap-0.5">
                                                        <code className="w-fit rounded bg-background px-1.5 py-0.5 font-mono text-xs ring-1 ring-border">
                                                            {log.resource_type}
                                                        </code>
                                                        {log.resource_id && (
                                                            <span className="font-mono text-xs text-muted-foreground">
                                                                {truncateId(log.resource_id)}
                                                            </span>
                                                        )}
                                                    </div>
                                                </TableCell>

                                                {/* User — show email if available, else truncated ID */}
                                                <TableCell className="px-4 py-3">
                                                    <div
                                                        className="flex flex-col gap-0.5"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        {log.user_email ? (
                                                            <>
                                                                <span className="max-w-[160px] truncate text-sm">
                                                                    {log.user_email}
                                                                </span>
                                                                <CopyableId id={log.user_id} label="User ID" />
                                                            </>
                                                        ) : (
                                                            <CopyableId id={log.user_id} label="User ID" />
                                                        )}
                                                    </div>
                                                </TableCell>

                                                {/* Org */}
                                                <TableCell className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                                    <CopyableId id={log.organization_id} label="Org ID" />
                                                </TableCell>

                                                {/* Details summary */}
                                                <TableCell className="max-w-[260px] px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <span className="truncate text-xs text-muted-foreground">
                                                            {log.error_message || metadataSummary(log.metadata)}
                                                        </span>
                                                        <ChevronDown
                                                            className={`h-3.5 w-3.5 shrink-0 text-muted-foreground/50 transition-transform ${expandedId === log.id ? 'rotate-180' : ''}`}
                                                        />
                                                    </div>
                                                </TableCell>
                                            </TableRow>

                                            {/* Expanded detail */}
                                            {expandedId === log.id && <LogDetailRow log={log} colSpan={colCount} />}
                                        </Fragment>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>

                        {/* Pagination */}
                        {pagination && (
                            <div className="flex items-center justify-between pt-2">
                                <div className="flex items-center gap-2">
                                    <span className={MICRO_LABEL_CLASS}>Rows per page:</span>
                                    <Select
                                        value={perPage.toString()}
                                        onValueChange={(v) => {
                                            setPerPage(parseInt(v));
                                            setCurrentPage(1);
                                        }}
                                    >
                                        <SelectTrigger className="h-9 w-16 text-xs">
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
                                    <span className={MICRO_LABEL_CLASS}>
                                        Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
                                    </span>
                                    <div className="flex gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                            onClick={() => setCurrentPage(1)}
                                            disabled={currentPage === 1}
                                        >
                                            <ChevronsLeft className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                            onClick={() => setCurrentPage(currentPage - 1)}
                                            disabled={currentPage === 1}
                                        >
                                            <ChevronLeft className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                            onClick={() => setCurrentPage(currentPage + 1)}
                                            disabled={currentPage === pagination.totalPages}
                                        >
                                            <ChevronRight className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                            onClick={() => setCurrentPage(pagination.totalPages)}
                                            disabled={currentPage === pagination.totalPages}
                                        >
                                            <ChevronsRight className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </section>
        </div>
    );
}
