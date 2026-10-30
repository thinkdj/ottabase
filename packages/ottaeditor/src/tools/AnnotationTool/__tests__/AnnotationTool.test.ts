import { fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { API } from '@editorjs/editorjs';
import AnnotationTool from '../AnnotationTool';

const createMockAPI = () => ({
    selection: { findParentTag: vi.fn(() => null as HTMLElement | null) },
    blocks: { getCurrentBlockIndex: vi.fn(() => 0), getBlockByIndex: vi.fn(() => ({ call: vi.fn() })) },
});

describe('AnnotationTool', () => {
    let api: ReturnType<typeof createMockAPI>;

    beforeEach(() => {
        api = createMockAPI();
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    const tool = () => new AnnotationTool({ api: api as unknown as API });

    it('is an inline tool that keeps the span contract', () => {
        expect(AnnotationTool.isInline).toBe(true);
        expect(AnnotationTool.title).toBe('Annotation');
        expect(AnnotationTool.sanitize.span).toEqual({ class: true, 'data-annotation': true, 'data-title': true });
    });

    it('renders an inline-toolbar button with an icon', () => {
        const b = tool().render();
        expect(b).toBeInstanceOf(HTMLButtonElement);
        expect(b.type).toBe('button');
        expect(b.classList.contains('ce-inline-tool')).toBe(true);
        expect(b.innerHTML).toContain('<svg');
    });

    it('reflects the active state from the selection', () => {
        const t = tool();
        const b = t.render();
        expect(t.checkState()).toBe(false);
        const span = document.createElement('span');
        span.classList.add('cdx-annotation');
        api.selection.findParentTag.mockReturnValue(span);
        expect(t.checkState()).toBe(true);
        expect(b.classList.contains('ce-inline-tool--active')).toBe(true);
        api.selection.findParentTag.mockReturnValue(null);
        t.checkState();
        expect(b.classList.contains('ce-inline-tool--active')).toBe(false);
    });

    it('wraps a selection, edits it in the popup and writes the data attributes', () => {
        const p = document.createElement('p');
        p.textContent = 'hello world';
        document.body.appendChild(p);
        const range = document.createRange();
        range.setStart(p.firstChild!, 0);
        range.setEnd(p.firstChild!, 5);

        const t = tool();
        t.surround(range);
        const span = p.querySelector('span.cdx-annotation') as HTMLElement;
        expect(span.textContent).toBe('hello');
        expect(span.dataset.title).toBe('hello');

        const dialog = screen.getByRole('dialog', { name: 'Edit annotation' });
        expect(dialog.classList.contains('oe-popup')).toBe(true);
        fireEvent.input(screen.getByLabelText('Annotation title'), { target: { value: 'Greeting' } });
        fireEvent.input(screen.getByLabelText('Annotation'), { target: { value: 'A friendly hello' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        expect(span.dataset.title).toBe('Greeting');
        expect(span.dataset.annotation).toBe('A friendly hello');
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(api.blocks.getBlockByIndex).toHaveBeenCalled();
    });

    it('removes an existing annotation back to plain text', () => {
        const p = document.createElement('p');
        const span = document.createElement('span');
        span.className = 'cdx-annotation';
        span.dataset.title = 'T';
        span.dataset.annotation = 'N';
        span.textContent = 'term';
        p.append('a ', span, ' b');
        document.body.appendChild(p);
        api.selection.findParentTag.mockReturnValue(span);

        tool().surround(document.createRange());
        fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
        expect(p.querySelector('span')).toBeNull();
        expect(p.textContent).toBe('a term b');
    });

    it('offers an edit action in the inline toolbar and clears without throwing', () => {
        const t = tool();
        const actions = t.renderActions();
        expect(actions.querySelector('button')?.textContent).toContain('Edit annotation');
        expect(() => t.clear()).not.toThrow();
    });
});
