import { Post, PostCategoryLink, PostTagLink } from '../ottaorm-models';
import {
    calculateReadingTime,
    createBlurbExcerpt,
    createBlurbTitle,
    createPhotoJournalExcerpt,
    validateBlurbText,
    validateCrossposts,
    validatePhotoJournalItems,
    validatePhotoJournalNote,
} from '../types';
import { createTermResolver } from './terms';
import type { BlogDemoPostSeed } from './types';

export interface BlogDemoSeedScope {
    appId: string;
    /** Rows are tagged with this organization, so they stay editable in the caller's admin */
    organizationId: string | null;
    /** The caller; authors every post whose author email does not resolve */
    userId: string | null;
    /** undefined in platform mode (one app-wide vocabulary); the organization in org mode */
    tenantOrganizationId?: string | null;
    /** A user id for a seed's author email, or null to fall back to the caller */
    authorIdFor?: (email: string) => Promise<string | null> | string | null;
}

export interface BlogDemoSeedResult {
    created: Array<{ id: string; slug: string; contentType: string }>;
    existing: string[];
    total: number;
}

const wordCount = (text: string) => text.split(/\s+/).filter(Boolean).length;

/** The columns a seed's content type fills, beside what every post shares */
function body(seed: BlogDemoPostSeed): Record<string, unknown> {
    if (seed.contentType === 'blurb') {
        const text = validateBlurbText(seed.blurbText);
        return {
            title: seed.title ?? createBlurbTitle(text),
            excerpt: seed.excerpt ?? createBlurbExcerpt(text),
            blurbText: text,
            crossposts: validateCrossposts(seed.crossposts ? [...seed.crossposts] : null),
            readingTimeMinutes: 1,
            wordCount: wordCount(text),
        };
    }
    if (seed.contentType === 'photo') {
        const items = validatePhotoJournalItems(seed.photoAlbum);
        const note = validatePhotoJournalNote(seed.photoNote);
        const lead = items[0]!;
        const spoken = [note, ...items.map((item) => item.caption), ...items.map((item) => item.location)];
        return {
            title: seed.title,
            excerpt: seed.excerpt ?? createPhotoJournalExcerpt(note, items),
            photoAlbum: items,
            photoNote: note,
            heroImage: seed.heroImage ?? {
                url: lead.url,
                alt: lead.alt || lead.caption || seed.title,
                caption: lead.caption || undefined,
            },
            readingTimeMinutes: 1,
            wordCount: wordCount(spoken.filter(Boolean).join(' ')),
        };
    }
    const reading = calculateReadingTime(seed.content);
    return {
        title: seed.title,
        excerpt: seed.excerpt,
        content: { ...seed.content, time: Date.now() },
        ...(seed.heroImage ? { heroImage: seed.heroImage } : {}),
        readingTimeMinutes: reading.minutes,
        wordCount: reading.words,
    };
}

/**
 * Publishes the seeds that do not exist yet, with their authors, dates and taxonomy. Create-only:
 * a slug already in the app is reported under `existing` and left untouched, so running a seed
 * again after someone edited the content is safe.
 */
export async function seedDemoPosts(
    seeds: readonly BlogDemoPostSeed[],
    scope: BlogDemoSeedScope,
): Promise<BlogDemoSeedResult> {
    const term = createTermResolver({ appId: scope.appId, tenantOrganizationId: scope.tenantOrganizationId });
    const authors = new Map<string, string | null>();
    const authorFor = async (email?: string) => {
        if (!email || !scope.authorIdFor) return scope.userId;
        if (!authors.has(email)) authors.set(email, await scope.authorIdFor(email));
        return authors.get(email) ?? scope.userId;
    };
    const result: BlogDemoSeedResult = { created: [], existing: [], total: seeds.length };

    for (const seed of seeds) {
        // The unique index that binds is (app_id, slug), so probe by that rather than by tenant:
        // a same-slug row owned by another tenant would otherwise turn into a constraint failure.
        const where = { slug: seed.slug, appId: scope.appId };
        if (await Post.first(where)) {
            result.existing.push(seed.slug);
            continue;
        }

        const authorId = await authorFor(seed.authorEmail);
        const publishedAt = (seed.publishedAt ? new Date(seed.publishedAt) : new Date()).toISOString();
        const seriesId = seed.series
            ? await term('series', seed.series.title, {
                  ...(seed.series.description ? { description: seed.series.description } : {}),
                  ...(seed.series.coverImage ? { coverImage: seed.series.coverImage } : {}),
              })
            : undefined;

        let post: Post;
        try {
            post = await Post.create({
                slug: seed.slug,
                contentType: seed.contentType,
                status: 'published',
                isFeatured: seed.isFeatured ?? false,
                allowComments: seed.allowComments ?? true,
                ...(seed.seoMeta ? { seoMeta: seed.seoMeta } : {}),
                ...(seriesId ? { seriesId, seriesOrder: seed.series!.order } : {}),
                ...body(seed),
                publishedAt,
                postedAt: publishedAt,
                userId: authorId,
                authorId,
                appId: scope.appId,
                organizationId: scope.organizationId,
            });
        } catch (error) {
            // A concurrent seed may win after the probe. Only a uniqueness conflict is benign.
            const message = error instanceof Error ? error.message : String(error);
            if (!/unique|constraint|duplicate/i.test(message) || !(await Post.first(where))) throw error;
            result.existing.push(seed.slug);
            continue;
        }

        const postId = post.get('id') as string;
        // Sets of ids: "JS" and "js" are one term, and the link tables are unique per pair
        const tagIds = new Set<string>();
        for (const name of seed.tags ?? []) tagIds.add(await term('tag', name));
        for (const tagId of tagIds) await PostTagLink.create({ postId, tagId });
        const categoryIds = new Set<string>();
        for (const name of seed.categories ?? []) categoryIds.add(await term('category', name));
        for (const categoryId of categoryIds) await PostCategoryLink.create({ postId, categoryId });
        result.created.push({ id: postId, slug: seed.slug, contentType: seed.contentType });
    }

    return result;
}
