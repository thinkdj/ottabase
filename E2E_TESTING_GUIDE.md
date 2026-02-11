# E2E Testing Guide for Ottabase

A comprehensive guide to end-to-end testing setup and best practices for the Ottabase monorepo.

## Quick Start

### 1. Initial Setup

```bash
# Install dependencies (already done)
pnpm install

# Install Playwright browsers
pnpm exec playwright install
```

### 2. Run Tests Locally

```bash
# Run all e2e tests (auto-starts dev server)
pnpm e2e

# Run in UI mode (interactive browser)
pnpm e2e:ui

# Debug with inspector
pnpm e2e:debug

# View test report
pnpm e2e:report
```

### 3. Test the Next.js App (Default)

Default configuration tests the Next.js template app on port 3000.

```bash
pnpm e2e
```

### 4. Test the TanStack App

To test the Vite + TanStack app instead:

```bash
# Using config file
CONFIG_FILE=e2e.config.tanstack.ts PLAYWRIGHT_TEST_BASE_URL=http://localhost:5173 pnpm e2e

# Or with Vite running on different port
pnpm e2e --config e2e.config.tanstack.ts
```

## Project Structure

```
ottabase/
├── e2e/
│   ├── README.md                 # E2E testing documentation
│   ├── auth.spec.ts              # Authentication and navigation tests
│   ├── forms.spec.ts             # Form interaction tests
│   └── accessibility.spec.ts     # A11y and SEO tests
├── playwright.config.ts          # Main Playwright configuration
├── e2e.config.tanstack.ts        # Alternative config for TanStack app
├── E2E_TESTING_GUIDE.md          # This file
└── .github/workflows/
    └── e2e.yml                   # GitHub Actions CI configuration
```

## Test Files Overview

### auth.spec.ts

Tests authentication flows, navigation, API integration, and performance:

- Login page display
- Page navigation
- API request handling
- Console error detection
- Page load performance
- Visibility state changes
- Responsive design

### forms.spec.ts

Tests form interactions and user input handling:

- Input changes
- Form submission
- Validation attributes
- Dropdown/select elements
- Textarea inputs
- Keyboard navigation
- Mouse interactions
- Focus management
- Text, numeric, email, password inputs
- Checkboxes and radio buttons

### accessibility.spec.ts

Tests accessibility compliance and SEO:

- HTML structure (DOCTYPE, language)
- Document titles
- Heading hierarchy
- Image alt text
- Button labels
- Link labels
- Form labels
- Keyboard navigation
- Enter key activation
- Focus indicators
- Color contrast
- Meta description
- Viewport tag
- Open Graph tags
- Canonical URLs
- Robots meta tag

## Running Tests in Different Ways

### By Pattern

```bash
# Run tests matching "form"
pnpm e2e -g "form"

# Run tests NOT matching "form"
pnpm e2e -g "form" --invert
```

### By File

```bash
# Run specific test file
pnpm e2e e2e/forms.spec.ts

# Run multiple files
pnpm e2e e2e/auth.spec.ts e2e/forms.spec.ts
```

### By Browser

```bash
# Chromium only
pnpm e2e --project=chromium

# Firefox only
pnpm e2e --project=firefox

# WebKit only
pnpm e2e --project=webkit

# Mobile Chrome
pnpm e2e --project="Mobile Chrome"
```

### Headed Mode

```bash
# See browser window while tests run
pnpm e2e --headed

# Single-threaded for easier debugging
pnpm e2e --headed --workers=1
```

## Development Workflow

### Writing New Tests

1. **Identify the feature** to test
2. **Create or update** test file in `e2e/`
3. **Follow the template** structure
4. **Use semantic selectors** (getByRole, getByLabel, etc.)
5. **Run test in UI mode** to debug:
    ```bash
    pnpm e2e:ui
    ```
6. **Step through** to verify behavior
7. **Commit** when tests pass

### Example: Adding a New Test

```typescript
// e2e/checkout.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Checkout Flow', () => {
    test('should complete purchase with valid card', async ({ page }) => {
        // 1. Navigate
        await page.goto('/checkout');
        await page.waitForLoadState('networkidle');

        // 2. Fill form
        await page.getByLabel('Card Number').fill('4242424242424242');
        await page.getByLabel('Expiry').fill('12/25');
        await page.getByLabel('CVC').fill('123');

        // 3. Submit
        await page.getByRole('button', { name: /pay/i }).click();

        // 4. Assert
        await expect(page).toHaveURL('/thank-you');
        await expect(page.getByText('Order confirmed')).toBeVisible();
    });
});
```

## Debugging Failed Tests

### Option 1: UI Mode

```bash
pnpm e2e:ui
```

Best for:

- Visual debugging
- Step-through execution
- Screenshot comparison
- Element inspection

### Option 2: Debug Mode

```bash
pnpm e2e:debug
```

Opens Playwright Inspector with:

- Page preview
- Locator explorer
- Console
- Network tab

### Option 3: HTML Report

```bash
pnpm e2e
# Tests fail...
pnpm e2e:report
```

Shows:

- Test timeline
- Screenshots at each step
- Video of entire test
- Full error messages
- Test traces (Inspector playback)

### Option 4: Traces

```bash
# View recorded trace
pnpm exec playwright show-trace path/to/trace.zip
```

Features:

- Replay test execution
- Inspect DOM at each step
- View network requests
- Debug timing issues

## CI/CD Integration

### GitHub Actions

Tests run automatically on:

- Push to `main` or `develop`
- Pull requests to `main` or `develop`
- Manual workflow dispatch (Actions → E2E Tests → Run workflow)

Configuration: `.github/workflows/e2e.yml`

### Environment Variables in CI

