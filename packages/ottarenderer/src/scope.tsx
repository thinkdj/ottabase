/**
 * Render scope shared by a document: the renderer map and the heading ids, computed once from the
 * block tree so rendering stays pure. Kept apart from OttaRenderer so Layout can nest a BlockList
 * without an import cycle.
 */
import { createContext, useContext, type ReactNode } from 'react';
import { inlineToText } from './inline';
import type { Block, BlockRenderers, Injection } from './types';

export interface RenderScope {
    renderers: BlockRenderers;
    /** Heading block → its document-unique id */
    headingIds: ReadonlyMap<Block, string>;
}

const ScopeContext = createContext<RenderScope | null>(null);
export const ScopeProvider = ScopeContext.Provider;

const EMPTY_IDS: ReadonlyMap<Block, string> = new Map();
let defaultRenderers: BlockRenderers = {};

/** Called by renderers.ts so a BlockList used outside an OttaRenderer still knows every built-in. */
export function registerDefaultRenderers(renderers: BlockRenderers) {
    defaultRenderers = renderers;
}

export function useScope(): RenderScope {
    return useContext(ScopeContext) ?? { renderers: defaultRenderers, headingIds: EMPTY_IDS };
}

/** Renders blocks with the renderers of the enclosing OttaRenderer, or the built-ins when standalone. */
export function BlockList({ blocks, injections }: { blocks: Block[] | undefined; injections?: Injection[] }) {
    const { renderers } = useScope();
    const list = Array.isArray(blocks) ? blocks : [];
    const seen = new Set<string>();
    const slot = (inj: Injection, key: string) => (
        <div key={key} className="otta-block otta-block--injection" data-slot="block" data-block="injection">
            {inj.component}
        </div>
    );
    const out: ReactNode[] = [];
    list.forEach((block, i) => {
        injections?.forEach((inj, k) => inj.index === i && out.push(slot(inj, `inj-${i}-${k}`)));
        // Own keys only: a stored type of "constructor" must not resolve to Object.prototype's
        const type = typeof block?.type === 'string' ? block.type : '';
        const Renderer = Object.prototype.hasOwnProperty.call(renderers, type) ? renderers[type] : undefined;
        if (!Renderer) return; // unknown type: the author's editor had a tool this renderer does not
        // Editor.js ids are unique per document; a pasted duplicate still gets a stable, distinct key
        let key = block.id ?? `${type}-${i}`;
        if (seen.has(key)) key = `${key}-${i}`;
        seen.add(key);
        out.push(
            <div key={key} className={`otta-block otta-block--${type}`} data-slot="block" data-block={type}>
                <Renderer data={block.data ?? {}} block={block} />
            </div>,
        );
    });
    injections?.forEach((inj, k) => inj.index >= list.length && out.push(slot(inj, `inj-tail-${k}`)));
    return <>{out}</>;
}

/**
 * Walk the document (including Layout columns) and give every heading a unique slug id, in order.
 * Pure: the same blocks always produce the same ids, whatever React decides to re-render.
 */
export function collectHeadingIds(blocks: unknown): ReadonlyMap<Block, string> {
    const ids = new Map<Block, string>();
    const taken = new Set<string>();
    const walk = (list: unknown) => {
        if (!Array.isArray(list)) return;
        for (const block of list as Block[]) {
            if (!block || typeof block !== 'object') continue;
            if (block.type === 'header') {
                const base = slugify(inlineToText(block.data?.text));
                if (!base) continue;
                let id = base;
                for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
                taken.add(id);
                ids.set(block, id);
            } else if (block.type === 'layout' && Array.isArray(block.data?.columns)) {
                for (const col of block.data.columns) walk(col?.content?.blocks);
            }
        }
    };
    walk(blocks);
    return ids;
}

/** The id for a heading block: the document-unique one when inside an OttaRenderer, a plain slug otherwise. */
export function useHeadingId(block: Block | undefined, text: string): string | undefined {
    const { headingIds } = useScope();
    if (block && headingIds.has(block)) return headingIds.get(block);
    return slugify(text) || undefined;
}

export function slugify(text: string): string {
    return text
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);
}
