/**
 * Locked (invite-only) categories: what readers without access see, and who has access.
 *
 * Categories are locked from the Categories screen. Access is the `insider` role (permission
 * posts:read_locked) granted in this blog's scope, so it is one level above being signed in.
 */
import type { LockedTeaserField } from '@ottabase/ottablog';
import { useApiMutation, useApiQuery } from '@ottabase/ottaorm/client';
import {
    Avatar,
    AvatarFallback,
    AvatarImage,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Checkbox,
    Input,
    Label,
} from '@ottabase/ui';
import { Link } from '@tanstack/react-router';
import { Loader2, Lock, UserPlus, X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useBlogSurface } from './blogAdminPaths';

const ACCESS_ENTITY = 'blog_access' as const;

interface BlogAccessState {
    lockedTeaser: LockedTeaserField[];
    lockedCategories: { id: string; name: string; slug: string; inherited: boolean }[];
    readers: { id: string; name: string | null; email: string; image: string | null }[];
}

const OPTIONAL_TEASER_FIELDS: { field: LockedTeaserField; label: string }[] = [
    { field: 'excerpt', label: 'Excerpt' },
    { field: 'heroImage', label: 'Hero image' },
];

export function BlogLockedAccessCard() {
    const surface = useBlogSurface();
    const { data, isLoading } = useApiQuery<BlogAccessState>({
        entity: ACCESS_ENTITY,
        queryKey: ['state'],
        endpoint: '/api/blog/studio/access',
    });
    const [teaser, setTeaser] = useState<LockedTeaserField[]>([]);
    const [email, setEmail] = useState('');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (data) setTeaser(data.lockedTeaser);
    }, [data]);

    const mutationOptions = {
        onSuccess: () => setError(null),
        onError: (err: Error) => setError(err.message || 'Something went wrong. Please try again.'),
    };
    const saveTeaser = useApiMutation<BlogAccessState, { lockedTeaser: LockedTeaserField[] }>({
        endpoint: '/api/blog/studio/access',
        method: 'POST',
        invalidateEntities: [ACCESS_ENTITY, 'posts'],
        mutationOptions,
    });
    const invite = useApiMutation<BlogAccessState, { email: string }>({
        endpoint: '/api/blog/studio/access/readers',
        method: 'POST',
        invalidateEntities: [ACCESS_ENTITY],
        mutationOptions: {
            ...mutationOptions,
            onSuccess: () => {
                setError(null);
                setEmail('');
            },
        },
    });
    const revoke = useApiMutation<BlogAccessState, string>({
        endpoint: (userId) => `/api/blog/studio/access/readers/${encodeURIComponent(userId)}`,
        method: 'DELETE',
        invalidateEntities: [ACCESS_ENTITY],
        mutationOptions,
    });

    const showTeaser = teaser.includes('title');
    const toggle = (field: LockedTeaserField, on: boolean) =>
        setTeaser((current) => (on ? [...new Set([...current, field])] : current.filter((item) => item !== field)));
    const teaserChanged = data ? [...teaser].sort().join() !== [...data.lockedTeaser].sort().join() : false;

    const submitInvite = (event: FormEvent) => {
        event.preventDefault();
        if (email.trim()) invite.mutate({ email: email.trim() });
    };

    return (
        <Card className="rounded-2xl border-transparent bg-muted/40 shadow-none">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                    <Lock className="h-4 w-4" />
                    Locked categories
                </CardTitle>
                <CardDescription>
                    Posts in a locked category (and its child categories) are readable only by invited readers. Lock a
                    category from{' '}
                    <Link to={surface.categoriesPath} className="underline underline-offset-2 hover:text-foreground">
                        Categories
                    </Link>
                    .
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {isLoading || !data ? (
                    <div className="h-24 animate-pulse rounded-xl bg-background/60" aria-busy="true" />
                ) : (
                    <>
                        <p className="text-sm text-muted-foreground">
                            {data.lockedCategories.length === 0
                                ? 'No category is locked yet.'
                                : 'Locked: ' +
                                  data.lockedCategories
                                      .map((category) => category.name + (category.inherited ? ' (via parent)' : ''))
                                      .join(', ')}
                        </p>

                        <section className="space-y-3">
                            <h3 className="text-sm font-medium">What everyone else sees</h3>
                            <div className="flex items-center gap-2">
                                <Checkbox
                                    id="locked-teaser-title"
                                    checked={showTeaser}
                                    onCheckedChange={(checked) => setTeaser(checked === true ? ['title'] : [])}
                                />
                                <Label htmlFor="locked-teaser-title" className="cursor-pointer text-sm">
                                    List locked posts with their title, as a teaser to request access
                                </Label>
                            </div>
                            <div className="flex flex-wrap gap-x-6 gap-y-2 pl-6">
                                {OPTIONAL_TEASER_FIELDS.map(({ field, label }) => (
                                    <div key={field} className="flex items-center gap-2">
                                        <Checkbox
                                            id={`locked-teaser-${field}`}
                                            checked={teaser.includes(field)}
                                            disabled={!showTeaser}
                                            onCheckedChange={(checked) => toggle(field, checked === true)}
                                        />
                                        <Label
                                            htmlFor={`locked-teaser-${field}`}
                                            className={`text-sm ${showTeaser ? 'cursor-pointer' : 'text-muted-foreground'}`}
                                        >
                                            {label}
                                        </Label>
                                    </div>
                                ))}
                            </div>
                            <p className="text-xs leading-relaxed text-muted-foreground">
                                {showTeaser
                                    ? 'The body, tags and comments stay private. Thoughts (blurbs) are never teased, since their text is the post.'
                                    : 'Locked posts and categories are hidden from everyone without access: lists, search, feeds and the sitemap.'}
                            </p>
                            <div className="flex justify-end">
                                <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => saveTeaser.mutate({ lockedTeaser: teaser })}
                                    disabled={!teaserChanged || saveTeaser.isPending}
                                >
                                    {saveTeaser.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Save
                                </Button>
                            </div>
                        </section>

                        <section className="space-y-3">
                            <h3 className="text-sm font-medium">Invited readers</h3>
                            <form onSubmit={submitInvite} className="flex gap-2">
                                <Input
                                    type="email"
                                    aria-label="Reader email"
                                    placeholder="Email of an existing account"
                                    value={email}
                                    onChange={(event) => setEmail(event.target.value)}
                                    className="h-9 bg-background"
                                />
                                <Button type="submit" size="sm" disabled={!email.trim() || invite.isPending}>
                                    {invite.isPending ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <UserPlus className="mr-2 h-4 w-4" />
                                    )}
                                    Invite
                                </Button>
                            </form>
                            {data.readers.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                    No invited readers yet. Readers sign up first, then you invite their email. Admins
                                    and editors can always read locked posts.
                                </p>
                            ) : (
                                <ul className="divide-y divide-border/60 overflow-hidden rounded-xl bg-background ring-1 ring-border/60">
                                    {data.readers.map((reader) => (
                                        <li key={reader.id} className="flex items-center gap-3 px-3 py-2">
                                            <Avatar className="h-7 w-7">
                                                <AvatarImage src={reader.image || undefined} />
                                                <AvatarFallback className="text-[0.6875rem]">
                                                    {(reader.name || reader.email).slice(0, 2).toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-medium">
                                                    {reader.name || reader.email}
                                                </p>
                                                {reader.name && (
                                                    <p className="truncate text-xs text-muted-foreground">
                                                        {reader.email}
                                                    </p>
                                                )}
                                            </div>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                aria-label={`Remove access for ${reader.name || reader.email}`}
                                                disabled={revoke.isPending}
                                                onClick={() => revoke.mutate(reader.id)}
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>
                    </>
                )}
                {error && (
                    <p className="text-sm text-destructive" role="alert">
                        {error}
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
