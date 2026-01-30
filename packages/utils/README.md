# @ottabase/utils

A set of utility functions for file operations, string manipulation, URL handling, environment detection, currency
formatting, email parsing, JSON handling, git operations, and more.

## Installation

```bash
pnpm add @ottabase/utils
```

## Usage

### Import All Utilities

```typescript
import {
    fileExists,
    readFile,
    isEmail,
    changeCase,
    makeSlug,
    isValidUrl,
    isDev,
    isStaging,
    isCI,
    parseCurrencyValue,
    parseNameAndEmail,
    parseJsonFromString,
    getLastCommitMessage,
    getCurrentBranch,
    isBrowser,
    isMobileBrowser,
} from '@ottabase/utils';
```

### Tree-Shakeable Imports (Recommended)

Import only what you need for optimal bundle size:

```typescript
// File utilities
import { fileExists, readFile, writeFile, mkdirSync, copyDirectoryContents } from '@ottabase/utils/file';

// String utilities
import {
    isEmail,
    changeCase,
    getInitials,
    isEmptyStr,
    humanizeString,
    ucFirst,
    replaceStringTokens,
    generateUUID,
} from '@ottabase/utils/string';

// URL utilities
import { makeSlug, getSegment, getDomainName, joinPaths, isValidUrl } from '@ottabase/utils/url';

// Environment utilities (server-side)
import { isDev, isProd, isTest, isStaging, isCI, getEnvironment, isRunningOnServer } from '@ottabase/utils/env';

// Browser utilities (client-side)
import { isBrowser, isMobileBrowser, getBrowserInfo, getViewportSize, supportsFeature } from '@ottabase/utils/browser';

// Currency utilities
import { parseCurrencyValue, formatCurrencyValue, getCurrencySymbol } from '@ottabase/utils/currency';

// Email utilities
import { parseNameAndEmail, parseEmailId, urlSafeBase64Decode } from '@ottabase/utils/email';

// Gmail-specific email utilities
import { verifySenderGmail, checkHeaderPass, getAuthenticationResults } from '@ottabase/utils/email-gmail';

// JSON utilities
import { parseJsonFromString, safeStringify, deepClone, isValidJson } from '@ottabase/utils/json';

// User utilities
import { getInitials } from '@ottabase/utils/user';

// Git utilities
import { getLastCommitMessage, getCurrentBranch, getLatestCommitHash, isGitRepository } from '@ottabase/utils/git';

// Timezone utilities
import {
    toUTC,
    fromUTC,
    formatInUserTimezone,
    getUserTimezone,
    setTimezoneConfig,
    nowUTC,
    parseInTimezone,
    getCommonTimezones,
    isValidTimezone,
} from '@ottabase/utils/timezone';
```

## Available Utilities

### File Operations (`@ottabase/utils/file`)

- **`fileExists(filePath: PathLike): boolean`** - Check if file/directory exists
- **`readFile(filePath: PathLike, encoding?: string): string | null`** - Read file content safely
- **`writeFile(filePath: PathLike, content: string | Uint8Array, encoding?: string): void`** - Write file content with
  error handling
- **`mkdirSync(dirPath: PathLike, options?: MakeDirectoryOptions): void`** - Create directories recursively
- **`copyDirectoryContents(src: PathLike, dest: PathLike): void`** - Copy all contents of a directory recursively
- **`removeFileExtension(filePath: string): string`** - Remove file extension from path
- **`getFileExtension(filePath: string): string`** - Get file extension from path

### String Utilities (`@ottabase/utils/string`)

- **`isEmail(email: string): boolean`** - Email validation
- **`changeCase(str: string, caseType: CaseType): string`** - Convert strings to various case formats
- **`getInitials(name: string | null | undefined, defaultInitials?: string): string`** - Extract initials from names
- **`isEmptyStr(str: string | null | undefined): boolean`** - Check if string is empty or whitespace
- **`humanizeString(input: string, capitalizeFirstLetter?: boolean, capitalizeAllWords?: boolean): string`** - Convert
  to human-readable format
