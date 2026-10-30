/**
 * The renderer root: walks Editor.js blocks, picks a renderer per block type, keeps vertical rhythm
 * and heading ids consistent across the whole document, including blocks nested inside a Layout.
 */
import { useMemo } from 'react';
import { blockRenderers } from './renderers';
import { BlockList, collectHeadingIds, ScopeProvider, type RenderScope } from './scope';
import type { Block, BlockRenderers, Injection, RendererData } from './types';

export interface OttaRendererProps {
    /** Editor.js output. `blocks` is all that is required. */
    data: RendererData | { blocks?: Block[] } | null | undefined;
    /** Block type → renderer. Defaults to every built-in; spread `blockRenderers` to add or replace one. */
    renderers?: BlockRenderers;
    /** Components to place before the block at `index`; an index past the end renders after the last block. */
    injections?: Injection[];
    className?: string;
    /** Root element. Default `div`. */
    as?: 'div' | 'article' | 'section';
}

/**
 * Renders Editor.js content with the Ottabase visual language.
 *
 * The root carries the typography contract (`.ottarenderer`), each block sits in an
 * `.otta-block--<type>` wrapper that owns its vertical rhythm, and every element is addressable
 * through `data-slot` / `data-block` for theme CSS. Nothing else is needed around it: no `prose`,
 * no card, no padding.
 */
export function OttaRenderer({
    data,
    renderers = blockRenderers,
    injections,
    className,
    as: Tag = 'div',
}: OttaRendererProps) {
    const blocks = data?.blocks;
    // Heading ids are derived from the block tree once, not claimed during render, so memoised or
    // skipped children can never shift them.
    const headingIds = useMemo(() => collectHeadingIds(blocks), [blocks]);
    const scope = useMemo<RenderScope>(() => ({ renderers, headingIds }), [renderers, headingIds]);
    return (
        <ScopeProvider value={scope}>
            <Tag className={['ottarenderer', className].filter(Boolean).join(' ')} data-slot="renderer">
                <BlockList blocks={blocks} injections={injections} />
            </Tag>
        </ScopeProvider>
    );
}

/** True when there is at least one block to render. */
export function hasBlocks(data: { blocks?: unknown[] } | null | undefined): boolean {
    return Array.isArray(data?.blocks) && data.blocks.length > 0;
}
