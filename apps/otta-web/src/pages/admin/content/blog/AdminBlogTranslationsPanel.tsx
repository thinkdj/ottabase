import {
    type BlogLanguageConfig,
    type ContentType,
    type HeroImage,
    type PhotoJournalItem,
    type PostStatus,
    type SeoMeta,
} from '@ottabase/ottablog';
import { useOttaEditor, type OutputData } from '@ottabase/ottaeditor';
import { useApiMutation, useApiQuery } from '@ottabase/ottaorm/client';
import {
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
import { Languages, Loader2, Save, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

interface BasePost {
    id: string;
    language: string;
    title: string;
    slug: string;
    excerpt: string | null;
    content: OutputData | null;
    contentType: ContentType;
    blurbText?: string | null;
    photoNote?: string | null;
    photoAlbum?: PhotoJournalItem[] | null;
    heroImage?: HeroImage | null;
    seoMeta?: SeoMeta | null;
    footnotes?: OutputData | null;
    status: PostStatus;
}

interface Translation {
    id: string;
    postId: string;
    language: string;
    title: string;
    slug: string;
    excerpt: string | null;
    content: OutputData | null;
    blurbText: string | null;
    photoNote: string | null;
    status: PostStatus;
    publishAt: number | null;
    publishedAt: number | null;
    updatedAt: number;
}

interface TranslationResponse {
    baseLanguage: string;
    languageConfig: BlogLanguageConfig;
    translations: Translation[];
}

interface Props {
    postId: string;
    basePost: BasePost;
}

function TranslationEditor({
    postId,
    basePost,
    language,
    existing,
    onSaved,
    onDeleted,
}: {
    postId: string;
    basePost: BasePost;
    language: string;
    existing?: Translation;
    onSaved: () => void;
    onDeleted: () => void;
}) {
    const languageName = existing?.language || language;
    const [title, setTitle] = useState(existing?.title ?? basePost.title);
    const [slug, setSlug] = useState(existing?.slug ?? `${basePost.slug}-${language.toLowerCase()}`);
    const [excerpt, setExcerpt] = useState(existing?.excerpt ?? basePost.excerpt ?? '');
    const [status, setStatus] = useState<PostStatus>(existing?.status ?? 'draft');
    const [publishAt, setPublishAt] = useState(
        existing?.publishAt ? new Date(existing.publishAt).toISOString().slice(0, 16) : '',
    );
    const [blurbText, setBlurbText] = useState(existing?.blurbText ?? basePost.blurbText ?? '');
    const [photoNote, setPhotoNote] = useState(existing?.photoNote ?? basePost.photoNote ?? '');
    const [error, setError] = useState<string | null>(null);
    const editor = useOttaEditor({
        defaultPlugins: 'all',
        placeholder: `Translate “${basePost.title}”…`,
        minHeight: 300,
        data: existing?.content ?? basePost.content ?? undefined,
    });
    const saveMutation = useApiMutation<Translation, Record<string, unknown>>({
        endpoint: existing
            ? `/api/blog/posts/${postId}/translations/${encodeURIComponent(language)}`
            : `/api/blog/posts/${postId}/translations`,
        method: existing ? 'PATCH' : 'POST',
        invalidateEntities: ['blog_translations'],
    });
    const deleteMutation = useApiMutation<unknown, Record<string, never>>({
        endpoint: `/api/blog/posts/${postId}/translations/${encodeURIComponent(language)}`,
        method: 'DELETE',
        invalidateEntities: ['blog_translations'],
    });

    useEffect(() => {
        setTitle(existing?.title ?? basePost.title);
        setSlug(existing?.slug ?? `${basePost.slug}-${language.toLowerCase()}`);
        setExcerpt(existing?.excerpt ?? basePost.excerpt ?? '');
        setStatus(existing?.status ?? 'draft');
        setPublishAt(existing?.publishAt ? new Date(existing.publishAt).toISOString().slice(0, 16) : '');
        setBlurbText(existing?.blurbText ?? basePost.blurbText ?? '');
        setPhotoNote(existing?.photoNote ?? basePost.photoNote ?? '');
    }, [existing, basePost, language]);

    const save = async () => {
        setError(null);
        try {
            const content = await editor.save();
            await saveMutation.mutateAsync({
                title,
                slug,
                excerpt: excerpt || null,
                content,
                status,
                publishAt: publishAt || null,
                blurbText: blurbText || null,
                photoNote: photoNote || null,
            });
            onSaved();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Could not save this translation.');
        }
    };
    const remove = async () => {
        if (!existing || !window.confirm(`Delete the ${languageName} translation?`)) return;
        setError(null);
        try {
            await deleteMutation.mutateAsync({});
            onDeleted();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Could not delete this translation.');
        }
    };

    return (
        <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
            <CardHeader>
                <CardTitle className="text-base">
                    {existing ? `Edit ${languageName} translation` : `Add ${languageName} translation`}
                </CardTitle>
                <CardDescription>
                    The canonical post remains in the main editor. This translation has its own title, slug, excerpt,
                    body, status, and schedule.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                        <Label htmlFor="translation-title">Title</Label>
                        <Input
                            id="translation-title"
                            value={title}
                            onChange={(event) => setTitle(event.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="translation-slug">URL slug</Label>
                        <Input id="translation-slug" value={slug} onChange={(event) => setSlug(event.target.value)} />
                        <p className="text-xs text-muted-foreground">Use letters, numbers, hyphens, or underscores.</p>
                    </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                        <Label htmlFor="translation-status">Status</Label>
                        <NativeSelect
                            id="translation-status"
                            value={status}
                            onChange={(event) => setStatus(event.target.value as PostStatus)}
                        >
                            <NativeSelectOption value="draft">Draft</NativeSelectOption>
                            <NativeSelectOption value="published">Published</NativeSelectOption>
                            <NativeSelectOption value="scheduled">Scheduled</NativeSelectOption>
                            <NativeSelectOption value="archived">Archived</NativeSelectOption>
                        </NativeSelect>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="translation-publish-at">Publish at (for scheduled)</Label>
                        <Input
                            id="translation-publish-at"
                            type="datetime-local"
                            value={publishAt}
                            onChange={(event) => setPublishAt(event.target.value)}
                        />
                    </div>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="translation-excerpt">Excerpt</Label>
                    <Textarea
                        id="translation-excerpt"
                        value={excerpt}
                        onChange={(event) => setExcerpt(event.target.value)}
                        rows={3}
                    />
                </div>
                {(basePost.contentType === 'blurb' || basePost.blurbText) && (
                    <div className="space-y-2">
                        <Label htmlFor="translation-blurb">Blurb text</Label>
                        <Textarea
                            id="translation-blurb"
                            value={blurbText}
                            onChange={(event) => setBlurbText(event.target.value)}
                            rows={3}
                        />
                    </div>
                )}
                {(basePost.contentType === 'photo' || basePost.photoNote) && (
                    <div className="space-y-2">
                        <Label htmlFor="translation-photo-note">Photo note</Label>
                        <Textarea
                            id="translation-photo-note"
                            value={photoNote}
                            onChange={(event) => setPhotoNote(event.target.value)}
                            rows={3}
                        />
                    </div>
                )}
                <div className="space-y-2">
                    <Label>Translated body</Label>
                    <div
                        ref={editor.editorRef}
                        className="min-h-[300px] rounded-lg border bg-background p-4 prose prose-slate dark:prose-invert max-w-none"
                    />
                </div>
                {error && (
                    <p className="text-sm text-destructive" role="alert">
                        {error}
                    </p>
                )}
                <div className="flex flex-wrap justify-end gap-2">
                    <Button
                        type="button"
                        variant="ghost"
                        className="mr-auto text-destructive"
                        onClick={remove}
                        disabled={!existing || deleteMutation.isPending}
                    >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete translation
                    </Button>
                    <Button type="button" onClick={save} disabled={saveMutation.isPending || !title.trim()}>
                        <Save className="mr-2 h-4 w-4" />
                        {saveMutation.isPending ? 'Saving…' : 'Save translation'}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

export function AdminBlogTranslationsPanel({ postId, basePost }: Props) {
    const { data, isLoading, isError, refetch } = useApiQuery<TranslationResponse>({
        entity: 'blog_translations',
        queryKey: [postId],
        endpoint: `/api/blog/posts/${postId}/translations`,
    });
    const [language, setLanguage] = useState<string | null>(null);
    const languages = useMemo(
        () =>
            (data?.languageConfig.supportedLanguages ?? []).filter(
                (item) => item.code !== (data?.baseLanguage ?? basePost.language),
            ),
        [data, basePost.language],
    );
    const existing = data?.translations.find((item) => item.language === language);
    useEffect(() => {
        if (!language && languages[0]) setLanguage(languages[0].code);
        if (language && !languages.some((item) => item.code === language)) setLanguage(languages[0]?.code ?? null);
    }, [language, languages]);
    if (isLoading)
        return (
            <Card className="mt-6 rounded-xl border-transparent bg-muted/40 shadow-none">
                <CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading translations…
                </CardContent>
            </Card>
        );
    if (isError)
        return (
            <Card className="mt-6 rounded-xl border-destructive/40 bg-destructive/10 shadow-none">
                <CardContent className="p-6 text-sm text-destructive">
                    Translations could not be loaded. Refresh the page and try again.
                </CardContent>
            </Card>
        );
    if (!languages.length)
        return (
            <Card className="mt-6 rounded-xl border-transparent bg-muted/40 shadow-none">
                <CardContent className="p-6 text-sm text-muted-foreground">
                    No additional languages are enabled yet. Add languages in Content Studio.
                </CardContent>
            </Card>
        );
    return (
        <div className="mt-6 space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h2 className="flex items-center gap-2 text-lg font-semibold">
                        <Languages className="h-5 w-5" />
                        Translations
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Create independent localized versions. Unpublished translations fall back to the canonical post
                        when fallback is enabled.
                    </p>
                </div>
                <div className="min-w-52 space-y-2">
                    <Label htmlFor="translation-language">Language</Label>
                    <NativeSelect
                        id="translation-language"
                        value={language ?? ''}
                        onChange={(event) => setLanguage(event.target.value)}
                    >
                        {languages.map((item) => (
                            <NativeSelectOption key={item.code} value={item.code}>
                                {item.name} ({item.code})
                            </NativeSelectOption>
                        ))}
                    </NativeSelect>
                </div>
            </div>
            {language && (
                <TranslationEditor
                    key={language + (existing?.id ?? 'new')}
                    postId={postId}
                    basePost={basePost}
                    language={language}
                    existing={existing}
                    onSaved={() => void refetch()}
                    onDeleted={() => void refetch()}
                />
            )}
        </div>
    );
}
