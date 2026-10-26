/**
 * Locked (invite-only) categories: what readers without access see, the blog's audiences (named
 * groups of readers), and which audiences open each locked category. A reader opens a locked
 * category when one of their audiences is given it or a parent category; the blog's staff
 * (posts:read_locked: owners, admins, editors) read everything. Categories are locked from the
 * Categories screen. The server is the gate; this is the control.
 */
import { organizationIdAtom } from '@/ottabase/state/appState';
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
    ConfirmDialog,
    Input,
    Label,
} from '@ottabase/ui';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Check, Loader2, Lock, Pencil, Plus, Trash2, UserPlus, X } from 'lucide-react';
import { useAtomValue } from 'jotai';
import { useEffect, useState, type FormEvent } from 'react';
import { useBlogSurface } from './blogAdminPaths';

const ACCESS_ENTITY = 'blog_access' as const;

interface AccessMember {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
}

interface AccessAudience {
    id: string;
    name: string;
    members: AccessMember[];
}

interface BlogAccessState {
    lockedTeaser: LockedTeaserField[];
    lockedCategories: { id: string; name: string; slug: string; inherited: boolean; audienceIds: string[] }[];
    audiences: AccessAudience[];
}

const OPTIONAL_TEASER_FIELDS: { field: LockedTeaserField; label: string }[] = [
    { field: 'excerpt', label: 'Excerpt' },
    { field: 'heroImage', label: 'Hero image' },
];

const enc = encodeURIComponent;

