import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
    Input,
    Label,
} from '@ottabase/ui-shadcn';
import { IconEdit, IconPlus, IconTrash } from '@tabler/icons-react';
import { toast } from 'sonner';
import { useBrand } from '@ottabase/brand-engine-react';
import { themeVariantApi } from './brandApi';

export function ThemeVariantEditorTab() {
    const queryClient = useQueryClient();
    const { refresh } = useBrand();

    const { data: variants = [], isLoading } = useQuery({
        queryKey: ['brand', 'themes'],
        queryFn: () => themeVariantApi.list(),
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => themeVariantApi.delete(id),
        onSuccess: () => {
            toast.success('Theme variant deleted');
            queryClient.invalidateQueries({ queryKey: ['brand', 'themes'] });
            refresh();
        },
        onError: () => toast.error('Failed to delete'),
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <p className="text-muted-foreground">Loading theme variants...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Theme variants</CardTitle>
                    <CardDescription>
                        Seasonal or A/B themes with custom tokens. Use in BrandBoxes or apply directly.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <CreateVariantDialog />
                        {(variants as ThemeVariant[]).length === 0 ? (
                            <p className="text-sm text-muted-foreground py-8 text-center">
                                No theme variants. Create one to customize colors and typography.
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {(variants as ThemeVariant[]).map((v) => (
                                    <div key={v.id} className="flex items-center justify-between rounded-lg border p-4">
                                        <div>
                                            <span className="font-medium">{v.name}</span>
                                            {v.description && (
                                                <p className="text-xs text-muted-foreground mt-1">{v.description}</p>
                                            )}
                                        </div>
                                        <div className="flex gap-2">
                                            <EditVariantDialog variant={v} />
                                            <Button
                                                size="sm"
                                                variant="destructive"
                                                onClick={() => {
                                                    if (confirm(`Delete "${v.name}"?`)) deleteMutation.mutate(v.id);
                                                }}
                                                disabled={deleteMutation.isPending}
                                            >
                                                <IconTrash className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

function EditVariantDialog({ variant }: { variant: ThemeVariant }) {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState(variant.name);
    const [description, setDescription] = useState(variant.description ?? '');
    const [tokensJson, setTokensJson] = useState(variant.tokensJson ?? '{}');
    const queryClient = useQueryClient();
    const { refresh } = useBrand();

    useEffect(() => {
        if (open) {
            setName(variant.name);
            setDescription(variant.description ?? '');
            setTokensJson(variant.tokensJson ?? '{}');
        }
    }, [open, variant]);

    const updateMutation = useMutation({
        mutationFn: (body: { name: string; description?: string; tokensJson: string }) =>
            themeVariantApi.update(variant.id, body),
        onSuccess: () => {
            toast.success('Theme variant updated');
            queryClient.invalidateQueries({ queryKey: ['brand', 'themes'] });
            refresh();
            setOpen(false);
        },
        onError: () => toast.error('Failed to update'),
    });

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                    <IconEdit className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Edit theme variant</DialogTitle>
                    <DialogDescription>Update name, description, or tokens.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div>
                        <Label htmlFor="editVariantName">Name</Label>
                        <Input
                            id="editVariantName"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Holiday 2024"
                        />
                    </div>
                    <div>
                        <Label htmlFor="editVariantDesc">Description (optional)</Label>
                        <Input
                            id="editVariantDesc"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Brief description"
                        />
                    </div>
                    <div>
                        <Label htmlFor="editTokensJson">Tokens JSON</Label>
                        <textarea
                            id="editTokensJson"
                            className="mt-1 w-full min-h-[120px] rounded-md border bg-background px-3 py-2 font-mono text-sm"
                            value={tokensJson}
                            onChange={(e) => setTokensJson(e.target.value)}
                            placeholder='{"color":{"light":{"primary":"221.2 83.2% 53.3%"}}}'
                            spellCheck={false}
                        />
                    </div>
                    <Button
                        onClick={() => {
                            if (!name.trim()) return;
                            try {
                                JSON.parse(tokensJson);
                            } catch {
                                toast.error('Invalid JSON');
                                return;
                            }
                            updateMutation.mutate({
                                name: name.trim(),
                                description: description.trim() || undefined,
                                tokensJson,
                            });
                        }}
                        disabled={updateMutation.isPending || !name.trim()}
                    >
                        {updateMutation.isPending ? 'Saving...' : 'Save'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

interface ThemeVariant {
    id: string;
    name: string;
    slug?: string | null;
    tokensJson?: string | null;
    description?: string | null;
    activeFrom?: number | null;
    activeUntil?: number | null;
}

function CreateVariantDialog() {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [tokensJson, setTokensJson] = useState('{}');
    const queryClient = useQueryClient();
    const { refresh } = useBrand();

    const createMutation = useMutation({
        mutationFn: (body: { name: string; tokensJson: string; description?: string }) => themeVariantApi.create(body),
        onSuccess: () => {
            toast.success('Theme variant created');
            queryClient.invalidateQueries({ queryKey: ['brand', 'themes'] });
            refresh();
            setName('');
            setDescription('');
            setTokensJson('{}');
            setOpen(false);
        },
        onError: () => toast.error('Failed to create'),
    });

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <IconPlus className="h-4 w-4 mr-2" />
                    New theme variant
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Create theme variant</DialogTitle>
                    <DialogDescription>
                        Define custom design tokens (colors, typography). Use valid JSON.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div>
                        <Label htmlFor="variantName">Name</Label>
                        <Input
                            id="variantName"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Holiday 2024"
                        />
                    </div>
                    <div>
                        <Label htmlFor="variantDesc">Description (optional)</Label>
                        <Input
                            id="variantDesc"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Brief description"
                        />
                    </div>
                    <div>
                        <Label htmlFor="tokensJson">Tokens JSON</Label>
                        <textarea
                            id="tokensJson"
                            className="mt-1 w-full min-h-[120px] rounded-md border bg-background px-3 py-2 font-mono text-sm"
                            value={tokensJson}
                            onChange={(e) => setTokensJson(e.target.value)}
                            placeholder='{"color":{"light":{"primary":"221.2 83.2% 53.3%"}}}'
                            spellCheck={false}
                        />
                    </div>
                    <Button
                        onClick={() => {
                            if (!name.trim()) return;
                            try {
                                JSON.parse(tokensJson);
                            } catch {
                                toast.error('Invalid JSON');
                                return;
                            }
                            createMutation.mutate({
                                name: name.trim(),
                                tokensJson,
                                description: description.trim() || undefined,
                            });
                        }}
                        disabled={createMutation.isPending || !name.trim()}
                    >
                        {createMutation.isPending ? 'Creating...' : 'Create'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
