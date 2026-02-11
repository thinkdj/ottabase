import { useState } from 'react';
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
import { IconCheck, IconCopy, IconPlus, IconTrash } from '@tabler/icons-react';
import { toast } from 'sonner';
import { useBrand } from '@ottabase/brand-engine-react';
import { brandboxApi } from './brandApi';

export function BrandBoxManagerTab() {
    const queryClient = useQueryClient();
    const { config, refresh } = useBrand();

    const { data: boxes = [], isLoading } = useQuery({
        queryKey: ['brandbox', 'list'],
        queryFn: () => brandboxApi.list(),
    });

    const applyMutation = useMutation({
        mutationFn: (id: string) => brandboxApi.apply(id),
        onSuccess: () => {
            toast.success('BrandBox applied');
            queryClient.invalidateQueries({ queryKey: ['brandbox'] });
            refresh();
        },
        onError: () => toast.error('Failed to apply'),
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => brandboxApi.delete(id),
        onSuccess: () => {
            toast.success('BrandBox deleted');
            queryClient.invalidateQueries({ queryKey: ['brandbox'] });
            refresh();
        },
        onError: () => toast.error('Failed to delete'),
    });

    const duplicateMutation = useMutation({
        mutationFn: ({ id, name }: { id: string; name?: string }) => brandboxApi.duplicate(id, name),
        onSuccess: () => {
            toast.success('BrandBox duplicated');
            queryClient.invalidateQueries({ queryKey: ['brandbox'] });
        },
        onError: () => toast.error('Failed to duplicate'),
    });

    const createMutation = useMutation({
        mutationFn: (body: { name: string; routeMappingsJson?: string }) =>
            brandboxApi.create({ name: body.name, routeMappingsJson: body.routeMappingsJson ?? '[]' }),
        onSuccess: () => {
            toast.success('BrandBox created');
            queryClient.invalidateQueries({ queryKey: ['brandbox'] });
        },
        onError: () => toast.error('Failed to create'),
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <p className="text-muted-foreground">Loading BrandBoxes...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>BrandBoxes</CardTitle>
                    <CardDescription>
                        One-click presets: layout + theme + logos. Apply to instantly change the site look.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <CreateBoxDialog
                            onCreate={(name) => createMutation.mutateAsync({ name })}
                            loading={createMutation.isPending}
                        />
                        {boxes.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-8 text-center">
                                No BrandBoxes yet. Create one to get started.
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {(boxes as Array<{ id: string; name: string; isActive?: boolean }>).map((box) => (
                                    <div
                                        key={box.id}
                                        className="flex items-center justify-between rounded-lg border p-4"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium">{box.name}</span>
                                            {box.isActive && (
                                                <Badge variant="default" className="text-xs">
                                                    <IconCheck className="h-3 w-3 mr-1" />
                                                    Active
                                                </Badge>
                                            )}
                                        </div>
                                        <div className="flex gap-2">
                                            {!box.isActive && (
                                                <Button
                                                    size="sm"
                                                    onClick={() => applyMutation.mutate(box.id)}
                                                    disabled={applyMutation.isPending}
                                                >
                                                    Apply
                                                </Button>
                                            )}
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => duplicateMutation.mutate({ id: box.id })}
                                                disabled={duplicateMutation.isPending}
                                            >
                                                <IconCopy className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="destructive"
                                                onClick={() => {
                                                    if (confirm('Delete this BrandBox?')) deleteMutation.mutate(box.id);
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

function CreateBoxDialog({ onCreate, loading }: { onCreate: (name: string) => Promise<unknown>; loading: boolean }) {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState('');

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <IconPlus className="h-4 w-4 mr-2" />
                    New BrandBox
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create BrandBox</DialogTitle>
                    <DialogDescription>Save the current brand look as a one-click preset.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div>
                        <Label htmlFor="boxName">Name</Label>
                        <Input
                            id="boxName"
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
