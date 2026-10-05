/**
 * Background jobs: scheduled tasks and the queue on one screen, one tab each, the tab in the URL.
 */
import { useNavigate, useSearch } from '@tanstack/react-router';
import { Activity } from 'lucide-react';
import { QueueJobs } from './QueueJobs';
import { ScheduledTasks } from './ScheduledTasks';

export type JobsTab = 'scheduled' | 'queue';

const TABS: { id: JobsTab; label: string }[] = [
    { id: 'scheduled', label: 'Scheduled tasks' },
    { id: 'queue', label: 'Queue' },
];

export function JobsPage() {
    const navigate = useNavigate();
    const { tab = 'scheduled' } = useSearch({ strict: false }) as { tab?: JobsTab };
    const select = (next: JobsTab) =>
        void navigate({
            to: '/admin/infrastructure/jobs',
            search: next === 'queue' ? { tab: 'queue' } : {},
            replace: true,
        });

    return (
        <div className="space-y-8">
            <header className="space-y-1.5">
                <div className="flex items-center gap-2">
                    <Activity className="h-7 w-7 text-primary" />
                    <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Background jobs</h1>
                </div>
                <p className="max-w-3xl text-muted-foreground">
                    Scheduled tasks fire on the cron trigger; queue jobs run as messages arrive. Times are UTC.
                </p>
            </header>

            <div role="tablist" aria-label="Background jobs" className="flex w-fit gap-1 rounded-lg bg-muted/40 p-1">
                {TABS.map((item) => (
                    <button
                        key={item.id}
                        role="tab"
                        aria-selected={tab === item.id}
                        onClick={() => select(item.id)}
                        className={`rounded-md px-3 py-1.5 text-sm font-medium outline-none transition-colors duration-normal focus-visible:ring-2 focus-visible:ring-ring ${
                            tab === item.id
                                ? 'bg-background text-foreground ring-1 ring-border'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        {item.label}
                    </button>
                ))}
            </div>

            {tab === 'queue' ? <QueueJobs /> : <ScheduledTasks />}
        </div>
    );
}
