import { describe, it, expect } from 'vitest';
import { renderHTML } from '../renderer';
import type { ParsedError, MetadataGroup } from '../types';

describe('renderHTML', () => {
    const makeParsedError = (overrides: Partial<ParsedError> = {}): ParsedError => ({
        type: 'Error',
        message: 'Something went wrong',
        frames: [
            {
                raw: '    at doSomething (/app/src/handler.ts:42:10)',
                file: '/app/src/handler.ts',
                line: 42,
                column: 10,
                function: 'doSomething',
                isApp: true,
            },
            {
                raw: '    at Module._compile (node:internal/modules/cjs/loader:1241:14)',
                file: 'node:internal/modules/cjs/loader',
                line: 1241,
                column: 14,
                function: 'Module._compile',
                isApp: false,
            },
        ],
        properties: {},
        ...overrides,
    });

    it('should return a valid HTML document', () => {
        const html = renderHTML(makeParsedError());

        expect(html).toContain('<!DOCTYPE html>');
        expect(html).toContain('<html');
        expect(html).toContain('</html>');
    });

    it('should include error type and message', () => {
        const html = renderHTML(makeParsedError({ type: 'TypeError', message: 'null is not an object' }));

        expect(html).toContain('TypeError');
        expect(html).toContain('null is not an object');
    });

    it('should include stack frames', () => {
        const html = renderHTML(makeParsedError());

        expect(html).toContain('doSomething');
        expect(html).toContain('/app/src/handler.ts');
        expect(html).toContain('42:10');
    });

    it('should mark app frames with badge', () => {
        const html = renderHTML(makeParsedError());

        expect(html).toContain('is-app');
        expect(html).toContain('ep-app-badge');
    });

    it('should include editor links with vscode by default', () => {
        const html = renderHTML(makeParsedError());

        expect(html).toContain('vscode://file/');
    });

    it('should use custom IDE when specified', () => {
        const html = renderHTML(makeParsedError(), [], { ide: 'sublime' });

        expect(html).toContain('subl://open');
    });

    it('should include dark/light theme toggle', () => {
        const html = renderHTML(makeParsedError());

        expect(html).toContain('ep-theme-toggle');
        expect(html).toContain('html.dark');
    });

    it('should include Stack Trace and Raw tabs', () => {
        const html = renderHTML(makeParsedError());

        expect(html).toContain('Stack Trace');
        expect(html).toContain('Raw');
    });

    it('should include raw JSON output with error data', () => {
        const html = renderHTML(makeParsedError({ type: 'RangeError', message: 'out of bounds' }));

        expect(html).toContain('RangeError');
        expect(html).toContain('out of bounds');
    });

    it('should render error cause when present', () => {
        const parsed = makeParsedError({
            cause: {
                type: 'DatabaseError',
                message: 'Connection refused',
                frames: [],
                properties: {},
            },
        });
        const html = renderHTML(parsed);

        expect(html).toContain('Error Cause');
        expect(html).toContain('DatabaseError');
        expect(html).toContain('Connection refused');
    });

    it('should render metadata groups', () => {
        const metadata: MetadataGroup[] = [
            {
                name: 'Request',
                sections: {
                    info: [
                        { key: 'Method', value: 'GET' },
                        { key: 'URL', value: 'https://example.com/api/test' },
                    ],
                    headers: [{ key: 'user-agent', value: 'Mozilla/5.0' }],
                },
            },
        ];
        const html = renderHTML(makeParsedError(), metadata);

        expect(html).toContain('Request');
        expect(html).toContain('Method');
        expect(html).toContain('GET');
        expect(html).toContain('user-agent');
        expect(html).toContain('Mozilla/5.0');
    });

    it('should render error properties as badges', () => {
        const parsed = makeParsedError({
            properties: { code: 'NOT_FOUND', status: 404 },
        });
        const html = renderHTML(parsed);

        expect(html).toContain('code');
        expect(html).toContain('NOT_FOUND');
        expect(html).toContain('status');
        expect(html).toContain('404');
    });

    it('should include custom title', () => {
        const html = renderHTML(makeParsedError(), [], { title: 'Server Error' });

        expect(html).toContain('Server Error');
    });

    it('should add CSP nonce to style and script tags', () => {
        const html = renderHTML(makeParsedError(), [], { cspNonce: 'abc123' });

        expect(html).toContain('nonce="abc123"');
    });

    it('should handle empty frames gracefully', () => {
        const html = renderHTML(makeParsedError({ frames: [] }));

        expect(html).toContain('No stack frames available');
    });

    it('should escape HTML in error messages', () => {
        const html = renderHTML(makeParsedError({ message: '<script>alert("xss")</script>' }));

        expect(html).not.toContain('<script>alert("xss")</script>');
        expect(html).toContain('&lt;script&gt;');
    });
});
