import { defineConfig, devices } from '@playwright/test';

/**
 * Alternative Playwright configuration for testing the TanStack Hono app
 * Use with: PLAYWRIGHT_TEST_BASE_URL=http://localhost:5173 pnpm e2e
 */
export default defineConfig({
    testDir: './e2e',
    fullyParallel: true,
    forbidOnly: !!process.env['CI'],
    retries: process.env['CI'] ? 2 : 0,
    workers: process.env['CI'] ? 1 : undefined,
    reporter: 'html',
    use: {
        baseURL: process.env['PLAYWRIGHT_TEST_BASE_URL'] || 'http://localhost:5173',
        trace: 'on-first-retry',
    },

    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
        {
            name: 'firefox',
            use: { ...devices['Desktop Firefox'] },
        },
        {
            name: 'webkit',
            use: { ...devices['Desktop Safari'] },
        },
    ],

    /* Run your local dev server before starting the tests */
    webServer: {
        command: 'pnpm --filter @ottabase/ottabase-template-app-tanstack dev',
        url: 'http://localhost:5173',
        reuseExistingServer: !process.env['CI'],
        timeout: 120 * 1000,
    },
});
