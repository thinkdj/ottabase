import { api, isApiError } from '@/lib/api';
import type { PaginatedResponse } from '@/lib/api-types';
import { useApiQuery } from '@ottabase/ottaorm/client';
import type { ShortlinkRecord } from '@ottabase/shortlinks';
import { ConfirmDialog } from '@ottabase/ui-components';
import {
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
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
    BarChart3,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    Copy,
    Edit,
    Link2,
    Plus,
    Trash2,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { ShortlinkForm } from './components/ShortlinkForm';

type ShortlinksResponse = PaginatedResponse<ShortlinkRecord>;

export function ShortlinksPage() {
    const queryClient = useQueryClient();
    const [actionError, setActionError] = useState<string | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingShortlink, setEditingShortlink] = useState<ShortlinkRecord | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [deleteDialog, setDeleteDialog] = useState<string | null>(null);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [perPage, setPerPage] = useState(15);
    const {
        data: shortlinksResponse,
        error: queryError,
        isFetching: loading,
    } = useApiQuery<ShortlinksResponse>({
        entity: 'shortlinks',
        queryKey: ['list', currentPage, perPage],
        endpoint: `/api/shortlinks?page=${currentPage}&per_page=${perPage}`,
        queryOptions: {
            meta: { errorPresentation: 'local' },
        },
    });
    const shortlinks = shortlinksResponse?.data ?? [];
    const pagination = shortlinksResponse?.pagination ?? null;
    const error = actionError ?? queryError?.message ?? null;

    useEffect(() => {
        if (pagination && pagination.page !== currentPage) {
            setCurrentPage(pagination.page);
        }
    }, [currentPage, pagination]);

    const handleCreate = () => {
        setEditingShortlink(null);
        setIsDialogOpen(true);
    };

    const handleEdit = (shortlink: ShortlinkRecord) => {
        setEditingShortlink(shortlink);
        setIsDialogOpen(true);
    };

    const handleDelete = async (id: string) => {
        setDeleteDialog(id);
    };

    const handleConfirmDelete = async () => {
        if (!deleteDialog) return;

        const id = deleteDialog;
        try {
            setActionError(null);
            await api(`/api/shortlinks/${id}`, { method: 'DELETE' });
            await queryClient.invalidateQueries({ queryKey: ['shortlinks'] });
        } catch (err) {
            setActionError(isApiError(err) ? err.message : 'Failed to delete shortlink');
        } finally {
            setDeleteDialog(null);
        }
    };

    const handleSuccess = async () => {
        setIsDialogOpen(false);
        setEditingShortlink(null);
        setActionError(null);
        await queryClient.invalidateQueries({ queryKey: ['shortlinks'] });
    };

    const copyToClipboard = async (text: string, id: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedId(id);
            setTimeout(() => setCopiedId(null), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const getShortUrl = (shortCode: string) => {
        return `${window.location.origin}/${shortCode}`;
    };

    const getExplicitUrl = (shortCode: string) => {
        return `${window.location.origin}/shortlinks/go?code=${shortCode}`;
    };

    const formatDate = (dateString: string | Date | null) => {
        if (!dateString) return 'Never';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    };

    const isExpired = (expiryDate: string | Date | null) => {
        if (!expiryDate) return false;
        return new Date(expiryDate) < new Date();
    };

    // Pagination handlers
    const goToPage = (page: number) => {
        setActionError(null);
        setCurrentPage(page);
    };

    const goToFirstPage = () => {
        goToPage(1);
    };

    const goToLastPage = () => {
        if (pagination) {
            goToPage(pagination.totalPages);
        }
    };

    const goToPrevPage = () => {
        if (currentPage > 1) {
            goToPage(currentPage - 1);
        }
    };

    const goToNextPage = () => {
        if (pagination && currentPage < pagination.totalPages) {
            goToPage(currentPage + 1);
        }
    };

    const handlePerPageChange = (value: string) => {
        const newPerPage = parseInt(value, 10);
        setActionError(null);
        setPerPage(newPerPage);
        setCurrentPage(1); // Reset to first page when changing page size
    };

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                        <Link2 className="h-7 w-7 text-primary" />
                        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Shortlinks</h1>
                    </div>
                    <p className="text-muted-foreground">Create and manage short URLs for easy sharing</p>
                </div>
                <div className="flex shrink-0 gap-2">
                    <Button variant="outline" asChild>
                        <Link to="/analytics" search={{ tab: 'shortlinks' }}>
                            <BarChart3 className="mr-2 h-4 w-4" />
                            Click Analytics
                        </Link>
                    </Button>
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                            <Button onClick={handleCreate} size="lg">
                                <Plus className="mr-2 h-4 w-4" />
                                Create Link
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                            <DialogHeader>
                                <DialogTitle>{editingShortlink ? 'Edit Shortlink' : 'Create Shortlink'}</DialogTitle>
                                <DialogDescription>
                                    {editingShortlink
                                        ? 'Update your shortlink details'
                                        : 'Create a new shortlink to share with others'}
                                </DialogDescription>
                            </DialogHeader>
                            <ShortlinkForm
                                shortlink={editingShortlink}
                                onSuccess={handleSuccess}
                                onCancel={() => setIsDialogOpen(false)}
                            />
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Error Display */}
            {error && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                    {error}
                </div>
            )}

            {/* Stats */}
            <div className="grid gap-4 md:grid-cols-2">
                <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                            Total Links
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold tracking-tight">
                            {pagination?.total ?? shortlinks.length}
                        </div>
                    </CardContent>
                </Card>
                <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                            Active Links
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold tracking-tight">
                            {shortlinks.filter((link) => !isExpired(link.expiryDate)).length}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Shortlinks Table */}
            <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <CardTitle className="text-[0.9375rem] font-semibold">Your Links</CardTitle>
                            <CardDescription>Manage and track your shortlinks</CardDescription>
                        </div>
                        {pagination && (
                            <div className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                Showing {(pagination.page - 1) * pagination.perPage + 1} -{' '}
                                {Math.min(pagination.page * pagination.perPage, pagination.total)} of {pagination.total}
                            </div>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="space-y-2" aria-busy="true">
                            <span className="sr-only">Loading shortlinks...</span>
                            {Array.from({ length: 5 }, (_, i) => (
                                <div key={i} className="h-12 animate-pulse rounded-lg bg-muted/40" />
                            ))}
                        </div>
                    ) : shortlinks.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-3 rounded-xl bg-background py-12 ring-1 ring-border">
                            <Link2 className="h-10 w-10 text-muted-foreground/50" />
                            <p className="text-sm text-muted-foreground">No shortlinks yet</p>
                            <Button onClick={handleCreate} variant="outline" size="sm">
                                Create your first link
                            </Button>
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto rounded-xl bg-background ring-1 ring-border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                                Short Code
                                            </TableHead>
                                            <TableHead className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                                Destination
                                            </TableHead>
                                            <TableHead className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                                Link
                                            </TableHead>
                                            <TableHead className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                                Type
                                            </TableHead>
                                            <TableHead className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                                App
                                            </TableHead>
                                            <TableHead className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                                Expires
                                            </TableHead>
                                            <TableHead className="text-right text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                                Actions
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {shortlinks.map((link) => (
                                            <TableRow key={link.id}>
                                                {/* Short Code + Copy */}
                                                <TableCell className="font-mono">
                                                    <div className="flex items-center gap-1">
                                                        <span className="font-medium">{link.shortCode}</span>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-6 w-6 p-0"
                                                            title="Copy Short Code"
                                                            onClick={() =>
                                                                copyToClipboard(link.shortCode, `${link.id}-code`)
                                                            }
                                                        >
                                                            {copiedId === `${link.id}-code` ? (
                                                                <span className="text-xs text-success">✓</span>
                                                            ) : (
                                                                <Copy className="h-3 w-3" />
                                                            )}
                                                        </Button>
                                                    </div>
                                                </TableCell>

                                                {/* Destination URL + Copy */}
                                                <TableCell className="max-w-[200px]">
                                                    <div className="flex items-center gap-1">
                                                        <a
                                                            href={link.fullUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="truncate text-sm text-muted-foreground hover:text-foreground"
                                                            title={link.fullUrl}
                                                        >
                                                            {link.fullUrl}
                                                        </a>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-6 w-6 p-0 flex-shrink-0"
                                                            title="Copy Destination URL"
                                                            onClick={() =>
                                                                copyToClipboard(link.fullUrl, `${link.id}-dest`)
                                                            }
                                                        >
                                                            {copiedId === `${link.id}-dest` ? (
                                                                <span className="text-xs text-success">✓</span>
                                                            ) : (
                                                                <Copy className="h-3 w-3" />
                                                            )}
                                                        </Button>
                                                    </div>
                                                </TableCell>

                                                {/* Redirect Link + Copy */}
                                                <TableCell className="max-w-[180px]">
                                                    <div className="flex items-center gap-1">
                                                        <a
                                                            href={getExplicitUrl(link.shortCode)}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="truncate text-sm text-primary hover:underline"
                                                            title={getExplicitUrl(link.shortCode)}
                                                        >
                                                            {getExplicitUrl(link.shortCode)}
                                                        </a>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-6 w-6 p-0 flex-shrink-0"
                                                            title="Copy Redirect URL"
                                                            onClick={() =>
                                                                copyToClipboard(
                                                                    getExplicitUrl(link.shortCode),
                                                                    `${link.id}-link`,
                                                                )
                                                            }
                                                        >
                                                            {copiedId === `${link.id}-link` ? (
                                                                <span className="text-xs text-success">✓</span>
                                                            ) : (
                                                                <Copy className="h-3 w-3" />
                                                            )}
                                                        </Button>
                                                    </div>
                                                </TableCell>

                                                {/* Type - quiet chip */}
                                                <TableCell>
                                                    <span className="inline-flex items-center rounded-full bg-background px-2 py-0.5 text-[0.6875rem] font-medium capitalize text-muted-foreground ring-1 ring-border">
                                                        {link.type}
                                                    </span>
                                                </TableCell>

                                                {/* App - quiet chip */}
                                                <TableCell>
                                                    <span className="inline-flex items-center rounded-full bg-background px-2 py-0.5 text-[0.6875rem] font-medium text-muted-foreground ring-1 ring-border">
                                                        {link.appId || 'default'}
                                                    </span>
                                                </TableCell>

                                                {/* Expires */}
                                                <TableCell>
                                                    {isExpired(link.expiryDate) ? (
                                                        <span className="inline-flex items-center rounded-full bg-background px-2 py-0.5 text-[0.6875rem] font-medium uppercase tracking-wide text-destructive ring-1 ring-destructive/40">
                                                            Expired
                                                        </span>
                                                    ) : link.expiryDate ? (
                                                        <span className="text-sm text-muted-foreground">
                                                            {formatDate(link.expiryDate)}
                                                        </span>
                                                    ) : (
                                                        <span className="text-sm text-muted-foreground">Never</span>
                                                    )}
                                                </TableCell>

                                                {/* Actions */}
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-8 w-8 p-0"
                                                            onClick={() => handleEdit(link)}
                                                        >
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                                            onClick={() => handleDelete(link.id)}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Pagination Controls */}
                            {pagination && pagination.totalPages > 1 && (
                                <div className="mt-6 flex items-center justify-between border-t border-border/60 pt-4">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                            Items per page
                                        </span>
                                        <Select value={String(perPage)} onValueChange={handlePerPageChange}>
                                            <SelectTrigger className="w-20">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="5">5</SelectItem>
                                                <SelectItem value="10">10</SelectItem>
                                                <SelectItem value="15">15</SelectItem>
                                                <SelectItem value="25">25</SelectItem>
                                                <SelectItem value="50">50</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="flex items-center gap-1">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-8 w-8 p-0"
                                            onClick={goToFirstPage}
                                            disabled={currentPage === 1}
                                        >
                                            <ChevronsLeft className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-8 w-8 p-0"
                                            onClick={goToPrevPage}
                                            disabled={currentPage === 1}
                                        >
                                            <ChevronLeft className="h-4 w-4" />
                                        </Button>

                                        {/* Page numbers */}
                                        <div className="flex items-center gap-1 px-2">
                                            {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                                                const pageNum = Math.max(
                                                    1,
                                                    Math.min(currentPage - 2 + i, pagination.totalPages - 4 + i),
                                                );
                                                const adjustedPageNum = Math.max(
                                                    1,
                                                    Math.min(pageNum, pagination.totalPages),
                                                );
                                                return adjustedPageNum;
                                            })
                                                .filter((v, i, a) => a.indexOf(v) === i) // unique
                                                .slice(0, 5)
                                                .map((pageNum) => (
                                                    <Button
                                                        key={pageNum}
                                                        variant={pageNum === currentPage ? 'default' : 'outline'}
                                                        size="sm"
                                                        className="h-8 w-8 p-0"
                                                        onClick={() => pageNum !== currentPage && goToPage(pageNum)}
                                                        disabled={pageNum === currentPage}
                                                    >
                                                        {pageNum}
                                                    </Button>
                                                ))}
                                        </div>

                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-8 w-8 p-0"
                                            onClick={goToNextPage}
                                            disabled={currentPage >= pagination.totalPages}
                                        >
                                            <ChevronRight className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-8 w-8 p-0"
                                            onClick={goToLastPage}
                                            disabled={currentPage >= pagination.totalPages}
                                        >
                                            <ChevronsRight className="h-4 w-4" />
                                        </Button>
                                    </div>

                                    <div className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                        Page {currentPage} of {pagination.totalPages}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>

            <ConfirmDialog
                open={deleteDialog !== null}
                onOpenChange={(open) => !open && setDeleteDialog(null)}
                title="Delete Shortlink?"
                description="Are you sure you want to delete this shortlink?"
                tone="destructive"
                secondaryActionText="Cancel"
                primaryActionText="Delete"
                onConfirm={handleConfirmDelete}
            />
        </div>
    );
}
