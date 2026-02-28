import { api, isApiError } from '@/lib/api';
import type { Pagination } from '@/lib/api-types';
import type { RecraftSetRecord } from '@ottabase/recraft';
import {
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
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@ottabase/ui-shadcn';
import { FolderPlus, Image, Palette, Plus, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { SetForm } from './components/SetForm';

interface SetsResponse {
    data: RecraftSetRecord[];
    pagination: Pagination;
}

export function RecraftSetsPage() {
    const [sets, setSets] = useState<RecraftSetRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [deleteDialog, setDeleteDialog] = useState<string | null>(null);

    const fetchSets = useCallback(async () => {
        try {
            setLoading(true);
            const response = await api<SetsResponse>('/api/recraft/sets?per_page=50', {
                method: 'GET',
                callerId: 'RecraftSetsPage:fetchSets',
            });
            if (response.data) {
                setSets(response.data);
            }
        } catch (err) {
            if (isApiError(err)) console.error('Failed to load sets:', err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSets();
    }, [fetchSets]);

    const handleDelete = async (id: string) => {
        try {
            await api(`/api/recraft/sets/${id}`, { method: 'DELETE' });
            setDeleteDialog(null);
            fetchSets();
        } catch (err) {
            if (isApiError(err)) console.error('Delete failed:', err.message);
        }
    };

    return (
        <div className="container mx-auto px-4 py-8 max-w-6xl">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Brand Studio</h1>
                    <p className="text-muted-foreground mt-1">
                        AI-powered brand assets — logos, illustrations, and graphics with consistent style
                    </p>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <Button onClick={() => setIsDialogOpen(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        New Set
                    </Button>
                    <DialogContent className="sm:max-w-[500px]">
                        <DialogHeader>
                            <DialogTitle>Create Asset Set</DialogTitle>
                            <DialogDescription>
                                A set groups brand assets with a consistent art style. Choose a preset or customize.
                            </DialogDescription>
                        </DialogHeader>
                        <SetForm
                            onSuccess={() => {
                                setIsDialogOpen(false);
                                fetchSets();
                            }}
                            onCancel={() => setIsDialogOpen(false)}
                        />
                    </DialogContent>
                </Dialog>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Sets</CardTitle>
                        <FolderPlus className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{sets.length}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Generations</CardTitle>
                        <Image className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {sets.reduce((sum, s) => sum + (s.generationCount || 0), 0)}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Style Presets</CardTitle>
                        <Palette className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">20+</div>
                    </CardContent>
                </Card>
            </div>

            {/* Sets Grid */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map((i) => (
                        <Card key={i} className="animate-pulse">
                            <div className="h-40 bg-muted rounded-t-lg" />
                            <CardHeader>
                                <div className="h-5 bg-muted rounded w-3/4" />
                                <div className="h-4 bg-muted rounded w-1/2 mt-2" />
                            </CardHeader>
                        </Card>
                    ))}
                </div>
            ) : sets.length === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-16">
                        <Palette className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold mb-2">No asset sets yet</h3>
                        <p className="text-muted-foreground text-center mb-4 max-w-sm">
                            Create your first set to start generating logos, illustrations, and brand assets
                            with AI-powered style consistency.
                        </p>
                        <Button onClick={() => setIsDialogOpen(true)}>
                            <Plus className="w-4 h-4 mr-2" />
                            Create First Set
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {sets.map((set) => (
                        <Link
                            key={set.id}
                            to={`/recraft/${set.id}`}
                            className="block group"
                        >
                            <Card className="overflow-hidden transition-shadow hover:shadow-lg cursor-pointer h-full">
                                {/* Cover Image or Placeholder */}
                                <div className="h-40 bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center relative">
                                    {set.coverImageKey ? (
                                        <img
                                            src={`/api/upload/file/${set.coverImageKey}`}
                                            alt={set.name}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <Palette className="h-16 w-16 text-primary/20" />
                                    )}
                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setDeleteDialog(set.id);
                                            }}
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </div>

                                <CardHeader>
                                    <CardTitle className="text-lg group-hover:text-primary transition-colors">
                                        {set.name}
                                    </CardTitle>
                                    {set.description && (
                                        <CardDescription className="line-clamp-2">
                                            {set.description}
                                        </CardDescription>
                                    )}
                                    <div className="flex items-center gap-2 mt-2">
                                        <Badge variant="secondary">
                                            {set.generationCount || 0} images
                                        </Badge>
                                    </div>
                                </CardHeader>
                            </Card>
                        </Link>
                    ))}
                </div>
            )}

            {/* Delete Dialog */}
            <AlertDialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete this set?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete the set and all its generated images.
                            This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => deleteDialog && handleDelete(deleteDialog)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
