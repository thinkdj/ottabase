/**
 * The data-display pieces of @ottabase/ui: Timeline, TreeView and Rating (AvatarGroup sits with
 * Avatar under Display & Media)
 * (VisuallyHidden labels the icon-only control in the Rating card).
 */
import {
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Rating,
    Timeline,
    TimelineDescription,
    TimelineHeader,
    TimelineItem,
    TimelineTime,
    TimelineTitle,
    TreeView,
    VisuallyHidden,
    type TreeNode,
} from '@ottabase/ui';
import { FileText, Folder, Lock, Palette, RotateCcw, Users } from 'lucide-react';
import { useState, type CSSProperties } from 'react';

/*
 * Custom Rating marks. A shape with no fill of its own takes the rating's treatment (a soft empty fill,
 * --rating-color when full); one drawn in currentColor follows the theme too; a fixed fill is kept.
 */

/** An SVG component: it only has to pass `className` on to its <svg>. */
function SpiceDrop({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
            <path
                d="M12 2.5c-3.7 5-6.2 8.4-6.2 11.6a6.2 6.2 0 0 0 12.4 0c0-3.2-2.5-6.6-6.2-11.6Z"
                stroke="currentColor"
                strokeLinejoin="round"
            />
        </svg>
    );
}

/** SVG elements, and a separate dashed mark for the empty part. */
const HEX_PATH = 'M12 2.6 20.2 7.3v9.4L12 21.4l-8.2-4.7V7.3Z';
const HEX_SOLID = (
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d={HEX_PATH} />
    </svg>
);
const HEX_DASHED = (
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d={HEX_PATH} fill="none" stroke="currentColor" strokeDasharray="2.6 2.2" strokeLinejoin="round" />
    </svg>
);

const ADMIN_TREE: TreeNode[] = [
    {
        id: 'content',
        label: 'Content',
        icon: <Folder />,
        children: [
            {
                id: 'blog',
                label: 'Blog',
                icon: <Folder />,
                children: [
                    { id: 'posts', label: 'Posts', icon: <FileText /> },
                    { id: 'series', label: 'Series', icon: <FileText /> },
                ],
            },
            { id: 'landing', label: 'Landing pages', icon: <FileText /> },
        ],
    },
    {
        id: 'access',
        label: 'Access',
        icon: <Users />,
        children: [
            { id: 'users', label: 'Users', icon: <FileText /> },
            { id: 'roles', label: 'Roles and permissions', icon: <FileText /> },
        ],
    },
    { id: 'appearance', label: 'Appearance', icon: <Palette /> },
    { id: 'billing', label: 'Billing (Pro)', icon: <Lock />, disabled: true },
];

export function DataDisplaySection() {
    const [selected, setSelected] = useState<string | null>('posts');
    const [rating, setRating] = useState(4);
    const [halfRating, setHalfRating] = useState(3.5);
    const [spice, setSpice] = useState(2.5);
    const [effort, setEffort] = useState(1.5);

    return (
        <section className="space-y-4">
            <h2 className="text-2xl font-semibold">Data Display</h2>

            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Timeline</CardTitle>
                        <CardDescription>
                            Events on a rail, newest first. Only an event that needs someone earns a tone.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Timeline aria-label="Recent events">
                            <TimelineItem tone="red">
                                <TimelineHeader>
                                    <TimelineTitle className="font-mono text-[12.5px]">job.failed</TimelineTitle>
                                    <TimelineTime dateTime="2026-10-24T09:41:00Z">09:41 UTC</TimelineTime>
                                </TimelineHeader>
                                <TimelineDescription>
                                    email.send failed 3 times and moved to the dead-letter queue
                                </TimelineDescription>
                            </TimelineItem>
                            <TimelineItem tone="amber">
                                <TimelineHeader>
                                    <TimelineTitle className="font-mono text-[12.5px]">license.grace</TimelineTitle>
                                    <TimelineTime dateTime="2026-10-24T06:00:00Z">06:00 UTC</TimelineTime>
                                </TimelineHeader>
                                <TimelineDescription>Tower pro is in its 14-day grace period</TimelineDescription>
                            </TimelineItem>
                            <TimelineItem>
                                <TimelineHeader>
                                    <TimelineTitle className="font-mono text-[12.5px]">backup.created</TimelineTitle>
                                    <TimelineTime dateTime="2026-10-24T02:23:00Z">02:23 UTC</TimelineTime>
                                </TimelineHeader>
                                <TimelineDescription>31 tables, 9.1 MB to OBCF_R2</TimelineDescription>
                            </TimelineItem>
                        </Timeline>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>TreeView</CardTitle>
                        <CardDescription>
                            Arrows move and open, Enter selects, typing a letter jumps. Selected:{' '}
                            <code className="rounded bg-background px-1 ring-1 ring-border">{selected ?? 'none'}</code>
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <TreeView
                            aria-label="Admin sections"
                            items={ADMIN_TREE}
                            defaultExpanded={['content', 'blog']}
                            selected={selected}
                            onSelectedChange={setSelected}
                        />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Rating</CardTitle>
                        <CardDescription>
                            One slider: arrows step, Home clears, a digit jumps. <code>step=&#123;0.5&#125;</code> picks
                            the half under the pointer; read-only shows any fraction; the mark can be any SVG.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-x-4 gap-y-3.5 text-sm">
                        <span className="text-muted-foreground">Whole stars</span>
                        <div className="flex items-center gap-3">
                            <Rating aria-label="Your rating" value={rating} onValueChange={setRating} />
                            <span className="w-7 tabular-nums text-muted-foreground">{rating}</span>
                            <Button variant="ghost" size="icon-sm" onClick={() => setRating(0)}>
                                <RotateCcw />
                                <VisuallyHidden>Clear rating</VisuallyHidden>
                            </Button>
                        </div>

                        <span className="text-muted-foreground">Half stars</span>
                        <div className="flex items-center gap-3">
                            <Rating
                                aria-label="Half steps"
                                step={0.5}
                                value={halfRating}
                                onValueChange={setHalfRating}
                            />
                            <span className="w-7 tabular-nums text-muted-foreground">{halfRating}</span>
                        </div>

                        <span className="text-muted-foreground">Read-only</span>
                        <div className="flex items-center gap-2">
                            <Rating readOnly value={4.3} size="sm" aria-label="Average rating" />
                            <span className="font-semibold tabular-nums">4.3</span>
                            <span className="text-muted-foreground">· 128 reviews</span>
                        </div>

                        <span className="text-muted-foreground">SVG component</span>
                        <div className="flex items-center gap-3">
                            <Rating
                                aria-label="Spice level"
                                icon={SpiceDrop}
                                step={0.5}
                                value={spice}
                                onValueChange={setSpice}
                                getValueText={(value, max) => `${value} of ${max} chillies`}
                                style={{ '--rating-color': 'hsl(var(--destructive))' } as CSSProperties}
                            />
                            <span className="w-7 tabular-nums text-muted-foreground">{spice}</span>
                        </div>

                        <span className="text-muted-foreground">SVG element</span>
                        <div className="flex items-center gap-3">
                            <Rating
                                aria-label="Effort"
                                icon={HEX_SOLID}
                                emptyIcon={HEX_DASHED}
                                step={0.5}
                                value={effort}
                                onValueChange={setEffort}
                                size="lg"
                                getValueText={(value, max) => `${value} of ${max} points`}
                                style={{ '--rating-color': 'hsl(var(--primary))' } as CSSProperties}
                            />
                            <span className="w-7 tabular-nums text-muted-foreground">{effort}</span>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </section>
    );
}
