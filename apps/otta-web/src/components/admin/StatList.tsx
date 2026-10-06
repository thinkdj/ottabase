/** A row of headline numbers: the admin overview's glance strip and the counts above a list */
export interface Stat {
    label: string;
    value: number;
}

export function StatList({ stats, className = '' }: { stats: Stat[]; className?: string }) {
    if (stats.length === 0) return null;
    return (
        <dl className={`flex flex-wrap gap-x-10 gap-y-3 ${className}`.trim()}>
            {stats.map((stat) => (
                <div key={stat.label}>
                    <dt className="text-sm text-muted-foreground">{stat.label}</dt>
                    <dd className="text-2xl font-semibold tabular-nums">{stat.value.toLocaleString()}</dd>
                </div>
            ))}
        </dl>
    );
}
