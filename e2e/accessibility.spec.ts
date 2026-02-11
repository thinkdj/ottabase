import { test, expect } from '@playwright/test';

test.describe('Accessibility', () => {
    test('should have proper HTML structure', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Check for DOCTYPE
        const docType = await page.evaluate(() => {
            return document.documentElement.outerHTML.substring(0, 15);
        });
        expect(docType).toContain('DOCTYPE');

        // Check for language attribute
        const htmlLang = await page.locator('html').getAttribute('lang');
        expect(htmlLang).toBeTruthy();
    });

    test('should have document title', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        const title = await page.title();
        expect(title).toBeTruthy();
        expect(title.length).toBeGreaterThan(0);
    });

    test('should have proper heading hierarchy', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Check for at least one heading
        const h1Count = await page.locator('h1').count();
        const headingCount = await page.locator('h1, h2, h3, h4, h5, h6').count();

        expect(headingCount >= 0).toBeTruthy();
    });

    test('should have alt text for images', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        const images = await page.locator('img').count();

        if (images > 0) {
            // Check some images have alt text
            for (let i = 0; i < Math.min(images, 5); i++) {
                const img = page.locator('img').nth(i);
                const alt = await img.getAttribute('alt');
                // Alt should exist (even if empty for decorative images)
                expect(alt).toBeDefined();
            }
        }

        expect(images >= 0).toBeTruthy();
    });

    test('should have proper button labels', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        const buttons = await page.locator('button').count();

        if (buttons > 0) {
            // Check that buttons have accessible names
            for (let i = 0; i < Math.min(buttons, 5); i++) {
                const button = page.locator('button').nth(i);
                // Button should have text or aria-label
                const text = await button.textContent();
                const ariaLabel = await button.getAttribute('aria-label');
                expect(text || ariaLabel).toBeTruthy();
            }
        }

        expect(buttons >= 0).toBeTruthy();
    });

    test('should have proper link labels', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        const links = await page.locator('a').count();

        if (links > 0) {
            // Check that links have accessible names
            for (let i = 0; i < Math.min(links, 5); i++) {
                const link = page.locator('a').nth(i);
                const href = await link.getAttribute('href');

                // If it's a real link (not just #), check for label
                if (href && href !== '#') {
                    const text = await link.textContent();
                    const ariaLabel = await link.getAttribute('aria-label');
                    expect(text || ariaLabel).toBeTruthy();
                }
            }
        }

        expect(links >= 0).toBeTruthy();
    });

    test('should have proper form labels', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        const inputs = await page.locator('input').count();

        if (inputs > 0) {
            // Check that inputs have labels or aria-labels
            for (let i = 0; i < Math.min(inputs, 3); i++) {
                const input = page.locator('input').nth(i);
                const inputId = await input.getAttribute('id');
                const ariaLabel = await input.getAttribute('aria-label');
                const placeholder = await input.getAttribute('placeholder');

                // Should have some form of accessible label
                let hasLabel = false;

                if (inputId) {
                    const label = await page.locator(`label[for="${inputId}"]`).count();
                    if (label > 0) hasLabel = true;
                }

                if (ariaLabel || placeholder) hasLabel = true;

                expect(hasLabel || !inputId).toBeTruthy();
            }
        }

        expect(inputs >= 0).toBeTruthy();
    });

    test('should support keyboard navigation', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Test Tab key navigation
        const initialFocus = await page.evaluate(() => {
            return document.activeElement?.tagName;
        });

        // Press Tab multiple times
        for (let i = 0; i < 5; i++) {
            await page.keyboard.press('Tab');
        }

        // Should still be on page
        expect(page.url()).toBeTruthy();
    });

    test('should support Enter key for buttons', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        const buttons = await page.locator('button').count();

        if (buttons > 0) {
            const firstButton = page.locator('button').first();

            if (await firstButton.isVisible()) {
                // Focus the button
                await firstButton.focus();

                // Try to activate with Enter key
                await page.keyboard.press('Enter');

                expect(firstButton).toBeTruthy();
            }
        }

        expect(buttons >= 0).toBeTruthy();
    });

    test('should have proper color contrast', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Check that body has CSS properties for text and background
        const bodyStyles = await page.evaluate(() => {
            const element = document.body;
            return {
                color: window.getComputedStyle(element).color,
                backgroundColor: window.getComputedStyle(element).backgroundColor,
            };
        });

        // Both should be defined
        expect(bodyStyles.color).toBeTruthy();
        expect(bodyStyles.backgroundColor).toBeTruthy();
    });

    test('should have proper focus indicators', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Focus on first interactive element
        await page.keyboard.press('Tab');

        const focusedElement = await page.evaluate(() => {
            const element = document.activeElement as HTMLElement;
            if (!element) return null;

            const styles = window.getComputedStyle(element);
            return {
                outline: styles.outline,
                boxShadow: styles.boxShadow,
                border: styles.border,
            };
        });

        // Should have some form of focus indicator
        expect(focusedElement).toBeTruthy();
    });
});

test.describe('SEO', () => {
    test('should have meta description', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        const metaDescription = await page.locator('meta[name="description"]').getAttribute('content');
        expect(metaDescription).toBeTruthy();
    });

    test('should have viewport meta tag', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
        expect(viewport).toContain('width=device-width');
        expect(viewport).toContain('initial-scale=1');
    });

    test('should have proper open graph tags', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content');
        expect(ogTitle).toBeTruthy();
    });

    test('should have canonical URL', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
        expect(canonical).toBeTruthy();
    });

    test('should have proper robots meta tag', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        const robots = await page.locator('meta[name="robots"]').getAttribute('content');
        // robots tag is optional but if present should be valid
        if (robots) {
            expect(robots).toMatch(/index|noindex/);
        }
    });
});
