/**
 * AnnotationTool - Inline tool for adding annotations/definitions to text
 *
 * Wraps selected text in a span with data-annotation and data-title attributes.
 * Shows a popup for editing the annotation content.
 */
import './AnnotationTool.css';

export interface AnnotationData {
    title: string;
    annotation: string;
}

export default class AnnotationTool {
    static get isInline(): boolean {
        return true;
    }

    static get sanitize() {
        return {
            span: {
                class: 'cdx-annotation',
                'data-annotation': true,
                'data-title': true,
            },
        };
    }

    static get title(): string {
        return 'Annotation';
    }

    private api: any;
    private button: HTMLButtonElement | null = null;
    private tag = 'SPAN';
    private class = 'cdx-annotation';
    private popup: HTMLElement | null = null;
    private currentRange: Range | null = null;
    private currentSpan: HTMLElement | null = null;

    constructor({ api }: { api: any }) {
        this.api = api;
    }

    render(): HTMLButtonElement {
        this.button = document.createElement('button');
        this.button.type = 'button';
        this.button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/><path d="m15 5 3 3"/></svg>`;
        this.button.classList.add('ce-inline-tool');
        return this.button;
    }

    surround(range: Range): void {
        if (!range) return;

        // Check if we're editing an existing annotation
        const existingAnnotation = this.api.selection.findParentTag(this.tag, this.class);

        if (existingAnnotation) {
            // Open popup to edit existing
            this.currentSpan = existingAnnotation;
            this.showPopup(existingAnnotation);
        } else {
            // Create new annotation
            const selectedText = range.toString().trim();
            if (!selectedText) return;

            this.currentRange = range;

            // Create span wrapper
            const span = document.createElement('span');
            span.classList.add(this.class);
            span.dataset.title = selectedText;
            span.dataset.annotation = '';

            // Wrap the selected text
            range.surroundContents(span);
            this.currentSpan = span;

            // Open popup to add annotation
            this.showPopup(span);
        }
    }

    checkState(): boolean {
        const annotationTag = this.api.selection.findParentTag(this.tag, this.class);
        this.button?.classList.toggle('ce-inline-tool--active', !!annotationTag);
        return !!annotationTag;
    }

    private showPopup(anchorElement: HTMLElement): void {
        this.closePopup();

        const title = anchorElement.dataset.title || anchorElement.textContent || '';
        const annotation = anchorElement.dataset.annotation || '';

        // Create popup
        this.popup = document.createElement('div');
        this.popup.className = 'cdx-annotation-popup';
        this.popup.innerHTML = `
            <div class="cdx-annotation-popup__header">
                <span class="cdx-annotation-popup__title">Edit annotation</span>
                <button type="button" class="cdx-annotation-popup__close">&times;</button>
            </div>
            <div class="cdx-annotation-popup__body">
                <input type="text" class="cdx-annotation-popup__input cdx-annotation-popup__input--title" value="${this.escapeHtml(title)}" placeholder="Title" />
                <textarea class="cdx-annotation-popup__input cdx-annotation-popup__input--annotation" placeholder="Add an annotation or definition..." rows="3">${this.escapeHtml(annotation)}</textarea>
            </div>
            <div class="cdx-annotation-popup__footer">
                <button type="button" class="cdx-annotation-popup__btn cdx-annotation-popup__btn--remove">Remove</button>
                <button type="button" class="cdx-annotation-popup__btn cdx-annotation-popup__btn--save">Save</button>
            </div>
        `;

        // Position popup near the anchor element
        document.body.appendChild(this.popup);
        this.positionPopup(anchorElement);

        // Event listeners
        const closeBtn = this.popup.querySelector('.cdx-annotation-popup__close') as HTMLButtonElement;
        const removeBtn = this.popup.querySelector('.cdx-annotation-popup__btn--remove') as HTMLButtonElement;
        const saveBtn = this.popup.querySelector('.cdx-annotation-popup__btn--save') as HTMLButtonElement;
        const titleInput = this.popup.querySelector('.cdx-annotation-popup__input--title') as HTMLInputElement;
        const annotationInput = this.popup.querySelector(
            '.cdx-annotation-popup__input--annotation',
        ) as HTMLTextAreaElement;

        closeBtn?.addEventListener('click', () => this.closePopup());
        removeBtn?.addEventListener('click', () => this.removeAnnotation(anchorElement));
        saveBtn?.addEventListener('click', () =>
            this.saveAnnotation(anchorElement, titleInput?.value, annotationInput?.value),
        );

        // Close on outside click
        setTimeout(() => {
            document.addEventListener('mousedown', this.handleOutsideClick);
        }, 100);

        // Focus the annotation textarea
        annotationInput?.focus();
    }

    private handleOutsideClick = (e: MouseEvent): void => {
        if (this.popup && !this.popup.contains(e.target as Node)) {
            this.closePopup();
        }
    };

    private positionPopup(anchor: HTMLElement): void {
        if (!this.popup) return;

        const rect = anchor.getBoundingClientRect();
        const popupRect = this.popup.getBoundingClientRect();

        let top = rect.bottom + window.scrollY + 8;
        let left = rect.left + window.scrollX;

        // Keep within viewport
        if (left + popupRect.width > window.innerWidth) {
            left = window.innerWidth - popupRect.width - 16;
        }
        if (left < 0) left = 16;

        this.popup.style.top = `${top}px`;
        this.popup.style.left = `${left}px`;
    }

    private closePopup(): void {
        if (this.popup) {
            document.removeEventListener('mousedown', this.handleOutsideClick);
            this.popup.remove();
            this.popup = null;
        }
        this.currentRange = null;
        this.currentSpan = null;
    }

    private saveAnnotation(span: HTMLElement, title: string, annotation: string): void {
        span.dataset.title = title;
        span.dataset.annotation = annotation;

        // Only update text content if it was empty (new annotation) or if user explicitly cleared/changed the title
        // Keep original selected text otherwise
        const originalTitle = span.dataset.originalText;
        if (!originalTitle) {
            // First save: store original text
            span.dataset.originalText = span.textContent || '';
        }

        this.closePopup();
        this.api.blocks.getBlockByIndex(this.api.blocks.getCurrentBlockIndex())?.call('save');
    }

    private removeAnnotation(span: HTMLElement): void {
        // Replace the span with its text content
        const textNode = document.createTextNode(span.textContent || '');
        span.parentNode?.replaceChild(textNode, span);
        this.closePopup();
        this.api.blocks.getBlockByIndex(this.api.blocks.getCurrentBlockIndex())?.call('save');
    }

    private escapeHtml(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Actions displayed in the inline toolbar when annotation is selected
    renderActions(): HTMLElement {
        const wrapper = document.createElement('div');
        wrapper.classList.add('cdx-annotation-actions');

        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'cdx-annotation-actions__edit';
        editBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg> Edit annotation`;
        editBtn.addEventListener('click', () => {
            const annotationTag = this.api.selection.findParentTag(this.tag, this.class);
            if (annotationTag) {
                this.showPopup(annotationTag);
            }
        });

        wrapper.appendChild(editBtn);
        return wrapper;
    }

    /**
     * Clear Tools
     */
    clear(): void {
        this.closePopup();
    }
}
