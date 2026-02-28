import { api, isApiError } from '@/lib/api';
import type { PaginatedResponse, Pagination } from '@/lib/api-types';
import type { ShortlinkRecord } from '@ottabase/shortlinks';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    Badge,
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
import { useCallback, useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ShortlinkForm } from './components/ShortlinkForm';

type ShortlinksResponse = PaginatedResponse<ShortlinkRecord>;

export function ShortlinksPage() {
    const [shortlinks, setShortlinks] = useState<ShortlinkRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingShortlink, setEditingShortlink] = useState<ShortlinkRecord | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [deleteDialog, setDeleteDialog] = useState<string | null>(null);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [perPage, setPerPage] = useState(15);
    const [pagination, setPagination] = useState<Pagination | null>(null);

    const fetchShortlinks = useCallback(async (page: number = 1, itemsPerPage: number = 15) => {
        try {
            setLoading(true);
            setError(null);
            const response = await api<ShortlinksResponse>(
                `/api/ottaorm/shortlinks?page=${page}&per_page=${itemsPerPage}`,
                { method: 'GET', callerId: 'ShortlinksPage:fetchShortlinks' },
            );
            if (response.data) {
                setShortlinks(response.data);
                setPagination(response.pagination);
                setCurrentPage(response.pagination.page);
            }
        } catch (err) {
            setError(isApiError(err) ? err.message : 'Failed to load shortlinks');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchShortlinks(currentPage, perPage);
    }, [fetchShortlinks, currentPage, perPage]);

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
            await api(`/api/ottaorm/shortlinks/${id}`, { method: 'DELETE' });
            await fetchShortlinks(currentPage, perPage);
        } catch (err) {
            setError(isApiError(err) ? err.message : 'Failed to delete shortlink');
        } finally {
            setDeleteDialog(null);
        }
    };

    const handleSuccess = async () => {
        setIsDialogOpen(false);
        setEditingShortlink(null);
        await fetchShortlinks(currentPage, perPage);
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
        setPerPage(newPerPage);
        setCurrentPage(1); // Reset to first page when changing page size
    };

    return (
        <div className="mx-auto max-w-7xl space-y-8 px-4 py-12">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <Link2 className="h-8 w-8 text-primary" />
                        <h1 className="text-4xl font-semibold tracking-tight">Shortlinks</h1>
                    </div>
                    <p className="text-muted-foreground">Create and manage short URLs for easy sharing</p>
                </div>
                <div className="flex gap-2">
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
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
                    <p className="text-sm text-destructive">{error}</p>
                </div>
            )}

            {/* Stats */}
            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Total Links</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{pagination?.total ?? shortlinks.length}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Active Links</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {shortlinks.filter((link) => !isExpired(link.expiryDate)).length}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Shortlinks Table */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Your Links</CardTitle>
                            <CardDescription>Manage and track your shortlinks</CardDescription>
                        </div>
                        {pagination && (
                            <div className="text-sm text-muted-foreground">
                                Showing {(pagination.page - 1) * pagination.perPage + 1} -{' '}
                                {Math.min(pagination.page * pagination.perPage, pagination.total)} of {pagination.total}
                            </div>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex h-32 items-center justify-center">
                            <p className="text-muted-foreground">Loading...</p>
                        </div>
                    ) : shortlinks.length === 0 ? (
                        <div className="flex h-32 flex-col items-center justify-center gap-2">
                            <Link2 className="h-12 w-12 text-muted-foreground/50" />
                            <p className="text-muted-foreground">No shortlinks yet</p>
                            <Button onClick={handleCreate} variant="outline" size="sm">
                                Create your first link
                            </Button>
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Short Code</TableHead>
                                            <TableHead>Destination</TableHead>
                                            <TableHead>Link</TableHead>
                                            <TableHead>Type</TableHead>
                                            <TableHead>App</TableHead>
                                            <TableHead>Expires</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
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
                                                                <span className="text-xs text-green-600">✓</span>
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
                                                                <span className="text-xs text-green-600">✓</span>
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
                                                                <span className="text-xs text-green-600">✓</span>
                                                            ) : (
                                                                <Copy className="h-3 w-3" />
                                                            )}
                                                        </Button>
                                                    </div>
                                                </TableCell>

                                                {/* Type - simple text */}
                                                <TableCell className="text-sm text-muted-foreground capitalize">
                                                    {link.type}
                                                </TableCell>

                                                {/* App - simple text */}
                                                <TableCell className="text-sm text-muted-foreground">
                                                    {link.appId || 'default'}
                                                </TableCell>

                                                {/* Expires */}
                                                <TableCell>
                                                    {isExpired(link.expiryDate) ? (
                                                        <Badge variant="destructive">Expired</Badge>
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
                                <div className="mt-6 flex items-center justify-between border-t pt-4">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-muted-foreground">Items per page:</span>
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

                                    <div className="text-sm text-muted-foreground">
                                        Page {currentPage} of {pagination.totalPages}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>

            <AlertDialog open={deleteDialog !== null} onOpenChange={(open) => !open && setDeleteDialog(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Shortlink?</AlertDialogTitle>
                        <AlertDialogDescription>Are you sure you want to delete this shortlink?</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmDelete}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
