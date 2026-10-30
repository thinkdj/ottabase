/**
 * Inline spoiler: hides a few words inside a sentence ("the killer is <spoiler>the butler</spoiler>").
 *
 * Wraps the selection in `<span class="cdx-spoiler">`. In the editor the text stays readable (the
 * author has to see what they wrote) and is marked with a hatched chip; the renderer blurs it until
 * the reader clicks. Selecting inside an existing spoiler and pressing the button again unwraps it.
 */
import type { API, InlineTool, SanitizerConfig } from '@editorjs/editorjs';
import { icon } from '../../ui/icons';

export const INLINE_SPOILER_CLASS = 'cdx-spoiler';

/**
 * Editor.js deep-merges every inline tool's sanitize rules per tag, so two tools that both use
 * `<span>` must declare the same rule or the later one silently wins. Annotation and the inline
 * spoiler share this one; the renderer only acts on the classes and attributes it knows.
 */
export const SHARED_SPAN_SANITIZE = { class: true, 'data-annotation': true, 'data-title': true } as const;

export default class InlineSpoilerTool implements InlineTool {
    private readonly api: API;
    private button: HTMLButtonElement | null = null;

    static get isInline(): boolean {
        return true;
    }

    static get title(): string {
        return 'Spoiler';
    }

    static get sanitize(): SanitizerConfig {
        return { span: { ...SHARED_SPAN_SANITIZE } } as unknown as SanitizerConfig;
    }

    static get shortcut(): string {
        return 'CMD+SHIFT+H';
    }

    constructor({ api }: { api: API }) {
        this.api = api;
    }

    render(): HTMLButtonElement {
        const b = document.createElement('button');
        b.type = 'button';
        b.classList.add('ce-inline-tool');
        b.title = 'Spoiler (hide until clicked)';
        b.setAttribute('aria-label', 'Spoiler');
        b.innerHTML = icon('spoiler');
        this.button = b;
        return b;
    }

    surround(range: Range): void {
        if (!range) return;
        const existing = this.api.selection.findParentTag('SPAN', INLINE_SPOILER_CLASS);
        if (existing) {
            this.unwrap(existing);
            return;
        }
        if (range.collapsed || !range.toString().trim()) return;
        const span = document.createElement('span');
        span.classList.add(INLINE_SPOILER_CLASS);
        span.appendChild(range.extractContents());
        range.insertNode(span);
        this.api.selection.expandToTag(span);
    }

    private unwrap(span: HTMLElement): void {
        const parent = span.parentNode;
        if (!parent) return;
        const range = document.createRange();
        const first = span.firstChild;
        const last = span.lastChild;
        while (span.firstChild) parent.insertBefore(span.firstChild, span);
        parent.removeChild(span);
        if (first && last) {
            range.setStartBefore(first);
            range.setEndAfter(last);
            const selection = window.getSelection();
            selection?.removeAllRanges();
            selection?.addRange(range);
        }
    }

    checkState(): boolean {
        const active = Boolean(this.api.selection.findParentTag('SPAN', INLINE_SPOILER_CLASS));
        this.button?.classList.toggle('ce-inline-tool--active', active);
        return active;
    }
}
