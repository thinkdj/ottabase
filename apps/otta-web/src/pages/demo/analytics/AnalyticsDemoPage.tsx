import { api, isApiError } from '@/lib/api';
import {
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Input,
    Label,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@ottabase/ui-shadcn';
import { IconActivity, IconChartBar, IconSend } from '@tabler/icons-react';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';

interface CoreAnalyticsResponse {
    data: Array<{ dimension: string; value?: number; clicks?: number }>;
    meta?: Record<string, unknown>;
}

export function AnalyticsDemoPage() {
    const [eventName, setEventName] = useState('demo_click');
    const [eventPath, setEventPath] = useState('/demo/analytics');
    const [groupBy, setGroupBy] = useState<'event' | 'path' | 'country'>('event');
    const [days, setDays] = useState('7');
    const [trackResult, setTrackResult] = useState<string>('');
    const [queryResult, setQueryResult] = useState<string>('');
    const [loadingTrack, setLoadingTrack] = useState(false);
    const [loadingQuery, setLoadingQuery] = useState(false);

    const sendTrackEvent = async () => {
        setLoadingTrack(true);
        setTrackResult('');
        try {
            const result = await api<Record<string, unknown>>('/api/analytics/track', {
                method: 'POST',
                body: {
                    event: eventName.trim() || 'demo_click',
                    path: eventPath.trim() || '/demo/analytics',
                    metadata: ['demo', 'anonymous-safe'],
                },
            });
            setTrackResult(JSON.stringify(result, null, 2));
        } catch (error) {
            if (isApiError(error)) {
                setTrackResult(`Track failed (${error.status}): ${error.message}`);
            } else {
                setTrackResult(`Track failed: ${error instanceof Error ? error.message : String(error)}`);
            }
        } finally {
            setLoadingTrack(false);
        }
    };

    const queryCoreAnalytics = async () => {
        setLoadingQuery(true);
        setQueryResult('');
        try {
            const params = new URLSearchParams({
                groupBy,
                days: days || '7',
            });
            const result = await api<CoreAnalyticsResponse>(`/api/analytics/core?${params.toString()}`);
            setQueryResult(JSON.stringify(result, null, 2));
        } catch (error) {
            if (isApiError(error)) {
                setQueryResult(`Query failed (${error.status}): ${error.message}`);
            } else {
                setQueryResult(`Query failed: ${error instanceof Error ? error.message : String(error)}`);
            }
        } finally {
            setLoadingQuery(false);
        }
    };

    return (
        <div className="space-y-6">
            <Button asChild variant="ghost" className="w-fit">
                <Link to="/demo">← Back to Demos</Link>
            </Button>

            <div className="space-y-2">
                <h1 className="text-3xl font-semibold">Analytics Demo</h1>
                <p className="text-muted-foreground">
                    Track and query demo for <code>@ottabase/analytics</code> through app endpoints, usable without
                    login.
                </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <IconSend className="h-5 w-5" />
                            Send Event
                        </CardTitle>
                        <CardDescription>Posts a sample event to the analytics tracking endpoint.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="event-name">Event name</Label>
                            <Input id="event-name" value={eventName} onChange={(e) => setEventName(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="event-path">Path</Label>
                            <Input id="event-path" value={eventPath} onChange={(e) => setEventPath(e.target.value)} />
                        </div>
                        <Button onClick={sendTrackEvent} disabled={loadingTrack} className="w-full">
                            <IconActivity className="mr-2 h-4 w-4" />
                            {loadingTrack ? 'Sending...' : 'Send track event'}
                        </Button>
                        {trackResult && (
                            <pre className="max-h-64 overflow-auto rounded-lg bg-muted p-3 text-xs">{trackResult}</pre>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <IconChartBar className="h-5 w-5" />
                            Query Aggregate Data
                        </CardTitle>
                        <CardDescription>Reads aggregated rows from the core analytics endpoint.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label>Group by</Label>
                                <Select
                                    value={groupBy}
                                    onValueChange={(value) => setGroupBy(value as 'event' | 'path' | 'country')}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="event">event</SelectItem>
                                        <SelectItem value="path">path</SelectItem>
                                        <SelectItem value="country">country</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="days">Days</Label>
                                <Input id="days" value={days} onChange={(e) => setDays(e.target.value)} />
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            onClick={queryCoreAnalytics}
                            disabled={loadingQuery}
                            className="w-full"
                        >
                            {loadingQuery ? 'Querying...' : 'Fetch analytics rows'}
                        </Button>
                        {queryResult && (
                            <pre className="max-h-64 overflow-auto rounded-lg bg-muted p-3 text-xs">{queryResult}</pre>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
