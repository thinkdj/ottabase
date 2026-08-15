import { redactErrorForLog } from '@ottabase/utils/http-errors';
import React, { useEffect, useMemo, useState } from 'react';
import { applyFilters, HOOKS } from '../hooks';
import { defaultTheme, getActiveTheme, getTheme } from '../themes';
import type { PhotoJournalItem } from '../types';
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

    const filteredPost = { ...post, photoAlbum: photos };
    const filteredProps = { ...props, post: filteredPost };
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