Set these in GitHub Settings → Secrets:

- `PLAYWRIGHT_TEST_BASE_URL` - Custom test URL
- Any app-specific variables

### Artifacts

CI automatically uploads:

- `playwright-report/` - HTML test report (30 days)
- `test-results/` - Videos and traces (7 days)

View in: Actions → [Workflow Run] → Artifacts

## Troubleshooting

### "Cannot find module '@playwright/test'"

```bash
# Install Playwright browsers
pnpm exec playwright install

# Or install with dependencies
pnpm exec playwright install --with-deps
```

### "Port 3000 is already in use"

```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use different port in playwright.config.ts
```

### Tests timeout

1. Increase timeout:

    ```typescript
    test(
        'my test',
        async ({ page }) => {
            // default is 30000ms
        },
        { timeout: 60000 },
    );
    ```

2. Check web server is running:

    ```bash
    curl http://localhost:3000
    ```

3. Wait for specific elements:
    ```typescript
    await page.locator('selector').waitFor({ timeout: 10000 });
    ```

### Tests fail only in CI

1. Check CI environment vs local:

    ```bash
    CI=true pnpm e2e
    ```

2. Increase retries:

    ```typescript
    // In playwright.config.ts
    retries: 3;
    ```

3. View CI artifacts (screenshots/videos)

### Flaky tests

1. **Avoid hard waits**:

    ```typescript
    // Bad
    await page.waitForTimeout(1000);

    // Good
    await page.waitForLoadState('networkidle');
    ```

2. **Use proper waits**:

    ```typescript
    // Good
    await page.locator('selector').waitFor({ state: 'visible' });
    await page.waitForNavigation();
    ```

3. **Isolate tests**:
    ```typescript
    test.beforeEach(async ({ page }) => {
        // Setup before each test
    });
    ```

## Best Practices

### 1. Maintainability

```typescript
// ✅ Good - Descriptive test names
test('should display error message when email is invalid', async ({ page }) => {

// ❌ Bad - Vague test name
test('should work', async ({ page }) => {
```

### 2. Reliability

```typescript
// ✅ Good - Specific wait
await page.locator('button[aria-label="Submit"]').waitFor({ state: 'visible' });

// ❌ Bad - Hard wait
await page.waitForTimeout(2000);
```

### 3. Accessibility

```typescript
// ✅ Good - Accessible selectors
page.getByRole('button', { name: /submit/i });
page.getByLabel('Email address');

// ❌ Bad - CSS/test IDs
page.locator('.btn-primary');
page.locator('[data-testid="email"]');
```

### 4. Assertions

```typescript
// ✅ Good - Specific assertions
expect(page).toHaveURL('/dashboard');
expect(page.getByText('Success')).toBeVisible();

// ❌ Bad - Generic checks
expect(page.url()).toBeTruthy();
```

### 5. Test Isolation

```typescript
// ✅ Good - Independent tests
test('should login successfully', async ({ page }) => {
    // Complete login flow
});

test('should show dashboard', async ({ page }) => {
    // Complete login flow
    // Then test dashboard
});

// ❌ Bad - Dependent tests
test('should login', async ({ page }) => {});
test('should show dashboard', async ({ page }) => {}); // Depends on previous test
```

## Performance Testing

### Check Page Load Time

```typescript
test('should load fast', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;

    expect(loadTime).toBeLessThan(3000); // 3 seconds
});
```

### Monitor Network Requests

```typescript
test('should make minimal requests', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (request) => {
        requests.push(request.url());
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    expect(requests.length).toBeLessThan(20);
});
```

## Reporting and Analytics

### Generate Coverage Report

```bash
pnpm e2e:report
```

### Integration with External Tools

Consider integrating with:

- **Sentry** - Error tracking
- **DataDog** - Performance monitoring
- **Slack** - Notifications
- **TestRail** - Test management

## Resources

- [Playwright Official Docs](https://playwright.dev)
- [Locators Guide](https://playwright.dev/docs/locators)
- [Debugging Guide](https://playwright.dev/docs/debug)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [CI Integration](https://playwright.dev/docs/ci)
- [API Reference](https://playwright.dev/docs/api/class-page)

## FAQ

**Q: How do I test authenticated pages?** A: Set up a test user and use `page.context()` to manage cookies/storage:

```typescript
test('authenticated page', async ({ page, context }) => {
    // Set auth token
    await context.addCookies([
        {
            name: 'auth_token',
            value: 'token',
            url: 'http://localhost:3000',
        },
    ]);
    await page.goto('/dashboard');
});
```

**Q: How do I test file uploads?** A: Use `page.locator().setInputFiles()`:

```typescript
await page.locator('input[type="file"]').setInputFiles('path/to/file.pdf');
```

**Q: How do I test WebSocket connections?** A: Listen to WebSocket events:

```typescript
page.on('websocket', (ws) => {
    console.log('WebSocket:', ws.url());
});
```

**Q: How do I run tests in parallel?** A: Configure in `playwright.config.ts`:

```typescript
workers: 4; // or remove for auto
```

**Q: How do I skip a test?** A: Use `test.skip()`:

```typescript
test.skip('flaky test', async ({ page }) => {
    // This test won't run
});
```

## Contributing

When adding features, please:

1. Write e2e tests for critical user workflows
2. Test across browsers (especially responsive features)
3. Include accessibility checks
4. Keep tests maintainable and focused
5. Update this guide if adding new test categories

## Support

For issues or questions:

1. Check the [Playwright Documentation](https://playwright.dev)
2. Review existing tests in `e2e/` for examples
3. Check [Playwright Issues](https://github.com/microsoft/playwright/issues)
4. Ask in team discussions
