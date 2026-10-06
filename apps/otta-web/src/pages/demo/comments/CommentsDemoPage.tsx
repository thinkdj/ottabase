/**
 * Demo page for @ottabase/comments: the shared CommentThread over an in-memory engine,
 * or over the real database through useCommentThread.
 */
import { useCommentThread, type CommentType } from '@/hooks/commentHooks';
import { useSession } from '@/lib/auth';
import { DEFAULT_REACTIONS } from '@ottabase/comments';
import { CommentThread, type CommentModeration } from '@ottabase/comments/react';
import { Card, CardContent, Label, Switch } from '@ottabase/ui-shadcn';
import { IconDatabase } from '@tabler/icons-react';
import { useCallback, useState } from 'react';
import { DemoPageHeader } from '../DemoPageHeader';

const TARGET = { targetType: 'demo', targetId: 'comments-demo-page' };
const ME = 'user-alice';
const USERS: Record<string, { name: string; image: null }> = {
    'user-alice': { name: 'Alice Martin', image: null },
    'user-bob': { name: 'Bob Chen', image: null },
    'user-carol': { name: 'Carol Diaz', image: null },
};
const hour = 3600_000;

function mock(id: string, body: string, userId: string, extra: Partial<CommentType> = {}): CommentType {
    const createdAt = Date.now() - 6 * hour;
    return {
        id,
        body,
        ...TARGET,
        parentId: null,
        userId,
        status: 'active',
        depth: extra.parentId ? 1 : 0,
        appId: null,
        organizationId: null,
        createdAt,
        updatedAt: createdAt,
        reactions: {},
        _user: { id: userId, ...USERS[userId] },
        ...extra,
    } as CommentType;
}

const SEED: CommentType[] = [
    mock('c1', 'Polymorphic targets are the right call. One table, any entity.', 'user-bob', {
        reactions: { '👍': ['user-alice', 'user-carol'], '❤️': ['user-carol'] },
        createdAt: Date.now() - 2 * 24 * hour,
    }),
    mock('c2', 'Agreed. How deep can replies go?', 'user-carol', { parentId: 'c1', createdAt: Date.now() - 30 * hour }),
    mock('c3', 'Three levels by default, the host decides.', 'user-alice', {
        parentId: 'c1',
        depth: 1,
        createdAt: Date.now() - 20 * hour,
    }),
    mock('c4', 'This one was removed by its author.', 'user-bob', {
        status: 'deleted',
        body: '[deleted]',
        createdAt: Date.now() - 10 * hour,
    }),
    mock('c5', 'Replies stay put even when the parent goes.', 'user-carol', {
        parentId: 'c4',
        createdAt: Date.now() - 9 * hour,
    }),
    mock('c6', 'Looking forward to the next post.', 'user-bob', { createdAt: Date.now() - 2 * hour }),
];

/** Local state standing in for the API, with the same moves the server makes */
function InMemoryDemo() {
    const [comments, setComments] = useState<CommentType[]>(SEED);
    const [moderator, setModerator] = useState(false);
    const update = useCallback(
        (id: string, patch: Partial<CommentType>) =>
            setComments((list) => list.map((c) => (c.id === id ? { ...c, ...patch, updatedAt: Date.now() } : c))),
        [],
    );

    const post = async (body: string, parentId: string | null) => {
        const parent = parentId ? comments.find((c) => c.id === parentId) : null;
        setComments((list) => [
            ...list,
            mock(`c${Date.now()}`, body, ME, {
                parentId,
                depth: parent ? (parent.depth ?? 0) + 1 : 0,
                createdAt: Date.now(),
            }),
        ]);
    };
    const react = (id: string, emoji: string) => {
        const comment = comments.find((c) => c.id === id);
        if (!comment) return;
        const reactions = { ...(comment.reactions ?? {}) };
        const users = reactions[emoji] ?? [];
        reactions[emoji] = users.includes(ME) ? users.filter((u) => u !== ME) : [...users, ME];
        if (reactions[emoji].length === 0) delete reactions[emoji];
        update(id, { reactions });
    };
    const moderate = (id: string, action: CommentModeration) =>
        update(
            id,
            action === 'delete'
                ? { status: 'deleted', body: '[deleted]', reactions: {} }
                : { status: action === 'hide' ? 'hidden' : 'active' },
        );

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                <Switch id="moderator" checked={moderator} onCheckedChange={setModerator} />
                <Label htmlFor="moderator">Act as a moderator</Label>
            </div>
            <CommentThread
                comments={comments}
                currentUserId={ME}
                canModerate={moderator}
                reactions={DEFAULT_REACTIONS}
                onPost={post}
                onEdit={async (id, body) => update(id, { body })}
                onReact={react}
                onReport={(id) => update(id, { status: 'flagged' })}
                onModerate={moderate}
            />
        </div>
    );
}