- **`ucFirst(str: string): string`** - Uppercase the first letter
- **`replaceStringTokens(str: string, replacements: object, identifier?: string): string`** - Replace tokens in strings
- **`generateUUID(length: number, alphanumeric?: boolean): string`** - Generate unique alphanumeric ID

### URL Utilities (`@ottabase/utils/url`)

- **`makeSlug(str: string, replaceSpaceWith?: string): string`** - Convert string to URL-friendly slug
- **`getSegment(slug: string | null, separator?: string, segmentNumber?: number): string | null`** - Get specific
  segment from path
- **`getDomainName(url: string, removeWww?: boolean): string | null`** - Extract domain name from URL
- **`joinPaths(...paths: string[]): string`** - Join multiple path segments
- **`getBaseUrl(): string`** - Get base URL from window location
- **`prependBaseUrlForRelativePath(url: string, baseUrl?: string): string`** - Prepend base URL to relative paths
- **`isValidUrl(url: string): boolean`** - Check if string is valid URL
- **`replaceDoubleSlashes(url: string): string`** - Replace multiple slashes with single slash

### Environment Utilities (`@ottabase/utils/env`) - Server-side

- **`isDev: boolean`** - Check if running in development environment
- **`isProd: boolean`** - Check if running in production environment
- **`isTest: boolean`** - Check if running in test environment
- **`isStaging: boolean`** - Check if running in staging environment
- **`isRunningOnServer: boolean`** - Check if running on server (Node.js)
- **`isRunningOnClient: boolean`** - Check if running on client (browser)
- **`getEnvironment(): Environment`** - Get current environment with type safety ('development' | 'production' | 'test'
  | 'staging')
- **`getEnvVar(key: string, defaultValue?: string): string`** - Safe environment variable access
- **`isCI(): boolean`** - Check if running in CI/CD environment

### Browser Utilities (`@ottabase/utils/browser`) - Client-side

- **`isBrowser(): boolean`** - Check if running in browser (comprehensive window + document check)
- **`isMobileBrowser(): boolean`** - Check if running on mobile browser using user agent
- **`getBrowserInfo(): object`** - Get detailed browser information object
- **`getViewportSize(): object | null`** - Get viewport dimensions
- **`supportsFeature(feature: string): boolean`** - Check browser feature support
- **`getBrowserDetails(): object | null`** - Get browser name and version

### Currency Utilities (`@ottabase/utils/currency`)

- **`parseCurrencyValue(input: string | number): number | null`** - Parse currency string to numeric value
- **`formatCurrencyValue(value: number, currencyCode: string, decimalPlaces?: number): string`** - Format number as
  currency
- **`getCurrencySymbol(currencyCode: string): string`** - Get currency symbol for code
- **`getCurrencyInfo(currencyCode: string): CurrencyInfo | null`** - Get currency information
- **`getSupportedCurrencies(): CurrencyInfo[]`** - Get all supported currencies

### Email Utilities (`@ottabase/utils/email`)

- **`parseNameAndEmail(str: string): ParsedNameEmail`** - Parse "Name <email>" format
- **`parseEmailId(str: string): string`** - Extract email from "Name <email>" format
- **`urlSafeBase64Decode(encodedString: string): string`** - Decode URL-safe base64
- **`urlSafeBase64Encode(str: string): string`** - Encode to URL-safe base64

### Gmail Email Utilities (`@ottabase/utils/email-gmail`)

- **`verifySenderGmail(headers: EmailHeader[], domain?: string): boolean`** - Verify Gmail sender authenticity
- **`checkHeaderPass(headers: EmailHeader[], headerName: string): boolean`** - Check authentication pass status
- **`getAuthenticationResults(headers: EmailHeader[]): object`** - Extract SPF/DKIM/DMARC results

### JSON Utilities (`@ottabase/utils/json`)

