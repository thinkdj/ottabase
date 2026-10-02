// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
    sanitizeBlockHtml,
    sanitizeCssForStyleTag,
    sanitizeInlineHtml,
    sanitizeJsonForScript,
    sanitizeSvgHtml,
    sanitizeUrl,
} from '../sanitize';

describe('sanitizeInlineHtml', () => {
    it('passes through safe inline tags', () => {
        const input = 'Hello <strong>world</strong> and <em>italics</em>';
        expect(sanitizeInlineHtml(input)).toBe(input);
    });

    it('allows anchor tags with href', () => {
        const input = '<a href="https://example.com" rel="noopener noreferrer">link</a>';
        expect(sanitizeInlineHtml(input)).toContain('href="https://example.com"');
    });

    it('strips script tags', () => {
        const input = '<strong>ok</strong><script>alert(1)</script>';
        expect(sanitizeInlineHtml(input)).not.toContain('<script>');
        expect(sanitizeInlineHtml(input)).toContain('<strong>ok</strong>');
    });

    it('strips event handler attributes', () => {
        const input = '<strong onmouseover="alert(1)">text</strong>';
        expect(sanitizeInlineHtml(input)).not.toContain('onmouseover');
        expect(sanitizeInlineHtml(input)).toContain('<strong>text</strong>');
    });

    it('strips disallowed block tags (div, h1)', () => {
        const input = 'text<div>block</div><h1>heading</h1>';
        const result = sanitizeInlineHtml(input);
        expect(result).not.toContain('<div>');
        expect(result).not.toContain('<h1>');
        // text content is preserved
        expect(result).toContain('block');
    });

    it('handles empty string', () => {
        expect(sanitizeInlineHtml('')).toBe('');
    });
});

describe('sanitizeCssForStyleTag', () => {
    it('neutralizes style break-out and javascript URLs', () => {
        const input = 'body{color:red}</style><script>alert(1)</script>.x{background:url(javascript:alert(1))}';
        const result = sanitizeCssForStyleTag(input);
        expect(result).not.toContain('</style>');
        expect(result).not.toContain('<script>');
        expect(result).not.toContain('javascript:');
    });
});

describe('sanitizeBlockHtml', () => {
    it('passes through safe block HTML', () => {
        const input = '<h2>Title</h2><p>Paragraph with <strong>bold</strong></p>';
        const result = sanitizeBlockHtml(input);
        expect(result).toContain('<h2>Title</h2>');
        expect(result).toContain('<strong>bold</strong>');
    });

    it('strips script tags', () => {
        const input = '<p>hello</p><script>alert(1)</script>';
        expect(sanitizeBlockHtml(input)).not.toContain('<script>');
    });

    it('strips javascript: href', () => {
        const input = '<a href="javascript:alert(1)">click</a>';
        const result = sanitizeBlockHtml(input);
        expect(result).not.toContain('javascript:');
    });
});

describe('sanitizeSvgHtml', () => {
    it('passes through a safe inline SVG', () => {
        const input = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M0 0h24v24H0z"/></svg>';
        const result = sanitizeSvgHtml(input);
        expect(result).toContain('<svg');
        expect(result).toContain('<path');
    });

    it('strips script inside SVG', () => {
        const input = '<svg><script>alert(1)</script><circle r="5"/></svg>';
        expect(sanitizeSvgHtml(input)).not.toContain('<script>');
    });
});

describe('sanitizeUrl', () => {
    it('allows https URLs', () => {
        expect(sanitizeUrl('https://example.com/path')).toBe('https://example.com/path');
    });

    it('allows http URLs', () => {
        expect(sanitizeUrl('http://example.com')).toBe('http://example.com');
    });

    it('allows mailto', () => {
        expect(sanitizeUrl('mailto:user@example.com')).toBe('mailto:user@example.com');
    });

    it('allows tel', () => {
        expect(sanitizeUrl('tel:+15551234567')).toBe('tel:+15551234567');
    });

    it('allows root-relative URLs', () => {
        expect(sanitizeUrl('/about')).toBe('/about');
    });

    it('blocks protocol-relative URLs, including backslash and whitespace variants', () => {
        for (const url of [
            '//evil.com',
            '/\\evil.com',
            '\\\\evil.com',
            '/\t/evil.com',
            '/\n/evil.com',
            ' //evil.com',
        ]) {
            expect(sanitizeUrl(url)).toBe('#');
        }
    });

    it('allows fragment-only links', () => {
        expect(sanitizeUrl('#section')).toBe('#section');
    });

    it('blocks javascript: scheme', () => {
        expect(sanitizeUrl('javascript:alert(1)')).toBe('#');
    });

    it('blocks javascript: with uppercase', () => {
        expect(sanitizeUrl('JAVASCRIPT:alert(1)')).toBe('#');
    });

    it('blocks data: URIs', () => {
        expect(sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBe('#');
    });

    it('blocks vbscript:', () => {
        expect(sanitizeUrl('vbscript:MsgBox(1)')).toBe('#');
    });

    it('returns # for null/undefined/empty', () => {
        expect(sanitizeUrl(null)).toBe('#');
        expect(sanitizeUrl(undefined)).toBe('#');
        expect(sanitizeUrl('')).toBe('#');
    });
});

describe('sanitizeJsonForScript', () => {
    it('escapes characters that can break script context', () => {
        const raw = {
            text: '</script><script>alert(1)</script>',
            other: '& < >',
        };

        const result = sanitizeJsonForScript(raw);
        expect(result).not.toContain('</script>');
        expect(result).toContain('\\u003c/script\\u003e');
        expect(result).toContain('\\u0026');
    });

    it('returns null literal for undefined input', () => {
        expect(sanitizeJsonForScript(undefined)).toBe('null');
    });

    it('returns null literal for circular input', () => {
        const circular: Record<string, unknown> = {};
        circular.self = circular;

        expect(sanitizeJsonForScript(circular)).toBe('null');
    });
});
