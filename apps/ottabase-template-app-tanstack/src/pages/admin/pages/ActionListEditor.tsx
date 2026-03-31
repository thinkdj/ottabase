import { Button, Input, Label, Switch } from '@ottabase/ui-shadcn';
import { Plus, Trash2 } from 'lucide-react';
import { useCallback, useState } from 'react';

interface ActionItem {
    id: string;
    label: string;
    href: string;
    variant: string;
    icon?: string;
    external: boolean;
    sortOrder: number;
}

interface ActionListEditorProps {
    actions: ActionItem[];
    onAdd: () => void;
    onUpdate: (id: string, data: Partial<ActionItem>) => void;
    onDelete: (id: string) => void;
    isPending?: boolean;
}

const ACTION_VARIANTS = ['primary', 'secondary', 'outline', 'ghost', 'link'] as const;

/** Single action row with controlled state. */
function ActionRow({
    action,
    onUpdate,
    onDelete,
}: {
    action: ActionItem;
    onUpdate: (id: string, data: Partial<ActionItem>) => void;
    onDelete: (id: string) => void;
}) {
    const [local, setLocal] = useState(action);
    const [expanded, setExpanded] = useState(false);

    const commit = useCallback(() => {
        const changed: Partial<ActionItem> = {};
        if (local.label !== action.label) changed.label = local.label;
        if (local.href !== action.href) changed.href = local.href;
        if (local.variant !== action.variant) changed.variant = local.variant;
        if (local.icon !== action.icon) changed.icon = local.icon;
        if (local.external !== action.external) changed.external = local.external;
        if (Object.keys(changed).length > 0) {
            onUpdate(action.id, changed);
        }
    }, [local, action, onUpdate]);

    return (
        <div className="space-y-2 rounded-md border p-2.5">
            <div className="flex items-center gap-2">
                <Input
                    className="flex-1 text-sm"
                    placeholder="Label"
                    value={local.label}
                    onChange={(e) => setLocal({ ...local, label: e.target.value })}
                    onBlur={commit}
                />
                <Input
                    className="flex-1 text-sm"
                    placeholder="/signup"
                    value={local.href}
                    onChange={(e) => setLocal({ ...local, href: e.target.value })}
                    onBlur={commit}
                />
                <button
                    type="button"
                    onClick={() => setExpanded(!expanded)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                >
                    {expanded ? 'Less' : 'More'}
                </button>
                <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => onDelete(action.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                </Button>
            </div>
            {expanded && (
                <div className="space-y-2 pl-1">
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <Label className="text-xs">Variant</Label>
                            <select
                                className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                                value={local.variant}
                                onChange={(e) => {
                                    setLocal({ ...local, variant: e.target.value });
                                    onUpdate(action.id, { variant: e.target.value });
                                }}
                            >
                                {ACTION_VARIANTS.map((v) => (
                                    <option key={v} value={v}>
                                        {v}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <Label className="text-xs">Icon</Label>
                            <Input
                                className="text-sm"
                                placeholder="e.g. ArrowRight"
                                value={local.icon || ''}
                                onChange={(e) => setLocal({ ...local, icon: e.target.value })}
                                onBlur={commit}
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-2 rounded border px-2 py-1.5">
                        <Label className="text-xs">Open externally</Label>
                        <Switch
                            checked={local.external}
                            onCheckedChange={(val) => {
                                setLocal({ ...local, external: val });
                                onUpdate(action.id, { external: val });
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

/** Managed list of actions for a section. */
export function ActionListEditor({ actions, onAdd, onUpdate, onDelete, isPending }: ActionListEditorProps) {
    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Actions</p>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onAdd} disabled={isPending}>
                    <Plus className="mr-1 h-3 w-3" /> Add
                </Button>
            </div>
            {actions.length === 0 && (
                <p className="py-2 text-center text-xs text-muted-foreground">No actions. Add one above.</p>
            )}
            {actions.map((action) => (
                <ActionRow key={action.id} action={action} onUpdate={onUpdate} onDelete={onDelete} />
            ))}
        </div>
    );
}
