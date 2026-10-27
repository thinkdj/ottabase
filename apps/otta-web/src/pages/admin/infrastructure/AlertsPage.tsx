/**
 * Alerts (admin): where operator alerts go, and every alert with where it went.
 *
 * The console talks to `/api/alerts` through the app's one API client (`useApiQuery` /
 * `useApiMutation` inside `@ottabase/alerts/react`), so it answers for the signed-in
 * platform administrator like the rest of the admin.
 */

import { AlertsConsole } from '@ottabase/alerts/react';
import { BellRing } from 'lucide-react';

export function AlertsPage() {
    return (
        <div className="max-w-4xl space-y-8">
            <div className="space-y-1.5">
                <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-[-0.015em]">
                    <BellRing className="h-6 w-6 text-muted-foreground" />
                    Alerts
                </h1>
                <p className="max-w-3xl text-muted-foreground">
                    Every package raises its alerts here: failing tasks, apps going down, new support tickets, new
                    sales. Send them to Slack, Discord, Telegram, PagerDuty, email or a signed webhook, each with its
                    own severity, sources and daily digest. Repeats are held by a cooldown and busy channels by an
                    hourly limit, so nothing floods.
                </p>
            </div>

            <AlertsConsole />
        </div>
    );
}
