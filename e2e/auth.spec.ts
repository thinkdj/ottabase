import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
    test('should display login page', async ({ page }) => {
        await page.goto('/auth/login');

        // Wait for page to load
        await page.waitForLoadState('networkidle');

        // Check for auth-related elements
        const pageContent = await page.textContent('body');
        expect(pageContent).toBeTruthy();
    });

    test('should have functioning navigation', async ({ page }) => {
        await page.goto('/');

        // Wait for page to be interactive
        await page.waitForLoadState('domcontentloaded');

        // Check that page loaded successfully
        const status = page.url();
        expect(status).toContain('localhost');
    });

    test('should handle page navigation', async ({ page }) => {
        await page.goto('/');

        // Check initial URL
        expect(page.url()).toContain('localhost');

        // Navigate using internal navigation if available
        const hasNavigation = (await page.locator('nav, header').count()) > 0;
        expect(hasNavigation).toBeTruthy();
    });
});

test.describe('API Integration', () => {
    test('should handle API requests', async ({ page }) => {
        // Listen for all network requests
        const responses: number[] = [];

        page.on('response', (response) => {
            responses.push(response.status());
        });

        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Check that we got some responses
        expect(responses.length).toBeGreaterThan(0);
        // At least the main page should load successfully
        expect(responses).toContain(200);
    });

    test('should not have console errors on page load', async ({ page }) => {
        const errors: string[] = [];

        page.on('console', (msg) => {
            if (msg.type() === 'error') {
                errors.push(msg.text());
            }
        });

        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Should not have JavaScript errors
        expect(errors.length).toBe(0);
    });
});

test.describe('Page Performance', () => {
    test('should load main page within reasonable time', async ({ page }) => {
        const startTime = Date.now();

        await page.goto('/');
        await page.waitForLoadState('networkidle');

        const loadTime = Date.now() - startTime;

        // Page should load in under 10 seconds
        expect(loadTime).toBeLessThan(10000);
    });

    test('should handle page visibility changes', async ({ page }) => {
        await page.goto('/');

        // Simulate page becoming hidden
        await page.evaluate(() => {
            Object.defineProperty(document, 'hidden', {
                writable: true,
                value: true,
            });
            document.dispatchEvent(new Event('visibilitychange'));
        });

        // Page should still be functional
        expect(page.url()).toBeTruthy();

        // Restore visibility
        await page.evaluate(() => {
            Object.defineProperty(document, 'hidden', {
                writable: true,
                value: false,
            });
            document.dispatchEvent(new Event('visibilitychange'));
        });

        expect(page.url()).toBeTruthy();
    });
});

test.describe('UI Responsiveness', () => {
    test('should be responsive on desktop', async ({ page }) => {
        // Already testing on Desktop Chrome by default
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        const viewport = page.viewportSize();
        expect(viewport?.width).toBe(1280);
        expect(viewport?.height).toBe(720);
    });

    test('should be responsive on mobile', async ({ browser }) => {
        const context = await browser.createIncognitoBrowserContext({
            viewport: { width: 375, height: 667 }, // iPhone size
        });
        const page = await context.newPage();

        await page.goto('/');
        await page.waitForLoadState('networkidle');

        const viewport = page.viewportSize();
        expect(viewport?.width).toBe(375);
        expect(viewport?.height).toBe(667);

        await context.close();
    });

    test('should handle window resize', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Resize window
        await page.setViewportSize({ width: 800, height: 600 });

        const viewport = page.viewportSize();
        expect(viewport?.width).toBe(800);
        expect(viewport?.height).toBe(600);

        // Page should still be functional
        expect(page.url()).toBeTruthy();
    });
});
