import type { ReactNode } from 'react';

/** One Editor.js block as saved by @ottabase/ottaeditor */
export interface Block<T = Record<string, any>> {
    id?: string;
    type: string;
    data: T;
}

/** Editor.js OutputData, with `time` and `version` optional: stored content rarely carries them. */
export interface RendererData {
    time?: number;
    version?: string;
    blocks: Block[];
}

export interface BlockRendererProps<T = Record<string, any>> {
    data: T;
    /** The whole block, for renderers that need its id or type. Absent when a renderer is used on its own. */
    block?: Block<T>;
    /**
     * Extra classes for the renderer's root. OttaRenderer never passes one: the `.otta-block` wrapper
     * it puts around every block already carries the type hooks. Only direct users set it.
     */
    className?: string;
}

/** A block renderer is a React component that receives the block's data. */
export type BlockRenderer<T = any> = (props: BlockRendererProps<T>) => ReactNode;

/** Map of block type → renderer */
export type BlockRenderers = Record<string, BlockRenderer>;

/** Something to render before the block at `index` (an ad, a newsletter box, a related-posts rail) */
export interface Injection {
    index: number;
    component: ReactNode;
}
