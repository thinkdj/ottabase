import { Card, CardContent, CardHeader, CardTitle, Badge, Button } from '@ottabase/ui-shadcn';
import { LayoutTemplate, Navigation, Puzzle, Plus, type LucideIcon } from 'lucide-react';
import type { BlockDefinition } from './builder-types';

const CATEGORY_META: Record<string, { label: string; icon: LucideIcon }> = {
    layout: { label: 'Layout', icon: LayoutTemplate },
    navigation: { label: 'Navigation', icon: Navigation },
    custom: { label: 'Custom', icon: Puzzle },
};

interface BlockPaletteProps {
    blocks: BlockDefinition[];
    onAddBlock: (block: BlockDefinition) => void;
    isPending?: boolean;
}

/** Categorised block palette with descriptive cards. */
export function BlockPalette({ blocks, onAddBlock, isPending }: BlockPaletteProps) {
    // Group blocks by category
    const grouped = blocks.reduce<Record<string, BlockDefinition[]>>((acc, block) => {
        const cat = block.category || 'custom';
        (acc[cat] ??= []).push(block);
        return acc;
    }, {});

    return (
        <Card className="h-fit">
            <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Add Blocks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {Object.entries(grouped).map(([category, items]) => {
                    const meta = CATEGORY_META[category] ?? CATEGORY_META.custom;
                    const Icon = meta.icon;
                    return (
                        <div key={category}>
                            <div className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                <Icon className="h-3.5 w-3.5" />
                                {meta.label}
                            </div>
                            <div className="space-y-1.5">
                                {items.map((block) => (
                                    <button
                                        key={block.id}
                                        type="button"
                                        disabled={isPending}
                                        onClick={() => onAddBlock(block)}
                                        className="flex w-full items-center gap-2 rounded-md border border-dashed px-3 py-2 text-left text-sm transition-colors hover:border-primary hover:bg-muted/50 disabled:opacity-50"
                                    >
                                        <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                        <span className="font-medium">{block.label}</span>
                                        <Badge variant="secondary" className="ml-auto text-[10px]">
                                            {block.variants.length}v
                                        </Badge>
                                    </button>
                                ))}
                            </div>
                        </div>
                    );
                })}
                {blocks.length === 0 && <p className="text-xs text-muted-foreground">Loading blocks…</p>}
            </CardContent>
        </Card>
    );
}
