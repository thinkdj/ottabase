/**
 * AnnotationTool: inline tool that wraps selected text in
 * `<span class="cdx-annotation" data-title data-annotation>`, which the renderer turns into a
 * dotted-underline phrase with a note. Editing happens in a small popup built from the kit.
 */
import type { API, InlineTool } from '@editorjs/editorjs';
import { icon } from '../../ui/icons';
import { button, h, iconButton, textInput, textarea } from '../../ui/kit';
import { SHARED_SPAN_SANITIZE } from '../InlineSpoilerTool/InlineSpoilerTool';

export interface AnnotationData {
    title: string;
    annotation: string;
}

export default class AnnotationTool implements InlineTool {
    static get isInline(): boolean {
        return true;
    }

    static get sanitize() {
        return {
            // Shared with the inline spoiler: Editor.js merges span rules across inline tools
            span: { ...SHARED_SPAN_SANITIZE },
        };
    }

    static get title(): string {
        return 'Annotation';
    }

    private readonly api: API;
    private button: HTMLButtonElement | null = null;
    private readonly tag = 'SPAN';
    private readonly class = 'cdx-annotation';
    private popup: HTMLElement | null = null;

    constructor({ api }: { api: API }) {
        this.api = api;
    }

    render(): HTMLButtonElement {
        this.button = h('button', {
            type: 'button',
            className: 'ce-inline-tool',
            html: icon('annotation'),
            title: 'Annotation',
        });
        return this.button;
    }

    surround(range: Range): void {
        if (!range) return;
        const existing = this.api.selection.findParentTag(this.tag, this.class) as HTMLElement | null;
        if (existing) {
            this.showPopup(existing);
            return;
        }
        const selectedText = range.toString().trim();
        if (!selectedText) return;
        const span = h('span', { className: this.class, dataset: { title: selectedText, annotation: '' } });
        range.surroundContents(span);
        this.showPopup(span);
    }

    checkState(): boolean {
        const annotationTag = this.api.selection.findParentTag(this.tag, this.class);
        this.button?.classList.toggle('ce-inline-tool--active', !!annotationTag);
        return !!annotationTag;
    }

    private showPopup(anchor: HTMLElement): void {
        this.closePopup();
        const title = textInput({
            value: anchor.dataset.title || anchor.textContent || '',
            placeholder: 'Title',
            ariaLabel: 'Annotation title',
        });
        const note = textarea({
            value: anchor.dataset.annotation || '',
            rows: 3,
            placeholder: 'Add a definition or a note',
            ariaLabel: 'Annotation',
            onInput: () => undefined,
        });
        this.popup = h(
            'div',
            { className: 'oe-popup', role: 'dialog', 'aria-label': 'Edit annotation' },
            h(
                'div',
                { className: 'oe-popup__header' },
                h('span', { className: 'oe-popup__title' }, 'Annotation'),
                iconButton({ icon: 'x', label: 'Close', onClick: () => this.closePopup() }),
            ),
            h('div', { className: 'oe-stack' }, title, note),
            h(
                'div',
                { className: 'oe-popup__footer' },
                button({
                    label: 'Remove',
                    variant: 'ghost',
                    size: 'sm',
                    icon: 'trash',
                    onClick: () => this.removeAnnotation(anchor),
                }),
                button({
                    label: 'Save',
                    variant: 'primary',
                    size: 'sm',
                    onClick: () => this.saveAnnotation(anchor, title.value, note.value),
                }),
            ),
        );
        this.popup.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closePopup();
        });
        document.body.appendChild(this.popup);
        this.positionPopup(anchor);
        setTimeout(() => document.addEventListener('mousedown', this.handleOutsideClick), 100);
        note.focus();
    }

    private handleOutsideClick = (e: MouseEvent): void => {
        if (this.popup && !this.popup.contains(e.target as Node)) this.closePopup();
    };

    private positionPopup(anchor: HTMLElement): void {
        if (!this.popup) return;
        const rect = anchor.getBoundingClientRect();
        const popupRect = this.popup.getBoundingClientRect();
        let left = rect.left + window.scrollX;
        if (left + popupRect.width > window.innerWidth + window.scrollX)
            left = window.innerWidth + window.scrollX - popupRect.width - 16;
        if (left < 16) left = 16;
        this.popup.style.top = `${rect.bottom + window.scrollY + 8}px`;
        this.popup.style.left = `${left}px`;
    }

    private closePopup(): void {
        document.removeEventListener('mousedown', this.handleOutsideClick);
        this.popup?.remove();
        this.popup = null;
    }

    private saveAnnotation(span: HTMLElement, title: string, annotation: string): void {
        span.dataset.title = title;
        span.dataset.annotation = annotation;
        this.closePopup();
        this.api.blocks.getBlockByIndex(this.api.blocks.getCurrentBlockIndex())?.call('save');
    }

    private removeAnnotation(span: HTMLElement): void {
        span.replaceWith(document.createTextNode(span.textContent || ''));
        this.closePopup();
        this.api.blocks.getBlockByIndex(this.api.blocks.getCurrentBlockIndex())?.call('save');
    }

    /** Shown in the inline toolbar while the caret is inside an annotation */
    renderActions(): HTMLElement {
        return h(
            'div',
            { className: 'oe-annotation-actions' },
            button({
                label: 'Edit annotation',
                icon: 'pencil',
                variant: 'ghost',
                size: 'sm',
                onClick: () => {
                    const tag = this.api.selection.findParentTag(this.tag, this.class) as HTMLElement | null;
                    if (tag) this.showPopup(tag);
                },
            }),
        );
    }

    clear(): void {
        this.closePopup();
    }
}