- **`parseJsonFromString(str: string, sanitize?: boolean): unknown | null`** - Parse JSON from mixed content
- **`safeStringify(obj: any, space?: number): string`** - Safe JSON stringify with error handling
- **`deepClone<T>(obj: T): T | null`** - Deep clone object using JSON
- **`isValidJson(str: string): boolean`** - Check if string is valid JSON

### User Utilities (`@ottabase/utils/user`)

- **`getInitials(name: string | null | undefined, defaultInitials?: string): string`** - Extract initials from name
  (re-exported from string utilities)

### Git Utilities (`@ottabase/utils/git`)

- **`getLastCommitMessage(): string`** - Get last commit message with date
- **`getCurrentBranch(): string`** - Get current git branch name
- **`getLatestCommitHash(short?: boolean): string`** - Get latest commit hash (short or full)
- **`getLatestCommitInfo(): GitCommitInfo`** - Get detailed commit information
- **`isGitRepository(): boolean`** - Check if current directory is a git repository
- **`getRepositoryUrl(): string | null`** - Get git repository URL (origin remote)
- **`hasUncommittedChanges(): boolean`** - Check for uncommitted changes
- **`getCommitCount(): number`** - Get number of commits in current branch

### Timezone Utilities (`@ottabase/utils/timezone`)

**Production-ready timezone standardization for SaaS applications**

Core principles:

- **Server/DB**: Always store in UTC
- **Client**: Convert to user's timezone for display
- **Lightweight**: Uses date-fns-tz (~2KB gzipped)
- **Type-safe**: Full TypeScript support

#### Configuration

- **`setTimezoneConfig(config: TimezoneConfig): void`** - Set global timezone configuration
- **`getTimezoneConfig(): TimezoneConfig`** - Get current timezone configuration
- **`getUserTimezone(): Timezone`** - Get user's timezone (auto-detected or configured)

#### UTC Conversion (For Database Storage)

- **`toUTC(date: DateInput, timezone?: Timezone): Date | null`** - Convert any date to UTC for storage
- **`nowUTC(): Date`** - Get current date/time in UTC (for new records)
- **`parseInTimezone(dateStr: string, timezone?: Timezone): Date | null`** - Parse user input to UTC

#### User Display (From Database)

- **`fromUTC(date: DateInput, timezone?: Timezone): Date | null`** - Convert UTC date to user's timezone
- **`formatInUserTimezone(date: DateInput, format?: string, timezone?: Timezone): string | null`** - Format UTC date in
  user's timezone (with custom format string)
- **`formatWithTimezone(date: DateInput, format?: string, timezone?: Timezone): string | null`** - Format with timezone
  abbreviation

#### Preset Format Functions (Convenience Wrappers)

Ready-to-use format presets for common display patterns:

- **`formatShortDateTime(date: DateInput, timezone?: Timezone): string | null`** - "Aug 10, 2025 11:10 AM"
- **`formatDayMonthDateTime(date: DateInput, timezone?: Timezone): string | null`** - "10-Aug-2025 11:10 AM"
- **`formatLongDateTime(date: DateInput, timezone?: Timezone): string | null`** - "August 10, 2025 11:10 AM"
- **`formatShortDate(date: DateInput, timezone?: Timezone): string | null`** - "Aug 10, 2025"
- **`formatSlashDate(date: DateInput, timezone?: Timezone): string | null`** - "10/Aug/2025"
- **`formatISODateTime(date: DateInput, timezone?: Timezone): string | null`** - "2025-08-10 11:10 AM"
- **`formatTime12Hour(date: DateInput, timezone?: Timezone): string | null`** - "11:10 AM"
- **`formatTime24Hour(date: DateInput, timezone?: Timezone): string | null`** - "14:30"
- **`formatFullDate(date: DateInput, timezone?: Timezone): string | null`** - "Monday, August 10, 2025"
- **`formatCompactDateTime(date: DateInput, timezone?: Timezone): string | null`** - "Mon, Aug 10, 2025 11:10 AM"
- **`formatDateAtTime(date: DateInput, timezone?: Timezone): string | null`** - "Aug 10 at 11:10 AM"

