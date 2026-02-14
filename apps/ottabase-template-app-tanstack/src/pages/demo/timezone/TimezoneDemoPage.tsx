import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ottabase/ui-shadcn';
import {
    convertTimezone,
    formatCompactDateTime,
    formatDateAtTime,
    formatDayMonthDateTime,
    formatFullDate,
    formatISODateTime,
    formatInUserTimezone,
    formatLongDateTime,
    formatShortDate,
    formatShortDateTime,
    formatSlashDate,
    formatTime12Hour,
    formatTime24Hour,
    fromUTC,
    getCommonTimezones,
    getTimezoneOffsetMinutes,
    getUserTimezone,
    isDST,
    isValidTimezone,
    nowUTC,
    parseInTimezone,
    setTimezoneConfig,
    toUTC,
    type Timezone,
} from '@ottabase/utils/timezone';
import { Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

export function TimezoneDemoPage() {
    const [selectedTimezone, setSelectedTimezone] = useState<Timezone>('UTC');
    const [userTimezone, setUserTimezone] = useState<Timezone>('UTC');
    const [currentTime, setCurrentTime] = useState<Date>(new Date());
    const [timezones, setTimezones] = useState<Array<{ name: Timezone; offset: number; label: string }>>([]);

    useEffect(() => {
        const detected = getUserTimezone();
        setUserTimezone(detected);
        setSelectedTimezone(detected);
        setTimezoneConfig({ userTimezone: detected });
        setTimezones(getCommonTimezones());

        const interval = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    const exampleDates = {
        utcDate: new Date('2024-01-15T19:30:00Z'),
        userInput: '2024-01-15T14:30:00',
        scheduledDate: new Date('2024-06-15T15:00:00Z'),
    };

    return (
        <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-4">
                <Button asChild variant="ghost" className="w-fit">
                    <Link to="/demo">← Back to Demo Gallery</Link>
                </Button>

                <h1 className="text-4xl font-bold tracking-tight">Timezone Utilities Demo</h1>
                <p className="text-lg text-muted-foreground">
                    Production-ready timezone standardization for SaaS apps: store in UTC, display in the user's
                    timezone.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>1. Timezone Detection</CardTitle>
                    <CardDescription>Detect timezone from the browser</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="rounded-lg bg-muted p-4">
                        <div className="grid gap-2 text-sm">
                            <div className="flex justify-between gap-3">
                                <span className="font-medium">Detected Timezone:</span>
                                <code className="rounded bg-background px-2 py-1">{userTimezone}</code>
                            </div>
                            <div className="flex justify-between gap-3">
                                <span className="font-medium">Timezone Offset:</span>
                                <code className="rounded bg-background px-2 py-1">
                                    UTC
                                    {getTimezoneOffsetMinutes(userTimezone) < 0 ? '-' : '+'}
                                    {Math.abs(Math.floor(Math.abs(getTimezoneOffsetMinutes(userTimezone)) / 60))}:
                                    {(Math.abs(getTimezoneOffsetMinutes(userTimezone)) % 60)
                                        .toString()
                                        .padStart(2, '0')}
                                </code>
                            </div>
                            <div className="flex justify-between gap-3">
                                <span className="font-medium">Is Valid Timezone:</span>
                                <code className="rounded bg-background px-2 py-1">
                                    {isValidTimezone(userTimezone) ? '✓ Yes' : '✗ No'}
                                </code>
                            </div>
                            <div className="flex justify-between gap-3">
                                <span className="font-medium">Currently DST:</span>
                                <code className="rounded bg-background px-2 py-1">
                                    {isDST(currentTime, userTimezone) ? 'Yes (Summer)' : 'No (Winter)'}
                                </code>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Change Timezone (common list)</label>
                        <select
                            value={selectedTimezone}
                            onChange={(e) => {
                                const tz = e.target.value as Timezone;
                                setSelectedTimezone(tz);
                                setTimezoneConfig({ userTimezone: tz });
                            }}
                            aria-label="Select timezone"
                            title="Select timezone"
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

            <Card>
                <CardHeader>
                    <CardTitle>2. Live Clock (UTC vs User Timezone)</CardTitle>
                    <CardDescription>Compare storage time (UTC) vs display time (user timezone)</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-lg border bg-muted/50 p-4">
                            <h3 className="mb-2 text-sm font-medium text-muted-foreground">UTC (Database)</h3>
                            <div className="space-y-1">
                                <p className="font-mono text-2xl font-bold">
                                    {currentTime.toISOString().split('T')[1].split('.')[0]}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    {formatInUserTimezone(currentTime, 'PPP', 'UTC')}
                                </p>
                                <code className="block rounded bg-background p-2 text-xs">
                                    nowUTC(): {nowUTC().toISOString()}
                                </code>
                            </div>
                        </div>

                        <div className="rounded-lg border bg-muted/50 p-4">
                            <h3 className="mb-2 text-sm font-medium">{selectedTimezone} (Display)</h3>
                            <div className="space-y-1">
                                <p className="font-mono text-2xl font-bold">
                                    {formatInUserTimezone(currentTime, 'HH:mm:ss', selectedTimezone)}
                                </p>
                                <p className="text-sm">{formatInUserTimezone(currentTime, 'PPP', selectedTimezone)}</p>
                                <code className="block rounded bg-background p-2 text-xs">
                                    formatInUserTimezone(date, 'PPpp')
                                </code>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>3. Database Storage (Always UTC)</CardTitle>
                    <CardDescription>Convert user input to UTC before storing</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="rounded-lg bg-muted p-4">
                        <div className="mb-4">
                            <h4 className="mb-2 text-sm font-semibold">Scenario</h4>
                            <p className="text-sm">
                                User enters: <strong>"2024-01-15 2:30 PM"</strong> in timezone ({selectedTimezone})
                            </p>
                        </div>

                        <div className="space-y-2">
                            <div className="rounded bg-background p-3">
                                <p className="mb-1 text-xs font-medium text-muted-foreground">User Input</p>
                                <code className="text-sm">{exampleDates.userInput}</code>
                            </div>

                            <div className="text-center text-sm text-muted-foreground">↓ toUTC(date, userTimezone)</div>

                            <div className="rounded bg-background p-3">
                                <p className="mb-1 text-xs font-medium text-muted-foreground">Store in Database</p>
                                <code className="text-sm">
                                    {toUTC(exampleDates.userInput, selectedTimezone)?.toISOString()}
                                </code>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-lg border bg-muted/50 p-4">
                        <h4 className="mb-2 text-sm font-semibold">Best Practice</h4>
                        <code className="block whitespace-pre-wrap text-xs">
                            {`// Creating a new record\nconst userScheduledTime = "2024-01-15T14:30:00";\nconst dbRecord = {\n  title: "Meeting",\n  scheduledAt: toUTC(userScheduledTime, userTimezone),\n  createdAt: nowUTC(),\n};\n// Store dbRecord in database`}
                        </code>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>4. Display (Convert from UTC)</CardTitle>
                    <CardDescription>Convert stored UTC dates into user timezone for display</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-lg border bg-muted/50 p-4">
                            <h3 className="mb-2 text-sm font-medium text-muted-foreground">Stored in DB (UTC)</h3>
                            <code className="block rounded bg-background p-2 text-xs">
                                {exampleDates.utcDate.toISOString()}
                            </code>
                        </div>
                        <div className="rounded-lg border bg-muted/50 p-4">
                            <h3 className="mb-2 text-sm font-medium">Display ({selectedTimezone})</h3>
                            <code className="block rounded bg-background p-2 text-xs">
                                {fromUTC(exampleDates.utcDate, selectedTimezone)?.toString()}
                            </code>
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-lg border bg-muted/50 p-4">
                            <h3 className="mb-2 text-sm font-medium">Formatting helpers</h3>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between gap-3">
                                    <span className="text-muted-foreground">formatShortDateTime</span>
                                    <code>{formatShortDateTime(exampleDates.scheduledDate, selectedTimezone)}</code>
                                </div>
                                <div className="flex justify-between gap-3">
                                    <span className="text-muted-foreground">formatLongDateTime</span>
                                    <code>{formatLongDateTime(exampleDates.scheduledDate, selectedTimezone)}</code>
                                </div>
                                <div className="flex justify-between gap-3">
                                    <span className="text-muted-foreground">formatISODateTime</span>
                                    <code>{formatISODateTime(exampleDates.scheduledDate, selectedTimezone)}</code>
                                </div>
                                <div className="flex justify-between gap-3">
                                    <span className="text-muted-foreground">formatShortDate</span>
                                    <code>{formatShortDate(exampleDates.scheduledDate, selectedTimezone)}</code>
                                </div>
                                <div className="flex justify-between gap-3">
                                    <span className="text-muted-foreground">formatSlashDate</span>
                                    <code>{formatSlashDate(exampleDates.scheduledDate, selectedTimezone)}</code>
                                </div>
                                <div className="flex justify-between gap-3">
                                    <span className="text-muted-foreground">formatDayMonthDateTime</span>
                                    <code>{formatDayMonthDateTime(exampleDates.scheduledDate, selectedTimezone)}</code>
                                </div>
                                <div className="flex justify-between gap-3">
                                    <span className="text-muted-foreground">formatTime12Hour</span>
                                    <code>{formatTime12Hour(exampleDates.scheduledDate, selectedTimezone)}</code>
                                </div>
                                <div className="flex justify-between gap-3">
                                    <span className="text-muted-foreground">formatTime24Hour</span>
                                    <code>{formatTime24Hour(exampleDates.scheduledDate, selectedTimezone)}</code>
                                </div>
                                <div className="flex justify-between gap-3">
                                    <span className="text-muted-foreground">formatFullDate</span>
                                    <code>{formatFullDate(exampleDates.scheduledDate, selectedTimezone)}</code>
                                </div>
                                <div className="flex justify-between gap-3">
                                    <span className="text-muted-foreground">formatCompactDateTime</span>
                                    <code>{formatCompactDateTime(exampleDates.scheduledDate, selectedTimezone)}</code>
                                </div>
                                <div className="flex justify-between gap-3">
                                    <span className="text-muted-foreground">formatDateAtTime</span>
                                    <code>{formatDateAtTime(exampleDates.scheduledDate, selectedTimezone)}</code>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-lg border bg-muted/50 p-4">
                            <h3 className="mb-2 text-sm font-medium">Conversions</h3>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between gap-3">
                                    <span className="text-muted-foreground">parseInTimezone</span>
                                    <code>
                                        {parseInTimezone(exampleDates.userInput, selectedTimezone)?.toISOString()}
                                    </code>
                                </div>
                                <div className="flex justify-between gap-3">
                                    <span className="text-muted-foreground">convertTimezone</span>
                                    <code>
                                        {convertTimezone(exampleDates.utcDate, 'UTC', selectedTimezone)?.toString()}
                                    </code>
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
