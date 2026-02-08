# Timezone Standardization Guide

Complete guide for working with timezones in Ottabase applications using `@ottabase/utils/timezone`.

## Overview

The timezone utilities package provides a production-ready solution for standardizing timezone handling across your SaaS
applications. It follows industry best practices:

- **Server/Database**: Always store in UTC
- **Client/Display**: Convert to user's timezone
- **Type-safe**: Full TypeScript support
- **Lightweight**: ~2KB gzipped with tree-shaking

## Installation

The timezone utilities are included in `@ottabase/utils`:

```bash
pnpm add @ottabase/utils
```

## Quick Start

```typescript
import { toUTC, fromUTC, formatInUserTimezone, getUserTimezone, setTimezoneConfig } from '@ottabase/utils/timezone';

// 1. Configure on app initialization
setTimezoneConfig({ userTimezone: getUserTimezone() });

// 2. Creating records - always use UTC
const newPost = {
    title: 'My Post',
    createdAt: Date.now(),
};

// 3. Storing user input - convert to UTC
const scheduledAt = toUTC(userInput, user.timezone);

// 4. Displaying to user - convert from UTC
const displayTime = formatInUserTimezone(dbDate, 'PPpp', user.timezone);
```

## Core Principles

### 1. Database Storage (Always UTC)

```typescript
// ✅ CORRECT: Store in UTC
const post = await db.post.create({
    data: {
        title: 'New Post',
        createdAt: Date.now(), // Current time in UTC (ms)
        publishedAt: toUTC(userInputDate, user.timezone), // Convert user input to UTC
    },
});

// ❌ INCORRECT: Never store user's local time
const post = await db.post.create({
    data: {
        createdAt: Date.parse(userInputDate), // Ambiguous timezone
    },
});
```

### 2. User Display (Convert to User's Timezone)

```typescript
// ✅ CORRECT: Convert UTC to user's timezone
const posts = await db.post.findMany();
const displayPosts = posts.map((post) => ({
  ...post,
  createdAtFormatted: formatInUserTimezone(
    post.createdAt,
    'PPpp',
    user.timezone
  ),
}));

// ❌ INCORRECT: Display UTC directly to user
<p>{post.createdAt}</p> // Shows UTC ms, not user's time
```

### 3. User Input (Parse with Timezone Context)

```typescript
// ✅ CORRECT: Parse user input with timezone awareness
const scheduledDate = parseInTimezone(userInput, user.timezone);

// ❌ INCORRECT: Parse without timezone context
const scheduledDate = Date.parse(userInput); // Ambiguous timezone
```

## Common Patterns

### Pattern 1: User Registration

```typescript
import { getUserTimezone } from '@ottabase/utils/timezone';

async function registerUser(data: RegisterInput) {
    return db.user.create({
        data: {
            email: data.email,
            timezone: getUserTimezone(), // Store user's detected timezone
            createdAt: Date.now(), // Store registration time in UTC (ms)
        },
    });
}
```

### Pattern 2: Scheduled Content

```typescript
import { toUTC, formatInUserTimezone } from '@ottabase/utils/timezone';

// Creating scheduled content
async function schedulePost(userId: string, data: ScheduleInput) {
    const user = await db.user.findUnique({ where: { id: userId } });

    return db.post.create({
        data: {
            userId,
            title: data.title,
            scheduledAt: toUTC(data.scheduledAt, user.timezone), // Convert to UTC
            createdAt: Date.now(),
        },
    });
}

// Displaying scheduled content
async function getScheduledPosts(userId: string) {
    const user = await db.user.findUnique({ where: { id: userId } });
    const posts = await db.post.findMany({
        where: { userId, scheduledAt: { gte: Date.now() } },
    });

    return posts.map((post) => ({
        ...post,
        // Display in user's timezone
        scheduledAtDisplay: formatInUserTimezone(post.scheduledAt, 'PPpp', user.timezone),
    }));
}
```

### Pattern 3: Timezone Selector

```typescript
import { getCommonTimezones, isValidTimezone } from '@ottabase/utils/timezone';

function TimezoneSelector({ value, onChange }: Props) {
  const timezones = getCommonTimezones();

  return (
    <select
      value={value}
      onChange={(e) => {
        const tz = e.target.value;
        if (isValidTimezone(tz)) {
          onChange(tz);
        }
      }}
    >
      {timezones.map((tz) => (
        <option key={tz.name} value={tz.name}>
          {tz.label}
        </option>
      ))}
    </select>
  );
}
```

