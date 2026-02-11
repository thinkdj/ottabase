import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
    DialogTrigger,
    Input,
    Label,
} from '@ottabase/ui-shadcn';
import { IconCheck, IconCopy, IconEdit, IconPlus, IconTrash } from '@tabler/icons-react';
import { toast } from 'sonner';
import type { BrandPresetItem } from '@ottabase/brand-engine';
import { useBrand } from '@ottabase/brand-engine-react';
import { presetApi } from './brandApi';

export function BrandPresetManagerTab() {
    const queryClient = useQueryClient();
    const { refresh } = useBrand();

    const { data: presets = [], isLoading } = useQuery<BrandPresetItem[]>({
        queryKey: ['brand', 'presets'],
        queryFn: () => presetApi.list() as Promise<BrandPresetItem[]>,
    });

    const applyMutation = useMutation({
        mutationFn: (id: string) => presetApi.apply(id),
        onSuccess: () => {
            toast.success('Preset applied');
            queryClient.invalidateQueries({ queryKey: ['brand'] });
            refresh();
        },
        onError: () => toast.error('Failed to apply'),
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => presetApi.delete(id),
        onSuccess: () => {
            toast.success('Preset deleted');
            queryClient.invalidateQueries({ queryKey: ['brand'] });
            refresh();
        },
        onError: () => toast.error('Failed to delete'),
    });

    const duplicateMutation = useMutation({
        mutationFn: ({ id, name }: { id: string; name?: string }) => presetApi.duplicate(id, name),
        onSuccess: () => {
            toast.success('Preset duplicated');
            queryClient.invalidateQueries({ queryKey: ['brand'] });
        },
        onError: () => toast.error('Failed to duplicate'),
    });

    const createMutation = useMutation({
        mutationFn: (body: { name: string }) => presetApi.create({ name: body.name, snapshotFromCurrent: true }),
        onSuccess: () => {
            toast.success('Preset created');
            queryClient.invalidateQueries({ queryKey: ['brand'] });
        },
        onError: () => toast.error('Failed to create'),
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, name }: { id: string; name: string }) => presetApi.update(id, { name }),
        onSuccess: () => {
            toast.success('Preset updated');
            queryClient.invalidateQueries({ queryKey: ['brand'] });
        },
        onError: () => toast.error('Failed to update'),
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <p className="text-muted-foreground">Loading presets...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Presets</CardTitle>
                    <CardDescription>
                        One-click presets: layout + theme + logos. Apply to instantly change the site look.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <CreatePresetDialog
                            onCreate={(name) => createMutation.mutateAsync({ name })}
                            loading={createMutation.isPending}
                        />
                        {presets.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-8 text-center">
                                No presets yet. Create one to get started.
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {presets.map((preset) => (
                                    <div
                                        key={preset.id}
                                        className="flex items-center justify-between rounded-lg border p-4"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium">{preset.name}</span>
                                            {preset.isActive && (
                                                <Badge variant="default" className="text-xs">
                                                    <IconCheck className="h-3 w-3 mr-1" />
                                                    Active
                                                </Badge>
                                            )}
                                        </div>
                                        <div className="flex gap-2">
                                            {!preset.isActive && (
                                                <Button
                                                    size="sm"
                                                    onClick={() => applyMutation.mutate(preset.id)}
                                                    disabled={applyMutation.isPending}
                                                >
                                                    Apply
                                                </Button>
                                            )}
                                            <EditPresetDialog
                                                preset={preset}
                                                onSave={(name) => updateMutation.mutateAsync({ id: preset.id, name })}
                                                loading={updateMutation.isPending}
                                            />
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => duplicateMutation.mutate({ id: preset.id })}
                                                disabled={duplicateMutation.isPending}
                                            >
                                                <IconCopy className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="destructive"
                                                onClick={() => {
                                                    if (confirm('Delete this preset?'))
                                                        deleteMutation.mutate(preset.id);
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

function EditPresetDialog({
    preset,
    onSave,
    loading,
}: {
    preset: { id: string; name: string };
    onSave: (name: string) => Promise<unknown>;
    loading: boolean;
}) {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState(preset.name);

    useEffect(() => {
        setName(preset.name);
    }, [preset.name, open]);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                    <IconEdit className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit Preset</DialogTitle>
                    <DialogDescription>Change the display name.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div>
                        <Label htmlFor="editPresetName">Name</Label>
                        <Input
                            id="editPresetName"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Christmas 2024"
                        />
                    </div>
                    <Button
                        onClick={async () => {
                            if (!name.trim()) return;
                            await onSave(name.trim());
                            setOpen(false);
                        }}
                        disabled={loading || !name.trim()}
                    >
                        {loading ? 'Saving...' : 'Save'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function CreatePresetDialog({ onCreate, loading }: { onCreate: (name: string) => Promise<unknown>; loading: boolean }) {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState('');

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <IconPlus className="h-4 w-4 mr-2" />
                    New Preset
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create Preset</DialogTitle>
                    <DialogDescription>
                        Saves the current brand (identity, logos, tokens, layouts) as a one-click preset.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div>
                        <Label htmlFor="presetName">Name</Label>
                        <Input
                            id="presetName"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Christmas 2024"
                        />
                    </div>
                    <Button
                        onClick={async () => {
                            if (!name.trim()) return;
                            await onCreate(name.trim());
                            setName('');
                            setOpen(false);
                        }}
                        disabled={loading || !name.trim()}
                    >
                        {loading ? 'Creating...' : 'Create'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
