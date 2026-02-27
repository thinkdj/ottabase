import { describe, it, expect } from 'vitest';
import { ErrorPage } from '../index';

describe('ErrorPage', () => {
    it('should create an instance', () => {
        const errorPage = new ErrorPage();
        expect(errorPage).toBeInstanceOf(ErrorPage);
    });

    it('should render error to HTML', () => {
        const errorPage = new ErrorPage();
        const html = errorPage.toHTML(new Error('Test error'));

        expect(html).toContain('<!DOCTYPE html>');
        expect(html).toContain('Test error');
        expect(html).toContain('Error');
    });

    it('should accept metadata groups', () => {
        const errorPage = new ErrorPage();
        errorPage.group('Request', {
            info: [
                { key: 'Method', value: 'POST' },
                { key: 'URL', value: '/api/users' },
            ],
        });

        const html = errorPage.toHTML(new Error('Not found'));

        expect(html).toContain('Request');
        expect(html).toContain('POST');
        expect(html).toContain('/api/users');
    });

    it('should merge metadata groups with the same name', () => {
        const errorPage = new ErrorPage();
        errorPage.group('Request', {
            info: [{ key: 'Method', value: 'GET' }],
        });
        errorPage.group('Request', {
            headers: [{ key: 'Host', value: 'example.com' }],
        });

        const html = errorPage.toHTML(new Error('Test'));

        expect(html).toContain('Method');
        expect(html).toContain('Host');
        expect(html).toContain('example.com');
    });

    it('should support chaining on group()', () => {
        const errorPage = new ErrorPage();
        const result = errorPage.group('Test', { a: [{ key: 'k', value: 'v' }] });

        expect(result).toBe(errorPage);
    });

    it('should parse errors independently via parse()', () => {
        const errorPage = new ErrorPage();
        const parsed = errorPage.parse(new TypeError('Cannot read'));

        expect(parsed.type).toBe('TypeError');
        expect(parsed.message).toBe('Cannot read');
        expect(parsed.frames.length).toBeGreaterThan(0);
    });

    it('should pass HTML options through', () => {
        const errorPage = new ErrorPage();
        const html = errorPage.toHTML(new Error('Test'), {
            title: 'Custom Title',
            ide: 'sublime',
            cspNonce: 'test-nonce',
        });

        expect(html).toContain('Custom Title');
        expect(html).toContain('subl://open');
        expect(html).toContain('nonce="test-nonce"');
    });

    it('should handle non-Error values', () => {
        const errorPage = new ErrorPage();
        const html = errorPage.toHTML('string error');

        expect(html).toContain('string error');
    });

    it('should handle error with cause', () => {
        const errorPage = new ErrorPage();
        const cause = new Error('Database connection failed');
        const error = new Error('Service unavailable', { cause });
        const html = errorPage.toHTML(error);

        expect(html).toContain('Service unavailable');
        expect(html).toContain('Database connection failed');
        expect(html).toContain('Error Cause');
    });

    it('should handle error with extra properties', () => {
        const errorPage = new ErrorPage();
        const error = new Error('Bad request');
        (error as Record<string, unknown>).status = 400;
        (error as Record<string, unknown>).code = 'VALIDATION_ERROR';

        const html = errorPage.toHTML(error);

        expect(html).toContain('400');
        expect(html).toContain('VALIDATION_ERROR');
    });

    it('should add request metadata from Request object', () => {
        const errorPage = new ErrorPage();
        const request = new Request('https://example.com/api/test?q=1', {
            method: 'POST',
            headers: {
                'user-agent': 'TestAgent/1.0',
                'content-type': 'application/json',
            },
        });

        errorPage.addRequestMetadata(request);
        const html = errorPage.toHTML(new Error('Test'));

        expect(html).toContain('POST');
        expect(html).toContain('/api/test');
        expect(html).toContain('TestAgent/1.0');
    });

    it('should mask sensitive headers in request metadata', () => {
        const errorPage = new ErrorPage();
        const request = new Request('https://example.com/', {
            headers: {
                authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.secret',
            },
        });

        errorPage.addRequestMetadata(request);
        const html = errorPage.toHTML(new Error('Test'));

        // Should mask the middle of the token
        expect(html).toContain('Bear');
        expect(html).toContain('****');
        expect(html).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.secret');
    });

    it('should support offset option to skip frames', () => {
        const errorPage = new ErrorPage();

        const htmlNoOffset = errorPage.toHTML(new Error('Test'), { offset: 0 });
        const htmlWithOffset = errorPage.toHTML(new Error('Test'), { offset: 5 });

        // Both should be valid HTML, but offset version may have fewer frames
        expect(htmlNoOffset).toContain('<!DOCTYPE html>');
        expect(htmlWithOffset).toContain('<!DOCTYPE html>');
    });

    it('should render production-safe error page via toProductionHTML', () => {
        const errorPage = new ErrorPage();
        const html = errorPage.toProductionHTML(500);

        expect(html).toContain('<!DOCTYPE html>');
        expect(html).toContain('500');
        expect(html).toContain('Server Error');
        expect(html).not.toContain('Stack Trace');
    });

    it('should render production page with custom title', () => {
        const errorPage = new ErrorPage();
        const html = errorPage.toProductionHTML(403, { title: 'Forbidden' });

        expect(html).toContain('403');
        expect(html).toContain('Forbidden');
    });
});
