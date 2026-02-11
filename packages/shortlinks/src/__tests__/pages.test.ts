import { describe, it, expect } from 'vitest';
import { renderExpiredShortlinkPage, renderShortlinkInterstitialPage } from '../index.js';

describe('Shortlink Page Renderers', () => {
    describe('renderExpiredShortlinkPage', () => {
        it('should return a Response object', () => {
            const response = renderExpiredShortlinkPage();
            expect(response).toBeInstanceOf(Response);
        });

        it('should return status 410 (Gone)', () => {
            const response = renderExpiredShortlinkPage();
            expect(response.status).toBe(410);
        });

        it('should set Content-Type header to text/html', () => {
            const response = renderExpiredShortlinkPage();
            const contentType = response.headers.get('Content-Type');
            expect(contentType).toBe('text/html; charset=utf-8');
        });

        it('should set Cache-Control header to no-store', () => {
            const response = renderExpiredShortlinkPage();
            const cacheControl = response.headers.get('Cache-Control');
            expect(cacheControl).toBe('no-store');
        });

        it('should contain valid HTML structure', async () => {
            const response = renderExpiredShortlinkPage();
            const html = await response.text();

            expect(html).toContain('<!doctype html>');
            expect(html).toContain('<html lang="en">');
            expect(html).toContain('</html>');
        });

        it('should include meta charset UTF-8', async () => {
            const response = renderExpiredShortlinkPage();
            const html = await response.text();

            expect(html).toContain('<meta charset="utf-8" />');
        });

        it('should include viewport meta tag', async () => {
            const response = renderExpiredShortlinkPage();
            const html = await response.text();

            expect(html).toContain('<meta name="viewport" content="width=device-width, initial-scale=1" />');
        });

        it('should have title "Link Expired"', async () => {
            const response = renderExpiredShortlinkPage();
            const html = await response.text();

            expect(html).toContain('<title>Link Expired</title>');
        });

        it('should include theme detection script', async () => {
            const response = renderExpiredShortlinkPage();
            const html = await response.text();

            expect(html).toContain('localStorage.getItem("ottabase-theme")');
            expect(html).toContain('data-theme');
        });

        it('should include system theme preference detection', async () => {
            const response = renderExpiredShortlinkPage();
            const html = await response.text();

            expect(html).toContain('prefers-color-scheme');
        });

        it('should include CSS styles', async () => {
            const response = renderExpiredShortlinkPage();
            const html = await response.text();

            expect(html).toContain('<style>');
            expect(html).toContain('</style>');
        });

        it('should include expiration message', async () => {
            const response = renderExpiredShortlinkPage();
            const html = await response.text();

            expect(html).toContain('Link expired');
            expect(html).toContain('This shortlink is no longer available');
        });

        it('should include SVG icon', async () => {
            const response = renderExpiredShortlinkPage();
            const html = await response.text();

            expect(html).toContain('<svg');
            expect(html).toContain('</svg>');
        });

        it('should have proper content structure', async () => {
            const response = renderExpiredShortlinkPage();
            const html = await response.text();

            expect(html).toContain('<div class="wrap">');
            expect(html).toContain('<div class="content">');
            expect(html).toContain('<h1>');
            expect(html).toContain('<p>');
        });

        it('should include proper body structure', async () => {
            const response = renderExpiredShortlinkPage();
            const html = await response.text();

            expect(html).toContain('<body>');
            expect(html).toContain('</body>');
        });

        it('should not be cached', () => {
            const response = renderExpiredShortlinkPage();
            const cacheControl = response.headers.get('Cache-Control');

            expect(cacheControl).toContain('no-store');
        });
    });

    describe('renderShortlinkInterstitialPage', () => {
        it('should return a Response object', () => {
            const response = renderShortlinkInterstitialPage({
                url: 'https://example.com',
            });
            expect(response).toBeInstanceOf(Response);
        });

        it('should return status 200 (OK)', () => {
            const response = renderShortlinkInterstitialPage({
                url: 'https://example.com',
            });
            expect(response.status).toBe(200);
        });

        it('should set Content-Type header to text/html', () => {
            const response = renderShortlinkInterstitialPage({
                url: 'https://example.com',
            });
            const contentType = response.headers.get('Content-Type');
            expect(contentType).toBe('text/html; charset=utf-8');
        });

        it('should set Cache-Control header to no-store', () => {
            const response = renderShortlinkInterstitialPage({
                url: 'https://example.com',
            });
            const cacheControl = response.headers.get('Cache-Control');
            expect(cacheControl).toBe('no-store');
        });

        it('should contain the target URL in HTML', async () => {
            const targetUrl = 'https://example.com/page';
            const response = renderShortlinkInterstitialPage({
                url: targetUrl,
            });
            const html = await response.text();

            expect(html).toContain(targetUrl);
        });

        it('should use default countdown of 10 seconds', async () => {
            const response = renderShortlinkInterstitialPage({
                url: 'https://example.com',
            });
            const html = await response.text();

            expect(html).toContain('var remaining = 10');
        });

        it('should respect custom countdown seconds', async () => {
            const response = renderShortlinkInterstitialPage({
                url: 'https://example.com',
                seconds: 5,
            });
            const html = await response.text();

            expect(html).toContain('var remaining = 5');
        });

        it('should clamp countdown to minimum of 1 second', async () => {
            const response = renderShortlinkInterstitialPage({
                url: 'https://example.com',
                seconds: 0,
            });
            const html = await response.text();

            expect(html).toContain('var remaining = 1');
        });

        it('should clamp countdown to maximum of 60 seconds', async () => {
            const response = renderShortlinkInterstitialPage({
                url: 'https://example.com',
                seconds: 120,
            });
            const html = await response.text();

            expect(html).toContain('var remaining = 60');
        });

        it('should include countdown display element', async () => {
            const response = renderShortlinkInterstitialPage({
                url: 'https://example.com',
            });
            const html = await response.text();

            expect(html).toContain('<div class="count" id="countdown">');
        });

        it('should include theme detection script', async () => {
            const response = renderShortlinkInterstitialPage({
                url: 'https://example.com',
            });
            const html = await response.text();

            expect(html).toContain('localStorage.getItem("ottabase-theme")');
        });

        it('should include redirect functionality script', async () => {
            const response = renderShortlinkInterstitialPage({
                url: 'https://example.com',
            });
            const html = await response.text();

            expect(html).toContain('window.location.href');
            expect(html).toContain('setTimeout');
        });

        it('should truncate long URLs', async () => {
            const longUrl = 'https://example.com/very/long/url/that/exceeds/the/max/length';
            const response = renderShortlinkInterstitialPage({
                url: longUrl,
            });
            const html = await response.text();

            // Should contain truncated version with ellipsis in display
            expect(html).toContain('…');
        });

        it('should not truncate short URLs', async () => {
            const shortUrl = 'https://example.com';
            const response = renderShortlinkInterstitialPage({
                url: shortUrl,
            });
            const html = await response.text();

            expect(html).toContain(shortUrl);
        });

        it('should include noopener and noreferrer on link', async () => {
            const response = renderShortlinkInterstitialPage({
                url: 'https://example.com',
            });
            const html = await response.text();

            expect(html).toContain('rel="noopener noreferrer"');
        });

        it('should have title "Redirecting…"', async () => {
            const response = renderShortlinkInterstitialPage({
                url: 'https://example.com',
            });
            const html = await response.text();

            expect(html).toContain('<title>Redirecting…</title>');
        });

        it('should include proper content structure', async () => {
            const response = renderShortlinkInterstitialPage({
                url: 'https://example.com',
            });
            const html = await response.text();

            expect(html).toContain('<div class="wrap">');
            expect(html).toContain('<div class="content">');
            expect(html).toContain('<h1>');
        });

        it('should include countdown in initial display', async () => {
            const response = renderShortlinkInterstitialPage({
                url: 'https://example.com',
                seconds: 15,
            });
            const html = await response.text();

            expect(html).toContain('<div class="count" id="countdown">15</div>');
        });

        it('should have valid HTML structure', async () => {
            const response = renderShortlinkInterstitialPage({
                url: 'https://example.com',
            });
            const html = await response.text();

            expect(html).toContain('<!doctype html>');
            expect(html).toContain('<html lang="en">');
            expect(html).toContain('</html>');
        });

        it('should properly escape URL for JavaScript', async () => {
            const url = 'https://example.com/test?param=value&other=123';
            const response = renderShortlinkInterstitialPage({
                url,
            });
            const html = await response.text();

            // URL should be JSON-stringified in JavaScript
            expect(html).toContain(JSON.stringify(url));
        });

        it('should handle URLs with special characters', async () => {
            const url = 'https://example.com/path?query=value&other=test#anchor';
            const response = renderShortlinkInterstitialPage({
                url,
            });
            const html = await response.text();

            expect(html).toContain(JSON.stringify(url));
        });
    });
});