#### Timezone Information

- **`getCommonTimezones(): Array<{name, offset, label}>`** - Get list of common timezones (for dropdowns)
- **`isValidTimezone(timezone: string): boolean`** - Validate IANA timezone string
- **`getTimezoneOffsetMinutes(timezone?: Timezone, date?: DateInput): number`** - Get timezone offset in minutes
- **`isDST(date: DateInput, timezone?: Timezone): boolean`** - Check if date is in daylight saving time

#### Advanced

- **`nowInTimezone(timezone?: Timezone): Date`** - Get current time in specific timezone
- **`convertTimezone(date: DateInput, from: Timezone, to: Timezone): Date | null`** - Convert between timezones

#### Case Types

The `changeCase` function supports these case formats:

- `'camel'` - camelCase
- `'snake'` - snake_case
- `'kebab'` - kebab-case
- `'pascal'` - PascalCase
- `'title'` - Title Case
- `'sentence'` - Sentence case
- `'lower'` - lowercase
- `'upper'` - UPPERCASE
- `'constant'` - CONSTANT_CASE
- `'path'` - path-case
- `'none'` - no transformation

## Examples

```typescript
// File operations
import { fileExists, readFile, copyDirectoryContents } from '@ottabase/utils/file';

if (fileExists('./config.json')) {
    const config = readFile('./config.json');
    console.log(config);
}

// Copy directory contents
copyDirectoryContents('./source', './destination');

// String utilities
import { isEmail, changeCase, getInitials, humanizeString, replaceStringTokens } from '@ottabase/utils/string';

console.log(isEmail('user@example.com')); // true
console.log(changeCase('hello world', 'camel')); // 'helloWorld'
console.log(getInitials('John Doe')); // 'JD'
console.log(humanizeString('hello_world')); // 'Hello world'
console.log(replaceStringTokens('Hello :name', { name: 'world' })); // 'Hello world'

// URL utilities
import { makeSlug, getDomainName, joinPaths, isValidUrl } from '@ottabase/utils/url';

console.log(makeSlug('Hello World!')); // 'hello-world'
console.log(getDomainName('https://www.example.com/path')); // 'example.com'
console.log(joinPaths('/api', 'users', '123')); // '/api/users/123'
console.log(isValidUrl('https://example.com')); // true

// Environment utilities
import { isDev, isStaging, getEnvironment, getEnvVar, isCI } from '@ottabase/utils/env';

console.log(isDev); // true/false
console.log(isStaging); // true/false
console.log(getEnvironment()); // 'development' | 'production' | 'test' | 'staging'
console.log(getEnvVar('API_URL', 'http://localhost:3000')); // Safe env var access
console.log(isCI()); // true/false

// Browser utilities (client-side)
import { isBrowser, isMobileBrowser, getBrowserInfo, supportsFeature } from '@ottabase/utils/browser';

console.log(isBrowser()); // true/false
console.log(isMobileBrowser()); // true/false
console.log(getBrowserInfo()); // { isBrowser: true, isMobile: false, userAgent: "...", ... }
console.log(supportsFeature('localstorage')); // true/false

// Currency utilities
import { parseCurrencyValue, formatCurrencyValue, getCurrencySymbol } from '@ottabase/utils/currency';

console.log(parseCurrencyValue('₹1,112.78')); // 1112.78
console.log(formatCurrencyValue(1112.78, 'INR')); // ₹1,112.78
console.log(getCurrencySymbol('USD')); // $

// Email utilities
import { parseNameAndEmail, urlSafeBase64Decode } from '@ottabase/utils/email';

console.log(parseNameAndEmail('John Doe <john@example.com>')); // { name: "John Doe", email: "john@example.com" }

// JSON utilities
import { parseJsonFromString, isValidJson } from '@ottabase/utils/json';

console.log(parseJsonFromString('Some text {"key": "value"} more text', true)); // { key: "value" }
console.log(isValidJson('{"valid": true}')); // true

// Git utilities
import { getLastCommitMessage, getCurrentBranch, getLatestCommitHash, isGitRepository } from '@ottabase/utils/git';

console.log(getLastCommitMessage()); // "feat: New feature @ Mon Jan 1 12:00:00 2024"
console.log(getCurrentBranch()); // "main"
console.log(getLatestCommitHash()); // "a1b2c3d"
console.log(isGitRepository()); // true

// Timezone utilities
import {
    toUTC,
    fromUTC,
    formatInUserTimezone,
    setTimezoneConfig,
    nowUTC,
    getCommonTimezones,
} from '@ottabase/utils/timezone';

// Configure user's timezone (e.g., from user profile)
setTimezoneConfig({ userTimezone: 'America/New_York' });

// SAVING TO DATABASE: Convert user input to UTC
const userInput = '2024-01-15T14:30:00'; // User enters in their timezone
const utcDate = toUTC(userInput); // Convert to UTC
// Save utcDate to database

// DISPLAYING FROM DATABASE: Convert UTC to user's timezone
const dbDate = new Date('2024-01-15T19:30:00Z'); // UTC from database
const userDate = fromUTC(dbDate); // Convert to user's timezone
console.log(formatInUserTimezone(dbDate, 'PPpp')); // "Jan 15, 2024, 2:30:00 PM"

// PRESET FORMATS: Use ready-made format presets
import { formatShortDateTime, formatDayMonthDateTime, formatDateAtTime } from '@ottabase/utils/timezone';
console.log(formatShortDateTime(dbDate)); // "Jan 15, 2024 2:30 PM"
console.log(formatDayMonthDateTime(dbDate)); // "15-JAN-2024 2:30 PM"
console.log(formatDateAtTime(dbDate)); // "Jan 15 at 2:30 PM"

// CREATE NEW RECORDS: Always use UTC
const newRecord = {
    title: 'New Post',
    createdAt: nowUTC(), // Current time in UTC
};

// TIMEZONE SELECTOR: Get list of common timezones
const timezones = getCommonTimezones();
// [{ name: 'America/New_York', offset: -300, label: 'America/New York (UTC-05:00)' }, ...]
```