/** The real thing: the thread hook over /api/ottaorm/comments */
function DatabaseDemo() {
    const { user } = useSession();
    const thread = useCommentThread(TARGET);
    return (
        <CommentThread
            comments={thread.comments}
            currentUserId={user?.id ?? null}
            canModerate={user?.platformAdmin === true}
            isLoading={thread.isLoading}
            error={thread.error}
            busy={thread.busy}
            signInPrompt={
                <p className="rounded-xl bg-muted/40 p-4 text-sm text-muted-foreground">
                    Sign in to join the discussion.
                </p>
            }
            onPost={thread.post}
            onEdit={thread.edit}
            onReact={thread.react}
            onReport={thread.report}
            onModerate={thread.moderate}
        />
    );
}

const FEATURES = [
    {
        title: 'Polymorphic targeting',
        desc: 'Attach comments to any entity type (post, product, video) without schema changes.',
    },
    {
        title: 'Threaded replies',
        desc: 'Nesting tracked by parentId and depth, with replies kept under removed parents.',
    },
    { title: 'Emoji reactions', desc: 'Per user toggles, stored as rows, aggregated into the GET response.' },
    { title: 'Reports and moderation', desc: 'Anyone signed in can report; moderators hide, restore and delete.' },
    {
        title: 'One component',
        desc: 'CommentThread from @ottabase/comments/react renders the blog, this demo, anything.',
    },
    { title: 'RLS aware', desc: 'Tenant and ownership rules enforced in the worker and the ORM.' },
];

export function CommentsDemoPage() {
    const [mode, setMode] = useState<'memory' | 'database'>('memory');
    const { user } = useSession();
    const tab = (active: boolean) =>
        `inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-sm font-medium transition-colors ${
            active ? 'bg-background text-foreground ring-1 ring-border' : 'text-muted-foreground hover:text-foreground'
        }`;

    return (
        <div className="flex flex-col gap-8">
            <DemoPageHeader
                title="Comments"
                description={
                    <>
                        Threaded comments with reactions, reports and moderation via{' '}
                        <code className="rounded bg-muted px-1 py-0.5 text-xs">@ottabase/comments</code>.
                    </>
                }
            />

            <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">Data source:</span>
                <div className="inline-flex rounded-lg bg-muted/40 p-0.5">
                    <button type="button" onClick={() => setMode('memory')} className={tab(mode === 'memory')}>
                        In-memory
                    </button>
                    <button type="button" onClick={() => setMode('database')} className={tab(mode === 'database')}>
                        <IconDatabase size={14} />
                        Database
                    </button>
                </div>
                <span className="text-xs text-muted-foreground">
                    {mode === 'memory' ? 'Local state with seeded data' : 'Reads and writes the real D1 table'}
                </span>
            </div>

            <section>
                {mode === 'memory' ? (
                    <InMemoryDemo />
                ) : user ? (
                    <DatabaseDemo />
                ) : (
                    <p className="rounded-xl bg-muted/40 p-4 text-sm text-muted-foreground">
                        Sign in to read and write the real comments table.
                    </p>
                )}
            </section>

            <section className="flex flex-col gap-4">
                <h2 className="text-[0.9375rem] font-semibold">Use it</h2>
                <Card>
                    <CardContent className="p-0">
                        <pre className="overflow-x-auto rounded-xl p-4 text-xs leading-relaxed">
                            {`import { CommentThread } from '@ottabase/comments/react';
import { useCommentThread } from '@/hooks/commentHooks';

const thread = useCommentThread({ targetType: 'post', targetId: post.id });

<CommentThread
    comments={thread.comments}
    currentUserId={user?.id ?? null}
    canModerate={isModerator}
    onPost={thread.post}
    onEdit={thread.edit}
    onReact={thread.react}
    onReport={thread.report}
    onModerate={thread.moderate}
/>`}
                        </pre>
                    </CardContent>
                </Card>
            </section>

            <section className="flex flex-col gap-4">
                <h2 className="text-[0.9375rem] font-semibold">What you get</h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {FEATURES.map((f) => (
                        <Card key={f.title} className="flex flex-col gap-1 p-4">
                            <h3 className="text-sm font-semibold">{f.title}</h3>
                            <p className="text-xs text-muted-foreground">{f.desc}</p>
                        </Card>
                    ))}
                </div>
            </section>
        </div>
    );
}
