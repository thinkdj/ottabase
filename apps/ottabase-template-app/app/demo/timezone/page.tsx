"use client";

import { useState, useEffect } from "react";
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
  getTimezoneOffsetMinutes,
  convertTimezone,
  isDST,
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
  type Timezone,
} from "@ottabase/utils/timezone";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@ottabase/ui-shadcn";
import Link from "next/link";

/**
 * Timezone Utilities Demo Page
 * Demonstrates the production-ready timezone standardization package
 */
export default function TimezoneDemoPage() {
  const [selectedTimezone, setSelectedTimezone] = useState<Timezone>("UTC");
  const [userTimezone, setUserTimezone] = useState<Timezone>("UTC");
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [timezones, setTimezones] = useState<
    Array<{ name: Timezone; offset: number; label: string }>
  >([]);

  // Initialize timezone and get common timezones
  useEffect(() => {
    const detected = getUserTimezone();
    setUserTimezone(detected);
    setSelectedTimezone(detected);
    setTimezoneConfig({ userTimezone: detected });
    setTimezones(getCommonTimezones());

    // Update time every second
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Example dates for demonstration
  const exampleDates = {
    utcDate: new Date("2024-01-15T19:30:00Z"),
    userInput: "2024-01-15T14:30:00",
    scheduledDate: new Date("2024-06-15T15:00:00Z"),
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-4 py-16">
      <div className="flex flex-col gap-4">
        <Button asChild variant="ghost" className="w-fit">
          <Link href="/demo">← Back to Demo Gallery</Link>
        </Button>

        <h1 className="text-4xl font-bold tracking-tight">
          Timezone Utilities Demo
        </h1>
        <p className="text-lg text-muted-foreground">
          Production-ready timezone standardization for SaaS applications.
          Always store in UTC, display in user's timezone.
        </p>
      </div>

      {/* User Timezone Detection */}
      <Card>
        <CardHeader>
          <CardTitle>1. Timezone Detection</CardTitle>
          <CardDescription>
            Automatically detect user's timezone from browser
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-muted p-4">
            <div className="grid gap-2 text-sm">
              <div className="flex justify-between">
                <span className="font-medium">Detected Timezone:</span>
                <code className="rounded bg-background px-2 py-1">
                  {userTimezone}
                </code>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Timezone Offset:</span>
                <code className="rounded bg-background px-2 py-1">
                  UTC
                  {getTimezoneOffsetMinutes(userTimezone) < 0 ? "-" : "+"}
                  {Math.abs(
                    Math.floor(
                      Math.abs(getTimezoneOffsetMinutes(userTimezone)) / 60
                    )
                  )}
                  :
                  {(Math.abs(getTimezoneOffsetMinutes(userTimezone)) % 60)
                    .toString()
                    .padStart(2, "0")}
                </code>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Is Valid Timezone:</span>
                <code className="rounded bg-background px-2 py-1">
                  {isValidTimezone(userTimezone) ? "✓ Yes" : "✗ No"}
                </code>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Currently DST:</span>
                <code className="rounded bg-background px-2 py-1">
                  {isDST(currentTime, userTimezone) ? "Yes (Summer)" : "No (Winter)"}
                </code>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Change Timezone (Select from common timezones)
            </label>
            <select
              value={selectedTimezone}
              onChange={(e) => {
                const tz = e.target.value;
                setSelectedTimezone(tz);
                setTimezoneConfig({ userTimezone: tz });
              }}
              className="w-full rounded-md border border-input bg-background px-3 py-2"
            >
              {timezones.map((tz) => (
                <option key={tz.name} value={tz.name}>
                  {tz.label}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Current Time Display */}
      <Card>
        <CardHeader>
          <CardTitle>2. Live Clock - UTC vs User Timezone</CardTitle>
          <CardDescription>
            See current time in UTC (for database) and user's timezone (for
            display)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border bg-muted/50 p-4">
              <h3 className="mb-2 text-sm font-medium text-muted-foreground">
                UTC (Database Format)
              </h3>
              <div className="space-y-1">
                <p className="font-mono text-2xl font-bold">
                  {currentTime.toISOString().split("T")[1].split(".")[0]}
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatInUserTimezone(currentTime, "PPP", "UTC")}
                </p>
                <code className="block rounded bg-background p-2 text-xs">
                  nowUTC(): {nowUTC().toISOString()}
                </code>
              </div>
            </div>

            <div className="rounded-lg border bg-blue-50 p-4 dark:bg-blue-950/30">
              <h3 className="mb-2 text-sm font-medium">
                {selectedTimezone} (User Display)
              </h3>
              <div className="space-y-1">
                <p className="font-mono text-2xl font-bold">
                  {formatInUserTimezone(currentTime, "HH:mm:ss", selectedTimezone)}
                </p>
                <p className="text-sm">
                  {formatInUserTimezone(currentTime, "PPP", selectedTimezone)}
                </p>
                <code className="block rounded bg-background p-2 text-xs">
                  formatInUserTimezone(date, 'PPpp')
                </code>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Database Storage Example */}
      <Card>
        <CardHeader>
          <CardTitle>3. Database Storage (Always UTC)</CardTitle>
          <CardDescription>
            Convert user input to UTC before storing in database
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-muted p-4">
            <div className="mb-4">
              <h4 className="mb-2 text-sm font-semibold">Scenario:</h4>
              <p className="text-sm">
                User enters: <strong>"2024-01-15 2:30 PM"</strong> in their
                timezone ({selectedTimezone})
              </p>
            </div>

            <div className="space-y-2">
              <div className="rounded bg-blue-50 p-3 dark:bg-blue-950/30">
                <p className="mb-1 text-xs font-medium">User Input:</p>
                <code className="text-sm">{exampleDates.userInput}</code>
              </div>

              <div className="text-center">↓ toUTC(date, userTimezone)</div>

              <div className="rounded bg-green-50 p-3 dark:bg-green-950/30">
                <p className="mb-1 text-xs font-medium">Store in Database:</p>
                <code className="text-sm">
                  {toUTC(exampleDates.userInput, selectedTimezone)?.toISOString()}
                </code>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-green-200 bg-green-50/50 p-4 dark:border-green-900 dark:bg-green-950/30">
            <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-green-900 dark:text-green-100">
              <span>✓</span> Best Practice
            </h4>
            <code className="block whitespace-pre-wrap text-xs">
              {`// Creating a new record
const userScheduledTime = "2024-01-15T14:30:00";
const dbRecord = {
  title: "Meeting",
  scheduledAt: toUTC(userScheduledTime, userTimezone),
  createdAt: nowUTC(),
};
// Store dbRecord in database`}
            </code>
          </div>
        </CardContent>
      </Card>

      {/* Display from Database */}
      <Card>
        <CardHeader>
          <CardTitle>4. Display from Database</CardTitle>
          <CardDescription>
            Convert UTC dates to user's timezone for display
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-muted p-4">
            <div className="mb-4">
              <h4 className="mb-2 text-sm font-semibold">Scenario:</h4>
              <p className="text-sm">
                Database contains UTC date:{" "}
                <strong>{exampleDates.utcDate.toISOString()}</strong>
              </p>
            </div>

            <div className="space-y-2">
              <div className="rounded bg-green-50 p-3 dark:bg-green-950/30">
                <p className="mb-1 text-xs font-medium">From Database (UTC):</p>
                <code className="text-sm">
                  {exampleDates.utcDate.toISOString()}
                </code>
              </div>

              <div className="text-center">
                ↓ formatInUserTimezone(date, 'PPpp')
              </div>

              <div className="rounded bg-blue-50 p-3 dark:bg-blue-950/30">
                <p className="mb-1 text-xs font-medium">
                  Display to User ({selectedTimezone}):
                </p>
                <code className="text-sm">
                  {formatInUserTimezone(
                    exampleDates.utcDate,
                    "PPpp",
                    selectedTimezone
                  )}
                </code>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-900 dark:bg-blue-950/30">
            <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <span>💡</span> Multiple Format Options
            </h4>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span>Short:</span>
                <code className="rounded bg-background px-2 py-0.5">
                  {formatInUserTimezone(exampleDates.utcDate, "P", selectedTimezone)}
                </code>
              </div>
              <div className="flex justify-between">
                <span>Long:</span>
                <code className="rounded bg-background px-2 py-0.5">
                  {formatInUserTimezone(exampleDates.utcDate, "PPpp", selectedTimezone)}
                </code>
              </div>
              <div className="flex justify-between">
                <span>Custom:</span>
                <code className="rounded bg-background px-2 py-0.5">
                  {formatInUserTimezone(
                    exampleDates.utcDate,
                    "MMM dd, yyyy 'at' h:mm a",
                    selectedTimezone
                  )}
                </code>
              </div>
              <div className="flex justify-between">
                <span>With TZ:</span>
                <code className="rounded bg-background px-2 py-0.5">
                  {formatInUserTimezone(
                    exampleDates.utcDate,
                    "PPpp zzz",
                    selectedTimezone
                  )}
                </code>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Timezone Conversion */}
      <Card>
        <CardHeader>
          <CardTitle>5. Cross-Timezone Conversion</CardTitle>
          <CardDescription>
            Convert dates between different timezones (e.g., for team
            collaboration)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg bg-muted p-4">
            <div className="mb-4">
              <p className="text-sm">
                Meeting scheduled for <strong>June 15, 2024, 3:00 PM UTC</strong>
              </p>
            </div>

            <div className="grid gap-3">
              {[
                "America/New_York",
                "America/Los_Angeles",
                "Europe/London",
                "Asia/Tokyo",
                "Australia/Sydney",
              ].map((tz) => (
                <div
                  key={tz}
                  className="flex items-center justify-between rounded border bg-background p-3"
                >
                  <span className="font-medium">{tz.replace(/_/g, " ")}</span>
                  <code className="text-sm">
                    {formatInUserTimezone(
                      exampleDates.scheduledDate,
                      "PPpp zzz",
                      tz
                    )}
                  </code>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded border border-orange-200 bg-orange-50/50 p-3 dark:border-orange-900 dark:bg-orange-950/30">
              <p className="text-xs">
                <strong>Note:</strong> Daylight Saving Time is automatically
                handled. June 15 shows DST offsets for applicable timezones.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preset Formats */}
      <Card>
        <CardHeader>
          <CardTitle>6. Preset Format Functions</CardTitle>
          <CardDescription>
            Ready-to-use format presets for common display patterns - no need to
            remember format strings!
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg bg-muted p-4">
            <div className="mb-4">
              <p className="text-sm">
                Example UTC date from database:{" "}
                <code className="rounded bg-background px-2 py-1">
                  {exampleDates.utcDate.toISOString()}
                </code>
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Selected timezone: <strong>{selectedTimezone}</strong>
              </p>
            </div>

            <div className="space-y-3">
              <div className="rounded border bg-background p-3">
                <div className="mb-1 text-xs font-medium text-muted-foreground">
                  Date & Time Formats
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <code className="text-xs">formatShortDateTime()</code>
                    <span className="font-mono text-sm">
                      {formatShortDateTime(
                        exampleDates.utcDate,
                        selectedTimezone
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <code className="text-xs">formatDayMonthDateTime()</code>
                    <span className="font-mono text-sm">
                      {formatDayMonthDateTime(
                        exampleDates.utcDate,
                        selectedTimezone
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <code className="text-xs">formatLongDateTime()</code>
                    <span className="font-mono text-sm">
                      {formatLongDateTime(
                        exampleDates.utcDate,
                        selectedTimezone
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <code className="text-xs">formatISODateTime()</code>
                    <span className="font-mono text-sm">
                      {formatISODateTime(
                        exampleDates.utcDate,
                        selectedTimezone
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <code className="text-xs">formatCompactDateTime()</code>
                    <span className="font-mono text-sm">
                      {formatCompactDateTime(
                        exampleDates.utcDate,
                        selectedTimezone
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <code className="text-xs">formatDateAtTime()</code>
                    <span className="font-mono text-sm">
                      {formatDateAtTime(
                        exampleDates.utcDate,
                        selectedTimezone
                      )}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded border bg-background p-3">
                <div className="mb-1 text-xs font-medium text-muted-foreground">
                  Date Only Formats
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <code className="text-xs">formatShortDate()</code>
                    <span className="font-mono text-sm">
                      {formatShortDate(exampleDates.utcDate, selectedTimezone)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <code className="text-xs">formatSlashDate()</code>
                    <span className="font-mono text-sm">
                      {formatSlashDate(exampleDates.utcDate, selectedTimezone)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <code className="text-xs">formatFullDate()</code>
                    <span className="font-mono text-sm">
                      {formatFullDate(exampleDates.utcDate, selectedTimezone)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded border bg-background p-3">
                <div className="mb-1 text-xs font-medium text-muted-foreground">
                  Time Only Formats
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <code className="text-xs">formatTime12Hour()</code>
                    <span className="font-mono text-sm">
                      {formatTime12Hour(exampleDates.utcDate, selectedTimezone)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <code className="text-xs">formatTime24Hour()</code>
                    <span className="font-mono text-sm">
                      {formatTime24Hour(exampleDates.utcDate, selectedTimezone)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-900 dark:bg-blue-950/30">
              <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <span>💡</span> Benefits
              </h4>
              <ul className="space-y-1 text-xs">
                <li>✅ No need to remember format strings</li>
                <li>✅ Consistent formatting across your app</li>
                <li>✅ Easy to use - just call the function</li>
                <li>✅ All presets automatically convert from UTC</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Code Examples */}
      <Card>
        <CardHeader>
          <CardTitle>7. Quick Reference - Code Examples</CardTitle>
          <CardDescription>
            Common patterns for using timezone utilities in your app
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="mb-2 text-sm font-semibold">
                🔧 Configuration (App Initialization)
              </h4>
              <code className="block whitespace-pre-wrap rounded bg-muted p-3 text-xs">
                {`import { setTimezoneConfig, getUserTimezone } from '@ottabase/utils/timezone';

// Auto-detect user's timezone
setTimezoneConfig({ userTimezone: getUserTimezone() });

// Or use timezone from user profile
setTimezoneConfig({ userTimezone: user.timezone });`}
              </code>
            </div>

            <div>
              <h4 className="mb-2 text-sm font-semibold">
                💾 Saving to Database
              </h4>
              <code className="block whitespace-pre-wrap rounded bg-muted p-3 text-xs">
                {`import { toUTC, nowUTC } from '@ottabase/utils/timezone';

// User creates a post
const newPost = await db.post.create({
  data: {
    title: "My Post",
    createdAt: nowUTC(), // Current time in UTC
    publishAt: toUTC(userInput, user.timezone), // Convert user input
  }
});`}
              </code>
            </div>

            <div>
              <h4 className="mb-2 text-sm font-semibold">
                📺 Displaying to User (Custom Format)
              </h4>
              <code className="block whitespace-pre-wrap rounded bg-muted p-3 text-xs">
                {`import { formatInUserTimezone } from '@ottabase/utils/timezone';

// Display UTC date from database with custom format
const posts = await db.post.findMany();
const formatted = posts.map(post => ({
  ...post,
  createdAtDisplay: formatInUserTimezone(
    post.createdAt,
    'PPpp',
    user.timezone
  ),
}));`}
              </code>
            </div>

            <div>
              <h4 className="mb-2 text-sm font-semibold">
                🎨 Displaying with Preset Formats
              </h4>
              <code className="block whitespace-pre-wrap rounded bg-muted p-3 text-xs">
                {`import { formatShortDateTime, formatDateAtTime } from '@ottabase/utils/timezone';

// Use preset formats for consistency
const posts = await db.post.findMany();
const formatted = posts.map(post => ({
  ...post,
  // No need to remember format strings!
  createdAtDisplay: formatShortDateTime(post.createdAt, user.timezone),
  scheduledDisplay: formatDateAtTime(post.scheduledAt, user.timezone),
}));`}
              </code>
            </div>

            <div>
              <h4 className="mb-2 text-sm font-semibold">
                🌍 Timezone Selector
              </h4>
              <code className="block whitespace-pre-wrap rounded bg-muted p-3 text-xs">
                {`import { getCommonTimezones, isValidTimezone } from '@ottabase/utils/timezone';

// Populate timezone dropdown
const timezones = getCommonTimezones();

// Validate user selection
if (isValidTimezone(selectedTimezone)) {
  await db.user.update({
    where: { id: userId },
    data: { timezone: selectedTimezone },
  });
}`}
              </code>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Package Info */}
      <div className="rounded-lg border bg-muted/50 p-6">
        <h2 className="mb-4 text-xl font-semibold">
          @ottabase/utils/timezone Package
        </h2>
        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-2">
            <span className="font-medium">📦 Installation:</span>
            <code className="rounded bg-background px-2 py-1">
              Already included in @ottabase/utils
            </code>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-medium">📚 Import:</span>
            <code className="rounded bg-background px-2 py-1">
              import {"{ ... }"} from '@ottabase/utils/timezone'
            </code>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-medium">⚖️ Size:</span>
            <span>~2KB gzipped (tree-shakeable with date-fns-tz)</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-medium">🎯 Use Case:</span>
            <span>
              Production SaaS apps needing standardized timezone handling
            </span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-medium">✅ Features:</span>
            <span>
              UTC storage, user timezone display, auto-detection, DST support,
              type-safe
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
