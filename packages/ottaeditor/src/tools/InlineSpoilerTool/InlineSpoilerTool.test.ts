import { afterEach, describe, expect, it } from 'vitest';
import type { API } from '@editorjs/editorjs';
import { DEFAULT_PLUGIN_NAMES, defaultPluginsMap } from '../../defaultPlugins';
import AnnotationTool from '../AnnotationTool/AnnotationTool';
import InlineSpoilerTool, { INLINE_SPOILER_CLASS, SHARED_SPAN_SANITIZE } from './InlineSpoilerTool';

/** The two selection helpers the tool uses, backed by the real DOM selection */
const api = {
    selection: {
        findParentTag: (tag: string, cls?: string) => {
            let node: Node | null = window.getSelection()?.anchorNode ?? null;
            while (node && node !== document.body) {
                if (node instanceof HTMLElement && node.tagName === tag && (!cls || node.classList.contains(cls)))
                    return node;
                node = node.parentNode;
            }
            return null;
        },
        expandToTag: (el: HTMLElement) => {
            const range = document.createRange();
            range.selectNodeContents(el);
            window.getSelection()?.removeAllRanges();
            window.getSelection()?.addRange(range);
        },
    },
} as unknown as API;

function select(node: Node, start: number, end: number) {
    const range = document.createRange();
    range.setStart(node, start);
    range.setEnd(node, end);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    return range;
}

afterEach(() => {
    document.body.innerHTML = '';
});

describe('InlineSpoilerTool', () => {
    it('is a default inline plugin with a toolbar button and shortcut', () => {
        expect(defaultPluginsMap.get(DEFAULT_PLUGIN_NAMES.INLINE_SPOILER)?.tool).toBe(InlineSpoilerTool);
        expect(InlineSpoilerTool.isInline).toBe(true);
        expect(InlineSpoilerTool.shortcut).toBe('CMD+SHIFT+H');
        const button = new InlineSpoilerTool({ api }).render();
        expect(button.getAttribute('aria-label')).toBe('Spoiler');
        expect(button.innerHTML).toContain('<svg');
    });

    it('wraps the selection in a spoiler span and unwraps it again', () => {
        const p = document.createElement('p');
        p.textContent = 'The killer is the butler.';
        document.body.append(p);
        const tool = new InlineSpoilerTool({ api });
        tool.render();

        tool.surround(select(p.firstChild!, 14, 24));
        const span = p.querySelector(`span.${INLINE_SPOILER_CLASS}`)!;
        expect(span.textContent).toBe('the butler');
        expect(tool.checkState()).toBe(true);

        tool.surround(select(span.firstChild!, 0, 3));
        expect(p.querySelector('span')).toBeNull();
        expect(p.textContent).toBe('The killer is the butler.');
    });

    it('ignores an empty selection', () => {
        const p = document.createElement('p');
        p.textContent = 'Nothing selected';
        document.body.append(p);
        new InlineSpoilerTool({ api }).surround(select(p.firstChild!, 3, 3));
        expect(p.querySelector('span')).toBeNull();
    });

    it('shares one span sanitize rule with the annotation, so Editor.js merging cannot drop either', () => {
        expect((InlineSpoilerTool.sanitize as Record<string, unknown>).span).toEqual(SHARED_SPAN_SANITIZE);
        expect((AnnotationTool.sanitize as Record<string, unknown>).span).toEqual(SHARED_SPAN_SANITIZE);
    });
});
