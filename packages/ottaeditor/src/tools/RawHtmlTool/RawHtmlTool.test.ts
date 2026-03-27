import { describe, expect, it, vi } from 'vitest';
import { sanitizeRawHtml } from './RawHtmlSanitizer';
import RawHtmlTool from './RawHtmlTool';

const createMockAPI = () => ({
    blocks: { getCurrentBlockIndex: vi.fn(() => 0) },
    ui: { notifier: { show: vi.fn() } },
});

const createTool = (html: string) =>
    new RawHtmlTool({
        data: { html },
        config: {},
        api: createMockAPI() as any,
        block: {} as any,
        readOnly: false,
    });

describe('RawHtmlSanitizer', () => {
    it('removes wrapper/executable tags', () => {
        const html =
            '<html><head><style>.x{color:red}</style></head><body><script>alert(1)</script><p>safe</p></body></html>';

        const sanitized = sanitizeRawHtml(html);

        expect(sanitized).toBe('<p>safe</p>');
    });

    it('removes unsafe attributes and dangerous URLs', () => {
        const html =
            '<a href="javascript:alert(1)" target="_blank" onclick="x()">Link</a><img src="data:text/html;base64,abc" onerror="x()">';

        const sanitized = sanitizeRawHtml(html);

        expect(sanitized).toContain('<a target="_blank" rel="noopener noreferrer">Link</a>');
        expect(sanitized).toContain('<img>');
        expect(sanitized).not.toContain('javascript:');
        expect(sanitized).not.toContain('data:text/html');
        expect(sanitized).not.toContain('onclick');
        expect(sanitized).not.toContain('onerror');
    });

    it('keeps safe formatting tags', () => {
        const html = '<b>bold</b> <em>italics</em> <p>Hello <strong>world</strong></p>';

        const sanitized = sanitizeRawHtml(html);

        expect(sanitized).toBe('<b>bold</b> <em>italics</em> <p>Hello <strong>world</strong></p>');
    });
});

describe('RawHtmlTool', () => {
    it('sanitizes content on save', () => {
        const tool = createTool('<html><body><p>ok</p><iframe src="https://example.com"></iframe></body></html>');

        const saved = tool.save();

        expect(saved.html).toBe('<p>ok</p>');
    });

    it('updates and sanitizes input from editor textarea', () => {
        const tool = createTool('');

        const el = tool.render();
        const textarea = el.querySelector('textarea') as HTMLTextAreaElement;
        textarea.value = '<div onclick="evil()">safe</div><script>alert(1)</script>';
        textarea.dispatchEvent(new Event('input'));

        const saved = tool.save();

        expect(saved.html).toBe('<div>safe</div>');
    });

    it('validate returns false for empty sanitized content', () => {
        const tool = createTool('<script>alert(1)</script>');

        expect(tool.validate(tool.save())).toBe(false);
    });
});