### Real-World SaaS Example

```typescript
import { toUTC, fromUTC, formatInUserTimezone, setTimezoneConfig } from '@ottabase/utils/timezone';

// 1. User Registration: Store user's preferred timezone
async function registerUser(email: string, timezone: string) {
    return db.user.create({
        data: {
            email,
            timezone, // Store user's timezone preference
            createdAt: nowUTC(), // Always UTC in database
        },
    });
}

// 2. Creating Content: Convert user's time to UTC
async function createPost(userId: string, scheduledTime: string) {
    const user = await db.user.findUnique({ where: { id: userId } });

    return db.post.create({
        data: {
            userId,
            // Convert scheduled time from user's timezone to UTC
            scheduledAt: toUTC(scheduledTime, user.timezone),
            createdAt: nowUTC(),
        },
    });
}

// 3. Displaying Content: Convert UTC to user's timezone
async function getUserPosts(userId: string) {
    const user = await db.user.findUnique({ where: { id: userId } });
    const posts = await db.post.findMany({ where: { userId } });

    return posts.map((post) => ({
        ...post,
        // Display in user's timezone
        scheduledAtFormatted: formatInUserTimezone(post.scheduledAt, 'PPpp', user.timezone),
    }));
}

// 4. Client-side: Auto-detect and use user's timezone
// In your app initialization
if (typeof window !== 'undefined') {
    setTimezoneConfig({ userTimezone: getUserTimezone() });
}
```

## Future Utilities

This package is designed to be extensible. Future additions may include:

- `@ottabase/utils/html` - HTML manipulation utilities
- `@ottabase/utils/table` - Table/data utilities
- `@ottabase/utils/validation` - Validation utilities

## Requirements

- Node.js ≥ 24.0.0
- TypeScript support included
