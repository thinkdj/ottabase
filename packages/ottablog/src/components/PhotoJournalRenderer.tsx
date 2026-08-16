import { redactErrorForLog } from '@ottabase/utils/http-errors';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { applyFilters, doAction, HOOKS } from '../hooks';
import { defaultTheme, getActiveTheme, getTheme } from '../themes';
import type { EditorJSData, PhotoJournalItem } from '../types';
import type { PhotoJournalRendererProps } from './blog-renderer-types';
import { BlurbTextLinksAllowed } from './BlurbText';
import { CrosspostsRow } from './Crossposts';
import { PhotoJournalGallery } from './PhotoJournalGallery';

/** Theme-aware controller for photo journals. */
export function PhotoJournalRenderer({
    post,
    variant = 'detail',
    themeId,
    disableHooks = false,
    ...rest
}: PhotoJournalRendererProps) {
    const theme = useMemo(() => (themeId ? getTheme(themeId) : null) ?? getActiveTheme() ?? defaultTheme, [themeId]);
    const [photos, setPhotos] = useState<PhotoJournalItem[]>(post.photoAlbum ?? []);
    // A journal body is article content in every way that matters to a plugin, so it runs the same
    // `post.content.filter` an article body does. Without this, anything that transforms or
    // instruments article bodies would silently skip journals.
    // Stamped with the post it was filtered FOR. A bare boolean would still read "complete" for one
    // render after switching posts, letting the next journal open its lifecycle with the previous
    // journal's body.
    const [filteredBody, setFilteredBody] = useState<{ postId: string; content: EditorJSData | null } | null>(null);
    const props: PhotoJournalRendererProps = { post, variant, themeId, disableHooks, ...rest };

    useEffect(() => {
        let active = true;
        if (disableHooks) {
            setPhotos(post.photoAlbum ?? []);
            return () => {
                active = false;
            };
        }
        void Promise.resolve(applyFilters(HOOKS['post.photoJournal.filter'], post.photoAlbum ?? [], post))
            .then((value: PhotoJournalItem[]) => {
                if (active) setPhotos(Array.isArray(value) ? value : []);
            })
            .catch((error: unknown) => {
                console.error('Error in post.photoJournal.filter:', redactErrorForLog(error));
                if (active) setPhotos(post.photoAlbum ?? []);
            });
        return () => {
            active = false;
        };
    }, [disableHooks, post]);

    /*
     * The content lifecycle belongs to the DETAIL view only.
     *
     * A timeline card renders the collage and never the body, so filtering content there would run
     * plugin work whose result is thrown away. There is no double-firing risk on detail:
     * BlogRenderer returns a PhotoJournalRenderer for photo posts instead of ArticleBlogRenderer, so
     * the article path and its content actions are never mounted on the same page.
     */
    const runsContentLifecycle = variant === 'detail' && !disableHooks;

    useEffect(() => {
        if (!runsContentLifecycle) return;
        let active = true;
        void Promise.resolve(applyFilters(HOOKS['post.content.filter'], post.content ?? null, post))
            .then((value: EditorJSData | null) => {
                if (active) setFilteredBody({ postId: post.id, content: value ?? null });
            })
            .catch((error: unknown) => {
                console.error('Error in post.content.filter:', redactErrorForLog(error));
                if (active) setFilteredBody({ postId: post.id, content: post.content ?? null });
            });
        return () => {
            active = false;
        };
    }, [runsContentLifecycle, post]);

    // Only a body filtered for THIS post counts. Between switching posts and the new filter
    // resolving there is no body, rather than the previous journal's.
    const bodyIsForThisPost = filteredBody?.postId === post.id;
    const contentReady = runsContentLifecycle ? bodyIsForThisPost : true;
    const filteredContent = runsContentLifecycle
        ? bodyIsForThisPost
            ? (filteredBody?.content ?? null)
            : null
        : (post.content ?? null);

    const filteredPost = { ...post, photoAlbum: photos, content: filteredContent };
    const filteredProps = { ...props, post: filteredPost };

    /*
     * Side effects only, and only once filtering has settled, so a plugin observing the body sees
     * the same content the page renders rather than the raw column.
     *
     * The payload goes through a ref rather than the dependency array on purpose. `filteredPost`
     * and `filteredProps` are fresh object literals on every render, so depending on them would
     * tear down and re-run the pair on any parent rerender: a plugin would see `after` then
     * `before` again for a post that never changed. What should actually re-fire the lifecycle is
     * the post identity or the filtered body changing, and those are what the deps name.
     *
     * The effect SNAPSHOTS that ref when it opens. Rendering the next journal moves the ref before
     * the previous journal's cleanup runs, so reading it there would close journal A's lifecycle by
     * handing the plugin journal B.
     */
    const lifecyclePayload = useRef({ post: filteredPost, props: filteredProps });
    lifecyclePayload.current = { post: filteredPost, props: filteredProps };

    useEffect(() => {
        if (!runsContentLifecycle || !contentReady) return;
        const opened = lifecyclePayload.current;
        doAction(HOOKS['post.content.before'], opened.post, opened.props);
        return () => {
            doAction(HOOKS['post.content.after'], opened.post, opened.props);
        };
    }, [runsContentLifecycle, contentReady, post.id, filteredContent]);

    const renderer = theme.renderers.renderPhotoJournal ?? defaultTheme.renderers.renderPhotoJournal;
    let rendered: React.ReactNode;
    try {
        rendered = renderer ? (
            renderer(filteredPost, filteredProps)
        ) : (
            <PhotoJournalGallery post={filteredPost} props={filteredProps} />
        );
    } catch (error) {
        console.error('Error in theme renderPhotoJournal:', redactErrorForLog(error));
        rendered = <PhotoJournalGallery post={filteredPost} props={filteredProps} />;
    }

    /*
     * The album is the opener; an optional rich body carries the story under it, alternating
     * prose with its own image and media-gallery blocks. It goes through the theme's own
     * renderContent so a journal body is typeset exactly like an article body, and it is
     * detail-only: a timeline card shows the collage, never the essay.
     */
    let body: React.ReactNode = null;
    if (variant === 'detail' && filteredPost.content?.blocks?.length) {
        const renderContent = theme.renderers.renderContent ?? defaultTheme.renderers.renderContent;
        try {
            body = renderContent?.(filteredPost, filteredProps) ?? null;
        } catch (error) {
            console.error('Error in theme renderContent:', redactErrorForLog(error));
        }
    }

    return (
        // The field note renders through BlurbText, and timeline cards are wrapped in a link by
        // the caller — see BlurbTextLinksAllowed.
        <BlurbTextLinksAllowed.Provider value={variant !== 'timeline'}>
            <article
                className={`blog-photo-journal blog-photo-journal--${variant} ${theme.config?.classes?.photoJournal ?? ''} ${rest.className ?? ''}`.trim()}
            >
                {rendered}
                {body && <div className="mx-auto mt-12 max-w-3xl sm:mt-16">{body}</div>}
                {/* Same row every content type gets; renders nothing when there are no links. */}
                <CrosspostsRow post={filteredPost} className="mx-auto mt-8 max-w-3xl" />
            </article>
        </BlurbTextLinksAllowed.Provider>
    );
}