### Pattern 4: API Responses

```typescript
import { formatInUserTimezone } from '@ottabase/utils/timezone';

// API route returning formatted dates
export async function GET(request: Request) {
    const userId = getUserIdFromRequest(request);
    const user = await db.user.findUnique({ where: { id: userId } });
    const posts = await db.post.findMany({ where: { userId } });

    // Format dates for user's timezone
    const formattedPosts = posts.map((post) => ({
        id: post.id,
        title: post.title,
        createdAt: post.createdAt, // UTC ms timestamp
        createdAtFormatted: formatInUserTimezone(post.createdAt, 'PPpp', user.timezone),
    }));

    return Response.json(formattedPosts);
}
```

### Pattern 5: Client-Side Initialization

```typescript
// app/providers.tsx or similar
'use client';

import { useEffect } from 'react';
import { setTimezoneConfig, getUserTimezone } from '@ottabase/utils/timezone';

export function TimezoneProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Auto-detect and configure user's timezone on mount
    setTimezoneConfig({ userTimezone: getUserTimezone() });
  }, []);

  return <>{children}</>;
}
```

## API Reference

### Configuration

#### `setTimezoneConfig(config: TimezoneConfig)`

Set global timezone configuration.

```typescript
setTimezoneConfig({
    defaultTimezone: 'UTC',
    userTimezone: 'America/New_York',
});
```

#### `getTimezoneConfig(): TimezoneConfig`

Get current timezone configuration.

#### `getUserTimezone(): Timezone`

Get user's timezone (auto-detected from browser or configured).

### UTC Conversion (Database)

#### `toUTC(date: DateInput, timezone?: Timezone): Date | null`

Convert a date from any timezone to UTC (for database storage).

```typescript
const utcDate = toUTC('2024-01-15T14:30:00', 'America/New_York');
// Result: 2024-01-15T19:30:00.000Z (UTC)
```

#### `nowUTC(): Date`

Get current date/time in UTC (Date object for display/formatting). Use `Date.now()` when storing timestamps.

```typescript
const now = nowUTC();
const timestamp = now.getTime();
```

#### `parseInTimezone(dateStr: string, timezone?: Timezone): Date | null`

Parse a date string with timezone awareness (returns UTC for storage).

### User Display (From Database)

#### `fromUTC(date: DateInput, timezone?: Timezone): Date | null`

Convert UTC date to specific timezone.

```typescript
const userDate = fromUTC(dbDate, 'America/New_York');
```

#### `formatInUserTimezone(date: DateInput, format?: string, timezone?: Timezone): string | null`

Format UTC date in user's timezone (combines conversion and formatting).

```typescript
// Default format (PPpp): "Jan 15, 2024, 2:30:00 PM"
formatInUserTimezone(dbDate, 'PPpp', 'America/New_York');

// Custom format
formatInUserTimezone(dbDate, 'yyyy-MM-dd HH:mm:ss');

// With timezone abbreviation
formatInUserTimezone(dbDate, 'PPpp zzz'); // "... 2:30:00 PM EST"
```

**Common Format Tokens:**

- `P` - Date (01/15/2024)
- `PP` - Date (Jan 15, 2024)
- `PPP` - Date (January 15, 2024)
- `p` - Time (2:30 PM)
- `pp` - Time (2:30:00 PM)
- `PPpp` - Date and time (Jan 15, 2024, 2:30:00 PM)
- `zzz` - Timezone abbreviation (EST, PST, etc.)

