import { Button, Input, Label, Textarea } from '@ottabase/ui-shadcn';
import { Plus, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';

interface FeatureItem {
    id: string;
    title: string;
    description?: string;
    icon?: string;
    link?: string;
    sortOrder: number;
}

interface FeatureListEditorProps {
    features: FeatureItem[];
    onAdd: () => void;
    onUpdate: (id: string, data: Partial<FeatureItem>) => void;
    onDelete: (id: string) => void;
    isPending?: boolean;
}

/** Inline feature item editor with controlled state. */
function FeatureRow({
    feature,
    onUpdate,
    onDelete,
}: {
    feature: FeatureItem;
    onUpdate: (id: string, data: Partial<FeatureItem>) => void;
    onDelete: (id: string) => void;
}) {
    const [local, setLocal] = useState(feature);
    const [expanded, setExpanded] = useState(false);
    const localRef = useRef(local);
    localRef.current = local;

    const commit = () => {
        const current = localRef.current;
        const changed: Partial<FeatureItem> = {};
        if (current.title !== feature.title) changed.title = current.title;
        if (current.description !== feature.description) changed.description = current.description;
        if (current.icon !== feature.icon) changed.icon = current.icon;
        if (current.link !== feature.link) changed.link = current.link;
        if (Object.keys(changed).length > 0) {
            onUpdate(feature.id, changed);
        }
    };

    return (
        <div className="space-y-2 rounded-md border p-2.5">
            <div className="flex items-center gap-2">
                <Input
                    className="flex-1 text-sm"
                    placeholder="Feature title"
                    value={local.title}
                    onChange={(e) => setLocal({ ...local, title: e.target.value })}
                    onBlur={commit}
                />
                <button
                    type="button"
                    onClick={() => setExpanded(!expanded)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                >
                    {expanded ? 'Less' : 'More'}
                </button>
                <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => onDelete(feature.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                </Button>
            </div>
            {expanded && (
                <div className="space-y-2 pl-1">
                    <div>
                        <Label className="text-xs">Description</Label>
                        <Textarea
                            className="text-sm"
                            rows={2}
                            placeholder="Short description…"
                            value={local.description || ''}
                            onChange={(e) => setLocal({ ...local, description: e.target.value })}
                            onBlur={commit}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <Label className="text-xs">Icon</Label>
                            <Input
                                className="text-sm"
                                placeholder="e.g. Zap"
                                value={local.icon || ''}
                                onChange={(e) => setLocal({ ...local, icon: e.target.value })}
                                onBlur={commit}
                            />
                        </div>
                        <div>
                            <Label className="text-xs">Link</Label>
                            <Input
                                className="text-sm"
                                placeholder="/features"
                                value={local.link || ''}
                                onChange={(e) => setLocal({ ...local, link: e.target.value })}
                                onBlur={commit}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/** Managed list of features for a section. */
export function FeatureListEditor({ features, onAdd, onUpdate, onDelete, isPending }: FeatureListEditorProps) {
    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Features</p>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onAdd} disabled={isPending}>
                    <Plus className="mr-1 h-3 w-3" /> Add
                </Button>
            </div>
            {features.length === 0 && (
                <p className="py-2 text-center text-xs text-muted-foreground">No features. Add one above.</p>
            )}
            {features.map((feature) => (
                <FeatureRow key={feature.id} feature={feature} onUpdate={onUpdate} onDelete={onDelete} />
            ))}
        </div>
    );
}
