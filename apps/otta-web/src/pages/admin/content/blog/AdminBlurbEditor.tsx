import { cleanCrossposts, CrosspostsField, crosspostsKey } from '@/components/editor/CrosspostsField';
import { UnsavedChangesDialog } from '@/components/editor/UnsavedChangesDialog';
import { useEditorLeaveGuard } from '@/hooks/useEditorLeaveGuard';
import { useSession } from '@/lib/auth';
import {
    BLURB_MAX_LENGTH,
    createBlurbTitle,
    POST_STATUSES,
    type PostCrosspost,
    type PostStatus,
} from '@ottabase/ottablog';
import { BlurbRenderer } from '@ottabase/ottablog/renderer';
import { createModelHooks, useApiMutation } from '@ottabase/ottaorm/client';
import { OttaSelect, type OttaSelectItem } from '@ottabase/ottaselect';
import { ConfirmDialog } from '@ottabase/ui-components';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Input,
    Label,
    NativeSelect,
    NativeSelectOption,
    Textarea,
} from '@ottabase/ui-shadcn';
import { Link, useNavigate } from '@tanstack/react-router';
import { ArrowLeft, Loader2, Save, Send, Tag, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { blogPostHooks, blogTagHooks } from '@/hooks/blogHooks';
import { useBlogSurface } from './blogAdminPaths';

export interface BlurbEditorPost {
    id: string;
    title: string;
    slug: string;
    blurbText: string | null;
    crossposts: PostCrosspost[] | null;
    excerpt: string | null;
    status: PostStatus;
    allowComments: boolean;
    publishAt: number | null;
    publishedAt: number | null;
    createdAt: number;
    authorId: string | null;
    author?: { id: string; name: string | null; image: string | null } | null;
}

interface BlurbPayload {
    text: string;
    crossposts: PostCrosspost[];
    status: PostStatus;
    allowComments: boolean;
    publishAt: number | null;
}

interface BlurbTag {
    id: string;
    name: string;
}

interface BlurbTagLink {
    id: string;
    postId: string;
    tagId: string;
}

const blogTagLinkHooks = createModelHooks<BlurbTagLink>({ entityName: 'post_tag_links' });

export function AdminBlurbEditor({ initialData }: { initialData?: BlurbEditorPost }) {
    const surface = useBlogSurface();
    const navigate = useNavigate();
    const { user } = useSession();
    const isEditMode = Boolean(initialData);
    const [text, setText] = useState(initialData?.blurbText ?? initialData?.excerpt ?? '');
    const [crossposts, setCrossposts] = useState<PostCrosspost[]>(initialData?.crossposts ?? []);
    const [status, setStatus] = useState<PostStatus>(initialData?.status ?? 'draft');
    const [allowComments, setAllowComments] = useState(initialData?.allowComments ?? true);
    const [publishAt, setPublishAt] = useState(
        initialData?.publishAt ? new Date(initialData.publishAt).toISOString().slice(0, 16) : '',
    );
    const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [alert, setAlert] = useState<{ open: boolean; title: string; message: string }>({
        open: false,
        title: '',
        message: '',
    });
    const [pendingSavedPostId, setPendingSavedPostId] = useState<string | null>(null);

    const createBlurb = useApiMutation<BlurbEditorPost, BlurbPayload>({
        endpoint: '/api/blog/blurbs',
        method: 'POST',
        invalidateEntities: ['posts'],
    });
    const updateBlurb = useApiMutation<BlurbEditorPost, BlurbPayload & { id: string }>({
        endpoint: (variables) => `/api/blog/blurbs/${encodeURIComponent(variables.id)}`,
        method: 'PATCH',
        invalidateEntities: ['posts'],
    });
    const deletePost = blogPostHooks.useDelete();
    const { data: allTagsData } = blogTagHooks.useList(undefined, { staleTime: 30_000 });
    const allTags = useMemo<BlurbTag[]>(() => {
        if (Array.isArray(allTagsData)) return allTagsData;
        return (allTagsData as { data?: BlurbTag[] } | undefined)?.data ?? [];
    }, [allTagsData]);
    const selectedTagItems = useMemo<OttaSelectItem[]>(
        () =>
            selectedTagIds
                .map((id) => allTags.find((tag) => tag.id === id))
                .filter(Boolean)
                .map((tag) => ({ id: tag!.id, name: tag!.name })),
        [allTags, selectedTagIds],
    );
    const { data: tagLinksData, refetch: refetchTagLinks } = blogTagLinkHooks.useList(
        { where: initialData ? { postId: initialData.id } : undefined },
        { enabled: Boolean(initialData), staleTime: 30_000 },
    );
    const tagLinks = useMemo<BlurbTagLink[]>(() => {
        if (!initialData) return [];
        if (Array.isArray(tagLinksData)) return tagLinksData;
        return (tagLinksData as { data?: BlurbTagLink[] } | undefined)?.data ?? [];
    }, [initialData, tagLinksData]);
    const createTagLink = blogTagLinkHooks.useCreate();
    const deleteTagLink = blogTagLinkHooks.useDelete();

    useEffect(() => {
        if (initialData && tagLinksData !== undefined) setSelectedTagIds(tagLinks.map((link) => link.tagId));
    }, [initialData, tagLinks, tagLinksData]);
    const isSaving = createBlurb.isPending || updateBlurb.isPending;

    const crosspostsJson = crosspostsKey(crossposts);
    const isDirty = useMemo(() => {
        if (!initialData) return text.trim().length > 0 || crosspostsJson !== '[]' || selectedTagIds.length > 0;
        return (
            text !== (initialData.blurbText ?? initialData.excerpt ?? '') ||
            crosspostsJson !== crosspostsKey(initialData.crossposts) ||
            status !== initialData.status ||
            allowComments !== initialData.allowComments ||
            publishAt !== (initialData.publishAt ? new Date(initialData.publishAt).toISOString().slice(0, 16) : '') ||
            JSON.stringify([...selectedTagIds].sort()) !== JSON.stringify(tagLinks.map((link) => link.tagId).sort())
        );
    }, [allowComments, crosspostsJson, initialData, publishAt, selectedTagIds, status, tagLinks, text]);
    const { blocker, allowNavigateRef } = useEditorLeaveGuard(isDirty);

    const handleSave = async (publishNow: boolean) => {
        const normalized = text.trim();
        if (!normalized || normalized.length > BLURB_MAX_LENGTH) {
            setAlert({
                open: true,
                title: 'Check your blurb',
                message: `Write between 1 and ${BLURB_MAX_LENGTH} characters.`,
            });
            return;
        }

        const resolvedStatus = publishNow ? 'published' : status;
        const publishAtValue = publishAt ? new Date(publishAt).getTime() : null;
        if (resolvedStatus === 'scheduled' && !publishAtValue) {
            setAlert({ open: true, title: 'Publish date required', message: 'Choose when this blurb should go live.' });
            return;
        }

        const payload: BlurbPayload = {
            text: normalized,
            // An empty list clears the links; the server rejects anything that is not a real URL.
            crossposts: cleanCrossposts(crossposts),
            status: resolvedStatus,
            allowComments,
            publishAt: resolvedStatus === 'scheduled' ? publishAtValue : null,
        };

        try {
            const saved = initialData
                ? await updateBlurb.mutateAsync({ id: initialData.id, ...payload })
                : await createBlurb.mutateAsync(payload);
            const existingTagIds = tagLinks.map((link) => link.tagId);
            const toAdd = selectedTagIds.filter((id) => !existingTagIds.includes(id));
            const toRemove = tagLinks.filter((link) => !selectedTagIds.includes(link.tagId));
            // Same split as the photo journal editor: the blurb write is the one that must not be
            // repeated, so a failing tag link no longer reports the whole save as failed and invites
            // a retry that creates a second blurb. See AdminPhotoJournalEditor for the full reasoning.
            const tagFailures = (
                await Promise.allSettled([
                    ...toAdd.map((tagId) => createTagLink.mutateAsync({ postId: saved.id, tagId })),
                    ...toRemove.map((link) => deleteTagLink.mutateAsync(link.id)),
                ])
            ).filter((result) => result.status === 'rejected').length;
            if (initialData) await refetchTagLinks();

            if (tagFailures > 0) {
                if (!initialData) setPendingSavedPostId(saved.id);
                setAlert({
                    open: true,
                    title: 'Saved, but the tags did not all stick',
                    message: `The blurb was saved. ${tagFailures} tag ${tagFailures === 1 ? 'change' : 'changes'} could not be applied — check the tags below and save again.`,
                });
                return;
            }
            allowNavigateRef.current = true;
            navigate({ to: surface.contentPath });
        } catch (error) {
            setAlert({
                open: true,
                title: 'Could not save blurb',
                message: error instanceof Error ? error.message : 'Please try again.',
            });
        }
    };

    const dismissAlert = () => {
        setAlert((current) => ({ ...current, open: false }));
        if (!pendingSavedPostId) return;
        const savedPostId = pendingSavedPostId;
        setPendingSavedPostId(null);
        allowNavigateRef.current = true;
        navigate({ to: surface.editPath(savedPostId) });
    };

    const handleDelete = async () => {
        if (!initialData) return;
        try {
            await deletePost.mutateAsync(initialData.id);
            allowNavigateRef.current = true;
            navigate({ to: surface.contentPath });
        } catch (error) {
            setAlert({
                open: true,
                title: 'Could not delete blurb',
                message: error instanceof Error ? error.message : 'Please try again.',
            });
        } finally {
            setDeleteOpen(false);
        }
    };

    const previewText = text.trim();

    return (
        <div className="space-y-6 pb-16">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" asChild>
                        <Link to={surface.contentPath}>
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                            {isEditMode ? 'Edit blurb' : 'New blurb'}
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Share something without writing an article.
                        </p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => void handleSave(false)} disabled={isSaving || !isDirty}>
                        {isSaving ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Save className="mr-2 h-4 w-4" />
                        )}
                        Save
                    </Button>
                    <Button onClick={() => void handleSave(true)} disabled={isSaving || !previewText}>
                        {isSaving ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Send className="mr-2 h-4 w-4" />
                        )}
                        Publish
                    </Button>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                <div className="space-y-6 lg:col-span-2">
                    <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                        <CardHeader>
                            <CardTitle className="text-[0.9375rem] font-semibold">Thought</CardTitle>
                            <CardDescription>Plain text with line breaks and safe clickable links.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Textarea
                                autoFocus
                                value={text}
                                onChange={(event) => setText(event.target.value)}
                                placeholder="Watched xyz movie today. It left me thinking about..."
                                rows={10}
                                maxLength={BLURB_MAX_LENGTH + 1}
                                className="resize-y bg-background text-lg leading-relaxed"
                            />
                            <p
                                className={`mt-2 text-right text-xs tabular-nums ${text.length > BLURB_MAX_LENGTH ? 'text-destructive' : 'text-muted-foreground'}`}
                            >
                                {text.length}/{BLURB_MAX_LENGTH}
                            </p>
                        </CardContent>
                    </Card>

                    <CrosspostsField value={crossposts} onChange={setCrossposts} noun="thought" />

                    {previewText && (
                        <section aria-labelledby="blurb-preview-title">
                            <h2
                                id="blurb-preview-title"
                                className="mb-3 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground"
                            >
                                Preview
                            </h2>
                            <BlurbRenderer
                                variant="timeline"
                                disableHooks
                                post={{
                                    id: initialData?.id ?? 'preview',
                                    title: createBlurbTitle(previewText),
                                    slug: initialData?.slug ?? 'preview',
                                    blurbText: previewText,
                                    crossposts: cleanCrossposts(crossposts),
                                    excerpt: previewText,
                                    contentType: 'blurb',
                                    status,
                                    authorId: initialData?.authorId ?? user?.id ?? null,
                                    author:
                                        initialData?.author ??
                                        (user
                                            ? { id: user.id, name: user.name ?? null, image: user.image ?? null }
                                            : null),
                                    publishedAt: initialData?.publishedAt ?? Date.now(),
                                }}
                            />
                        </section>
                    )}
                </div>

                <div className="space-y-6">
                    <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                        <CardHeader>
                            <CardTitle className="text-[0.9375rem] font-semibold">Publishing</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="blurbStatus">Status</Label>
                                <NativeSelect
                                    id="blurbStatus"
                                    value={status}
                                    onChange={(event) => setStatus(event.target.value as PostStatus)}
                                    wrapperClassName="w-full"
                                >
                                    {Object.entries(POST_STATUSES).map(([value, option]) => (
                                        <NativeSelectOption key={value} value={value}>
                                            {option.label}
                                        </NativeSelectOption>
                                    ))}
                                </NativeSelect>
                            </div>
                            {status === 'scheduled' && (
                                <div className="space-y-2">
                                    <Label htmlFor="blurbPublishAt">Publish at</Label>
                                    <Input
                                        id="blurbPublishAt"
                                        type="datetime-local"
                                        value={publishAt}
                                        onChange={(event) => setPublishAt(event.target.value)}
                                    />
                                </div>
                            )}
                            <label className="flex items-center gap-2 text-sm font-medium">
                                <input
                                    type="checkbox"
                                    checked={allowComments}
                                    onChange={(event) => setAllowComments(event.target.checked)}
                                    className="rounded"
                                />
                                Allow comments
                            </label>
                        </CardContent>
                    </Card>

                    <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-[0.9375rem] font-semibold">
                                <Tag className="h-4 w-4 text-muted-foreground" />
                                Tags
                            </CardTitle>
                            <CardDescription>Optional topics for discovery and tag archives.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <OttaSelect
                                mode="multiple"
                                items={allTags}
                                value={selectedTagItems}
                                onChange={(value) => {
                                    const items = (value as OttaSelectItem[]) ?? [];
                                    setSelectedTagIds(items.map((item) => item.id));
                                }}
                                searchable
                                clearable
                                showChips
                                placeholder="Select tags..."
                                emptyMessage="No tags found"
                            />
                        </CardContent>
                    </Card>

                    {initialData && (
                        <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                            <CardHeader>
                                <CardTitle className="text-[0.9375rem] font-semibold text-destructive">
                                    Danger zone
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Button variant="destructive" className="w-full" onClick={() => setDeleteOpen(true)}>
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete blurb
                                </Button>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>

            <ConfirmDialog
                open={deleteOpen}
                title="Delete this blurb?"
                description="This cannot be undone."
                primaryActionText="Delete"
                secondaryActionText="Cancel"
                onConfirm={() => void handleDelete()}
                onCancel={() => setDeleteOpen(false)}
            />
            <UnsavedChangesDialog blocker={blocker} />
            <AlertDialog open={alert.open} onOpenChange={(open) => !open && dismissAlert()}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{alert.title}</AlertDialogTitle>
                        <AlertDialogDescription>{alert.message}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction>OK</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