See [date-fns format tokens](https://date-fns.org/v2.30.0/docs/format) for complete list.

### Preset Format Functions

Ready-to-use format presets for common display patterns. These are convenience wrappers that eliminate the need to
remember format strings.

#### Available Presets

```typescript
import {
    formatShortDateTime,
    formatDayMonthDateTime,
    formatLongDateTime,
    formatShortDate,
    formatSlashDate,
    formatISODateTime,
    formatTime12Hour,
    formatTime24Hour,
    formatFullDate,
    formatCompactDateTime,
    formatDateAtTime,
} from '@ottabase/utils/timezone';

const dbTimestamp = Date.UTC(2024, 0, 15, 19, 30, 0);

// Date and Time formats
formatShortDateTime(dbTimestamp); // "Jan 15, 2024 2:30 PM"
formatDayMonthDateTime(dbTimestamp); // "15-JAN-2024 2:30 PM"
formatLongDateTime(dbTimestamp); // "January 15, 2024 2:30 PM"
formatISODateTime(dbTimestamp); // "2024-01-15 2:30 PM"
formatCompactDateTime(dbTimestamp); // "Mon, Jan 15, 2024 2:30 PM"
formatDateAtTime(dbTimestamp); // "Jan 15 at 2:30 PM"

// Date only formats
formatShortDate(dbTimestamp); // "Jan 15, 2024"
formatSlashDate(dbTimestamp); // "15/Jan/2024"
formatFullDate(dbTimestamp); // "Monday, January 15, 2024"

// Time only formats
formatTime12Hour(dbTimestamp); // "2:30 PM"
formatTime24Hour(dbTimestamp); // "14:30"
```

**When to use preset formats:**

- ✅ Use presets for consistency across your app
- ✅ Use presets to avoid remembering format strings
- ✅ Use presets for common display patterns
- ⚠️ Use `formatInUserTimezone()` with custom format string for unique needs

### Timezone Information

#### `getCommonTimezones(): Array<{name, offset, label}>`

Get list of common timezones (for dropdowns).

```typescript
const timezones = getCommonTimezones();
// [
//   { name: 'America/New_York', offset: -300, label: 'America/New York (UTC-05:00)' },
//   ...
// ]
```

#### `isValidTimezone(timezone: string): boolean`

Validate IANA timezone string.

```typescript
isValidTimezone('America/New_York'); // true
isValidTimezone('Invalid/Timezone'); // false
```

#### `getTimezoneOffsetMinutes(timezone?: Timezone, date?: DateInput): number`

Get timezone offset in minutes.

```typescript
getTimezoneOffsetMinutes('America/New_York'); // -300 (UTC-5)
getTimezoneOffsetMinutes('Asia/Tokyo'); // 540 (UTC+9)
```

#### `isDST(date: DateInput, timezone?: Timezone): boolean`

Check if date is in daylight saving time.

```typescript
isDST(Date.UTC(2024, 5, 15), 'America/New_York'); // true (summer)
isDST(Date.UTC(2024, 11, 15), 'America/New_York'); // false (winter)
```

### Advanced

#### `convertTimezone(date: DateInput, from: Timezone, to: Timezone): Date | null`

Convert date between two timezones.

```typescript
convertTimezone(date, 'America/New_York', 'America/Los_Angeles');
```

#### `nowInTimezone(timezone?: Timezone): Date`

Get current time in specific timezone.

## Schema Example (Numeric Timestamps)

```prisma
model User {
    id        String  @id @default(cuid())
    email     String  @unique
    timezone  String  @default("UTC") // Store user's preferred timezone
    createdAt BigInt  // Set in app with Date.now()
    updatedAt BigInt  // Set in app with Date.now()
    posts     Post[]
}

model Post {
    id          String   @id @default(cuid())
    title       String
    content     String?
    scheduledAt BigInt? // UTC ms timestamp (Date.now)
    publishedAt BigInt? // UTC ms timestamp (Date.now)
    createdAt   BigInt  // Set in app with Date.now()
    updatedAt   BigInt  // Set in app with Date.now()
    userId      String
    user        User    @relation(fields: [userId], references: [id])
}
```

## Testing

### Unit Test Example

```typescript
import { toUTC, fromUTC, formatInUserTimezone, isValidTimezone } from '@ottabase/utils/timezone';

describe('Timezone Utilities', () => {
    test('converts user input to UTC', () => {
        const userInput = '2024-01-15T14:30:00';
        const utcDate = toUTC(userInput, 'America/New_York');

        expect(utcDate?.getTime()).toBe(Date.UTC(2024, 0, 15, 19, 30, 0));
    });

    test('formats UTC date in user timezone', () => {
        const utcTimestamp = Date.UTC(2024, 0, 15, 19, 30, 0);
        const formatted = formatInUserTimezone(utcTimestamp, 'PPpp', 'America/New_York');

        expect(formatted).toContain('2:30:00 PM');
        expect(formatted).toContain('Jan 15, 2024');
    });

    test('validates timezone strings', () => {
        expect(isValidTimezone('America/New_York')).toBe(true);
        expect(isValidTimezone('Invalid/Timezone')).toBe(false);
    });
});
```

## Best Practices

### ✅ Do

1. **Always store in UTC**

    ```typescript
    createdAt: Date.now();
    ```

2. **Convert user input to UTC before storing**

    ```typescript
    scheduledAt: toUTC(userInput, user.timezone);
    ```

3. **Format dates in user's timezone for display**

    ```typescript
    formatInUserTimezone(dbDate, 'PPpp', user.timezone);
    ```

4. **Store user's timezone preference**

    ```typescript
    user.timezone = getUserTimezone();
    ```

5. **Validate timezone input**
    ```typescript
    if (isValidTimezone(input)) {
        /* ... */
    }
    ```

### ❌ Don't

1. **Never store dates in user's local timezone**

    ```typescript
    // ❌ BAD
    const userInput = '2024-01-15 14:30'; // No timezone
    createdAt: Date.parse(userInput);
    ```

2. **Never display UTC dates directly to users**

    ```typescript
    // ❌ BAD
    <p>{post.createdAt}</p>
    ```

3. **Never parse dates without timezone context**

    ```typescript
    // ❌ BAD
    const timestamp = Date.parse(userInput);
    ```

4. **Never hardcode timezone offsets**

    ```typescript
    // ❌ BAD
    date.setHours(date.getHours() - 5); // EST offset
    ```

5. **Never assume server and client are in same timezone**
    ```typescript
    // ❌ BAD
    const now = Date.now(); // Could be server or client timezone
    ```

## Troubleshooting

### Issue: Dates showing wrong time

**Problem**: UTC dates displayed without conversion

**Solution**: Always use `formatInUserTimezone()` or `fromUTC()`

```typescript
// ❌ Wrong
<p>{post.createdAt.toString()}</p>

// ✅ Correct
<p>{formatInUserTimezone(post.createdAt, 'PPpp', user.timezone)}</p>
```

### Issue: Daylight Saving Time errors

**Problem**: Manual timezone offset calculations

**Solution**: Use the utilities which handle DST automatically

```typescript
// ❌ Wrong
const offset = timezone === 'America/New_York' ? -5 : -4; // DST?

// ✅ Correct
const offset = getTimezoneOffsetMinutes('America/New_York');
// Automatically handles DST
```

### Issue: Timezone not detected on server

**Problem**: `getUserTimezone()` returns 'UTC' on server

**Solution**: Timezone detection works client-side only. Store user's timezone in database:

```typescript
// Client-side: detect and store
const userTz = getUserTimezone();
await updateUserProfile({ timezone: userTz });

// Server-side: retrieve from database
const user = await db.user.findUnique({ where: { id } });
const displayDate = formatInUserTimezone(dbDate, 'PPpp', user.timezone);
```

## Migration Guide

### From moment-timezone

```typescript
// Before (moment-timezone)
import moment from 'moment-timezone';
const date = moment.tz(input, 'America/New_York').utc().toDate();
const formatted = moment(utcDate).tz('America/New_York').format('MMM DD, YYYY h:mm A');

// After (@ottabase/utils/timezone)
import { toUTC, formatInUserTimezone } from '@ottabase/utils/timezone';
const date = toUTC(input, 'America/New_York');
const formatted = formatInUserTimezone(utcDate, 'PPpp', 'America/New_York');
```

### From Luxon

```typescript
// Before (Luxon)
import { DateTime } from 'luxon';
const inputTimestamp = Date.parse(input);
const utcTimestamp = DateTime.fromMillis(inputTimestamp, { zone: 'America/New_York' }).toUTC().toMillis();
const formatted = DateTime.fromMillis(utcTimestamp).setZone('America/New_York').toFormat('MMM dd, yyyy h:mm a');

// After (@ottabase/utils/timezone)
import { toUTC, formatInUserTimezone } from '@ottabase/utils/timezone';
const date = toUTC(input, 'America/New_York');
const formatted = formatInUserTimezone(utcDate, 'PPpp', 'America/New_York');
```

## Resources

- [Demo Page](/demo/timezone) - Interactive examples
- [Package README](/packages/utils/README.md#timezone-utilities-ottabaseutilstimezone) - API documentation
- [date-fns format tokens](https://date-fns.org/v2.30.0/docs/format) - Format string reference
- [IANA Time Zone Database](https://www.iana.org/time-zones) - Timezone list

## Support

For issues or questions:

1. Check the [Demo Page](/demo/timezone) for working examples
2. Review this guide and the package README
3. Open an issue on GitHub with minimal reproduction

---

**Package**: `@ottabase/utils/timezone`  
**Version**: 0.1.0  
**License**: MIT
