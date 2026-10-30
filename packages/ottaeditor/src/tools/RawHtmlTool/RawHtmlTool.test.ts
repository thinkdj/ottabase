import { fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { API } from '@editorjs/editorjs';
import { sanitizeRawHtml } from './RawHtmlSanitizer';
import RawHtmlTool from './RawHtmlTool';

const tools: RawHtmlTool[] = [];

function create(html: string) {
    const tool = new RawHtmlTool({ data: { html }, config: {}, api: {} as API, block: {} as never, readOnly: false });
    tools.push(tool);
    return tool;
}

afterEach(() => {
    tools.splice(0).forEach((t) => t.destroy());
    document.body.innerHTML = '';
});

describe('RawHtmlSanitizer', () => {
    it('removes wrapper/executable tags', () => {
        expect(
            sanitizeRawHtml(
                '<html><head><style>.x{color:red}</style></head><body><script>alert(1)</script><p>safe</p></body></html>',
            ),
        ).toBe('<p>safe</p>');
    });

    it('removes unsafe attributes and dangerous URLs', () => {
        const sanitized = sanitizeRawHtml(
            '<a href="javascript:alert(1)" target="_blank" onclick="x()">Link</a><img src="data:text/html;base64,abc" onerror="x()">',
        );
        expect(sanitized).toContain('<a target="_blank" rel="noopener noreferrer">Link</a>');
        expect(sanitized).toContain('<img>');
        expect(sanitized).not.toContain('javascript:');
        expect(sanitized).not.toContain('onclick');
    });

    it('keeps safe formatting tags', () => {
        expect(sanitizeRawHtml('<b>bold</b> <em>italics</em> <p>Hello <strong>world</strong></p>')).toBe(
            '<b>bold</b> <em>italics</em> <p>Hello <strong>world</strong></p>',
        );
    });
});

describe('RawHtmlTool', () => {
    it('takes its toolbox entry from the registry', () => {
        expect(RawHtmlTool.toolbox.title).toBe('HTML');
    });

    it('sanitises content on save', () => {
        expect(
            create('<html><body><p>ok</p><iframe src="https://example.com"></iframe></body></html>').save().html,
        ).toBe('<p>ok</p>');
    });

    it('edits through the HTML textarea and opens in edit mode when empty', () => {
        const tool = create('');
        const element = tool.render();
        document.body.appendChild(element);
        expect(element.dataset.mode).toBe('edit');
        fireEvent.input(screen.getByLabelText('HTML'), {
            target: { value: '<div onclick="evil()">safe</div><script>alert(1)</script>' },
        });
        expect(tool.save().html).toBe('<div>safe</div>');
    });

    it('opens in preview with content and validates emptiness after sanitising', () => {
        const filled = create('<p>x</p>');
        expect(filled.render().dataset.mode).toBe('preview');
        const empty = create('<script>alert(1)</script>');
        expect(empty.validate(empty.save())).toBe(false);
    });
});
