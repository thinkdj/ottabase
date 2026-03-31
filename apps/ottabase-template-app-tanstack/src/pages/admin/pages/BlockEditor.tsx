import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Switch, Textarea } from '@ottabase/ui-shadcn';
import { Save, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ActionListEditor } from './ActionListEditor';
import type { BlockDefinition, EditableBlock } from './builder-types';
import { FeatureListEditor } from './FeatureListEditor';

interface BlockEditorProps {
    /** The current block data from the server. */
    block: any;
    /** Available block definitions from the registry. */
    blocks: BlockDefinition[];
    /** Features belonging to the selected section. */
    features: any[];
    /** Actions belonging to the selected section. */
    actions: any[];
    /** Handlers */
    onSave: (draft: EditableBlock) => void;
    onDelete: (id: string) => void;
    onAddFeature: () => void;
    onUpdateFeature: (id: string, data: Record<string, unknown>) => void;
    onDeleteFeature: (id: string) => void;
    onAddAction: () => void;
    onUpdateAction: (id: string, data: Record<string, unknown>) => void;
    onDeleteAction: (id: string) => void;
    isPending?: boolean;
}

/** Right-panel editor for the currently selected block. */
export function BlockEditor({
    block,
    blocks,
    features,
    actions,
    onSave,
    onDelete,
    onAddFeature,
    onUpdateFeature,
    onDeleteFeature,
    onAddAction,
    onUpdateAction,
    onDeleteAction,
    isPending,
}: BlockEditorProps) {
    const [draft, setDraft] = useState<EditableBlock>({
        id: block.id,
        title: block.title,
        subtitle: block.subtitle,
        body: block.body,
        variant: block.variant,
        enabled: block.enabled,
    });

    // Sync when a different block is selected
    useEffect(() => {
        setDraft({
            id: block.id,
            title: block.title,
            subtitle: block.subtitle,
            body: block.body,
            variant: block.variant,
            enabled: block.enabled,
        });
    }, [block.id]);

    // Find available variants from registry for this block's slot
    const blockDef = blocks.find((b) => b.id === block.slot);
    const variantOptions = blockDef?.variants ?? [];

    return (
        <Card className="h-fit">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">
                        Edit Block
                        {blockDef ? ` — ${blockDef.label}` : ''}
                    </CardTitle>
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
                <div>
                    <Label className="text-xs">Title</Label>
                    <Input value={draft.title || ''} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
                </div>
                <div>
                    <Label className="text-xs">Subtitle</Label>
                    <Input
                        value={draft.subtitle || ''}
                        onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })}
                    />
                </div>
                <div>
                    <Label className="text-xs">Body</Label>
                    <Textarea
                        rows={3}
                        value={draft.body || ''}
                        onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                    />
                </div>

                {/* Variant picker */}
                <div>
                    <Label className="text-xs">Variant</Label>
                    {variantOptions.length > 0 ? (
                        <div className="mt-1 flex flex-wrap gap-1.5">
                            {variantOptions.map((v) => (
                                <button
                                    key={v.id}
                                    type="button"
                                    onClick={() => setDraft({ ...draft, variant: v.id })}
                                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                                        draft.variant === v.id
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                    }`}
                                >
                                    {v.label}
                                </button>
                            ))}
                        </div>
                    ) : (
                        <Input
                            value={draft.variant || ''}
                            onChange={(e) => setDraft({ ...draft, variant: e.target.value })}
                        />
                    )}
                </div>

                {/* Enabled toggle */}
                <div className="flex items-center justify-between rounded border p-2">
                    <Label htmlFor="block-enabled" className="text-xs">
                        Visible
                    </Label>
                    <Switch
                        id="block-enabled"
                        checked={Boolean(draft.enabled)}
                        onCheckedChange={(val) => setDraft({ ...draft, enabled: val })}
                    />
                </div>

                {/* Save / Delete */}
                <div className="flex gap-2">
                    <Button size="sm" onClick={() => onSave(draft)} disabled={isPending}>
                        <Save className="mr-1 h-3.5 w-3.5" /> Save
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => onDelete(block.id)} disabled={isPending}>
                        <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                    </Button>
                </div>

                {/* Feature editor */}
                <div className="border-t pt-3">
                    <FeatureListEditor
                        features={features}
                        onAdd={onAddFeature}
                        onUpdate={onUpdateFeature}
                        onDelete={onDeleteFeature}
                        isPending={isPending}
                    />
                </div>

                {/* Action editor */}
                <div className="border-t pt-3">
                    <ActionListEditor
                        actions={actions}
                        onAdd={onAddAction}
                        onUpdate={onUpdateAction}
                        onDelete={onDeleteAction}
                        isPending={isPending}
                    />
                </div>
            </CardContent>
        </Card>
    );
}
