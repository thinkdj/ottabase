# End-to-End Testing with Playwright

This directory contains end-to-end (e2e) tests for the Ottabase applications using
[Playwright](https://playwright.dev/).

## Overview

The e2e test suite ensures that the applications work correctly from a user's perspective, testing real workflows rather
than individual units. Tests cover:

- **Authentication flows** - Login, session management, protected routes
- **Form interactions** - Input validation, submission, error handling
- **API integration** - Network requests, error responses
- **Accessibility** - WCAG compliance, keyboard navigation, semantic HTML
- **SEO** - Meta tags, Open Graph, structured data
- **UI responsiveness** - Desktop and mobile viewports
- **Performance** - Page load times, no console errors

## Setup

### Installation

Playwright is already installed as a dev dependency. To set up Playwright browsers:

```bash
pnpm exec playwright install
```

### Configuration

The main configuration file is `playwright.config.ts` in the root directory. Key settings:

- **Base URL**: `http://localhost:3000` (configurable via `PLAYWRIGHT_TEST_BASE_URL`)
- **Browsers**: Chromium, Firefox, WebKit
- **Mobile viewports**: iPhone 12, Pixel 5
- **Reporters**: HTML report
- **Web server**: Automatically starts the Next.js dev server

## Running Tests

### Run all e2e tests

```bash
pnpm e2e
```

### Run tests in UI mode (interactive)

```bash
pnpm e2e:ui
```

This opens the Playwright Inspector where you can:

- Run tests step-by-step
- Debug individual assertions
- View screenshots and videos
- Inspect page elements

### Run tests in debug mode

```bash
pnpm e2e:debug
```

### Run specific test file

```bash
pnpm exec playwright test e2e/auth.spec.ts
```

### Run tests with specific browser

```bash
pnpm exec playwright test --project=firefox
```

### Run tests matching pattern

```bash
pnpm exec playwright test -g "should handle form input"
```

### View HTML report

```bash
pnpm e2e:report
```

## Test Structure

Tests are organized by feature/concern:

- **auth.spec.ts** - Authentication and navigation flows
- **forms.spec.ts** - Form interactions and validation
- **accessibility.spec.ts** - A11y compliance and SEO

### Test File Template

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
    test('should do something', async ({ page }) => {
        await page.goto('/path');
        await page.waitForLoadState('networkidle');

        // Interact with page
        const element = page.locator('selector');
        await element.click();

        // Assert
        expect(element).toBeVisible();
    });
});
```

## Writing Tests

### Best Practices

1. **Use semantic selectors** - Prefer accessible selectors:

    ```typescript
    // Good
    page.getByRole('button', { name: /submit/i });
    page.getByLabel('Email');
    page.getByPlaceholder('Enter email');

    // Avoid
    page.locator('.btn-submit');
    page.locator('[data-testid="email-input"]');
    ```

2. **Wait for elements** - Use proper wait strategies:

    ```typescript
    // Good
    await page.waitForLoadState('networkidle');
    await page.locator('button').waitFor({ state: 'visible' });

    // Avoid
    await page.waitForTimeout(1000); // Hard waits
    ```

3. **Keep tests focused** - One assertion per test when possible:

    ```typescript
    // Good
    test('should display error on invalid email', async ({ page }) => {
        // setup and test specific behavior
    });

    // Avoid
    test('should handle forms', async ({ page }) => {
        // tests multiple unrelated behaviors
    });
    ```

4. **Use page fixtures** - Access to page, browser, context:
    ```typescript
    test('should do something', async ({ page, browser, context }) => {
        // page: individual page instance
        // browser: browser instance
        // context: incognito context
    });
    ```

### Common Selectors

```typescript
// By role (accessible)
page.getByRole('button');
page.getByRole('textbox');
page.getByRole('heading', { level: 1 });

// By label (accessible)
page.getByLabel('Username');

// By placeholder
page.getByPlaceholder('Enter search...');

// By text
page.getByText('Submit');

// By CSS/XPath
page.locator('button.primary');
page.locator('xpath=//button[@id="submit"]');
```

### Common Actions

```typescript
// Navigation
await page.goto('/');
await page.goBack();
await page.reload();

// Interaction
await page.locator('selector').click();
await page.locator('input').fill('text');
await page.locator('select').selectOption('option');
await page.keyboard.press('Enter');

// Waiting
await page.waitForLoadState('networkidle');
await page.locator('selector').waitFor({ state: 'visible' });
await page.waitForNavigation();

// Assertions
expect(page).toHaveTitle('Title');
expect(element).toBeVisible();
expect(element).toHaveText('Text');
expect(element).toHaveAttribute('href', '/path');
```

## CI/CD Integration

### GitHub Actions

Tests run automatically on:

- Pull requests
- Pushes to main
- Manual workflow dispatch

Configuration in `.github/workflows/e2e.yml` (create if needed).

### Environment Variables

- `PLAYWRIGHT_TEST_BASE_URL` - Set custom base URL for tests
- `CI` - Set to `true` in CI environment (disables headless mode, enables retries)

## Debugging

### View test trace

```bash
pnpm exec playwright show-trace path/to/trace.zip
```

### Run with verbose logging

```bash
DEBUG=pw:api pnpm e2e
```

### Generate videos

Videos are recorded for failed tests by default. Configure in `playwright.config.ts`:

```typescript
use: {
    video: 'retain-on-failure', // or 'on', 'off'
}
```

### Screenshots

Automatic screenshots on failure:

```typescript
use: {
    screenshot: 'only-on-failure', // or 'on', 'off'
}
```

## Reporting

### HTML Report

After test run, view the HTML report:

```bash
pnpm e2e:report
```

This shows:

- Test results and timing
- Screenshots and videos for failed tests
- Detailed error messages
- Test traces (inspector playback)

### Integration with CI

Reports are uploaded to CI artifacts automatically.

## Troubleshooting

### Tests timeout

- Increase timeout in config: `timeout: 30000` (30 seconds)
- Check if web server is running
- Verify base URL is correct

### "Port 3000 is already in use"

```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or configure different port in playwright.config.ts
```

### Tests fail in headless mode but pass locally

- Add `--headed` flag to run in headed mode
- Check for browser-specific issues in specific browser config

### Flaky tests

- Avoid hard waits (`waitForTimeout`)
- Use proper wait strategies (`waitForLoadState`, `waitFor`)
- Check for race conditions

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [Debugging Guide](https://playwright.dev/docs/debug)
- [Locator Guide](https://playwright.dev/docs/locators)
- [API Reference](https://playwright.dev/docs/api/class-page)

## Contributing

When adding new features:

1. Write e2e tests for critical user workflows
2. Test across all browsers (especially for responsive UI)
3. Include accessibility checks
4. Keep tests maintainable and focused

## Future Enhancements

- [ ] Add visual regression testing
- [ ] Add performance benchmarking
- [ ] Add mobile app testing
- [ ] Add API testing for backend endpoints
- [ ] Set up parallel test execution in CI
- [ ] Add custom reporters for CI integration
