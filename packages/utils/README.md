# @ottabase/utils

Common utility functions for file operations, string manipulation, URL handling, environment detection, currency formatting, timezone management, and more.

## Features

- Tree-shakeable modular imports
- File operations (read, write, copy)
- String utilities (case conversion, validation, slugs)
- URL utilities (parsing, validation, slug generation)
- Environment detection (dev, prod, staging, CI)
- Browser utilities (detection, feature support)
- Currency formatting and parsing
- Email parsing and validation
- JSON utilities (safe parsing, stringify)
- Git operations (commit info, branch, repository status)
- Timezone utilities (UTC conversion, formatting)
- HTTP error utilities and pagination helpers

## Installation

```bash
pnpm add @ottabase/utils
```

## Quick Start

### Tree-Shakeable Imports (Recommended)

```typescript
// Import only what you need
import { isEmail, changeCase, makeSlug } from '@ottabase/utils/string';
import { isDev, isProd, getEnvVar } from '@ottabase/utils/env';
import { toUTC, formatInUserTimezone } from '@ottabase/utils/timezone';
```

### Import All (Alternative)

```typescript
import { isEmail, isDev, toUTC } from '@ottabase/utils';
```

## Common Use Cases

### String Utilities

```typescript
import { isEmail, changeCase, makeSlug, getInitials } from '@ottabase/utils/string';

isEmail('user@example.com'); // true
changeCase('hello world', 'camel'); // 'helloWorld'
makeSlug('Hello World!'); // 'hello-world'
getInitials('John Doe'); // 'JD'
```

### URL Utilities

```typescript
import { makeSlug, getDomainName, joinPaths, isValidUrl } from '@ottabase/utils/url';

makeSlug('Hello World!'); // 'hello-world'
getDomainName('https://www.example.com/path'); // 'example.com'
joinPaths('/api', 'users', '123'); // '/api/users/123'
isValidUrl('https://example.com'); // true
```

### Environment Detection

```typescript
import { isDev, isProd, isStaging, getEnvVar, isCI } from '@ottabase/utils/env';

if (isDev) {
  console.log('Running in development');
}

const apiUrl = getEnvVar('API_URL', 'http://localhost:3000');
```

### Browser Detection

```typescript
import { isBrowser, isMobileBrowser, getBrowserInfo } from '@ottabase/utils/browser';

if (isBrowser()) {
  const info = getBrowserInfo();
  console.log(info.isMobile); // true/false
}
```

### Currency Utilities

```typescript
import { parseCurrencyValue, formatCurrencyValue, getCurrencySymbol } from '@ottabase/utils/currency';

parseCurrencyValue('₹1,112.78'); // 1112.78
formatCurrencyValue(1112.78, 'INR'); // ₹1,112.78
getCurrencySymbol('USD'); // $
```

### Timezone Utilities

```typescript
import {
  toUTC,
  fromUTC,
  formatInUserTimezone,
  setTimezoneConfig,
  nowUTC,
} from '@ottabase/utils/timezone';

// Configure user's timezone
setTimezoneConfig({ userTimezone: 'America/New_York' });

// SAVING TO DATABASE: Convert user input to UTC
const userInput = '2024-01-15T14:30:00';
const utcDate = toUTC(userInput);
// Save utcDate to database

// DISPLAYING FROM DATABASE: Convert UTC to user's timezone
const dbDate = new Date('2024-01-15T19:30:00Z');
const formatted = formatInUserTimezone(dbDate, 'PPpp');
// "Jan 15, 2024, 2:30:00 PM"

// CREATE NEW RECORDS: Always use UTC
const newRecord = {
  title: 'New Post',
  createdAt: nowUTC(),
};
```

### Preset Timezone Formats

```typescript
import {
  formatShortDateTime,
  formatDayMonthDateTime,
  formatDateAtTime,
  formatTime12Hour,
} from '@ottabase/utils/timezone';

const dbDate = new Date('2024-01-15T19:30:00Z');

formatShortDateTime(dbDate); // "Jan 15, 2024 2:30 PM"
formatDayMonthDateTime(dbDate); // "15-Jan-2024 2:30 PM"
formatDateAtTime(dbDate); // "Jan 15 at 2:30 PM"
formatTime12Hour(dbDate); // "2:30 PM"
```

### Email Utilities

```typescript
import { parseNameAndEmail } from '@ottabase/utils/email';

const parsed = parseNameAndEmail('John Doe <john@example.com>');
// { name: "John Doe", email: "john@example.com" }
```

### JSON Utilities

```typescript
import { parseJsonFromString, isValidJson, safeStringify } from '@ottabase/utils/json';

parseJsonFromString('Some text {"key": "value"} more', true); // { key: "value" }
isValidJson('{"valid": true}'); // true
safeStringify({ foo: 'bar' }); // '{"foo":"bar"}'
```

### Git Utilities

```typescript
import { getLastCommitMessage, getCurrentBranch, isGitRepository } from '@ottabase/utils/git';

getLastCommitMessage(); // "feat: New feature @ Mon Jan 1 12:00:00 2024"
getCurrentBranch(); // "main"
isGitRepository(); // true
```

### File Operations

```typescript
import { fileExists, readFile, writeFile } from '@ottabase/utils/file';

if (fileExists('./config.json')) {
  const config = readFile('./config.json');
  console.log(config);
}

writeFile('./output.txt', 'Hello World');
```

## Available Modules

| Module | Import Path | Key Functions |
|--------|-------------|---------------|
| File | `@ottabase/utils/file` | fileExists, readFile, writeFile, mkdirSync, copyDirectoryContents |
| String | `@ottabase/utils/string` | isEmail, changeCase, getInitials, humanizeString, makeSlug, generateUUID |
| URL | `@ottabase/utils/url` | makeSlug, getDomainName, joinPaths, isValidUrl |
| Environment | `@ottabase/utils/env` | isDev, isProd, isStaging, isCI, getEnvVar |
| Browser | `@ottabase/utils/browser` | isBrowser, isMobileBrowser, getBrowserInfo, supportsFeature |
| Currency | `@ottabase/utils/currency` | parseCurrencyValue, formatCurrencyValue, getCurrencySymbol |
| Email | `@ottabase/utils/email` | parseNameAndEmail, parseEmailId, urlSafeBase64Decode |
| JSON | `@ottabase/utils/json` | parseJsonFromString, safeStringify, deepClone, isValidJson |
| Git | `@ottabase/utils/git` | getLastCommitMessage, getCurrentBranch, isGitRepository |
| Timezone | `@ottabase/utils/timezone` | toUTC, fromUTC, formatInUserTimezone, nowUTC, preset formats |
| HTTP Errors | `@ottabase/utils/http-errors` | Error creation and handling utilities |
| HTTP Response | `@ottabase/utils/http-response` | Response formatting utilities |
| Pagination | `@ottabase/utils/pagination` | Pagination helpers |

## Case Types

The `changeCase` function supports:
- `'camel'` - camelCase
- `'snake'` - snake_case
- `'kebab'` - kebab-case
- `'pascal'` - PascalCase
- `'title'` - Title Case
- `'constant'` - CONSTANT_CASE
- `'lower'` - lowercase
- `'upper'` - UPPERCASE

## License

MIT