export function BlogLockedAccessCard() {
    const surface = useBlogSurface();
    const queryClient = useQueryClient();
    // The active organization's blog, or the site blog in Platform scope.
    const organizationId = useAtomValue(organizationIdAtom);
    const queryKey = ['state', organizationId];
    const { data, isLoading } = useApiQuery<BlogAccessState>({
        entity: ACCESS_ENTITY,
        queryKey,
        endpoint: '/api/blog/studio/access',
    });
    const [teaser, setTeaser] = useState<LockedTeaserField[]>([]);
    const [audienceName, setAudienceName] = useState('');
    const [deleting, setDeleting] = useState<AccessAudience | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (data) setTeaser(data.lockedTeaser);
    }, [data]);

    // Every access change answers with the whole access state: show it as is, no refetch.
    const mutationOptions = {
        onSuccess: (state: BlogAccessState) => {
            setError(null);
            queryClient.setQueryData([ACCESS_ENTITY, ...queryKey], state);
        },
        onError: (err: Error) => setError(err.message || 'Something went wrong. Please try again.'),
    };
    const saveTeaser = useApiMutation<BlogAccessState, { lockedTeaser: LockedTeaserField[] }>({
        endpoint: '/api/blog/studio/access',
        method: 'POST',
        // Public lists show teasers differently now.
        invalidateEntities: ['posts'],
        mutationOptions,
    });
    const createAudience = useApiMutation<BlogAccessState, { name: string }>({
        endpoint: '/api/blog/studio/audiences',
        method: 'POST',
        mutationOptions,
    });
    const renameAudience = useApiMutation<BlogAccessState, { id: string; name: string }>({
        endpoint: ({ id }) => `/api/blog/studio/audiences/${enc(id)}`,
        method: 'PATCH',
        mutationOptions,
    });
    const deleteAudience = useApiMutation<BlogAccessState, string>({
        endpoint: (id) => `/api/blog/studio/audiences/${enc(id)}`,
        method: 'DELETE',
        mutationOptions,
    });
    const addMember = useApiMutation<BlogAccessState, { audienceId: string; email: string }>({
        endpoint: ({ audienceId }) => `/api/blog/studio/audiences/${enc(audienceId)}/members`,
        method: 'POST',
        mutationOptions,
    });
    const removeMember = useApiMutation<BlogAccessState, { audienceId: string; userId: string }>({
        endpoint: ({ audienceId, userId }) => `/api/blog/studio/audiences/${enc(audienceId)}/members/${enc(userId)}`,
        method: 'DELETE',
        mutationOptions,
    });
    const giveCategory = useApiMutation<BlogAccessState, { categoryId: string; audienceIds: string[] }>({
        endpoint: ({ categoryId }) => `/api/blog/studio/categories/${enc(categoryId)}/audiences`,
        method: 'PUT',
        mutationOptions,
    });

    const showTeaser = teaser.includes('title');
    const toggle = (field: LockedTeaserField, on: boolean) =>
        setTeaser((current) => (on ? [...new Set([...current, field])] : current.filter((item) => item !== field)));
    const teaserChanged = data ? [...teaser].sort().join() !== [...data.lockedTeaser].sort().join() : false;

    const submitAudience = (event: FormEvent) => {
        event.preventDefault();
        const name = audienceName.trim();
        if (name) createAudience.mutate({ name }, { onSuccess: () => setAudienceName('') });
    };

    return (
        <Card className="rounded-2xl border-transparent bg-muted/40 shadow-none">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                    <Lock className="h-4 w-4" />
                    Locked categories
                </CardTitle>
                <CardDescription>
                    Posts in a locked category (and its child categories) are readable only by the audiences you give
                    it, and by the blog&apos;s owners, admins and editors. Lock a category from{' '}
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
                            <div>
                                <h3 className="text-sm font-medium">Audiences</h3>
                                <p className="text-xs leading-relaxed text-muted-foreground">
                                    Groups of readers, such as Family or Close friends. Readers sign up first, then you
                                    add their email. One reader can be in several audiences.
                                </p>
                            </div>
                            <form onSubmit={submitAudience} className="flex gap-2">
                                <Input
                                    aria-label="New audience name"
                                    placeholder="New audience, e.g. Family"
                                    maxLength={60}
                                    value={audienceName}
                                    onChange={(event) => setAudienceName(event.target.value)}
                                    className="h-9 bg-background"
                                />
                                <Button
                                    type="submit"
                                    size="sm"
                                    disabled={!audienceName.trim() || createAudience.isPending}
                                >
                                    {createAudience.isPending ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <Plus className="mr-2 h-4 w-4" />
                                    )}
                                    Add
                                </Button>
                            </form>
                            {data.audiences.map((audience) => (
                                <AudienceBlock
                                    key={audience.id}
                                    audience={audience}
                                    busy={addMember.isPending || removeMember.isPending || renameAudience.isPending}
                                    onRename={(name, done) =>
                                        renameAudience.mutate({ id: audience.id, name }, { onSuccess: done })
                                    }
                                    onDelete={() => setDeleting(audience)}
                                    onAddMember={(email, done) =>
                                        addMember.mutate({ audienceId: audience.id, email }, { onSuccess: done })
                                    }
                                    onRemoveMember={(userId) =>
                                        removeMember.mutate({ audienceId: audience.id, userId })
                                    }
                                />
                            ))}
                        </section>

                        <section className="space-y-3">
                            <h3 className="text-sm font-medium">Who reads each locked category</h3>
                            {data.lockedCategories.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No category is locked yet.</p>
                            ) : data.audiences.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                    Add an audience above, then choose the locked categories it reads.
                                </p>
                            ) : (
                                <ul className="divide-y divide-border/60 overflow-hidden rounded-xl bg-background ring-1 ring-border/60">
                                    {data.lockedCategories.map((category) => (
                                        <li key={category.id} className="space-y-2 px-3 py-2.5">
                                            <p className="text-sm font-medium">
                                                {category.name}
                                                {category.inherited && (
                                                    <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                                                        (locked by its parent, whose audiences also read it)
                                                    </span>
                                                )}
                                            </p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {data.audiences.map((audience) => {
                                                    const given = category.audienceIds.includes(audience.id);
                                                    return (
                                                        <button
                                                            key={audience.id}
                                                            type="button"
                                                            aria-pressed={given}
                                                            disabled={giveCategory.isPending}
                                                            onClick={() =>
                                                                giveCategory.mutate({
                                                                    categoryId: category.id,
                                                                    audienceIds: given
                                                                        ? category.audienceIds.filter(
                                                                              (id) => id !== audience.id,
                                                                          )
                                                                        : [...category.audienceIds, audience.id],
                                                                })
                                                            }
                                                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ring-1 transition-colors disabled:opacity-60 ${
                                                                given
                                                                    ? 'bg-primary text-primary-foreground ring-primary'
                                                                    : 'text-muted-foreground ring-border hover:text-foreground'
                                                            }`}
                                                        >
                                                            {given && <Check className="h-3 w-3" />}
                                                            {audience.name}
                                                        </button>
                                                    );
                                                })}
                                            </div>
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
            <ConfirmDialog
                open={deleting !== null}
                onOpenChange={(open) => !open && setDeleting(null)}
                title="Delete audience"
                description={`Delete "${deleting?.name}"? Its readers lose the locked categories it gives them, unless another of their audiences gives them too.`}
                tone="destructive"
                secondaryActionText="Cancel"
                primaryActionText="Delete"
                onConfirm={() => {
                    if (deleting) deleteAudience.mutate(deleting.id);
                    setDeleting(null);
                }}
            />
        </Card>
    );
}

function AudienceBlock({
    audience,
    busy,
    onRename,
    onDelete,
    onAddMember,
    onRemoveMember,
}: {
    audience: AccessAudience;
    busy: boolean;
    onRename: (name: string, done: () => void) => void;
    onDelete: () => void;
    onAddMember: (email: string, done: () => void) => void;
    onRemoveMember: (userId: string) => void;
}) {
    const [email, setEmail] = useState('');
    const [name, setName] = useState<string | null>(null);

    const submitMember = (event: FormEvent) => {
        event.preventDefault();
        if (email.trim()) onAddMember(email.trim(), () => setEmail(''));
    };
    const submitName = (event: FormEvent) => {
        event.preventDefault();
        if (name?.trim()) onRename(name.trim(), () => setName(null));
    };

    return (
        <div className="space-y-2 rounded-xl bg-background p-3 ring-1 ring-border/60">
            {name === null ? (
                <div className="flex items-center gap-2">
                    <p className="min-w-0 flex-1 truncate text-sm font-medium">
                        {audience.name}
                        <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                            {audience.members.length === 1 ? '1 reader' : `${audience.members.length} readers`}
                        </span>
                    </p>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground"
                        aria-label={`Rename ${audience.name}`}
                        onClick={() => setName(audience.name)}
                    >
                        <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        aria-label={`Delete ${audience.name}`}
                        onClick={onDelete}
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                </div>
            ) : (
                <form onSubmit={submitName} className="flex gap-2">
                    <Input
                        aria-label="Audience name"
                        maxLength={60}
                        value={name}
                        autoFocus
                        onChange={(event) => setName(event.target.value)}
                        onKeyDown={(event) => event.key === 'Escape' && setName(null)}
                        className="h-8"
                    />
                    <Button type="submit" size="sm" disabled={!name.trim() || busy}>
                        Save
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setName(null)}>
                        Cancel
                    </Button>
                </form>
            )}
            {audience.members.length > 0 && (
                <ul className="divide-y divide-border/60">
                    {audience.members.map((member) => (
                        <li key={member.id} className="flex items-center gap-3 py-1.5">
                            <Avatar className="h-7 w-7">
                                <AvatarImage src={member.image || undefined} />
                                <AvatarFallback className="text-[0.6875rem]">
                                    {(member.name || member.email).slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm">{member.name || member.email}</p>
                                {member.name && (
                                    <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                                )}
                            </div>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                aria-label={`Remove ${member.name || member.email} from ${audience.name}`}
                                disabled={busy}
                                onClick={() => onRemoveMember(member.id)}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </li>
                    ))}
                </ul>
            )}
            <form onSubmit={submitMember} className="flex gap-2">
                <Input
                    type="email"
                    aria-label={`Reader email for ${audience.name}`}
                    placeholder="Email of an existing account"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="h-8"
                />
                <Button type="submit" size="sm" variant="secondary" disabled={!email.trim() || busy}>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Add
                </Button>
            </form>
        </div>
    );
}
