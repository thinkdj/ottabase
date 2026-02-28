import { api, isApiError } from '@/lib/api';
import type { Pagination } from '@/lib/api-types';
import { ASSET_TYPES, IMAGE_DIMENSIONS, type AssetType, type ImageDimensionKey } from '@ottabase/recraft';
import type { RecraftGenerationRecord, RecraftSetRecord, RecraftStylePresetRecord } from '@ottabase/recraft';
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
    Input,
    Label,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Textarea,
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@ottabase/ui-shadcn';
import {
    ArrowLeft,
    Download,
    Heart,
    HeartOff,
    Image,
    Loader2,
    Settings,
    Sparkles,
    Trash2,
    Wand2,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from '@tanstack/react-router';
import { SetForm } from './components/SetForm';

interface SetDetailResponse extends RecraftSetRecord {
    preset: RecraftStylePresetRecord | null;
    resolvedStyle: {
        promptSuffix: string;
        negativePrompt?: string;
        guidanceScale?: number;
        steps?: number;
        preferredModel?: string;
    };
}

interface GenerationsResponse {
    data: (RecraftGenerationRecord & { imageUrl?: string; thumbnailUrl?: string })[];
    pagination: Pagination;
}

interface GenerateResponse {
    success: boolean;
    generationId: string;
    status: string;
    imageUrl?: string;
    metadata?: Record<string, unknown>;
    error?: string;
}

export function RecraftSetDetailPage() {
    const { setId } = useParams({ strict: false }) as { setId: string };

    const [set, setSet] = useState<SetDetailResponse | null>(null);
    const [generations, setGenerations] = useState<GenerationsResponse['data']>([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [deleteDialog, setDeleteDialog] = useState<string | null>(null);

    // Generation form state
    const [prompt, setPrompt] = useState('');
    const [negativePrompt, setNegativePrompt] = useState('');
    const [assetType, setAssetType] = useState<AssetType>('logo');
    const [dimensionKey, setDimensionKey] = useState<ImageDimensionKey>('logo-square');
    const [showAdvanced, setShowAdvanced] = useState(false);

    // Filter state
    const [filterType, setFilterType] = useState<string>('all');
    const [favoritesOnly, setFavoritesOnly] = useState(false);

    const fetchSet = useCallback(async () => {
        if (!setId) return;
        try {
            const res = await api<SetDetailResponse>(`/api/recraft/sets/${setId}`, {
                method: 'GET',
                callerId: 'RecraftSetDetail:fetchSet',
            });
            setSet(res);
        } catch (err) {
            console.error('Failed to load set:', err);
        }
    }, [setId]);

    const fetchGenerations = useCallback(async () => {
        if (!setId) return;
        try {
            let url = `/api/recraft/sets/${setId}/generations?per_page=50`;
            if (filterType !== 'all') url += `&assetType=${filterType}`;
            if (favoritesOnly) url += `&favorites=true`;

            const res = await api<GenerationsResponse>(url, {
                method: 'GET',
                callerId: 'RecraftSetDetail:fetchGenerations',
            });
            if (res.data) setGenerations(res.data);
        } catch (err) {
            console.error('Failed to load generations:', err);
        }
    }, [setId, filterType, favoritesOnly]);

    useEffect(() => {
        Promise.all([fetchSet(), fetchGenerations()]).finally(() => setLoading(false));
    }, [fetchSet, fetchGenerations]);

    const handleGenerate = async () => {
        if (!prompt.trim() || !setId) return;

        setGenerating(true);
        try {
            const dims = IMAGE_DIMENSIONS[dimensionKey];
            const res = await api<GenerateResponse>(`/api/recraft/sets/${setId}/generate`, {
                method: 'POST',
                body: {
                    prompt: prompt.trim(),
                    negativePrompt: negativePrompt.trim() || undefined,
                    assetType,
                    width: dims.width,
                    height: dims.height,
                },
            });

            if (res.success) {
                setPrompt('');
                // Refresh data
                await Promise.all([fetchSet(), fetchGenerations()]);
            }
        } catch (err) {
            if (isApiError(err)) console.error('Generation failed:', err.message);
        } finally {
            setGenerating(false);
        }
    };

    const handleToggleFavorite = async (genId: string) => {
        try {
            await api(`/api/recraft/generations/${genId}/favorite`, { method: 'PATCH' });
            fetchGenerations();
        } catch (err) {
            console.error('Toggle favorite failed:', err);
        }
    };

    const handleDeleteGeneration = async (genId: string) => {
        try {
            await api(`/api/recraft/generations/${genId}`, { method: 'DELETE' });
            setDeleteDialog(null);
            fetchGenerations();
            fetchSet();
        } catch (err) {
            console.error('Delete generation failed:', err);
        }
    };

    if (loading) {
        return (
            <div className="container mx-auto px-4 py-8 max-w-6xl">
                <div className="animate-pulse space-y-4">
                    <div className="h-8 bg-muted rounded w-1/3" />
                    <div className="h-4 bg-muted rounded w-1/2" />
                    <div className="h-40 bg-muted rounded" />
                </div>
            </div>
        );
    }

    if (!set) {
        return (
            <div className="container mx-auto px-4 py-8 max-w-6xl text-center">
                <h2 className="text-xl font-semibold">Set not found</h2>
                <Link to="/recraft">
                    <Button variant="outline" className="mt-4">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Sets
                    </Button>
                </Link>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8 max-w-7xl">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <Link to="/recraft">
                    <Button variant="ghost" size="sm">
                        <ArrowLeft className="w-4 h-4 mr-1" />
                        Back
                    </Button>
                </Link>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold tracking-tight">{set.name}</h1>
                    {set.description && <p className="text-muted-foreground">{set.description}</p>}
                </div>
                <div className="flex items-center gap-2">
                    {set.preset && <Badge variant="secondary">{set.preset.name}</Badge>}
                    <Badge variant="outline">{set.generationCount || 0} images</Badge>
                    <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                        <Settings className="w-4 h-4 mr-1" />
                        Settings
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left: Generation Panel */}
                <div className="lg:col-span-1 space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Wand2 className="w-5 h-5" />
                                Generate
                            </CardTitle>
                            <CardDescription>
                                Describe what you want to create. The set's style will be applied automatically.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="prompt">Prompt *</Label>
                                <Textarea
                                    id="prompt"
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    placeholder="A minimalist coffee shop logo with a steaming cup..."
                                    rows={3}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                            e.preventDefault();
                                            handleGenerate();
                                        }
                                    }}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <Label>Asset Type</Label>
                                    <Select value={assetType} onValueChange={(v) => setAssetType(v as AssetType)}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Object.entries(ASSET_TYPES).map(([value, label]) => (
                                                <SelectItem key={value} value={value}>
                                                    {label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label>Dimensions</Label>
                                    <Select
                                        value={dimensionKey}
                                        onValueChange={(v) => setDimensionKey(v as ImageDimensionKey)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Object.entries(IMAGE_DIMENSIONS).map(([key, dim]) => (
                                                <SelectItem key={key} value={key}>
                                                    {dim.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Advanced Options */}
                            <button
                                type="button"
                                onClick={() => setShowAdvanced(!showAdvanced)}
                                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                            >
                                {showAdvanced ? 'Hide' : 'Show'} advanced options
                            </button>

                            {showAdvanced && (
                                <div className="space-y-3 border-t pt-3">
                                    <div className="space-y-2">
                                        <Label htmlFor="neg-prompt">Negative Prompt</Label>
                                        <Input
                                            id="neg-prompt"
                                            value={negativePrompt}
                                            onChange={(e) => setNegativePrompt(e.target.value)}
                                            placeholder="blurry, low quality, text..."
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            What to avoid in the generated image.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Style Info */}
                            {set.resolvedStyle?.promptSuffix && (
                                <div className="bg-muted/50 rounded-lg p-3 text-xs">
                                    <span className="font-medium">Style applied:</span>{' '}
                                    <span className="text-muted-foreground">
                                        {set.resolvedStyle.promptSuffix.slice(0, 100)}
                                        {set.resolvedStyle.promptSuffix.length > 100 ? '...' : ''}
                                    </span>
                                </div>
                            )}

                            <Button
                                className="w-full"
                                onClick={handleGenerate}
                                disabled={generating || !prompt.trim()}
                            >
                                {generating ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Generating...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-4 h-4 mr-2" />
                                        Generate Image
                                    </>
                                )}
                            </Button>
                            <p className="text-xs text-center text-muted-foreground">
                                Cmd+Enter to generate
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Right: Gallery */}
                <div className="lg:col-span-2">
                    {/* Filters */}
                    <div className="flex items-center gap-3 mb-4">
                        <Select value={filterType} onValueChange={setFilterType}>
                            <SelectTrigger className="w-[150px]">
                                <SelectValue placeholder="All types" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Types</SelectItem>
                                {Object.entries(ASSET_TYPES).map(([value, label]) => (
                                    <SelectItem key={value} value={value}>
                                        {label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Button
                            variant={favoritesOnly ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setFavoritesOnly(!favoritesOnly)}
                        >
                            <Heart className={`w-4 h-4 mr-1 ${favoritesOnly ? 'fill-current' : ''}`} />
                            Favorites
                        </Button>

                        <span className="text-sm text-muted-foreground ml-auto">
                            {generations.length} images
                        </span>
                    </div>

                    {/* Image Grid */}
                    {generations.length === 0 ? (
                        <Card className="border-dashed">
                            <CardContent className="flex flex-col items-center justify-center py-16">
                                <Image className="h-12 w-12 text-muted-foreground mb-4" />
                                <h3 className="text-lg font-semibold mb-2">No images yet</h3>
                                <p className="text-muted-foreground text-center max-w-sm">
                                    Write a prompt and hit Generate to create your first brand asset.
                                </p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {generations.map((gen) => (
                                <div
                                    key={gen.id}
                                    className="group relative rounded-lg overflow-hidden border bg-card"
                                >
                                    {gen.status === 'completed' && gen.imageUrl ? (
                                        <img
                                            src={gen.imageUrl}
                                            alt={gen.prompt}
                                            className="w-full aspect-square object-cover"
                                            loading="lazy"
                                        />
                                    ) : gen.status === 'processing' ? (
                                        <div className="w-full aspect-square flex items-center justify-center bg-muted">
                                            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                                        </div>
                                    ) : (
                                        <div className="w-full aspect-square flex items-center justify-center bg-destructive/10">
                                            <span className="text-xs text-destructive px-2 text-center">
                                                {gen.errorMessage || 'Failed'}
                                            </span>
                                        </div>
                                    )}

                                    {/* Hover Overlay */}
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-3">
                                        <div className="flex justify-end gap-1">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0 text-white hover:text-white hover:bg-white/20"
                                                onClick={() => handleToggleFavorite(gen.id)}
                                            >
                                                {gen.isFavorite ? (
                                                    <Heart className="h-4 w-4 fill-red-500 text-red-500" />
                                                ) : (
                                                    <HeartOff className="h-4 w-4" />
                                                )}
                                            </Button>
                                            {gen.imageUrl && (
                                                <a href={gen.imageUrl} download target="_blank" rel="noopener noreferrer">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-8 w-8 p-0 text-white hover:text-white hover:bg-white/20"
                                                    >
                                                        <Download className="h-4 w-4" />
                                                    </Button>
                                                </a>
                                            )}
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0 text-white hover:text-red-400 hover:bg-white/20"
                                                onClick={() => setDeleteDialog(gen.id)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                        <div>
                                            <p className="text-white text-xs line-clamp-2">{gen.prompt}</p>
                                            <div className="flex items-center gap-1 mt-1">
                                                <Badge variant="secondary" className="text-[10px] px-1 py-0">
                                                    {gen.assetType}
                                                </Badge>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Edit Set Dialog */}
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Edit Set</DialogTitle>
                        <DialogDescription>Update the set's name, description, or style.</DialogDescription>
                    </DialogHeader>
                    <SetForm
                        initialData={{
                            id: set.id,
                            name: set.name,
                            description: set.description ?? undefined,
                            stylePresetId: set.stylePresetId ?? undefined,
                        }}
                        onSuccess={() => {
                            setEditOpen(false);
                            fetchSet();
                        }}
                        onCancel={() => setEditOpen(false)}
                    />
                </DialogContent>
            </Dialog>

            {/* Delete Generation Dialog */}
            <AlertDialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete this image?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete the generated image. This cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => deleteDialog && handleDeleteGeneration(deleteDialog)}
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
