import { api, isApiError } from '@/lib/api';
import type { RecraftStylePresetRecord } from '@ottabase/recraft';
import { Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@ottabase/ui-shadcn';
import { useEffect, useState } from 'react';

interface SetFormProps {
    onSuccess: () => void;
    onCancel: () => void;
    initialData?: {
        id?: string;
        name?: string;
        description?: string;
        stylePresetId?: string;
    };
}

export function SetForm({ onSuccess, onCancel, initialData }: SetFormProps) {
    const [name, setName] = useState(initialData?.name ?? '');
    const [description, setDescription] = useState(initialData?.description ?? '');
    const [stylePresetId, setStylePresetId] = useState(initialData?.stylePresetId ?? '');
    const [presets, setPresets] = useState<RecraftStylePresetRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const isEditing = !!initialData?.id;

    useEffect(() => {
        loadPresets();
    }, []);

    async function loadPresets() {
        try {
            const res = await api<{ data: RecraftStylePresetRecord[] }>('/api/recraft/presets', {
                method: 'GET',
                callerId: 'SetForm:loadPresets',
            });
            if (res.data) setPresets(res.data);
        } catch {
            // Presets may not be seeded yet — not blocking
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!name.trim()) {
            setError('Name is required');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            if (isEditing) {
                await api(`/api/recraft/sets/${initialData!.id}`, {
                    method: 'PATCH',
                    body: { name, description: description || null, stylePresetId: stylePresetId || null },
                });
            } else {
                await api('/api/recraft/sets', {
                    method: 'POST',
                    body: { name, description: description || null, stylePresetId: stylePresetId || null },
                });
            }
            onSuccess();
        } catch (err) {
            if (isApiError(err)) setError(err.message);
            else setError('Failed to save set');
        } finally {
            setLoading(false);
        }
    }

    // Group presets by category
    const grouped: Record<string, RecraftStylePresetRecord[]> = {};
    for (const p of presets) {
        const cat = p.category || 'other';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(p);
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="set-name">Name *</Label>
                <Input
                    id="set-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="My Brand Assets"
                    autoFocus
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="set-desc">Description</Label>
                <Input
                    id="set-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Logos and icons for product launch"
                />
            </div>

            <div className="space-y-2">
                <Label>Style Preset</Label>
                <Select value={stylePresetId} onValueChange={setStylePresetId}>
                    <SelectTrigger>
                        <SelectValue placeholder="Choose a style..." />
                    </SelectTrigger>
                    <SelectContent>
                        {Object.entries(grouped).map(([category, categoryPresets]) => (
                            <div key={category}>
                                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                    {category}
                                </div>
                                {categoryPresets.map((p) => (
                                    <SelectItem key={p.id} value={p.id}>
                                        {p.name}
                                    </SelectItem>
                                ))}
                            </div>
                        ))}
                    </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                    The style preset determines the visual style of all generated assets in this set.
                </p>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={onCancel}>
                    Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                    {loading ? 'Saving...' : isEditing ? 'Update Set' : 'Create Set'}
                </Button>
            </div>
        </form>
    );
}
