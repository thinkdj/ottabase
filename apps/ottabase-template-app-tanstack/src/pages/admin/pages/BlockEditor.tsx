import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    Button,
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    Input,
    Label,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Switch,
    Textarea,
} from '@ottabase/ui-shadcn';
import { api, isApiError } from '@/lib/api';
import { ImagePlus, Save, Sparkles, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ActionListEditor } from './ActionListEditor';
import type { BlockDefinition, EditableBlock } from './builder-types';
import { openMediaLibraryPicker } from './mediaPicker';
import { FeatureListEditor } from './FeatureListEditor';

type AITone = 'professional' | 'casual' | 'bold' | 'playful';
type AIOperation = 'generate' | 'rewrite' | 'shorten' | 'expand';
type CopyField = 'title' | 'subtitle' | 'body';

const TONE_LABELS: Record<AITone, string> = {
    professional: 'Professional',
    casual: 'Casual',
    bold: 'Bold',
    playful: 'Playful',
};

const OPERATION_LABELS: Record<AIOperation, string> = {
    generate: 'Generate New',
    rewrite: 'Rewrite',
    shorten: 'Shorten',
    expand: 'Expand',
};

const OPERATION_RESULT_LABELS: Record<AIOperation, string> = {
    generate: 'generated',
    rewrite: 'rewritten',
    shorten: 'shortened',
    expand: 'expanded',
};

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
        mediaUrl: block.mediaUrl,
        mediaAlt: block.mediaAlt,
        variant: block.variant,
        enabled: block.enabled,
    });
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
    const [aiTone, setAiTone] = useState<AITone>('professional');
    const [aiOperation, setAiOperation] = useState<AIOperation>('generate');
    const [aiContext, setAiContext] = useState('');
    const [aiLoadingField, setAiLoadingField] = useState<CopyField | 'all' | null>(null);

    // Sync when a different block is selected
    useEffect(() => {
        setDraft({
            id: block.id,
            title: block.title,
            subtitle: block.subtitle,
            body: block.body,
            mediaUrl: block.mediaUrl,
            mediaAlt: block.mediaAlt,
            variant: block.variant,
            enabled: block.enabled,
        });
    }, [block.id]);

    // Find available variants from registry for this block's slot
    const blockDef = blocks.find((b) => b.id === block.slot);
    const variantOptions = blockDef?.variants ?? [];

    const generateCopyForField = async (field: CopyField, operation: AIOperation) => {
        const toneInstruction = TONE_LABELS[aiTone];
        const sectionLabel = blockDef?.label || block.slot || 'section';
        const existingText = String(draft[field] || '').trim();
        const contextText = aiContext.trim();

        const fieldInstruction =
            operation === 'generate'
                ? field === 'title'
                    ? 'Write a concise marketing headline (max 12 words).'
                    : field === 'subtitle'
                      ? 'Write a supporting subtitle (max 22 words).'
                      : 'Write short marketing body copy (2-3 sentences).'
                : operation === 'rewrite'
                  ? `Rewrite the existing ${field} while preserving intent and key claims.`
                  : operation === 'shorten'
                    ? `Shorten the existing ${field} by around 30-40% while keeping meaning intact.`
                    : `Expand the existing ${field} with one specific detail while staying concise.`;

        if (operation !== 'generate' && !existingText) {
            return false;
        }

        const prompt = [
            `Generate copy for a ${sectionLabel} block in a SaaS landing page.`,
            `Operation: ${OPERATION_LABELS[operation]}.`,
            `Tone: ${toneInstruction}.`,
            fieldInstruction,
            contextText ? `Product/context: ${contextText}` : '',
            existingText ? `Existing ${field}: ${existingText}` : '',
            'Return only the final copy text, no markdown, no quotes.',
        ]
            .filter(Boolean)
            .join('\n');

        try {
            const result = await api<{ text?: string; response?: { text?: string } }>(
                '/api/cloudflare/ai/universal/chat',
                {
                    method: 'POST',
                    body: {
                        provider: 'workers-ai',
                        model: '@cf/meta/llama-3.1-8b-instruct',
                        prompt,
                        systemPrompt:
                            'You are an expert SaaS copywriter. Be clear, specific, and conversion-focused. Avoid hype and filler.',
                    },
                },
            );

            const generatedText = String(result?.text || result?.response?.text || '').trim();
            if (!generatedText) {
                toast.error('AI did not return copy');
                return;
            }

            setDraft((current) => ({
                ...current,
                [field]: generatedText,
            }));
            toast.success(`${field[0].toUpperCase() + field.slice(1)} ${OPERATION_RESULT_LABELS[operation]}`);
            return true;
        } catch (error) {
            toast.error(isApiError(error) ? error.message : 'Failed to generate copy');
            return false;
        }
    };

    const generateCopy = async (field: CopyField, operation: AIOperation = aiOperation) => {
        setAiLoadingField(field);
        try {
            const updated = await generateCopyForField(field, operation);
            if (!updated && operation !== 'generate') {
                toast.error(`Add ${field} text first to ${operation}`);
            }
        } finally {
            setAiLoadingField(null);
        }
    };

    const generateAllCopy = async () => {
        const fields: CopyField[] = ['title', 'subtitle', 'body'];

        if (aiOperation !== 'generate') {
            const availableFields = fields.filter((field) => String(draft[field] || '').trim().length > 0);
            if (availableFields.length === 0) {
                toast.error(`Add existing text in at least one field to ${aiOperation}`);
                return;
            }
        }

        setAiLoadingField('all');
        try {
            let updatedCount = 0;
            for (const field of fields) {
                if (aiOperation !== 'generate' && !String(draft[field] || '').trim()) {
                    continue;
                }
                // Run sequentially to keep prompts/context deterministic and avoid request spikes.
                const updated = await generateCopyForField(field, aiOperation);
                if (updated) {
                    updatedCount += 1;
                }
            }

            if (updatedCount === 0) {
                toast.error(`No fields updated for ${aiOperation}`);
                return;
            }

            toast.success(
                aiOperation === 'generate'
                    ? 'Generated title, subtitle, and body'
                    : `${OPERATION_LABELS[aiOperation]} complete for ${updatedCount} field(s)`,
            );
        } finally {
            setAiLoadingField(null);
        }
    };

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
                    <div className="mt-1 flex justify-end">
                        <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            onClick={() => generateCopy('title')}
                            disabled={aiLoadingField !== null}
                        >
                            <Sparkles className="mr-1 h-3 w-3" />
                            {aiLoadingField === 'title' ? 'Generating...' : 'AI'}
                        </Button>
                    </div>
                </div>
                <div>
                    <Label className="text-xs">Subtitle</Label>
                    <Input
                        value={draft.subtitle || ''}
                        onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })}
                    />
                    <div className="mt-1 flex justify-end">
                        <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            onClick={() => generateCopy('subtitle')}
                            disabled={aiLoadingField !== null}
                        >
                            <Sparkles className="mr-1 h-3 w-3" />
                            {aiLoadingField === 'subtitle' ? 'Generating...' : 'AI'}
                        </Button>
                    </div>
                </div>
                <div>
                    <Label className="text-xs">Body</Label>
                    <Textarea
                        rows={3}
                        value={draft.body || ''}
                        onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                    />
                    <div className="mt-1 flex justify-end">
                        <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            onClick={() => generateCopy('body')}
                            disabled={aiLoadingField !== null}
                        >
                            <Sparkles className="mr-1 h-3 w-3" />
                            {aiLoadingField === 'body' ? 'Generating...' : 'AI'}
                        </Button>
                    </div>
                </div>

                <div className="space-y-2 rounded border p-2.5">
                    <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        <p className="text-xs font-medium">AI Copy Assistant</p>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                        <div>
                            <Label className="text-xs">Action</Label>
                            <Select value={aiOperation} onValueChange={(value) => setAiOperation(value as AIOperation)}>
                                <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.entries(OPERATION_LABELS).map(([key, label]) => (
                                        <SelectItem key={key} value={key}>
                                            {label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label className="text-xs">Tone</Label>
                            <Select value={aiTone} onValueChange={(value) => setAiTone(value as AITone)}>
                                <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.entries(TONE_LABELS).map(([key, label]) => (
                                        <SelectItem key={key} value={key}>
                                            {label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label className="text-xs">Product Context (optional)</Label>
                            <Input
                                className="h-8 text-xs"
                                placeholder="e.g. AI-powered invoicing for freelancers"
                                value={aiContext}
                                onChange={(event) => setAiContext(event.target.value)}
                            />
                        </div>
                    </div>
                    <div className="flex justify-end">
                        <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs"
                            onClick={generateAllCopy}
                            disabled={aiLoadingField !== null}
                        >
                            <Sparkles className="mr-1 h-3 w-3" />
                            {aiLoadingField === 'all'
                                ? 'Working...'
                                : aiOperation === 'generate'
                                  ? 'Generate All'
                                  : `${OPERATION_LABELS[aiOperation]} All`}
                        </Button>
                    </div>
                </div>

                <div className="space-y-2 rounded border p-2.5">
                    <div className="flex items-center justify-between">
                        <Label className="text-xs">Section image</Label>
                        <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={async () => {
                                const picked = await openMediaLibraryPicker();
                                if (!picked) return;
                                setDraft({
                                    ...draft,
                                    mediaUrl: picked.url,
                                    mediaAlt: picked.alt || draft.mediaAlt,
                                });
                            }}
                        >
                            <ImagePlus className="mr-1 h-3 w-3" /> Pick from library
                        </Button>
                    </div>

                    <Input
                        placeholder="https://..."
                        value={draft.mediaUrl || ''}
                        onChange={(e) => setDraft({ ...draft, mediaUrl: e.target.value })}
                    />
                    <Input
                        placeholder="Image alt text"
                        value={draft.mediaAlt || ''}
                        onChange={(e) => setDraft({ ...draft, mediaAlt: e.target.value })}
                    />

                    {draft.mediaUrl ? (
                        <div className="overflow-hidden rounded border">
                            <img src={draft.mediaUrl} alt={draft.mediaAlt || ''} className="h-28 w-full object-cover" />
                        </div>
                    ) : null}
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
                    <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setConfirmDeleteOpen(true)}
                        disabled={isPending}
                    >
                        <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                    </Button>
                </div>

                <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete Block?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This will permanently remove this block and its nested items from the page.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                disabled={isPending}
                                onClick={() => {
                                    onDelete(block.id);
                                    setConfirmDeleteOpen(false);
                                }}
                            >
                                {isPending ? 'Deleting...' : 'Delete'}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

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
